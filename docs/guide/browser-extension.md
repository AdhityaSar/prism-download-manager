# Installing the Prism browser extension

The extension is what makes Prism feel like magic in the browser:

* clicking a download link opens Prism's **Download File** window instead of the browser's
  download bar (hold **Alt** while clicking to let the browser handle it),
* a **Download video** button appears over video players — choose **MP4 + quality** or
  **MP3**,
* right-click menu: *Download with Prism*, *Download all links / images / videos*,
* the toolbar popup lists every video and audio stream found on the page.

> The Prism **app must be installed first** — the extension talks to it through a small
> helper that the installer registers. Prism → **Settings → Browser integration** shows the
> status of every browser and repairs it with one click.

> **Easiest way:** Prism guides you through this on first start, and any time from
> **Settings → Browser integration**. It copies the extensions-page address, opens your
> browser, shows exactly which folder to pick, and turns green when the extension connects.
> The steps below are the same thing by hand.

## Get the extension files

Download **`prism-chromium.zip`** (Chrome, Edge, Brave, Opera, Vivaldi, Chromium) and/or
**`prism-firefox.zip`** from the [latest release](https://github.com/FortoGraphy/prism-download-manager/releases/latest) and unzip them
into a folder that will **stay** there (for example `Documents/Prism Extension`). Don't
delete the folder afterwards — the browser loads the extension from it.

Tip: the installed app also contains the unpacked extension —
Prism → Settings → Browser integration → **Open folder**:

| System | Folder |
|---|---|
| Windows (setup.exe) | `%LOCALAPPDATA%\Prism\extension\chromium` |
| Windows (MSI) | `C:\Program Files\Prism\extension\chromium` |
| Linux (deb / rpm) | `/usr/lib/Prism/extension/chromium` |
| Linux (AppImage) | `~/.local/share/prism/extension/chromium` (a copy Prism keeps up to date) |
| macOS | `~/Library/Application Support/Prism/extension/chromium` (a copy Prism keeps up to date) |

## Google Chrome (Windows, macOS, Linux)

1. Open **`chrome://extensions`**.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the unzipped **`chromium`** folder (the one containing
   `manifest.json`).
4. Pin the Prism icon: click the puzzle icon in the toolbar → pin **Prism**.
5. Click the Prism icon — it should say **Connected**.

## Microsoft Edge

1. Open **`edge://extensions`**.
2. Turn on **Developer mode** (left sidebar, bottom).
3. **Load unpacked** → select the **`chromium`** folder.

## Brave · Opera · Vivaldi · Chromium

Same steps as Chrome, at:

| Browser | Address |
|---|---|
| Brave | `brave://extensions` |
| Opera | `opera://extensions` (Developer mode toggle at top right) |
| Vivaldi | `vivaldi://extensions` |
| Chromium | `chrome://extensions` |

## Firefox

Firefox only keeps unsigned extensions until it restarts, so choose one of:

* **Try it now (until restart):** open **`about:debugging#/runtime/this-firefox`** →
  **Load Temporary Add-on…** → pick `manifest.json` inside the unzipped **`firefox`** folder.
* **Permanent (Firefox Developer Edition / Nightly / ESR):** open `about:config`, set
  `xpinstall.signatures.required` to `false`, then open `about:addons` → gear icon →
  **Install Add-on From File…** → pick `prism-firefox.zip`.

## After updating Prism

Browsers don't reload an unpacked extension's files by themselves. After Prism updates, open
the extensions page (`chrome://extensions`, `edge://extensions`, …) and click the reload arrow
**↻** next to Prism, or restart the browser. Prism shows a reminder in its window while the
browser still runs an older extension.

The folders in the table above are updated together with Prism. If you loaded an unzipped
`prism-chromium.zip` instead, unzip the new release's zip over that folder first.

## Already using IDM or another download manager?

Their browser extensions compete for the same downloads. Disable (or remove) the
*IDM Integration Module* or similar extensions in `chrome://extensions`, otherwise they may
grab downloads before Prism sees them.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Popup says **Not connected** / *Prism isn't reachable* | Start Prism (it lives in the tray), then click **Retry** in the popup. Still failing → Prism → Settings → Browser integration → **Repair**, then restart the browser. |
| Downloads still go to the browser | Make sure *Capture downloads* is on in the popup; check the file type is in Settings → File types (e.g. images are not captured by default); `blob:` downloads (some web apps) can't be handed over. |
| No **Download video** button | Hover the video; check *Show video button* in the extension options; reload the page after installing. |
| "Extension ID" mismatch in Browser integration | You loaded a modified copy — use the official zip; its ID is `mmcdeiglkbfbicdjboocmhehodogilfl`. |
| Linux Flatpak/Snap browsers | Flatpak browsers can't run native helpers (browser limitation). Snap Firefox asks for permission once. Use a deb/rpm browser for full integration. |

## Privacy

The extension sends a download's address, the page it came from, the browser's user agent
and that site's cookies **only to the Prism app on your own computer** (through native
messaging — no network, no servers, no analytics). This is what lets downloads that need
your login continue in Prism.
