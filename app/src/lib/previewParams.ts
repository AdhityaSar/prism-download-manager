// Browser-preview helpers (never active inside Tauri): query parameters that put the
// UI into a given state for design reviews and automated screenshots, e.g.
//   /?theme=dark&select=demo0#/              selected row + details pane
//   /?sheet=settings:appearance#/            open a sheet (settings[:section] | scheduler[:queue] | grabber[:project])
//   /?dialog=properties:demo1#/              open a dialog (properties | delete | batch | category | speedLimit | refreshUrl)
//   /?menu=demo2#/                           open the context menu of a row
//   /?post=sleep#/                           show the post-queue countdown

import { inTauri } from "./api";
import { useApp } from "./store";
import { type Dialog, useUi } from "./ui";

export function applyPreviewParams() {
  if (inTauri) return;
  const q = new URLSearchParams(location.search);
  const app = useApp.getState();
  const ui = useUi.getState();

  const sel = q.get("select");
  const tab = q.get("tab");
  if (tab === "connections" || tab === "speed" || tab === "info") ui.setBottom({ bottomTab: tab, bottomOpen: true });
  const filter = q.get("filter");
  if (filter === "active" || filter === "queued" || filter === "completed" || filter === "failed") ui.setFilter(filter);
  const view = q.get("view");
  if (view === "trash") app.setView({ kind: "trash" });
  else if (view?.startsWith("queue:")) app.setView({ kind: "queue", id: view.slice(6) });
  if (sel) app.select(sel.split(","), sel.split(",")[0]);

  const sheet = q.get("sheet");
  if (sheet) {
    const [kind, arg] = sheet.split(":");
    if (kind === "settings") ui.openSheet({ kind, section: arg });
    if (kind === "scheduler") ui.openSheet({ kind, queueId: arg });
    if (kind === "grabber") ui.openSheet({ kind, projectId: arg ?? null });
  }
  const dialog = q.get("dialog");
  if (dialog) {
    const [kind, arg = ""] = dialog.split(":");
    const ids = arg ? arg.split(",") : [];
    const map: Record<string, Dialog | undefined> = {
      properties: { kind: "properties", id: ids[0] },
      delete: { kind: "delete", ids, trash: false },
      batch: { kind: "batch" },
      category: { kind: "category", category: app.categories.find((c) => c.id === arg) },
      speedLimit: { kind: "speedLimit", ids },
      refreshUrl: { kind: "refreshUrl", id: ids[0] },
    };
    if (map[kind]) ui.openDialog(map[kind]!);
  }
  const menu = q.get("menu");
  if (menu) {
    setTimeout(() => {
      const row = document.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(menu)}"]`);
      if (!row) return;
      const r = row.getBoundingClientRect();
      row.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: r.left + 220, clientY: r.top + r.height / 2 }));
    }, 1200);
  }
  const post = q.get("post");
  if (post) useApp.setState({ postAction: { action: post, deadline: Date.now() + 27_000 } });
}
