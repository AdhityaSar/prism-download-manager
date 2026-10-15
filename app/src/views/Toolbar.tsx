import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { IconButton } from "../components/IconButton";
import { Icon } from "../design/icons";
import { actions } from "../lib/actions";
import { api } from "../lib/api";
import { formatBytes } from "../lib/format";
import { canPause, canResume } from "../lib/present";
import { useApp } from "../lib/store";
import { attempt, useUi } from "../lib/ui";
import { win } from "../lib/win";

export function Toolbar() {
  const selection = useApp((s) => s.selection);
  const sel = useApp(useShallow((s) => s.selection.map((id) => s.items[id]).filter(Boolean)));
  const view = useApp((s) => s.view);
  const queues = useApp((s) => s.queues);
  const limiter = useApp((s) => s.settings?.downloads.speedLimiterEnabled ?? false);
  const limit = useApp((s) => s.settings?.downloads.speedLimit ?? 0);
  const hasFinished = useApp((s) => Object.values(s.items).some((i) => i.status === "completed" && !i.trashed));
  const ui = useUi.getState;

  const queue = queues.find((q) => q.id === (view.kind === "queue" ? view.id : "main")) ?? queues[0];
  const anyResumable = sel.some((i) => canResume(i.status) || i.status === "queued");
  const anyPausable = sel.some((i) => canPause(i.status));

  return (
    <header className="toolbar" data-tauri-drag-region role="toolbar" aria-label="Download actions">
      <button type="button" className="btn btn--primary" onClick={actions.openAddUrl} data-tip="Add a download address" data-kbd="Ctrl N">
        <Icon name="plus" size={16} strokeWidth={2} />
        Add URL
      </button>
      <IconButton icon="resume" label="Resume" kbd="Space" disabled={!anyResumable} onClick={() => actions.resume(selection)} />
      <IconButton icon="pause" label="Pause" kbd="Space" disabled={!anyPausable} onClick={() => actions.pause(selection)} />
      <IconButton icon="stop-all" label="Stop all" onClick={actions.pauseAll} />
      <span className="tb-sep" />
      <IconButton icon="delete" label="Delete" kbd="Del" disabled={!selection.length} onClick={() => actions.requestDelete(selection)} />
      <IconButton icon="delete-completed" label="Remove completed from the list" disabled={!hasFinished} onClick={() => void attempt(api.removeCompleted(), "Could not remove completed downloads")} />
      <span className="tb-sep" />
      <IconButton icon="start-queue" label={queue ? `Start ${queue.name}` : "Start queue"} disabled={!queue || queue.running} onClick={() => queue && void attempt(api.startQueue(queue.id))} />
      <IconButton icon="stop-queue" label={queue ? `Stop ${queue.name}` : "Stop queue"} disabled={!queue || !queue.running} onClick={() => queue && void attempt(api.stopQueue(queue.id))} />
      <IconButton icon="scheduler" label="Scheduler" onClick={() => ui().openSheet({ kind: "scheduler", queueId: queue?.id })} />
      <span className="tb-sep" />
      <IconButton icon="grabber" label="Site grabber" onClick={() => ui().openSheet({ kind: "grabber" })} />
      <IconButton icon="batch" label="Batch download" onClick={() => ui().openDialog({ kind: "batch" })} />
      <IconButton
        icon="speed-limiter"
        label={limiter ? `Speed limiter on · ${formatBytes(limit)}/s` : "Speed limiter off"}
        kbd="Ctrl L"
        pressed={limiter}
        onClick={() => void actions.toggleLimiter()}
      />
      <IconButton icon="mini-mode" label="Mini window" kbd="Ctrl Shift M" onClick={actions.toggleMini} />
      <span className="spacer" data-tauri-drag-region />
      <SearchBox />
      <IconButton icon="options" label="Settings" kbd="Ctrl ," onClick={() => ui().openSheet({ kind: "settings" })} />
      <Caption />
    </header>
  );
}

function SearchBox() {
  const search = useApp((s) => s.search);
  const focusTick = useUi((s) => s.searchFocus);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusTick) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [focusTick]);
  return (
    <label className="input search">
      <Icon name="search" size={15} />
      <input
        ref={ref}
        value={search}
        placeholder="Search downloads"
        aria-label="Search downloads"
        onChange={(e) => useApp.getState().setSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            useApp.getState().setSearch("");
            ref.current?.blur();
          }
          if (e.key === "ArrowDown") document.querySelector<HTMLElement>(".table__body")?.focus();
        }}
      />
      {search ? (
        <button type="button" className="search__clear" aria-label="Clear search" onClick={() => useApp.getState().setSearch("")}>
          <Icon name="close" size={13} />
        </button>
      ) : (
        <span className="kbd">Ctrl K</span>
      )}
    </label>
  );
}

function Caption() {
  const [max, setMax] = useState(false);
  useEffect(() => {
    let off: (() => void) | undefined;
    void win.isMaximized().then(setMax);
    void win.onResized(() => void win.isMaximized().then(setMax)).then((u) => (off = u));
    return () => off?.();
  }, []);
  return (
    <div className="caption">
      <button type="button" className="caption__btn" aria-label="Minimize" onClick={() => void win.minimize()}>
        <Icon name="minimize" size={16} strokeWidth={1.25} />
      </button>
      <button type="button" className="caption__btn" aria-label={max ? "Restore" : "Maximize"} onClick={() => void win.toggleMaximize()}>
        <Icon name={max ? "restore" : "maximize"} size={14} strokeWidth={1.5} />
      </button>
      <button type="button" className="caption__btn caption__btn--close" aria-label="Close to tray" onClick={() => void win.close()}>
        <Icon name="close" size={16} strokeWidth={1.4} />
      </button>
    </div>
  );
}
