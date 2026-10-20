import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Icon, type IconName } from "../design/icons";
import { api, type BrowserIntegration, type IntegrationStatus } from "../lib/api";
import { useApp } from "../lib/store";
import { toast } from "../lib/ui";
import { copyText } from "../lib/win";

/** Browsers the guide offers, in display order (ids match `prism_native_host::Browser::id`). */
const ORDER = ["chrome", "edge", "brave", "opera", "vivaldi", "helium", "chromium", "firefox", "zen"] as const;
const SHORT: Record<string, string> = {
  chrome: "Chrome",
  edge: "Edge",
  brave: "Brave",
  opera: "Opera",
  vivaldi: "Vivaldi",
  helium: "Helium",
  chromium: "Chromium",
  firefox: "Firefox",
  zen: "Zen",
};
const PAGE: Record<string, string> = {
  chrome: "chrome://extensions",
  edge: "edge://extensions",
  brave: "brave://extensions",
  opera: "opera://extensions",
  vivaldi: "vivaldi://extensions",
  helium: "chrome://extensions",
  chromium: "chrome://extensions",
  firefox: "about:debugging#/runtime/this-firefox",
  zen: "about:debugging#/runtime/this-firefox",
};
/** Firefox-based browsers: Firefox's extension, loaded as a temporary add-on. */
const FIREFOX_FAMILY = ["firefox", "zen"];

/** Prism's extension in the Chrome Web Store: Chrome, Edge, Brave, Opera, Vivaldi, Helium and Chromium install it from there. */
export const EXTENSION_STORE_URL = "https://chromewebstore.google.com/detail/prism-download-manager/mmcdeiglkbfbicdjboocmhehodogilfl";
/** The store's install button as each browser labels it (Chrome's label elsewhere). */
const ADD_LABEL: Record<string, string> = { brave: "Add to Brave", opera: "Add to Opera" };

const OS: "windows" | "mac" | "linux" = /Mac/i.test(navigator.userAgent) ? "mac" : /Linux/i.test(navigator.userAgent) ? "linux" : "windows";

