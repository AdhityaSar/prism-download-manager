# Prism 1.1.3 — One beam. Many rays.

A fast, open-source download manager for Windows, Linux and macOS, with browser integration
and video downloads.

## What's new in 1.1.3

* **Downloads from sites with a robot check work again**
  ([#14](https://github.com/FortoGraphy/prism-download-manager/issues/14)). Some sites, like
  softpedia.com, sit behind Cloudflare's check (*Just a moment…*) that only a web browser passes.
  Prism used to fail with *HTTP 403* or save the check page as your file (11 KB "completed"
  downloads). Now it tries the link first and leaves such downloads to the browser, with a
  notification saying so.
* **Remove downloads whose files were deleted** (Settings › General, off by default): finished
  downloads leave the list once their file is gone from the computer, checked when Prism starts
  and whenever its window comes to the front. Downloads on a drive that isn't connected stay.
  Thanks to ReyvID for the idea!
* **An error page is never saved as your file:** when a server answers a program, archive, disk
  image or media download with a small web page instead, the download fails with a clear message.
* The Chrome Web Store extension (1.1.0) keeps working as it is; nothing to update there.

### Prism 1.1.2

* Arabic (the whole window mirrored right to left) and Indonesian: 8 languages now.
* Copied links without popups: turn off *Ask before adding copied links* in Settings › General.
* A fuller torrent window (category, queue, free space) and *Delete with files* asking once.

### Prism 1.1.1

* Czech, German, Spanish, French and Italian, besides English; Prism follows your system's
  language (Settings › General › Language).
* The portable version finds the browser extension again
  ([#12](https://github.com/FortoGraphy/prism-download-manager/issues/12)); torrents with several
  files get their own folder; Start minimized and starting with the computer keep Prism in the
  tray; Zen and Firefox with new profiles connect on Linux; the rpm works with RPM Fusion's ffmpeg
  ([#10](https://github.com/FortoGraphy/prism-download-manager/issues/10)).

## Downloads

| Your system | File |
|---|---|
| Windows 10 / 11 | `Prism_1.1.3_x64-setup.exe` (recommended) · `Prism_1.1.3_x64_en-US.msi` (all users) · `Prism-1.1.3-windows-x64-portable.zip` |
| macOS — Apple Silicon | `Prism_1.1.3_aarch64.dmg` |
| macOS — Intel | `Prism_1.1.3_x64.dmg` |
| Ubuntu / Debian / Mint | `Prism_1.1.3_amd64.deb` |
| Fedora / openSUSE | `Prism-1.1.3-1.x86_64.rpm` |
| Any Linux | `Prism_1.1.3_amd64.AppImage` |
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
