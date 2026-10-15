# Prism 1.0.3 — One beam. Many rays.

A fast, open-source download manager for Windows, Linux and macOS, with browser integration
and video downloads.

## What's new in 1.0.3

* **Updates from inside the app.** Prism checks for new versions by itself and shows
  "Prism 1.x is ready — Restart & update". It downloads the signed update, restarts into the
  new version and continues the downloads that were running. (Settings → General to turn the
  check off; About → Check for updates.) Installer, macOS app and AppImage update themselves;
  MSI, portable and deb/rpm installs get a link to the new version.
* **macOS fixes from real-world testing:**
  * Clicking Prism in the Dock brings back the window after it was closed; "Show Prism" (⌘0)
    is in the app menu too.
  * Dialogs (Download File, Download Complete, …) appear immediately and are freed when closed.
  * Clearer first-start instructions for Gatekeeper (`xattr` or Open Anyway). In-app updates
    don't need it again.
* **Trash:** a download moved to the trash while running can be restored and continues where
  it stopped (it used to start over). Emptying the trash no longer leaves `.prismpart` files.
* **Video:** streams (HLS/DASH) always get their audio joined in — it could be saved as a
  separate `.audio.m4a` after changing a setting. File names follow your name template
  (`Title [id].mp4`).
* **Selecting downloads with the checkboxes** works (a click selected and unselected at once).
* **Privacy:** the clipboard is read only when it changes and password-manager entries are
  skipped; browser cookies and passwords are removed from the database once a download is
  finished; Prism's data folder is private to your user on macOS and Linux.
* The browser helper restarts itself after an update, and Prism no longer says "Browser not
  connected" for a minute after every start.

## Downloads

| Your system | File |
|---|---|
| Windows 10 / 11 | `Prism_1.0.3_x64-setup.exe` (recommended) · `Prism_1.0.3_x64_en-US.msi` (all users) · `Prism-1.0.3-windows-x64-portable.zip` |
| macOS — Apple Silicon | `Prism_1.0.3_aarch64.dmg` |
| macOS — Intel | `Prism_1.0.3_x64.dmg` |
| Ubuntu / Debian / Mint | `Prism_1.0.3_amd64.deb` |
| Fedora / openSUSE | `Prism-1.0.3-1.x86_64.rpm` |
| Any Linux | `Prism_1.0.3_amd64.AppImage` |
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
