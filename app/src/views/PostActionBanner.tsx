import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "../design/icons";
import { api } from "../lib/api";
import { useApp } from "../lib/store";
import { attempt } from "../lib/ui";

const TEXT: Record<string, [IconName, string]> = {
  exit: ["close", "Prism will exit"],
  sleep: ["sleep", "The computer will sleep"],
  hibernate: ["sleep", "The computer will hibernate"],
  shutdown: ["power", "The computer will shut down"],
  lock: ["lock", "The screen will lock"],
  sound: ["sound", "Playing the queue sound"],
  command: ["external", "Running the finish command"],
};

/** Countdown before a queue's "when finished" action, with Cancel. */
export function PostActionBanner() {
  const pending = useApp((s) => s.postAction);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!pending) return;
    const t = window.setInterval(() => {
      setNow(Date.now());
      if (Date.now() > pending.deadline + 1500) useApp.setState({ postAction: null });
    }, 250);
    return () => window.clearInterval(t);
  }, [pending]);
  const [icon, text] = (pending && TEXT[pending.action]) || ["info", "Queue finished"];
  const secs = pending ? Math.max(0, Math.ceil((pending.deadline - now) / 1000)) : 0;
  return (
    <AnimatePresence>
      {pending && (
        <motion.div
          className="post-banner glass-strong"
          role="alertdialog"
          aria-live="assertive"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
        >
          <span className="post-banner__icon">
            <Icon name={icon} size={18} />
          </span>
          <div>
            <b>
              {text} in <span className="tnum">{secs}</span> s
            </b>
            <div className="t-small text-tertiary">All queued downloads have finished.</div>
          </div>
          <button
            type="button"
            className="btn btn--primary"
            autoFocus
            onClick={() => {
              void attempt(api.cancelPostAction(), "Could not cancel");
              useApp.setState({ postAction: null });
            }}
          >
            Cancel
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
