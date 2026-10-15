import { useEffect, useMemo, useState } from "react";
import { Checkbox, RateField, Segmented, Stepper, Switch, TextField } from "../../components/Controls";
import { FileTile } from "../../components/Visuals";
import { Icon, type IconName } from "../../design/icons";
import { api } from "../../lib/api";
import { formatBytes } from "../../lib/format";
import { useApp } from "../../lib/store";
import type { PostAction, Queue } from "../../lib/types";
import { attempt, toast } from "../../lib/ui";

const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const AFTER: { type: PostAction["type"]; label: string; icon: IconName }[] = [
  { type: "none", label: "Do nothing", icon: "minus" },
  { type: "sound", label: "Play sound", icon: "sound" },
  { type: "exit", label: "Exit Prism", icon: "close" },
  { type: "sleep", label: "Sleep", icon: "sleep" },
  { type: "hibernate", label: "Hibernate", icon: "moon" },
  { type: "shutdown", label: "Shut down", icon: "power" },
  { type: "lock", label: "Lock screen", icon: "lock" },
  { type: "command", label: "Run command", icon: "external" },
];

type Repeat = "once" | "daily" | "days";

export function repeatOf(q: Queue): Repeat {
  if (q.schedule.onceDate) return "once";
  return q.schedule.days.length && q.schedule.days.length < 7 ? "days" : "daily";
}

function newQueue(position: number): Queue {
  return {
    id: `q-${Date.now().toString(36)}`,
    name: "New queue",
    maxConcurrent: 2,
    speedLimit: 0,
    position,
    builtin: false,
    running: false,
    schedule: { enabled: false, startTime: "01:00", stopTime: null, days: [], onceDate: null, retryFailed: true, onComplete: { type: "none" }, wake: false },
  };
}

