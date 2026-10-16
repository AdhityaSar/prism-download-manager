# Prism 1.0.6 — One beam. Many rays.

A fast, open-source download manager for Windows, Linux and macOS, with browser integration
and video downloads.

## What's new in 1.0.6

* **Video menus open faster.** Prism now runs yt-dlp's unpacked build, which starts in about
  a third of the time (on Windows 0.35 s instead of 1–1.4 s per run; it is downloaded once,
  on the first start after the update). The *Download video* button starts reading the
  video while the pointer rests on it, a page Prism has read answers at once for 10 minutes
  (on a LinkedIn post: 2 s the first time, 0.2 s after that), and **Best quality** is
  offered right away, before the list of qualities arrives.
* **Prism tells you when the browser still runs an old extension.** Browsers don't reload an
  unpacked extension after an update, so a new version's fixes didn't reach them until the
  extension was reloaded. Prism now shows a reminder with the one click it takes, and
  Settings › Browser integration shows the extension's version.
* **LinkedIn and Instagram:** feed, company, profile and Explore pages get a clear message at
  once instead of a slow error; the button recognises more kinds of LinkedIn feed posts.
  Errors from pages Prism can't read say what to do, also with an older extension.
* **macOS:** the guide in the DMG now points to the extension folder Prism keeps up to date
  (`~/Library/Application Support/Prism/extension`), not to a copy that never updates.
* **After updating, click ↻ next to Prism on `chrome://extensions`** (or restart the browser)
  so it loads the new extension (1.0.6). If you installed it from a downloaded
  `prism-chromium.zip`, use the 1.0.6 zip.

## Downloads

| Your system | File |
|---|---|
| Windows 10 / 11 | `Prism_1.0.6_x64-setup.exe` (recommended) · `Prism_1.0.6_x64_en-US.msi` (all users) · `Prism-1.0.6-windows-x64-portable.zip` |
| macOS — Apple Silicon | `Prism_1.0.6_aarch64.dmg` |
| macOS — Intel | `Prism_1.0.6_x64.dmg` |
| Ubuntu / Debian / Mint | `Prism_1.0.6_amd64.deb` |
| Fedora / openSUSE | `Prism-1.0.6-1.x86_64.rpm` |
| Any Linux | `Prism_1.0.6_amd64.AppImage` |
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
