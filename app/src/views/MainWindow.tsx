import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { handleDrop } from "../lib/drop";
import { win } from "../lib/win";
import { Icon } from "../design/icons";
import { actions } from "../lib/actions";
import { api } from "../lib/api";
import { useApp } from "../lib/store";
import { toast, useUi } from "../lib/ui";
import { BottomPane } from "./BottomPane";
import { ConnectBanner } from "./BrowserConnect";
import { Dialogs } from "./dialogs/Dialogs";
import { DownloadTable } from "./DownloadTable";
import { Onboarding } from "./Onboarding";
import { PostActionBanner } from "./PostActionBanner";
import { Sheets } from "./Sheets";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { TitleRow } from "./TitleRow";
import { Toolbar } from "./Toolbar";
import { listIds } from "./useListing";

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
};

export function MainWindow() {
  const bottomOpen = useUi((s) => s.bottomOpen);
  const bottomHeight = useUi((s) => s.bottomHeight);
  const dragOver = useUi((s) => s.dragOver);

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => void win.show()));
  }, []);

  // Square corners while maximized / fullscreen, rounded otherwise (see shell.css).
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.os = /Mac/i.test(navigator.userAgent) ? "mac" : /Windows/i.test(navigator.userAgent) ? "windows" : "linux";
    const sync = () => void win.isMaximized().then((m) => root.toggleAttribute("data-maximized", m));
    sync();
    let off: (() => void) | undefined;
    void win.onResized(sync).then((u) => (off = u));
    return () => off?.();
  }, []);

  useGlobalShortcuts();
  useCoreNotifications();

  // ---- drag & drop of links / .torrent files anywhere on the window -------------------
  const onDragOver = (e: React.DragEvent) => {
    const types = Array.from(e.dataTransfer.types);
    if (types.includes("text/uri-list") || types.includes("text/plain") || types.includes("Files")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      if (!useUi.getState().dragOver) useUi.getState().setDragOver(true);
    }
  };
  const onDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget === e.target || !(e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node))) useUi.getState().setDragOver(false);
  };
  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    useUi.getState().setDragOver(false);
    await handleDrop(e.dataTransfer);
  };

  return (
    <div className="win canvas" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <Sidebar />
      <main className="sheet" style={{ ["--bottom-h" as string]: bottomOpen ? `${bottomHeight}px` : "0px" }}>
        <Toolbar />
        <TitleRow />
        <ConnectBanner onOpen={() => useUi.getState().openSheet({ kind: "settings", section: "browser" })} />
        <DownloadTable />
        <BottomPane />
        <StatusBar />
      </main>
      <PostActionBanner />
      <AnimatePresence>
        {dragOver && (
          <motion.div className="drop-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }}>
            <motion.div className="drop-overlay__card glass-strong" initial={{ scale: 0.96, y: 6 }} animate={{ scale: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
              <span className="drop-overlay__icon">
                <Icon name="download" size={30} strokeWidth={1.5} />
              </span>
              <b>Drop to download</b>
              <span>Links, magnet links and .torrent files</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <Sheets />
      <Dialogs />
      <Onboarding />
    </div>
  );
}

function useGlobalShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ui = useUi.getState();
      if (ui.sheet || ui.dialog || ui.menu || document.querySelector(".modal-scrim")) return;
      const ctrl = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      const sel = useApp.getState().selection;
      let handled = true;
      if (ctrl && e.shiftKey && k === "m") actions.toggleMini();
      else if (ctrl && k === "n") actions.openAddUrl();
      else if (ctrl && (k === "k" || k === "f")) ui.focusSearch();
      else if (ctrl && k === ",") ui.openSheet({ kind: "settings" });
      else if (ctrl && k === "l") void actions.toggleLimiter();
      else if (e.key === "F2" && sel.length) ui.openDialog({ kind: "properties", id: sel[sel.length - 1] });
      else if (isTyping(e.target)) handled = false;
      else if (ctrl && k === "a") useApp.getState().select(listIds(useApp.getState(), ui.filter));
      else if (e.key === "Delete" && sel.length) actions.requestDelete(sel, e.shiftKey);
      else handled = false;
      if (handled) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** Toasts for failures / notifications coming from the core while the main window is open. */
function useCoreNotifications() {
  useEffect(() => {
    let off: (() => void) | undefined;
    void import("../lib/api").then(({ onCoreEvent }) =>
      onCoreEvent((e) => {
        if (e.type === "failed") toast("Download failed", { kind: "error", body: `${e.payload.fileName}${e.payload.error ? ` — ${e.payload.error}` : ""}` });
        else if (e.type === "queueFinished") toast(`${e.payload.name} finished`, { kind: "success" });
        else if (e.type === "notify") toast(e.payload.title, { body: e.payload.body });
        else if (e.type === "clipboardUrls" && e.payload.length)
          toast(e.payload.length > 1 ? `${e.payload.length} links copied` : "Link copied", {
            body: e.payload[0],
            action: { label: "Download", run: () => (e.payload.length > 1 ? void api.batchFromText(e.payload.join("\n")).then((b) => api.openWindow("batch", b.id)) : void actions.addUrl(e.payload[0])) },
          });
      }).then((u) => (off = u)),
    );
    return () => off?.();
  }, []);
}
