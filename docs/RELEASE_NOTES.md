# Prism 1.1.1 — One beam. Many rays.

A fast, open-source download manager for Windows, Linux and macOS, with browser integration
and video downloads.

## What's new in 1.1.1

* **Prism speaks your language:** Czech, German, Spanish, French and Italian, besides English.
  Prism follows your system's language; pick another one in Settings › General › Language.
  Thanks for the idea on Reddit! Spotted a clumsy translation? Tell us in an issue.
* **Portable version:** the browser extension finds Prism again. The portable Prism keeps its
  data next to `prism.exe`, but the helper the extension talks to looked for it in
  `%APPDATA%\Prism`, so *Start Prism* and *Sync from Prism* timed out
  ([#12](https://github.com/FortoGraphy/prism-download-manager/issues/12)).
* **Torrents with several files are saved in their own folder** (named after the torrent)
  instead of spilling into your download folder, and *Open folder* opens it.
* **Start minimized** and starting with your computer keep Prism in the tray; the window
  appeared anyway.
* **Linux:** Zen 1.18.6+ and Firefox 147+ keep new profiles in `~/.config`. Prism now finds them,
  so Repair connects them (the extension said *No such native application*).
* **Fedora / openSUSE:** the rpm needs any `/usr/bin/ffmpeg` instead of `ffmpeg-free`, so the
  full ffmpeg from RPM Fusion works
  ([#10](https://github.com/FortoGraphy/prism-download-manager/issues/10)).
* The Chrome Web Store extension (1.1.0) keeps working as it is; nothing to update there.

### Prism 1.1.0

* The browser extension is in the
  [Chrome Web Store](https://chromewebstore.google.com/detail/prism-download-manager/mmcdeiglkbfbicdjboocmhehodogilfl):
  one click to add it to Chrome, Edge, Brave, Opera, Vivaldi or Helium, and it updates itself.
* Zen and Helium in Settings › Browser integration; Repair whenever a browser needs it.
* Playlists: every video under its own title, optional numbering (`01 - Title.mkv`) and
  *One at a time*. The container from Settings (MKV, WebM) is used. Thanks to
  [@asalia22](https://github.com/asalia22)!
* Ten new "download complete" sounds, real connections for HLS and DASH downloads (thanks to
  [@uuc110](https://github.com/uuc110)) and a *What's new* window after updates.

## Downloads

| Your system | File |
|---|---|
| Windows 10 / 11 | `Prism_1.1.1_x64-setup.exe` (recommended) · `Prism_1.1.1_x64_en-US.msi` (all users) · `Prism-1.1.1-windows-x64-portable.zip` |
| macOS — Apple Silicon | `Prism_1.1.1_aarch64.dmg` |
| macOS — Intel | `Prism_1.1.1_x64.dmg` |
| Ubuntu / Debian / Mint | `Prism_1.1.1_amd64.deb` |
| Fedora / openSUSE | `Prism-1.1.1-1.x86_64.rpm` |
| Any Linux | `Prism_1.1.1_amd64.AppImage` |
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
