# Prism 1.1.2 — One beam. Many rays.

A fast, open-source download manager for Windows, Linux and macOS, with browser integration
and video downloads.

## What's new in 1.1.2

* **Arabic and Indonesian:** Prism now speaks 8 languages. In Arabic the whole window is mirrored
  right to left. Native speakers offered to check the translations: thank you!
* **Copied links without popups:** turn off *Ask before adding copied links* in Settings ›
  General and copied links go straight into the list as *Download later*, like JDownloader's
  link list (a notification says what was added). This setting did nothing before.
* **A fuller torrent window:** the file list fills the window, the category is picked from the
  torrent's files (and decides the folder), and *Download later ▾* can add the torrent to a
  queue, like the Download File window.
* **Delete with files** asks once, plainly: it no longer shows a checkbox for what you already
  chose.
* The Chrome Web Store extension (1.1.0) keeps working as it is; nothing to update there.

### Prism 1.1.1

* Czech, German, Spanish, French and Italian, besides English; Prism follows your system's
  language (Settings › General › Language).
* The portable version finds the browser extension again
  ([#12](https://github.com/FortoGraphy/prism-download-manager/issues/12)); torrents with several
  files get their own folder; Start minimized and starting with the computer keep Prism in the
  tray; Zen and Firefox with new profiles connect on Linux; the rpm works with RPM Fusion's ffmpeg
  ([#10](https://github.com/FortoGraphy/prism-download-manager/issues/10)).

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
| Windows 10 / 11 | `Prism_1.1.2_x64-setup.exe` (recommended) · `Prism_1.1.2_x64_en-US.msi` (all users) · `Prism-1.1.2-windows-x64-portable.zip` |
| macOS — Apple Silicon | `Prism_1.1.2_aarch64.dmg` |
| macOS — Intel | `Prism_1.1.2_x64.dmg` |
| Ubuntu / Debian / Mint | `Prism_1.1.2_amd64.deb` |
| Fedora / openSUSE | `Prism-1.1.2-1.x86_64.rpm` |
| Any Linux | `Prism_1.1.2_amd64.AppImage` |
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
