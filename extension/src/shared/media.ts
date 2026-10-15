import type { StreamKind } from './protocol';
import { fileExtension, filenameFromUrl } from './rules';

export type MediaKind = 'hls' | 'dash' | 'video' | 'audio' | 'segment';

export interface MediaClassification {
  kind: MediaKind;
  streamKind: StreamKind;
}

const HLS_MIMES = ['application/vnd.apple.mpegurl', 'application/x-mpegurl', 'audio/mpegurl', 'audio/x-mpegurl'];
const DASH_MIMES = ['application/dash+xml'];
const SEGMENT_MIMES = ['video/mp2t', 'video/iso.segment', 'audio/iso.segment'];
const GENERIC_MIMES = ['', 'application/octet-stream', 'binary/octet-stream', 'text/plain', 'application/binary', 'application/x-www-form-urlencoded'];

const VIDEO_EXTS = ['MP4', 'M4V', 'WEBM', 'MKV', 'MOV', 'FLV', 'AVI', 'OGV', '3GP', 'WMV'];
const AUDIO_EXTS = ['MP3', 'M4A', 'AAC', 'OGG', 'OGA', 'OPUS', 'FLAC', 'WAV', 'WMA'];
const SEGMENT_EXTS = ['TS', 'M4S', 'M4F', 'CMFV', 'CMFA'];

/** Media we don't list because the page is resolved by the app instead (YouTube's chunked streams). */
export function isIgnoredMediaUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname.endsWith('googlevideo.com') || u.protocol === 'blob:' || u.protocol === 'data:';
  } catch {
    return true;
  }
}

/** Classifies a response as media (or not) from its URL, Content-Type and resource type. */
export function classifyMedia(input: { url: string; contentType?: string; resourceType?: string }): MediaClassification | null {
  const mime = (input.contentType ?? '').split(';')[0]!.trim().toLowerCase();
  const ext = fileExtension(input.url);
  if (HLS_MIMES.includes(mime) || (ext === 'M3U8' && (GENERIC_MIMES.includes(mime) || mime.includes('mpegurl')))) {
    return { kind: 'hls', streamKind: 'hls' };
  }
  if (DASH_MIMES.includes(mime) || (ext === 'MPD' && (GENERIC_MIMES.includes(mime) || mime.endsWith('xml')))) {
    return { kind: 'dash', streamKind: 'dash' };
  }
  if (SEGMENT_MIMES.includes(mime) || SEGMENT_EXTS.includes(ext)) {
    if (mime.startsWith('text/html') || mime.startsWith('image/')) return null;
    return { kind: 'segment', streamKind: 'direct' };
  }
  if (mime.startsWith('video/')) return { kind: 'video', streamKind: 'direct' };
  if (mime.startsWith('audio/')) return { kind: 'audio', streamKind: 'direct' };
  if (GENERIC_MIMES.includes(mime) || (input.resourceType === 'media' && !mime.startsWith('text/'))) {
    if (VIDEO_EXTS.includes(ext)) return { kind: 'video', streamKind: 'direct' };
    if (AUDIO_EXTS.includes(ext)) return { kind: 'audio', streamKind: 'direct' };
  }
  return null;
}

/** Identity of a media resource: URL without fragment and byte-range style query params. */
export function mediaKey(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    for (const p of ['range', 'bytes', 'rn', 'rbuf', 'bytestart', 'byteend', '_']) u.searchParams.delete(p);
    return u.toString();
  } catch {
    return url;
  }
}

/** Total resource size from a response: Content-Range total for 206, else Content-Length. */
export function totalSize(status: number, contentLength?: string, contentRange?: string): number | undefined {
  if (status === 206 && contentRange) {
    const m = /\/(\d+)\s*$/.exec(contentRange);
    if (m) return Number(m[1]);
  }
  if (contentLength && /^\d+$/.test(contentLength.trim())) {
    const n = Number(contentLength);
    return n > 0 ? n : undefined;
  }
  return undefined;
}

/** Quality hint from a URL (`1080p`, `720`, `4k`, `hd`). */
export function qualityFromUrl(url: string): string | undefined {
  const s = decodeSafe(url);
  const p = /(?:^|[^0-9])(2160|1440|1080|720|540|480|360|240|144)p?(?:[^0-9]|$)/i.exec(s);
  if (p) return `${p[1]}p`;
  if (/(?:^|[^a-z])(4k|uhd)(?:[^a-z]|$)/i.test(s)) return '2160p';
  return undefined;
}

function decodeSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export function humanSize(n: number | undefined): string {
  if (!n || n <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

/** Display name for a media URL. */
export function mediaName(url: string, kind: MediaKind): string {
  const name = filenameFromUrl(url);
  if (name) return name.length > 80 ? `${name.slice(0, 77)}…` : name;
  return kind === 'hls' ? 'HLS stream' : kind === 'dash' ? 'DASH stream' : 'media';
}

/** Minimum size for progressive media to be listed (filters tracking pixels, tiny previews). */
export const MIN_DIRECT_MEDIA_BYTES = 64 * 1024;

export interface MediaItem {
  key: string;
  url: string;
  kind: MediaKind;
  streamKind: StreamKind;
  mime?: string;
  size?: number;
  name: string;
  quality?: string;
  /** Referer / Origin used by the player. */
  headers?: Record<string, string>;
  frameUrl?: string;
  ts: number;
}

/**
 * Adds a media item to a tab's list with de-duplication and segment pruning:
 * segments are dropped once a manifest is known (and not added afterwards).
 * Returns the new list and whether it changed.
 */
export function addMedia(list: MediaItem[], item: MediaItem, maxItems = 100): { list: MediaItem[]; changed: boolean } {
  const hasManifest = list.some((m) => m.kind === 'hls' || m.kind === 'dash');
  if (item.kind === 'segment' && hasManifest) return { list, changed: false };
  if (item.kind !== 'hls' && item.kind !== 'dash' && item.size !== undefined && item.size < MIN_DIRECT_MEDIA_BYTES) {
    return { list, changed: false };
  }
  const idx = list.findIndex((m) => m.key === item.key);
  if (idx >= 0) {
    const prev = list[idx]!;
    if ((item.size ?? 0) > (prev.size ?? 0)) {
      const next = list.slice();
      next[idx] = { ...prev, size: item.size };
      return { list: next, changed: true };
    }
    return { list, changed: false };
  }
  let next = list.concat(item);
  if (item.kind === 'hls' || item.kind === 'dash') next = next.filter((m) => m.kind !== 'segment');
  if (next.length > maxItems) next = next.slice(next.length - maxItems);
  return { list: next, changed: true };
}

/** Number of user-meaningful items (segments excluded). */
export function visibleMedia(list: MediaItem[]): MediaItem[] {
  return list.filter((m) => m.kind !== 'segment');
}
