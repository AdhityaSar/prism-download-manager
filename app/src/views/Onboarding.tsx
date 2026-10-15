import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { BrandTile } from "../components/LogoMark";
import { Modal } from "../components/Modal";
import { Icon } from "../design/icons";
import { patchSettings } from "../lib/actions";
import { useApp } from "../lib/store";
import { pickFolder } from "../lib/win";
import { BrowserConnect, useExtensionStatus } from "./BrowserConnect";

const STEPS = ["Welcome", "Browser", "Preferences", "Done"];

/** First-run guide (settings.onboardingDone === false). */
export function Onboarding() {
  const done = useApp((s) => s.settings?.onboardingDone ?? true);
  const [step, setStep] = useState(0);
  const finish = () => void patchSettings({ onboardingDone: true });
  return (
    <Modal open={!done} onClose={finish} width={720} height={660} variant="sheet" className="onboard">
      <div className="onboard__steps" aria-hidden="true">
        {STEPS.map((s, i) => (
          <span key={s} className={i <= step ? "on" : undefined} />
        ))}
      </div>
      <div className="onboard__body">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} className="onboard__page" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
            {step === 0 && <Welcome />}
            {step === 1 && <Browser />}
            {step === 2 && <Preferences />}
            {step === 3 && <Ready />}
          </motion.div>
        </AnimatePresence>
      </div>
      <footer className="dialog__footer">
        {step > 0 && step < 3 && (
          <button type="button" className="btn btn--ghost" onClick={() => setStep(step - 1)}>
            Back
          </button>
        )}
        <span className="spacer" />
        {step < 3 && (
          <button type="button" className="btn btn--ghost" onClick={finish}>
            Skip
          </button>
        )}
        {step < 3 ? (
          <button type="button" className="btn btn--primary" onClick={() => setStep(step + 1)} data-autofocus>
            {step === 0 ? "Get started" : "Continue"}
          </button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={finish} data-autofocus>
            Start using Prism
          </button>
        )}
      </footer>
    </Modal>
  );
}

function Welcome() {
  return (
    <div className="onboard__hero">
      <BrandTile size={84} />
      <h1>
        One beam. <span className="prism-text">Many rays.</span>
      </h1>
      <p>Prism splits every download into parallel segments, resumes where it stopped and grabs videos from the pages you visit. Three quick steps and you are ready.</p>
    </div>
  );
}

function Browser() {
  const { status, connected } = useExtensionStatus();
  return (
    <>
      <h2>Connect your browser</h2>
      <p className="text-secondary">Add the Prism extension to your browser once — then clicking a download link, or the “Download video” button on a page, sends it straight to Prism. It takes about a minute.</p>
      <BrowserConnect status={status} connected={connected} />
    </>
  );
}

function Preferences() {
  const s = useApp((st) => st.settings);
  if (!s) return null;
  return (
    <>
      <h2>Make it yours</h2>
      <div className="card">
        <div className="srow">
          <Icon name="folder" size={18} />
          <div className="srow__txt">
            <div className="srow__t1">Download folder</div>
            <div className="srow__t2 t-mono">{s.downloads.defaultDir}</div>
          </div>
          <button type="button" className="btn btn--sm" onClick={async () => {
              const p = await pickFolder(s.downloads.defaultDir);
              if (p) await patchSettings({ downloads: { defaultDir: p } });
            }}>
            Change…
          </button>
        </div>
      </div>
      <div className="themes themes--onboard">
        {(
          [
            ["light", "Light", "pv-light"],
            ["dark", "Dark", "pv-dark"],
            ["system", "Match system", "pv-sys"],
          ] as const
        ).map(([v, label, cls]) => (
          <button key={v} type="button" className={`tcard${s.appearance.theme === v ? " on" : ""}`} aria-pressed={s.appearance.theme === v} onClick={() => void patchSettings({ appearance: { theme: v } })}>
            <span className={`tprev ${cls}`}>
              <span className="sb">
                <i />
                <i />
                <i />
              </span>
              <span className="sh">
                <i className="a" />
                <i />
                <i />
                <i />
              </span>
            </span>
            {label}
          </button>
        ))}
      </div>
    </>
  );
}

function Ready() {
  return (
    <div className="onboard__hero">
      <span className="burst">
        <span>
          <Icon name="check" size={30} strokeWidth={2} />
        </span>
      </span>
      <h1>You’re all set</h1>
      <p>
        Press <span className="kbd">Ctrl</span> <span className="kbd">N</span> to add a link, drop links anywhere on the window, or just download from your browser.
      </p>
    </div>
  );
}
