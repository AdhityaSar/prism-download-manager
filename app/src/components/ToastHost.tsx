import { AnimatePresence, motion } from "motion/react";
import { Icon } from "../design/icons";
import { useUi } from "../lib/ui";

const ICON = { info: "info", success: "status-completed", error: "status-error" } as const;

export function ToastHost() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismissToast);
  return (
    <div className="toast-stack" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            className={`toast glass-strong blur-md toast--${t.kind}`}
            role={t.kind === "error" ? "alert" : "status"}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, transition: { duration: 0.16 } }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="toast__icon">
              <Icon name={ICON[t.kind]} size={16} />
            </span>
            <div className="toast__text">
              <div className="toast__title">{t.title}</div>
              {t.body && <div className="toast__body">{t.body}</div>}
            </div>
            {t.action && (
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                onClick={() => {
                  t.action?.run();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" className="tb-btn toast__close" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
              <Icon name="close" size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
