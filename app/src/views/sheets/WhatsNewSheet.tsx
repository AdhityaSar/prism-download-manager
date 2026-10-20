import { useEffect } from "react";
import { BrandTile } from "../../components/LogoMark";
import { Icon, type IconName } from "../../design/icons";
import { patchSettings } from "../../lib/actions";
import { useApp } from "../../lib/store";
import { useUi } from "../../lib/ui";
import { versionNewer } from "../../lib/version";
import { BrowserConnect, useExtensionStatus } from "../BrowserConnect";

/** What this version brings, newest first (shown once after an update, and from About Prism). */
const CHANGES: { icon: IconName; title: string; body: string; action?: "sounds" }[] = [
  {
    icon: "playlist",
    title: "Playlists done right",
    body: "Every video keeps its own title. Number them (01 - Title) in Settings › Video & streams, or tick “One at a time” in the video window. Thanks to @asalia22!",
  },
  {
    icon: "video",
    title: "Your MKV or WebM choice is used",
    body: "Videos were saved as MP4 whatever you set in Settings › Video & streams.",
  },
  {
    icon: "browser",
    title: "Zen and Helium",
    body: "Prism connects to them too: Zen like Firefox, Helium from the Chrome Web Store.",
  },
  {
    icon: "sound",
    title: "Pick your “download complete” sound",
    body: "Ten new sounds, from a soft kalimba to a music box, in Settings › Sounds.",
    action: "sounds",
  },
  {
    icon: "activity",
    title: "Streams show their real connections",
    body: "HLS and DASH downloads list the connections actually working and fill the file map as they go. Thanks to @uuc110!",
  },
];

/**
 * "What's new" after an update: the browser extension from the Chrome Web Store first (one
 * click, updates itself; replaces one added by hand), then what else changed.
 */
export function WhatsNewSheet() {
  const version = useApp((s) => s.version);
  const openSheet = useUi((s) => s.openSheet);
  const { status, connected } = useExtensionStatus();
  const fromStore = connected && status?.extensionInstallType === "normal";
  return (
    <div className="whatsnew">
      <header className="whatsnew__head">
        <BrandTile size={52} />
        <div>
          <h2>Prism {version} is here</h2>
          <p className="text-secondary">The browser extension is now in the Chrome Web Store.</p>
        </div>
      </header>

      <section className="whatsnew__store card">
        <div className="whatsnew__storehead">
          <Icon name="puzzle" size={18} className="text-accent" />
          <div>
            <b>Add Prism to your browser in one click</b>
            <div className="t-small text-secondary">From the Chrome Web Store, for Chrome, Edge, Brave, Opera, Vivaldi and Helium. It updates by itself, so there's nothing to reload after a Prism update.</div>
          </div>
        </div>
        {fromStore ? (
          <div className="bstatus bstatus--ok" role="status">
            <span className="bstatus__icon">
              <Icon name="check" size={16} strokeWidth={2.4} />
            </span>
            <div>
              <b>You're all set.</b> Your browser runs Prism from the Chrome Web Store.
            </div>
          </div>
        ) : (
          <BrowserConnect status={status} connected={connected} />
        )}
      </section>

      <ul className="whatsnew__list">
        {CHANGES.map((c) => (
          <li key={c.title}>
            <span className="whatsnew__icon">
              <Icon name={c.icon} size={16} />
            </span>
            <div>
              <b>{c.title}</b>
              <div className="t-small text-secondary">
                {c.body}{" "}
                {c.action === "sounds" && (
                  <button type="button" className="linkbtn" onClick={() => openSheet({ kind: "settings", section: "sounds" })}>
                    Try them
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Opens "What's new" once after Prism was updated, when the main window is on screen (not while
 * it starts hidden in the tray). A fresh install shows the onboarding instead and only records
 * the version.
 */
export function useWhatsNew() {
  const version = useApp((s) => s.version);
  const seen = useApp((s) => s.settings?.lastSeenVersion);
  const onboarded = useApp((s) => s.settings?.onboardingDone);
  useEffect(() => {
    if (!version || seen === undefined || onboarded === undefined || seen === version) return;
    if (!onboarded || (seen && !versionNewer(version, seen))) {
      void patchSettings({ lastSeenVersion: version });
      return;
    }
    const show = () => {
      if (document.visibilityState !== "visible") return false;
      if (!useUi.getState().sheet) useUi.getState().openSheet({ kind: "whatsnew" });
      void patchSettings({ lastSeenVersion: version });
      return true;
    };
    if (show()) return;
    const onVisible = () => {
      if (show()) document.removeEventListener("visibilitychange", onVisible);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [version, seen, onboarded]);
}
