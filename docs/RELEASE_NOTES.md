# Prism 1.1.6 — One beam. Many rays.

A fast, open-source download manager for Windows, Linux and macOS, with browser integration
and video downloads.

## What's new in 1.1.6

* **The light theme is fully light on Windows**
  ([#21](https://github.com/FortoGraphy/prism-download-manager/issues/21)). With the theme set to
  match the system, the Mica glass behind the window was always dark, so a light Windows got a
  dark sidebar and window edge. It now follows Windows.
* **Brave Origin** connects to Prism on Linux and macOS: Prism registers itself in Brave Origin's
  own folder too. Thanks to u/CredibleWrong for finding it!
* **VK videos** ([#25](https://github.com/FortoGraphy/prism-download-manager/issues/25)): the
  *Download video* button and the quality list work on vk.ru and vkvideo.ru.
* **YouTube while signed in** ([#23](https://github.com/FortoGraphy/prism-download-manager/pull/23)):
  when YouTube rejects the signed-in browser's cookies (*The page needs to be reloaded*), Prism
  tries the video again without them. Thanks to BiparJoy!
* **Firefox:** Prism is ready for the Firefox Add-ons version of the extension (its own ID,
  `prism@prismdl.site`). A copy loaded by hand keeps working.
* The Chrome Web Store extension (1.1.0) keeps working as it is; nothing to update there.

### Prism 1.1.5

* Links to .torrent files open *Add torrent* instead of failing
  ([#20](https://github.com/FortoGraphy/prism-download-manager/issues/20)).

### Prism 1.1.4

* The window opens again on Linux
  ([#18](https://github.com/FortoGraphy/prism-download-manager/issues/18)).
* Lighter in the tray ([#11](https://github.com/FortoGraphy/prism-download-manager/issues/11)):
  after a minute there, Prism closes its window to free the web view's memory.
* Compact view (Settings › Appearance); magnet links and .torrent files open in Prism on Linux;
  with *Close button hides to the tray* off, the close button quits Prism.

### Prism 1.1.3

* Downloads from sites with a robot check (like softpedia.com) are left to the browser
  ([#14](https://github.com/FortoGraphy/prism-download-manager/issues/14)), and an error page is
  never saved as your file.
* *Remove downloads whose files were deleted* (Settings › General, off by default).

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
| Windows 10 / 11 | `Prism_1.1.6_x64-setup.exe` (recommended) · `Prism_1.1.6_x64_en-US.msi` (all users) · `Prism-1.1.6-windows-x64-portable.zip` |
| macOS — Apple Silicon | `Prism_1.1.6_aarch64.dmg` |
| macOS — Intel | `Prism_1.1.6_x64.dmg` |
| Ubuntu / Debian / Mint | `Prism_1.1.6_amd64.deb` |
| Fedora / openSUSE | `Prism-1.1.6-1.x86_64.rpm` |
| Any Linux | `Prism_1.1.6_amd64.AppImage` |
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
