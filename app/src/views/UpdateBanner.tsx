import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { create } from "zustand";
import { Icon } from "../design/icons";
import { api, inTauri, onAppEvent, type UpdateInfo } from "../lib/api";
import { useApp } from "../lib/store";
import { toast } from "../lib/ui";
import { scheduleUpdateChecks, windowEnv } from "../lib/update-schedule";

const SITE = "https://prismdl.site/#download";
const RELEASES = "https://github.com/FortoGraphy/prism-download-manager/releases";

interface UpdateState {
  info: UpdateInfo | null;
  /** Version the user postponed this session. */
  later: string | null;
  phase: "idle" | "downloading" | "installing";
  progress: number;
}

const useUpdate = create<UpdateState>(() => ({ info: null, later: null, phase: "idle", progress: 0 }));

/** When the latest check started (counted from the app's start until the first one). */
let lastCheckAt = Date.now();

/** Looks for a newer release; `manual` reports "up to date" and errors as toasts. */
export async function checkForUpdates(manual = false): Promise<void> {
  lastCheckAt = Date.now();
  try {
    const info = await api.checkUpdate();
    useUpdate.setState({ info, ...(manual ? { later: null } : {}) });
    if (manual && !info) toast("Prism is up to date", { kind: "success", ms: 2500 });
  } catch (e) {
    if (manual) toast("Couldn't check for updates", { kind: "error", body: String(e) });
  }
}

async function openUrl(url: string) {
  if (inTauri) {
    const opener = await import("@tauri-apps/plugin-opener");
    await opener.openUrl(url);
  } else {
    window.open(url, "_blank", "noopener");
  }
}

async function install() {
  useUpdate.setState({ phase: "downloading", progress: 0 });
  const off = await onAppEvent<[number, number | null]>("update-progress", ([got, total]) => {
    useUpdate.setState({ progress: total ? got / total : 0, phase: total && got >= total ? "installing" : "downloading" });
  });
  try {
    await api.installUpdate(); // on success the app restarts and never gets here
  } catch (e) {
    toast("The update couldn't be installed", { kind: "error", body: String(e) });
    useUpdate.setState({ phase: "idle" });
  } finally {
    off();
  }
}

/** "Prism x.y.z is ready — Restart & update" bar above the download list. */
export function UpdateBanner() {
  const enabled = useApp((s) => s.settings?.general.checkUpdates ?? true);
  const { info, later, phase, progress } = useUpdate();

  useEffect(() => {
    if (!enabled) return;
    // 5 s after start, every hour, and on coming back to the window after 30 min.
    return scheduleUpdateChecks(() => void checkForUpdates(), () => lastCheckAt, windowEnv);
  }, [enabled]);

  const show = !!info && later !== info.version;
  const busy = phase !== "idle";
  return (
    <div className="cbanner-slot">
      <AnimatePresence initial={false}>
        {show && info && (
          <motion.div className="cbanner" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
            <div className="cbanner__inner ubanner">
              <span className="cbanner__icon">
                <Icon name="download" size={16} />
              </span>
              <span className="cbanner__txt">
                {busy ? (
                  <>
                    <b>{phase === "installing" ? "Installing Prism " + info.version + "…" : `Downloading Prism ${info.version}… ${Math.round(progress * 100)}%`}</b> Prism restarts by itself and your downloads continue.
                    <span className="ubanner__bar">
                      <span style={{ width: `${Math.max(4, progress * 100)}%` }} />
                    </span>
                  </>
                ) : (
                  <>
                    <b>Prism {info.version} is ready.</b> You have {info.current}.{" "}
                    <button type="button" className="link-btn" onClick={() => void openUrl(`${RELEASES}/tag/v${info.version}`)}>
                      What&rsquo;s new
                    </button>
                  </>
                )}
              </span>
              {!busy &&
                (info.canInstall ? (
                  <button type="button" className="btn btn--primary btn--sm" onClick={() => void install()}>
                    Restart &amp; update
                  </button>
                ) : (
                  <button type="button" className="btn btn--primary btn--sm" onClick={() => void openUrl(SITE)}>
                    Get the update
                  </button>
                ))}
              {!busy && (
                <button type="button" className="tb-btn" aria-label="Remind me later" data-tip="Later" onClick={() => useUpdate.setState({ later: info.version })}>
                  <Icon name="close" size={14} />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
