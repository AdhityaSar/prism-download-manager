import { useEffect } from "react";
import { BrandTile } from "../../components/LogoMark";
import { Icon, type IconName } from "../../design/icons";
import { patchSettings } from "../../lib/actions";
import { t, tk } from "../../lib/i18n";
import { useApp } from "../../lib/store";
import { useUi } from "../../lib/ui";
import { versionNewer } from "../../lib/version";
import { BrowserConnect, useExtensionStatus } from "../BrowserConnect";

type Change = { icon: IconName; title: string; body: string; credit?: string; action?: "sounds" | "language" | "appearance" };

/**
 * What this version brings (shown once after an update, and from About Prism), then what the
 * version before brought, for people updating from older ones. Titles and bodies are translated
 * where they're shown; `credit` is the contributor's handle.
 */
const CHANGES: Change[] = [
  {
    icon: "sidebar",
    title: tk("Compact view"),
    body: tk("Just the download list, like a classic download manager. Turn it on in Settings › Appearance."),
    action: "appearance",
  },
  {
    icon: "sleep",
    title: tk("Lighter in the tray"),
    body: tk("After a minute in the tray, Prism closes its window to free memory. Downloads keep running, and the window is back as soon as you open Prism."),
  },
  {
    icon: "magnet",
    title: tk("Better on Linux"),
    body: tk("The window opens from the tray every time, and magnet links and .torrent files open in Prism."),
    credit: "pepopepopepo",
  },
];

/** The previous version's changes, shown below the new ones. */
const PREVIOUS = { version: "1.1.3", changes: [
  {
    icon: "browser",
    title: tk("Downloads that need the browser"),
    body: tk("Some sites, like softpedia.com, let only a web browser download (they check for robots). Prism now leaves those downloads to your browser instead of failing or saving an error page."),
  },
  {
    icon: "list",
    title: tk("A tidier list"),
    body: tk("Turn on “Remove downloads whose files were deleted” in Settings › General, and downloads you delete from the computer leave the list too."),
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
          <p className="text-secondary">{t("A compact view, a lighter Prism in the tray and fixes for Linux.")}</p>
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
              {c.action === "appearance" && (
                <button type="button" className="linkbtn" onClick={() => openSheet({ kind: "settings", section: "appearance" })}>
                  {t("Try it")}
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