export function SchedulerSheet({ initial }: { initial?: string }) {
  const queues = useApp((s) => s.queues);
  const [init] = useState(() => {
    const fresh = initial === "new" ? newQueue(useApp.getState().queues.length) : null;
    return { selected: fresh?.id ?? (initial && initial !== "new" ? initial : (useApp.getState().queues[0]?.id ?? "")), draft: fresh };
  });
  const [selected, setSelected] = useState(init.selected);
  const [draft, setDraft] = useState<Queue | null>(init.draft);
  const [tab, setTab] = useState<"schedule" | "files">("schedule");
  const [nextRuns, setNextRuns] = useState<[string, string | null][]>([]);

  const saved = queues.find((q) => q.id === selected);
  useEffect(() => {
    if (saved && (!draft || draft.id !== saved.id)) setDraft(structuredClone(saved));
  }, [saved, draft]);

  useEffect(() => {
    void api.nextScheduleRuns().then(setNextRuns, () => undefined);
  }, [queues]);

  const dirty = useMemo(() => !!draft && JSON.stringify({ ...draft, running: false }) !== JSON.stringify({ ...(saved ?? {}), running: false }), [draft, saved]);
  if (!draft) return null;
  const s = draft.schedule;
  const set = (patch: Partial<Queue>) => setDraft({ ...draft, ...patch });
  const setS = (patch: Partial<Queue["schedule"]>) => setDraft({ ...draft, schedule: { ...draft.schedule, ...patch } });
  const repeat = repeatOf(draft);
  const isNew = !saved;
  const next = nextRuns.find(([id]) => id === draft.id)?.[1];

  const save = async () => {
    const res = await attempt(api.upsertQueue(draft), "Could not save the queue");
    if (res) {
      useApp.setState({ queues: res });
      toast(`${draft.name} saved`, { kind: "success", ms: 1800 });
    }
  };

  return (
    <div className="sched">
      <aside className="sched__list">
        {queues.map((q) => (
          <button key={q.id} type="button" className={`qitem${q.id === selected ? " on" : ""}`} onClick={() => setSelected(q.id)}>
            <Icon name={q.running ? "queue" : q.schedule.enabled ? "status-scheduled" : "queue"} size={16} />
            <b>{q.name}</b>
            <small>{q.running ? "Running" : q.schedule.enabled ? scheduleSummary(q) : "Manual start"}</small>
          </button>
        ))}
        {isNew && (
          <button type="button" className="qitem on">
            <Icon name="plus" size={16} />
            <b>{draft.name}</b>
            <small>Not saved yet</small>
          </button>
        )}
        <button
          type="button"
          className="newq"
          onClick={() => {
            const q = newQueue(queues.length);
            setSelected(q.id);
            setDraft(q);
          }}
        >
          <Icon name="plus" size={15} /> New queue
        </button>
      </aside>

      <section className="sched__pane">
        <div className="qhead">
          <input className="qhead__name" aria-label="Queue name" value={draft.name} onChange={(e) => set({ name: e.target.value })} />
          {s.enabled && next && (
            <span className="badge badge--info">
              <Icon name="status-scheduled" size={12} strokeWidth={2} /> Next run {next}
            </span>
          )}
          <Switch checked={s.enabled} label="Schedule enabled" onChange={(v) => setS({ enabled: v })} />
        </div>
        <div className="qtabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "schedule"} className={`qtab${tab === "schedule" ? " on" : ""}`} onClick={() => setTab("schedule")}>
            Schedule
          </button>
          <button type="button" role="tab" aria-selected={tab === "files"} className={`qtab${tab === "files" ? " on" : ""}`} onClick={() => setTab("files")}>
            Files <QueueCount id={draft.id} />
          </button>
        </div>

        {tab === "schedule" ? (
          <div className={`qbody${s.enabled ? "" : " is-off"}`}>
            <div className="frow">
              <span>Repeat</span>
              <Segmented<Repeat>
                size="sm"
                label="Repeat"
                value={repeat}
                onChange={(r) =>
                  setS(
                    r === "once"
                      ? { onceDate: new Date().toISOString().slice(0, 10), days: [] }
                      : r === "daily"
                        ? { onceDate: null, days: [] }
                        : { onceDate: null, days: s.days.length && s.days.length < 7 ? s.days : [1, 2, 3, 4, 5] },
                  )
                }
                options={[
                  { value: "once", label: "Once" },
                  { value: "daily", label: "Every day" },
                  { value: "days", label: "On days" },
                ]}
              />
            </div>
            <div className="frow">
              <span>Start at</span>
              <div className="inline">
                <label className="input time">
                  <Icon name="clock" size={15} />
                  <input type="time" aria-label="Start time" value={s.startTime ?? ""} onChange={(e) => setS({ startTime: e.target.value || null })} />
                </label>
                {repeat === "once" && (
                  <label className="input date">
                    <Icon name="calendar" size={15} />
                    <input type="date" aria-label="Date" value={s.onceDate ?? ""} onChange={(e) => setS({ onceDate: e.target.value || null })} />
                  </label>
                )}
                {repeat === "days" && (
                  <div className="days" role="group" aria-label="Weekdays">
                    {DAYS.map((d, i) => {
                      const n = i + 1;
                      const on = s.days.includes(n);
                      return (
                        <button key={d} type="button" className={`day${on ? " on" : ""}`} aria-pressed={on} onClick={() => setS({ days: on ? s.days.filter((x) => x !== n) : [...s.days, n].sort() })}>
                          {d}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="frow">
              <span>Stop at</span>
              <div className="inline">
                <Checkbox checked={!!s.stopTime} label="Stop at a time" onChange={(v) => setS({ stopTime: v ? "07:00" : null })} />
                <label className="input time">
                  <input type="time" aria-label="Stop time" disabled={!s.stopTime} value={s.stopTime ?? ""} onChange={(e) => setS({ stopTime: e.target.value || null })} />
                </label>
                <span className="hint">Unfinished files pause and continue next time</span>
              </div>
            </div>
            <div className="frow">
              <span>Simultaneous</span>
              <div className="inline">
                <Stepper value={draft.maxConcurrent} min={1} max={16} label="simultaneous downloads" onChange={(v) => set({ maxConcurrent: v })} />
                <span className="hint">downloads at a time</span>
              </div>
            </div>
            <div className="frow">
              <span>Speed limit</span>
              <div className="inline">
                <RateField value={draft.speedLimit} onCommit={(v) => set({ speedLimit: v })} label="Queue speed limit" />
                <span className="hint">for the whole queue</span>
              </div>
            </div>
            <div className="frow">
              <span>Options</span>
              <div className="inline">
                <Checkbox checked={s.retryFailed} onChange={(v) => setS({ retryFailed: v })}>
                  Retry failed downloads
                </Checkbox>
                <Checkbox checked={s.wake} onChange={(v) => setS({ wake: v })}>
                  Wake the computer to start
                </Checkbox>
              </div>
            </div>
            <div className="frow frow--start">
              <span>When finished</span>
              <div>
                <div className="after">
                  {AFTER.map((a) => (
                    <button
                      key={a.type}
                      type="button"
                      className={`aft${s.onComplete.type === a.type ? " on" : ""}`}
                      aria-pressed={s.onComplete.type === a.type}
                      onClick={() => setS({ onComplete: a.type === "command" ? { type: "command", value: s.onComplete.type === "command" ? s.onComplete.value : "" } : ({ type: a.type } as PostAction) })}
                    >
                      <Icon name={a.icon} size={16} />
                      {a.label}
                    </button>
                  ))}
                </div>
                {s.onComplete.type === "command" && (
                  <div style={{ marginTop: 8 }}>
                    <TextField
                      value={s.onComplete.value}
                      onChange={(v) => setS({ onComplete: { type: "command", value: v } })}
                      label="Command to run"
                      mono
                      icon="external"
                      placeholder={'e.g. "C:\\Tools\\sync.cmd" --after-downloads'}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <QueueFiles id={draft.id} />
        )}

        <footer className="dialog__footer">
          {saved?.running ? (
            <button type="button" className="btn" onClick={() => void attempt(api.stopQueue(draft.id))}>
              <Icon name="stop-queue" size={16} /> Stop
            </button>
          ) : (
            <button type="button" className="btn" disabled={isNew} onClick={() => void attempt(api.startQueue(draft.id))}>
              <Icon name="start-queue" size={16} /> Run now
            </button>
          )}
          {!draft.builtin && !isNew && (
            <button
              type="button"
              className="btn btn--ghost btn--danger"
              onClick={async () => {
                const res = await attempt(api.deleteQueue(draft.id), "Could not delete the queue");
                if (res) {
                  useApp.setState({ queues: res });
                  setSelected(res[0]?.id ?? "");
                  setDraft(null);
                }
              }}
            >
              Delete queue
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn btn--ghost" disabled={!dirty || isNew} onClick={() => saved && setDraft(structuredClone(saved))}>
            Revert
          </button>
          <button type="button" className="btn btn--primary" disabled={!dirty && !isNew} onClick={save}>
            {isNew ? "Create queue" : "Save schedule"}
          </button>
        </footer>
      </section>
    </div>
  );
}

export function scheduleSummary(q: Queue): string {
  const s = q.schedule;
  const at = s.startTime ?? "—";
  if (s.onceDate) return `${s.onceDate} at ${at}`;
  if (!s.days.length || s.days.length === 7) return `Daily at ${at}`;
  if (s.days.join() === "1,2,3,4,5") return `Weekdays at ${at}`;
  if (s.days.join() === "6,7") return `Weekends at ${at}`;
  return `${s.days.map((d) => DAYS[d - 1]).join(" ")} at ${at}`;
}

function QueueCount({ id }: { id: string }) {
  const n = useApp((s) => Object.values(s.items).filter((i) => i.queueId === id && !i.trashed).length);
  return <span className="count">{n}</span>;
}

/** Files assigned to the queue in their order; drag (or Alt+↑/↓) to reorder. */
function QueueFiles({ id }: { id: string }) {
  const all = useApp((s) => s.items);
  const files = useMemo(() => Object.values(all).filter((i) => i.queueId === id && !i.trashed).sort((a, b) => a.position - b.position), [all, id]);
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null);
  if (!files.length)
    return (
      <div className="qbody">
        <p className="hint">This queue is empty. Right-click downloads in the list and choose Move to queue.</p>
      </div>
    );
  const move = (from: number, to: number) => {
    if (from !== to) void attempt(api.moveInQueue([files[from].id], to - from), "Could not reorder");
  };
  return (
    <div className="qbody qbody--files">
      <div className="files" role="list" aria-label="Files in queue">
        {files.map((f, i) => (
          <div
            key={f.id}
            role="listitem"
            tabIndex={0}
            draggable
            className={`frow2${drag?.from === i ? " dragging" : ""}${drag && drag.over === i && drag.from !== i ? (drag.from < i ? " drop-after" : " drop-before") : ""}`}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/x-prism-row", f.id);
              setDrag({ from: i, over: i });
            }}
            onDragOver={(e) => {
              if (!drag) return;
              e.preventDefault();
              if (drag.over !== i) setDrag({ ...drag, over: i });
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (drag) move(drag.from, i);
              setDrag(null);
            }}
            onDragEnd={() => setDrag(null)}
            onKeyDown={(e) => {
              if (e.altKey && e.key === "ArrowUp" && i > 0) move(i, i - 1);
              if (e.altKey && e.key === "ArrowDown" && i < files.length - 1) move(i, i + 1);
            }}
          >
            <Icon name="drag-handle" size={16} className="dh" />
            <span className="pos tnum">{i + 1}</span>
            <FileTile item={f} size={24} thumbWidth={34} />
            <span className="nm">{f.fileName}</span>
            <span className="sz tnum">{formatBytes(f.size)}</span>
          </div>
        ))}
      </div>
      <p className="hint">Drag to reorder, or focus a row and press Alt+↑ / Alt+↓.</p>
    </div>
  );
}