/** Polls the integration status while mounted; `connected` turns true when the extension says hello. */
export function useExtensionStatus(intervalMs = 2000) {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  useEffect(() => {
    let alive = true;
    const tick = () =>
      void api.integrationStatus().then(
        (s) => alive && setStatus(s),
        () => undefined,
      );
    tick();
    const t = window.setInterval(tick, intervalMs);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [intervalMs]);
  return { status, connected: !!status?.extensionConnected };
}

function pickDefault(browsers: BrowserIntegration[]): string {
  const installed = ORDER.filter((id) => browsers.some((b) => b.browser === id && b.installed && b.supported !== false));
  return installed[0] ?? "chrome";
}

/**
 * Step-by-step guide that gets the browser extension installed: pick your browser, open Prism in
 * the Chrome Web Store and add it (Firefox: load the Prism folder as a temporary add-on) — with a
 * live check that turns green the moment the extension connects.
 */
export function BrowserConnect({ status, connected, hideOwnStatus }: { status: IntegrationStatus | null; connected: boolean; hideOwnStatus?: boolean }) {
  const browsers = useMemo(() => {
    const list = status?.browsers ?? [];
    const shown = ORDER.filter((id) => list.some((b) => b.browser === id && b.installed && b.supported !== false));
    return shown.length ? shown : (["chrome", "edge", "firefox"] as string[]);
  }, [status]);
  const [browser, setBrowser] = useState<string | null>(null);
  const current = browser ?? (status ? pickDefault(status.browsers) : "chrome");
  const firefox = FIREFOX_FAMILY.includes(current);
  // "Prefer to add it by hand?" (below the store guide): the unpacked extension Prism ships.
  const [byHand, setByHand] = useState(false);
  const [folder, setFolder] = useState<string | null>(null);
  useEffect(() => {
    if (firefox || byHand) void api.extensionFolder(firefox).then(setFolder, () => setFolder(null));
  }, [firefox, byHand]);
  // A Prism extension someone loaded by hand earlier ("Load unpacked"): the store version
  // updates by itself, but the browser won't add it while the old one is still installed.
  const manual = !firefox && !byHand && status?.extensionInstallType === "development";
  // Store steps start after the "remove the copy added by hand" step when that one shows.
  const step = manual ? 1 : 0;

  const name = SHORT[current] ?? current;
  const paste = OS === "mac" ? "⌘ V" : "Ctrl V";
  const openPage = async () => {
    const copied = await copyText(PAGE[current]);
    let opened = true;
    try {
      await api.openBrowser(current);
    } catch {
      opened = false;
    }
    toast(copied ? "Address copied" : `Type ${PAGE[current]}`, {
      kind: copied ? "success" : undefined,
      body: `${opened ? "" : `Open ${name}, then `}click the address bar, press ${paste} and Enter.`,
      ms: 6000,
    });
  };
  const openStore = async () => {
    try {
      await api.openExtensionStore(current);
    } catch {
      toast("Couldn't open the browser", { body: "Copy the store link and open it in your browser.", ms: 6000 });
    }
  };
  const copyStoreLink = async () => {
    if (await copyText(EXTENSION_STORE_URL)) toast("Store link copied", { kind: "success", ms: 1800 });
  };
  const copyFolder = async () => {
    if (folder && (await copyText(folder))) toast("Folder path copied", { kind: "success", ms: 1800 });
  };
  const pasteHint =
    OS === "mac" ? (
      <>
        In the window that opens press <span className="kbd">⌘</span> <span className="kbd">⇧</span> <span className="kbd">G</span>, paste the path and press{" "}
        <span className="kbd">Return</span>.
      </>
    ) : OS === "linux" ? (
      <>
        In the window that opens press <span className="kbd">Ctrl</span> <span className="kbd">L</span>, paste the path and press <span className="kbd">Enter</span>.
      </>
    ) : (
      <>
        Paste the path into the folder field of the window that opens and press <b>Select Folder</b>.
      </>
    );

  return (
    <div className="bconnect">
      <div className="bconnect__pick" role="radiogroup" aria-label="Your browser">
        {browsers.map((id) => (
          <button key={id} type="button" role="radio" aria-checked={id === current} className={`bchip${id === current ? " on" : ""}`} onClick={() => setBrowser(id)}>
            <Icon name="browser" size={14} /> {SHORT[id] ?? id}
          </button>
        ))}
      </div>

      {firefox ? (
        <ol className="bsteps">
          <li className="bstep">
            <span className="bstep__n">1</span>
            <div className="bstep__txt">
              <div className="bstep__t">Open the add-ons debugging page</div>
              <div className="bstep__d">
                The button copies <code className="selectable">{PAGE[current]}</code> and opens {name} — click its address bar, press{" "}
                {paste.split(" ").map((k) => (
                  <span key={k}>
                    <span className="kbd">{k}</span>{" "}
                  </span>
                ))}
                and <span className="kbd">Enter</span>.
              </div>
            </div>
            <button type="button" className="btn btn--primary btn--sm" onClick={openPage}>
              <Icon name="copy" size={14} /> Copy &amp; open {name}
            </button>
          </li>
          <li className="bstep">
            <span className="bstep__n">2</span>
            <div className="bstep__txt">
              <div className="bstep__t">Click “Load Temporary Add-on…”</div>
              <div className="bstep__d">It's in the “This {name}” section of that page.</div>
            </div>
            <FakeButton label="Load Temporary Add-on…" />
          </li>
          <li className="bstep bstep--wide">
            <span className="bstep__n">3</span>
            <div className="bstep__txt">
              <div className="bstep__t">Pick manifest.json in the Prism folder</div>
              <div className="bstep__d">{pasteHint}</div>
            </div>
            <div className="howto__path bstep__full">
              <span className="t-mono ellipsis selectable" title={folder ?? undefined}>
                {folder ?? "…"}
              </span>
              <button type="button" className="btn btn--sm" disabled={!folder} onClick={copyFolder}>
                <Icon name="copy" size={14} /> Copy path
              </button>
              <button type="button" className="btn btn--sm btn--ghost" disabled={!folder} onClick={() => folder && void api.openPath(folder)}>
                <Icon name="folder-open" size={14} /> Show
              </button>
            </div>
          </li>
        </ol>
      ) : (
        <ol className="bsteps">
          {manual && (
            <li className="bstep">
              <span className="bstep__n">1</span>
              <div className="bstep__txt">
                <div className="bstep__t">Remove the Prism you added by hand</div>
                <div className="bstep__d">
                  The store version updates by itself. On <code className="selectable">{PAGE[current]}</code> click <b>Remove</b> under Prism. The button copies the address and opens {name}.
                </div>
              </div>
              <button type="button" className="btn btn--sm" onClick={openPage}>
                <Icon name="copy" size={14} /> Copy &amp; open {name}
              </button>
            </li>
          )}
          <li className="bstep">
            <span className="bstep__n">{step + 1}</span>
            <div className="bstep__txt">
              <div className="bstep__t">Open Prism in the Chrome Web Store</div>
              <div className="bstep__d">
                {current === "edge"
                  ? "Edge asks once to allow extensions from other stores: click Allow at the top of the page."
                  : current === "opera"
                    ? "Opera first offers its free “Install Chrome Extensions” add-on: add it, then come back to the page."
                    : `The store page opens in ${name}.`}{" "}
                <button type="button" className="linkbtn" onClick={copyStoreLink}>
                  Copy link
                </button>
              </div>
            </div>
            <button type="button" className="btn btn--primary" onClick={openStore}>
              <Icon name="browser" size={15} /> Open in {name}
            </button>
          </li>
          <li className="bstep">
            <span className="bstep__n">{step + 2}</span>
            <div className="bstep__txt">
              <div className="bstep__t">Click “{ADD_LABEL[current] ?? "Add to Chrome"}”</div>
              <div className="bstep__d">The blue button at the top right of the store page. It's free.</div>
            </div>
            <FakeButton label={ADD_LABEL[current] ?? "Add to Chrome"} />
          </li>
          <li className="bstep">
            <span className="bstep__n">{step + 3}</span>
            <div className="bstep__txt">
              <div className="bstep__t">Confirm with “Add extension”</div>
              <div className="bstep__d">{name} asks once whether to add Prism. From then on it updates Prism by itself.</div>
            </div>
            <FakeButton label="Add extension" />
          </li>
          <li className="bstep">
            <span className="bstep__n">{step + 4}</span>
            <div className="bstep__txt">
              <div className="bstep__t">Pin Prism next to the address bar</div>
              <div className="bstep__d">Click the puzzle icon, then the pin next to Prism. The check below turns green as soon as it's connected.</div>
            </div>
            <FakeButton label="Pin" icon="pin" />
          </li>
        </ol>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {hideOwnStatus && connected && !manual ? null : connected && !manual ? (
          <motion.div
            key="ok"
            className="bstatus bstatus--ok"
            role="status"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
          >
            <span className="bstatus__icon">
              <Icon name="check" size={16} strokeWidth={2.4} />
            </span>
            <div>
              <b>Connected!</b> Downloads and videos from your browser now open in Prism.
              <div className="bstatus__sub">Tip: pin the Prism icon next to the address bar (puzzle icon → pin).</div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="wait" className="bstatus" role="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <span className="bstatus__spin" aria-hidden="true" />
            <div>
              {manual ? "Waiting for the store version…" : "Waiting for the extension…"} <span className="text-tertiary">this turns green as soon as it's installed.</span>
              {firefox && <div className="bstatus__sub">{name} removes temporary add-ons when it restarts — Chrome, Edge or Brave keep the extension for good, from the Chrome Web Store.</div>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!firefox && (
        <div className="bconnect__manual">
          <button type="button" className="disclose" aria-expanded={byHand} onClick={() => setByHand(!byHand)}>
            <Icon name={byHand ? "chevron-down" : "chevron-right"} size={12} strokeWidth={2.2} /> Prefer to add it by hand?
          </button>
          {byHand && (
            <>
              <p className="t-small text-tertiary">
                Without the store: load the folder Prism keeps up to date. A copy added this way doesn't update by itself — after a Prism update, click ↻ next to Prism on the extensions page.
              </p>
              <ol className="bsteps">
                <li className="bstep">
                  <span className="bstep__n">1</span>
                  <div className="bstep__txt">
                    <div className="bstep__t">Open the extensions page</div>
                    <div className="bstep__d">
                      The button copies <code className="selectable">{PAGE[current]}</code> and opens {name}.
                    </div>
                  </div>
                  <button type="button" className="btn btn--sm" onClick={openPage}>
                    <Icon name="copy" size={14} /> Copy &amp; open {name}
                  </button>
                </li>
                <li className="bstep">
                  <span className="bstep__n">2</span>
                  <div className="bstep__txt">
                    <div className="bstep__t">Turn on Developer mode</div>
                    <div className="bstep__d">The switch is {current === "edge" ? "in the left sidebar" : "in the top-right corner"} of the page.</div>
                  </div>
                  <FakeToggle />
                </li>
                <li className="bstep bstep--wide">
                  <span className="bstep__n">3</span>
                  <div className="bstep__txt">
                    <div className="bstep__t">Click “Load unpacked” and choose the Prism folder</div>
                    <div className="bstep__d">{pasteHint}</div>
                  </div>
                  <FakeButton label="Load unpacked" />
                  <div className="howto__path bstep__full">
                    <span className="t-mono ellipsis selectable" title={folder ?? undefined}>
                      {folder ?? "…"}
                    </span>
                    <button type="button" className="btn btn--sm" disabled={!folder} onClick={copyFolder}>
                      <Icon name="copy" size={14} /> Copy path
                    </button>
                    <button type="button" className="btn btn--sm btn--ghost" disabled={!folder} onClick={() => folder && void api.openPath(folder)}>
                      <Icon name="folder-open" size={14} /> Show
                    </button>
                  </div>
                </li>
              </ol>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Miniature of the browser's Developer-mode switch, so people know what to look for. */
function FakeToggle() {
  return (
    <span className="bmini" aria-hidden="true">
      <span className="bmini__label">Developer mode</span>
      <span className="bmini__toggle" />
    </span>
  );
}

function FakeButton({ label, icon }: { label: string; icon?: IconName }) {
  return (
    <span className="bmini" aria-hidden="true">
      <span className="bmini__btn">
        {icon && <Icon name={icon} size={12} />} {label}
      </span>
    </span>
  );
}

const DISMISS_KEY = "prism.connectBanner.dismissed";
const OUTDATED_DISMISS_KEY = "prism.extensionOutdatedDismissed";

/**
 * Slim reminder above the download list until the extension has ever connected (for people who
 * skipped the onboarding step). Dismissable; the sidebar keeps a "Browser not connected" entry.
 */
export function ConnectBanner({ onOpen }: { onOpen: () => void }) {
  const { status } = useExtensionStatus(15_000);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  // An extension older than the app: after an update the browser keeps running the old files
  // of an unpacked extension until it is reloaded. Hidden per version pair once dismissed.
  const outdatedKey = status?.extensionOutdated ? `${status.extensionVersion}>${status.appVersion}` : "";
  const [outdatedDismissed, setOutdatedDismissed] = useState<string | null>(() => {
    try {
      return localStorage.getItem(OUTDATED_DISMISS_KEY);
    } catch {
      return null;
    }
  });
  const onboarded = useApp((st) => st.settings?.onboardingDone ?? true);
  const outdated = !!outdatedKey && outdatedDismissed !== outdatedKey;
  const show = outdated || (onboarded && !!status && !status.lastSeen && !dismissed);
  const dismiss = () => {
    if (outdated) {
      setOutdatedDismissed(outdatedKey);
      try {
        localStorage.setItem(OUTDATED_DISMISS_KEY, outdatedKey);
      } catch {
        /* private storage unavailable: hide for this session only */
      }
      return;
    }
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private storage unavailable: hide for this session only */
    }
  };
  // Always rendered: the slot is a fixed row of the main grid (empty when hidden).
  return (
    <div className="cbanner-slot">
      <AnimatePresence initial={false}>
        {show && (
          <motion.div
            className="cbanner"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="cbanner__inner">
              <span className="cbanner__icon">
                <Icon name="browser" size={16} />
              </span>
              {outdated ? (
                status?.extensionInstallType === "development" ? (
                  <span className="cbanner__txt">
                    <b>Prism's extension is now in the Chrome Web Store.</b> Yours ({status?.extensionVersion}) was added by hand and won't update by itself: switch to the store version, it takes a minute.
                  </span>
                ) : (
                  <span className="cbanner__txt">
                    <b>Your browser still runs an older Prism extension</b> ({status?.extensionVersion}, Prism is {status?.appVersion}). Reload it: on {OS === "mac" ? "chrome://extensions" : "chrome://extensions or edge://extensions"} click ↻ next to Prism, or restart the browser.
                  </span>
                )
              ) : (
                <span className="cbanner__txt">
                  <b>Catch downloads straight from your browser.</b> Add the Prism extension — it takes about a minute.
                </span>
              )}
              <button type="button" className="btn btn--primary btn--sm" onClick={onOpen}>
                {outdated ? (status?.extensionInstallType === "development" ? "Switch" : "Show how") : "Connect browser"}
              </button>
              <button type="button" className="tb-btn" aria-label="Hide this reminder" data-tip="Hide" onClick={dismiss}>
                <Icon name="close" size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
