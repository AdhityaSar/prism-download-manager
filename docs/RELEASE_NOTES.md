# Prism 1.0.0 — One beam. Many rays.

The first public release of Prism: a fast, open-source download manager for Windows, Linux
and macOS, with browser integration and video downloads.

## Downloads

| Your system | File |
|---|---|
| Windows 10 / 11 | `Prism_1.0.0_x64-setup.exe` (recommended) · `Prism_1.0.0_x64_en-US.msi` (all users) · `Prism-1.0.0-windows-x64-portable.zip` |
| macOS — Apple Silicon | `Prism_1.0.0_aarch64.dmg` |
| macOS — Intel | `Prism_1.0.0_x64.dmg` |
| Ubuntu / Debian / Mint | `Prism_1.0.0_amd64.deb` |
| Fedora / openSUSE | `Prism-1.0.0-1.x86_64.rpm` |
| Any Linux | `Prism_1.0.0_amd64.AppImage` |
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
  * macOS: **right-click Prism → Open** the first time (or
    `xattr -dr com.apple.quarantine /Applications/Prism.app`).
* The extension is installed manually (Developer mode → *Load unpacked*); store listings
  are not available yet. Firefox keeps unsigned add-ons only until restart, except in
  Developer Edition / Nightly / ESR.
* macOS builds are produced by CI and tested there; feedback from real Macs is very welcome.
* Flatpak browsers on Linux can't talk to native apps (a browser sandbox limitation) — use
  the deb/rpm version of your browser.

Found a bug? [Open an issue](https://github.com/FortoGraphy/prism-download-manager/issues/new/choose).
Like Prism? A ⭐ helps a lot.
