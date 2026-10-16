/** Floating video button + popup media actions. */
import type { NativeError } from '../shared/correlator';
import { type ElementSource, type MediaItem, elementMedia, mediaLabel, visibleMedia } from '../shared/media';
import type { VideoOption, VideoOptionsResult } from '../shared/messages';
import type { VideoRequest, VideoStream } from '../shared/protocol';
import { siteMatches } from '../shared/rules';
import { actionTimeout, cookieHeaderFor, tabInfo, userAgent } from './context';
import { native } from './native';
import { getTabMedia } from './sniffer';
import { getState } from './state';

export function isVideoSite(url: string | undefined, sites: string[]): boolean {
  return !!url && sites.some((s) => siteMatches(url, s));
}

export function streamOf(m: MediaItem): VideoStream {
  return {
    url: m.url,
    kind: m.streamKind,
    ...(m.mime ? { mime: m.mime } : {}),
    ...(m.size ? { size: m.size } : {}),
    ...(m.quality ? { quality: m.quality } : {}),
    ...(m.headers ? { headers: m.headers } : {}),
  };
}

const rank = (m: MediaItem) => (m.kind === 'hls' || m.kind === 'dash' ? 0 : m.kind === 'video' ? 1 : 2);

function noticeFor(err: NativeError): string {
  switch (err.code) {
    case 'host_missing':
    case 'host_forbidden':
      return 'Browser integration is not installed — open Prism › Settings › Browser integration.';
    case 'app_not_running':
    case 'app_unreachable':
      return "Prism isn't running — showing streams found on this page.";
    case 'timeout':
      return 'Prism took too long to read this page — showing streams found on this page.';
    default:
      return `Prism couldn't read this page (${err.message}).`;
  }
}

export async function videoOptions(
  msg: { pageUrl: string; title: string; sources?: ElementSource[] },
  tab: chrome.tabs.Tab | undefined,
): Promise<VideoOptionsResult> {
  const st = await getState();
  let notice: string | undefined;
  if (isVideoSite(msg.pageUrl, st.settings.videoSites) || isVideoSite(tab?.url, st.settings.videoSites)) {
    const pageUrl = isVideoSite(msg.pageUrl, st.settings.videoSites) ? msg.pageUrl : tab!.url!;
    try {
      const reply = await native.request(
        { type: 'probeVideo', pageUrl, cookies: await cookieHeaderFor(pageUrl, !!tab?.incognito), userAgent: userAgent() },
        { timeoutMs: 60_000 },
      );
      const options: VideoOption[] = (reply.formats ?? []).map((f) => ({
        id: `fmt:${f.id}`,
        label: f.label,
        group: f.kind === 'audio' ? 'audio' : 'video',
        formatId: f.id,
        ...(f.note ? { detail: f.note } : {}),
      }));
      if (options.length) return { source: 'probe', ...(reply.title ? { title: reply.title } : {}), options };
      notice = 'Prism found no downloadable formats on this page.';
    } catch (e) {
      notice = noticeFor(e as NativeError);
    }
  }
  const media = tab?.id !== undefined ? visibleMedia(await getTabMedia(tab.id)) : [];
  // The hovered video first: on a feed the tab also holds other posts' and autoplaying ads'
  // streams, and the largest of those is rarely the one the user pointed at.
  const own = elementMedia(msg.sources ?? [], media, msg.pageUrl);
  const ownKeys = new Set(own.map((m) => m.key));
  const rest = media.filter((m) => !ownKeys.has(m.key)).sort((a, b) => rank(a) - rank(b) || (b.size ?? 0) - (a.size ?? 0));
  const option = (m: MediaItem, group: VideoOption['group']): VideoOption => ({ id: `s:${m.key}`, label: mediaLabel(m), detail: m.name, group, stream: streamOf(m) });
  const options = [...own.map((m) => option(m, 'element')), ...rest.map((m) => option(m, 'stream'))];
  return { source: 'sniffed', options, ...(notice ? { notice } : {}) };
}

export async function sendVideo(pageUrl: string, title: string, option: VideoOption, tab: chrome.tabs.Tab | undefined): Promise<void> {
  const incognito = !!tab?.incognito;
  const msg: VideoRequest = option.formatId
    ? {
        type: 'video',
        pageUrl,
        title,
        formatId: option.formatId,
        formatLabel: option.label,
        streams: [],
        cookies: await cookieHeaderFor(pageUrl, incognito),
        userAgent: userAgent(),
        incognito,
      }
    : {
        type: 'video',
        pageUrl,
        title,
        streams: option.stream ? [option.stream] : [],
        cookies: option.stream ? await cookieHeaderFor(option.stream.url, incognito) : '',
        userAgent: userAgent(),
        incognito,
      };
  const reply = await native.request(msg, { timeoutMs: actionTimeout() });
  if (reply.accepted === false) throw new Error('Prism declined the video');
}

/** Popup "Download" on a sniffed media item. */
export async function downloadMedia(tabId: number, key: string): Promise<void> {
  const tab = await tabInfo(tabId);
  const m = (await getTabMedia(tabId)).find((x) => x.key === key);
  if (!m) throw new Error('media item is gone (page navigated?)');
  await sendVideo(tab?.url ?? m.frameUrl ?? '', tab?.title ?? m.name, { id: `s:${m.key}`, label: mediaLabel(m), group: 'stream', stream: streamOf(m) }, tab);
}
