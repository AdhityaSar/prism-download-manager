import { useEffect, useMemo, useState } from "react";
import { Icon } from "../design/icons";
import { actions } from "../lib/actions";
import { api } from "../lib/api";
import { formatBytes, formatSpeed } from "../lib/format";
import { isActive, useApp } from "../lib/store";
import { useUi } from "../lib/ui";

/** Glass status bar overlaying the bottom of the list. */
export function StatusBar() {
  const speed = useApp((s) => Object.values(s.progress).reduce((sum, p) => sum + (p.speed || 0), 0));
  const items = useApp((s) => s.items);
  const queues = useApp((s) => s.queues);
  const limiter = useApp((s) => s.settings?.downloads.speedLimiterEnabled ?? false);
  const limit = useApp((s) => s.settings?.downloads.speedLimit ?? 0);
  const dir = useApp((s) => s.settings?.downloads.defaultDir ?? "");
  const bottomOpen = useUi((s) => s.bottomOpen);
  const [free, setFree] = useState<number | null>(null);
  const [next, setNext] = useState<[string, string | null][]>([]);
  const [integrationOk, setIntegrationOk] = useState<boolean | null>(null);

  const c = useMemo(() => {
    let active = 0;
    let queued = 0;
    for (const i of Object.values(items)) {
      if (i.trashed) continue;
      if (isActive(i.status)) active++;
      else if (i.status === "queued") queued++;
    }
    return { active, queued };
  }, [items]);

  useEffect(() => {
    if (!dir) return;
    const load = () => {
      void api.freeSpace(dir).then(setFree, () => setFree(null));
      void api.nextScheduleRuns().then(setNext, () => setNext([]));
      void api.integrationStatus().then((s) => setIntegrationOk(!!s.extensionConnected || s.browsers.some((b) => b.registered)), () => setIntegrationOk(null));
    };
    load();
    const t = window.setInterval(load, 60_000);
    return () => window.clearInterval(t);
  }, [dir, queues]);

  const running = queues.filter((q) => q.running);
  const upcoming = next.find(([, at]) => at);
  const upcomingQueue = upcoming && queues.find((q) => q.id === upcoming[0]);

  return (
    <footer className="statusbar glass blur-md edge-top">
      <span className="sb down" data-tip="Total download speed">
        <Icon name="arrow-down" size={12} strokeWidth={2.2} />
        <b>{speed ? formatSpeed(speed) : "0 B/s"}</b>
      </span>
      <span className="sb">
        <b>{c.active}</b> active · <b>{c.queued}</b> queued
      </span>
      {running.length > 0 && (
        <span className="sb">
          <Icon name="queue" size={12} strokeWidth={2} />
          {running.map((q) => q.name).join(", ")} running
        </span>
      )}
      {upcoming && upcomingQueue && (
        <span className="sb" data-tip="Next scheduled start">
          <Icon name="status-scheduled" size={12} strokeWidth={2} />
          {upcomingQueue.name} at <b>{upcoming[1]?.slice(-5)}</b>
        </span>
      )}
      <span className="spacer" />
      <button type="button" className="sb sb--btn" onClick={() => void actions.toggleLimiter()} data-tip="Toggle speed limiter" data-kbd="Ctrl L">
        <Icon name="speed-limiter" size={12} strokeWidth={2} />
        Limit <b>{limiter ? `${formatBytes(limit)}/s` : "Off"}</b>
      </button>
      {free != null && (
        <span className="sb" data-tip={dir}>
          <Icon name="hard-drive" size={12} strokeWidth={2} />
          <b>{formatBytes(free)}</b> free
        </span>
      )}
      <button type="button" className={`sb sb--btn ${integrationOk ? "ok" : "warn"}`} onClick={() => useUi.getState().openSheet({ kind: "settings", section: "browser" })}>
        <Icon name={integrationOk ? "shield" : "warning"} size={12} strokeWidth={2} />
        {integrationOk ? "Integration OK" : "Integration !"}
      </button>
      <button
        type="button"
        className="sb sb--btn"
        aria-label={bottomOpen ? "Hide details pane" : "Show details pane"}
        data-tip={bottomOpen ? "Hide details pane" : "Show details pane"}
        onClick={() => useUi.getState().setBottom({ bottomOpen: !bottomOpen })}
      >
        <Icon name={bottomOpen ? "chevron-down" : "chevron-up"} size={13} strokeWidth={2} />
      </button>
    </footer>
  );
}
