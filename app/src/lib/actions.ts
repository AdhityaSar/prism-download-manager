// User-level actions shared by the toolbar, context menu, keyboard shortcuts and dialogs.

import { api } from "./api";
import { canPause, canResume, isTorrentLink } from "./present";
import { hexEncode } from "./route";
import { useApp } from "./store";
import type { Settings } from "./types";
import { attempt, toast, useUi } from "./ui";
import { copyText } from "./win";

const items = (ids: string[]) => ids.map((id) => useApp.getState().items[id]).filter(Boolean);

export const actions = {
  resume: (ids: string[]) => {
    const go = items(ids).filter((i) => canResume(i.status) || i.status === "queued").map((i) => i.id);
    if (go.length) void attempt(api.startItems(go), "Could not resume");
  },
  pause: (ids: string[]) => {
    const stop = items(ids).filter((i) => canPause(i.status)).map((i) => i.id);
    if (stop.length) void attempt(api.pauseItems(stop), "Could not pause");
  },
  toggle: (ids: string[]) => {
    const list = items(ids);
    if (list.some((i) => canPause(i.status))) actions.pause(ids);
    else actions.resume(ids);
  },
  pauseAll: () => void attempt(api.pauseAll(), "Could not stop downloads"),

  /** Delete honoring settings.general.confirmDelete; items in trash are deleted permanently. */
  requestDelete: (ids: string[], withFiles = false) => {
    if (!ids.length) return;
    const st = useApp.getState();
    const inTrash = st.view.kind === "trash";
    if (st.settings?.general.confirmDelete || withFiles || inTrash) {
      useUi.getState().openDialog({ kind: "delete", ids, trash: inTrash, withFiles });
      return;
    }
    void actions.delete(ids, false, !(st.settings?.general.useTrash ?? true));
  },
  delete: async (ids: string[], deleteFiles: boolean, permanent: boolean) => {
    await attempt(api.deleteItems(ids, deleteFiles, permanent), "Could not delete");
    useApp.getState().select([]);
  },
  restore: async (ids: string[]) => {
    const unfinished = items(ids).filter((i) => i.status !== "completed").length;
    try {
      await api.restoreItems(ids);
    } catch (e) {
      toast("Could not restore", { kind: "error", body: e instanceof Error ? e.message : String(e) });
      return;
    }
    toast(ids.length > 1 ? `${ids.length} downloads restored` : "Download restored", {
      kind: "success",
      body: unfinished ? "Press Resume to continue where it stopped." : undefined,
      ms: 3500,
    });
  },

  open: (id: string) => void attempt(api.openItem(id), "Could not open the file"),
  reveal: (id: string) => void attempt(api.revealItem(id), "Could not open the folder"),
  details: (id: string) => void attempt(api.openDetails(id), "Could not open details"),
  redownload: (id: string) => void attempt(api.redownload(id), "Could not restart the download"),
  copyLinks: async (ids: string[]) => {
    const urls = items(ids).map((i) => i.url);
    if (await copyText(urls.join("\n"))) toast(urls.length > 1 ? `${urls.length} links copied` : "Link copied", { kind: "success", ms: 2200 });
  },
  moveToQueue: (ids: string[], queueId: string | null) => void attempt(api.assignToQueue(ids, queueId), "Could not move to queue"),
  moveInQueue: (ids: string[], delta: number) => void attempt(api.moveInQueue(ids, delta), "Could not reorder"),

  /** Primary activation: open finished files, show details for everything else. */
  activate: (id: string) => {
    const it = useApp.getState().items[id];
    if (!it) return;
    if (it.status === "completed") actions.open(id);
    else actions.details(id);
  },

  addUrl: async (url: string) => {
    if (isTorrentLink(url)) {
      await attempt(api.openWindow("torrent", hexEncode(url.trim())), "Could not open the torrent");
      return true;
    }
    return (await attempt(api.addUrl({ url }), "Could not add the address")) !== undefined;
  },
  openAddUrl: () => void attempt(api.openWindow("addurl"), "Could not open Add URL"),
  toggleLimiter: async () => {
    const on = await attempt(api.toggleSpeedLimiter(), "Could not toggle the speed limiter");
    if (on !== undefined) toast(on ? "Speed limiter on" : "Speed limiter off", { ms: 1800 });
  },
  toggleMini: () => void attempt(api.toggleMini(), "Could not open the mini window"),
};

/** Patch settings and apply the result locally (the core also broadcasts settingsChanged). */
export async function patchSettings(patch: DeepPartial<Settings>) {
  const s = await attempt(api.updateSettings(patch), "Could not save settings");
  if (s) useApp.getState().applySettings(s);
  return s;
}

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends (infer U)[] ? U[] : T[K] extends object ? DeepPartial<T[K]> : T[K] };
