import { useEffect } from "react";
import { BrandTile } from "../../components/LogoMark";
import { Icon, type IconName } from "../../design/icons";
import { patchSettings } from "../../lib/actions";
import { t, tk } from "../../lib/i18n";
import { useApp } from "../../lib/store";
import { useUi } from "../../lib/ui";
import { versionNewer } from "../../lib/version";
import { BrowserConnect, useExtensionStatus } from "../BrowserConnect";

type Change = { icon: IconName; title: string; body: string; credit?: string; action?: "sounds" | "language" };

/**
 * What this version brings (shown once after an update, and from About Prism), then what the
 * version before brought, for people updating from older ones. Titles and bodies are translated
 * where they're shown; `credit` is the contributor's handle.
 */
const CHANGES: Change[] = [
  {
    icon: "globe",
    title: tk("Prism speaks your language"),
    body: tk("Czech, German, Spanish, French and Italian, besides English. Prism follows your system's language; pick another one in Settings › General."),
    action: "language",
  },
  {
    icon: "torrent",
    title: tk("Torrents get their own folder"),
    body: tk("A torrent with several files is saved in a folder named after it instead of spilling into your downloads."),
  },
  {
    icon: "check",
    title: tk("Fixes"),
    body: tk("The portable version works with the browser extension again, Start minimized keeps Prism in the tray, Zen and Firefox with new profiles connect on Linux, and the Fedora package works with ffmpeg from RPM Fusion."),
  },
];

/** The previous version's changes, shown below the new ones. */
const PREVIOUS = { version: "1.1.0", changes: [
  {
    icon: "playlist",
    title: tk("Playlists done right"),
    body: tk("Every video keeps its own title. Number them (01 - Title) in Settings › Video & streams, or tick “One at a time” in the video window."),
    credit: "@asalia22",
  },
  {
    icon: "video",
    title: tk("Your MKV or WebM choice is used"),
    body: tk("Videos were saved as MP4 whatever you set in Settings › Video & streams."),
  },
  {
    icon: "browser",
    title: tk("Zen and Helium"),
    body: tk("Prism connects to them too: Zen like Firefox, Helium from the Chrome Web Store."),
  },
  {
    icon: "sound",
    title: tk("Pick your “download complete” sound"),
    body: tk("Ten new sounds, from a soft kalimba to a music box, in Settings › Sounds."),
    action: "sounds",
  },
  {
    icon: "activity",
    title: tk("Streams show their real connections"),
    body: tk("HLS and DASH downloads list the connections actually working and fill the file map as they go."),
    credit: "@uuc110",
  },
] satisfies Change[] };

/**
 * "What's new" after an update: the browser extension from the Chrome Web Store first (one
 * click, updates itself; replaces one added by hand), then what else changed.
 */
export function WhatsNewSheet() {
  const version = useApp((s) => s.version);
  const { status, connected } = useExtensionStatus();
  const fromStore = connected && status?.extensionInstallType === "normal";
  return (
    <div className="whatsnew">
      <header className="whatsnew__head">
        <BrandTile size={52} />
        <div>
          <h2>{t("Prism {version} is here", { version })}</h2>
          <p className="text-secondary">{t("Now in your language, with fixes for torrents, the portable version and Linux.")}</p>
        </div>
      </header>

      <section className="whatsnew__store card">
        <div className="whatsnew__storehead">
          <Icon name="puzzle" size={18} className="text-accent" />
          <div>
            <b>{t("Add Prism to your browser in one click")}</b>
            <div className="t-small text-secondary">
              {t("From the Chrome Web Store, for Chrome, Edge, Brave, Opera, Vivaldi and Helium. It updates by itself, so there's nothing to reload after a Prism update.")}
            </div>
          </div>
        </div>
        {fromStore ? (
          <div className="bstatus bstatus--ok" role="status">
            <span className="bstatus__icon">
              <Icon name="check" size={16} strokeWidth={2.4} />
            </span>
            <div>
              <b>{t("You're all set.")}</b> {t("Your browser runs Prism from the Chrome Web Store.")}
            </div>
          </div>
        ) : (
          <BrowserConnect status={status} connected={connected} />
        )}
      </section>

      <ChangeList changes={CHANGES} />
      <h3 className="whatsnew__older t-small text-tertiary">{t("New in Prism {version}", { version: PREVIOUS.version })}</h3>
      <ChangeList changes={PREVIOUS.changes} />
    </div>
  );
}

function ChangeList({ changes }: { changes: Change[] }) {
  const openSheet = useUi((s) => s.openSheet);
  return (
    <ul className="whatsnew__list">
      {changes.map((c) => (
        <li key={c.title}>
          <span className="whatsnew__icon">
            <Icon name={c.icon} size={16} />
          </span>
          <div>
            <b>{t(c.title)}</b>
            <div className="t-small text-secondary">
              {t(c.body)}
              {c.credit && ` ${t("Thanks to {name}!", { name: c.credit })}`}{" "}
              {c.action === "sounds" && (
                <button type="button" className="linkbtn" onClick={() => openSheet({ kind: "settings", section: "sounds" })}>
                  {t("Try them")}
                </button>
              )}
              {c.action === "language" && (
                <button type="button" className="linkbtn" onClick={() => openSheet({ kind: "settings", section: "general" })}>
                  {t("Choose a language")}
                </button>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
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
