/** Context menu items. Created on install/startup, handled at top level. */
import { api } from '../shared/api';
import type { DownloadRequest } from '../shared/protocol';
import { filenameFromUrl, isHandoffUrl } from '../shared/rules';
import { showUnreachable } from './badge';
import { collectAndSend } from './collect';
import { actionTimeout, cookieHeaderFor, userAgent } from './context';
import { native } from './native';

type Ctx = chrome.contextMenus.ContextType;

const ITEMS: Array<{ id: string; title: string; contexts: Ctx[] }> = [
  { id: 'prism-link', title: 'Download with Prism', contexts: ['link', 'image', 'video', 'audio'] as Ctx[] },
  { id: 'prism-selection', title: 'Download selection links with Prism', contexts: ['selection'] as Ctx[] },
  { id: 'prism-all-links', title: 'Download all links with Prism', contexts: ['page', 'selection'] as Ctx[] },
  { id: 'prism-all-images', title: 'Download all images with Prism', contexts: ['page', 'image'] as Ctx[] },
  { id: 'prism-all-videos', title: 'Download all videos with Prism', contexts: ['page', 'video', 'audio'] as Ctx[] },
];

export async function createMenus(): Promise<void> {
  const menus = api.contextMenus;
  if (!menus) return;
  await menus.removeAll();
  for (const it of ITEMS) {
    menus.create({ id: it.id, title: it.title, contexts: it.contexts as [Ctx, ...Ctx[]] }, () => void api.runtime.lastError);
  }
}

export async function sendSingleLink(url: string, referrer: string | undefined, tab: chrome.tabs.Tab | undefined, source: DownloadRequest['source']): Promise<void> {
  const incognito = !!tab?.incognito;
  const filename = filenameFromUrl(url);
  const msg: DownloadRequest = {
    type: 'download',
    url,
    ...(referrer ? { referrer } : {}),
    ...(tab?.url ? { pageUrl: tab.url } : {}),
    ...(filename ? { filename } : {}),
    method: 'GET',
    cookies: await cookieHeaderFor(url, incognito),
    userAgent: userAgent(),
    incognito,
    source,
  };
  await native.request(msg, { timeoutMs: actionTimeout() });
}

export function initMenus(): void {
  api.contextMenus?.onClicked.addListener((info, tab) => {
    void (async () => {
      try {
        const tabId = tab?.id;
        switch (info.menuItemId) {
          case 'prism-link': {
            const url = info.linkUrl ?? info.srcUrl;
            if (url && isHandoffUrl(url)) await sendSingleLink(url, info.frameUrl ?? info.pageUrl, tab, 'contextMenu');
            break;
          }
          case 'prism-selection':
            if (tabId !== undefined) await collectAndSend(tabId, 'selection', info.frameId);
            break;
          case 'prism-all-links':
            if (tabId !== undefined) await collectAndSend(tabId, 'links');
            break;
          case 'prism-all-images':
            if (tabId !== undefined) await collectAndSend(tabId, 'images');
            break;
          case 'prism-all-videos':
            if (tabId !== undefined) await collectAndSend(tabId, 'videos');
            break;
        }
      } catch (e) {
        console.warn('[prism] context menu action failed', e);
        showUnreachable(true, (e as Error).message);
      }
    })();
  });
}
