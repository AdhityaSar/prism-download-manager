# Prism 1.0.4 — One beam. Many rays.

A fast, open-source download manager for Windows, Linux and macOS, with browser integration
and video downloads.

## What's new in 1.0.4

* **Dropdowns in Settings work** — *Cookies from browser*, *Preferred quality*,
  *HTTP version* and the others (also *Category* in a download's properties). Their menu
  opened behind the Settings window, so a click seemed to do nothing
  ([#2](https://github.com/FortoGraphy/prism-download-manager/issues/2)). Tooltips inside
  dialogs show up too, and menus work from the keyboard: arrows and Enter pick, Esc closes
  only the menu.
* **Browser extension: the Download button over a video offers that video.** On LinkedIn
  and other feeds it listed every stream the page had loaded, largest first — often an ad
  playing elsewhere on the page
  ([#1](https://github.com/FortoGraphy/prism-download-manager/issues/1)). Now *This video*
  comes first, with all its qualities (720p / 640p / 360p on LinkedIn, best first); other
  streams on the page are listed below it. Streams without a file extension are labelled
  with their quality and format (`640p · MP4 · 5.1 MB`).
  * After updating, restart the browser (or click *Reload* for Prism on
    `chrome://extensions`) so it loads the new extension. On macOS Prism now refreshes its
    copy of the extension in Application Support when it starts (until now that copy stayed
    at the old version). If you installed it from a downloaded `prism-chromium.zip`, use the
    1.0.4 zip.

## Downloads

| Your system | File |
|---|---|
| Windows 10 / 11 | `Prism_1.0.4_x64-setup.exe` (recommended) · `Prism_1.0.4_x64_en-US.msi` (all users) · `Prism-1.0.4-windows-x64-portable.zip` |
| macOS — Apple Silicon | `Prism_1.0.4_aarch64.dmg` |
| macOS — Intel | `Prism_1.0.4_x64.dmg` |
| Ubuntu / Debian / Mint | `Prism_1.0.4_amd64.deb` |
| Fedora / openSUSE | `Prism-1.0.4-1.x86_64.rpm` |
| Any Linux | `Prism_1.0.4_amd64.AppImage` |
| Browser extension | `prism-chromium.zip` (Chrome, Edge, Brave, Opera, Vivaldi) · `prism-firefox.zip` |

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
* The extension is installed manually (Developer mode → *Load unpacked*); store listings
  are not available yet. Firefox keeps unsigned add-ons only until restart, except in
  Developer Edition / Nightly / ESR.
* macOS builds are produced by CI and tested there; feedback from real Macs is very welcome.
* Flatpak browsers on Linux can't talk to native apps (a browser sandbox limitation) — use
  the deb/rpm version of your browser.

Found a bug? [Open an issue](https://github.com/FortoGraphy/prism-download-manager/issues/new/choose).
Like Prism? A ⭐ helps a lot.
