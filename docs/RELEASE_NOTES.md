# Prism 1.1.0 — One beam. Many rays.

A fast, open-source download manager for Windows, Linux and macOS, with browser integration
and video downloads.

## What's new in 1.1.0

* **The browser extension is in the Chrome Web Store.** Add it to Chrome, Edge, Brave, Opera
  or Vivaldi in one click, and the store keeps it up to date:
  [Prism Download Manager](https://chromewebstore.google.com/detail/prism-download-manager/mmcdeiglkbfbicdjboocmhehodogilfl).
  Prism's setup (on first start, and in Settings › Browser integration) opens the store page in
  the browser you pick.
* **Added the extension by hand before?** That copy doesn't update by itself. After this update
  Prism shows what's new and walks you through switching: remove the old copy on
  `chrome://extensions`, then add Prism from the store. Adding it by hand still works: Settings ›
  Browser integration › *Add it by hand instead*.
* **Zen and Helium:** Prism connects to Zen (built on Firefox, it uses the Firefox extension)
  and to Helium (it adds Prism from the Chrome Web Store), and both show up in Settings ›
  Browser integration.
* Settings › Browser integration shows **Repair** whenever a browser in the list needs it, also
  while the extension is connected in another browser.
* **Playlists:**
  * Every video is saved under its own title. Some were saved as *Video [id]*, and a single
    video picked from a playlist got the playlist's name.
  * **Number playlist videos** (Settings › Video & streams) starts each file name with the video's
    position: `01 - Title.mkv`.
  * **One at a time** in the video window downloads a playlist's videos one after another (in the
    new *One at a time* queue).
  * Thanks to [@asalia22](https://github.com/asalia22) for the suggestions!
* **The container in Settings › Video & streams (MKV, WebM) is used.** Videos were saved as MP4
  whatever you chose.
* **Pick your "download complete" sound:** ten new ones in Settings › Sounds (Prism, Pop,
  Kalimba, Snap, Cascade, Glide, Harp, Droplet, Music box, Sparkle). A sound plays when you pick
  it.
* **HLS and DASH downloads show their real connections:** the connections list shows the parts
  being downloaded right now instead of every part of the stream, and the file map fills as the
  download goes. Thanks to [@uuc110](https://github.com/uuc110)!
* A **What's new** window after an update, also in Settings › About Prism.

### Also new since 1.0.8 (Prism 1.1.0)

* Choose the quality of an HLS or DASH stream a page plays; picking a video quality opens the
  Download File window; "Open a progress window for new downloads" works; smaller fixes. From a
  pull request by [@uuc110](https://github.com/uuc110).

### Prism 1.0.8: security fixes

* Linux: the browser cookies Prism hands to yt-dlp for a video are no longer readable by other
  accounts on the computer.
* The browser extension no longer adds SameSite=Strict cookies to downloads another site
  started, and the in-page *Download video* button reacts only to your own clicks.
* Both were reported privately by [@pepopepopepo](https://github.com/pepopepopepo) — thank you!

## Downloads

| Your system | File |
|---|---|
| Windows 10 / 11 | `Prism_1.1.0_x64-setup.exe` (recommended) · `Prism_1.1.0_x64_en-US.msi` (all users) · `Prism-1.1.0-windows-x64-portable.zip` |
| macOS — Apple Silicon | `Prism_1.1.0_aarch64.dmg` |
| macOS — Intel | `Prism_1.1.0_x64.dmg` |
| Ubuntu / Debian / Mint | `Prism_1.1.0_amd64.deb` |
| Fedora / openSUSE | `Prism-1.1.0-1.x86_64.rpm` |
| Any Linux | `Prism_1.1.0_amd64.AppImage` |
| Browser extension | [Chrome Web Store](https://chromewebstore.google.com/detail/prism-download-manager/mmcdeiglkbfbicdjboocmhehodogilfl) (Chrome, Edge, Brave, Opera, Vivaldi) · `prism-firefox.zip` (Firefox) |

Step-by-step guides: [installing Prism](https://github.com/FortoGraphy/prism-download-manager/blob/main/docs/guide/installation.md) ·
[installing the browser extension](https://github.com/FortoGraphy/prism-download-manager/blob/main/docs/guide/browser-extension.md).
Verify downloads with `SHA256SUMS.txt`.

## What's inside

* **Multi-connection engine** written in Rust: up to 32 connections per file, dynamic
  segmentation (a freed connection splits the largest remaining range), automatic
  detection of server connection limits, writes straight into the final file.
* **Resume that survives crashes**: pause, quit, lose power — Prism continues where it
  stopped and validates the file against the server.
* **Browser integration**: click a download link and Prism takes over. A *Download video*
  button over video players, a popup listing every stream on the page, right-click menus.
* **Video and audio**: YouTube and every site yt-dlp supports. Choose **MP4 + quality** (up
  to 8K/HDR) or **MP3 only**. Subtitles, chapters, thumbnails, SponsorBlock.
* **More protocols**: FTP/FTPS, HLS and DASH streams, BitTorrent and magnet links.
* **Organisation**: categories, queues with schedules and speed limits, actions when a
  queue finishes (sleep, shut down…), site grabber, batch downloads, clipboard monitor.
* **Liquid-glass UI** with dark and light themes, six accent colours and a mini window.

## Known limitations

* The installers are **not code-signed** (signing certificates are paid):
  * Windows SmartScreen: click **More info → Run anyway**.
  * macOS: run `xattr -dr com.apple.quarantine /Applications/Prism.app` once (or System
    Settings → Privacy & Security → **Open Anyway**). In-app updates don't need this again.
* Firefox: Prism isn't in Firefox Add-ons yet. Its extension is loaded by hand, and Firefox
  keeps unsigned add-ons only until restart, except in Developer Edition / Nightly / ESR.
* macOS builds are produced by CI and tested there; feedback from real Macs is very welcome.
* Flatpak browsers on Linux can't talk to native apps (a browser sandbox limitation) — use
  the deb/rpm version of your browser.

Found a bug? [Open an issue](https://github.com/FortoGraphy/prism-download-manager/issues/new/choose).
Like Prism? A ⭐ helps a lot.
