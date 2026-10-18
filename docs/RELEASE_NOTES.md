# Prism 1.0.9 — One beam. Many rays.

A fast, open-source download manager for Windows, Linux and macOS, with browser integration
and video downloads.

## What's new in 1.0.9

* **Choose the quality of a stream a page plays.** When a page plays an HLS or DASH stream,
  the video menu lists its qualities (1080p, 720p, …) instead of a single *Stream* entry, and
  Prism downloads the one you pick.
* **Picking a video quality opens the Download File window**, where you can rename the file or
  choose the folder, as for any other download. To start right away, turn off *Show the
  Download File dialog* in Settings › General.
* **"Open a progress window for new downloads" works.** The setting did nothing. A new download
  now opens a small progress window, which closes when the download finishes.
* Videos you need to be signed in for list their qualities on the first try: Prism reads the
  page with your browser's cookies, as it already did for the download.
* Qualities are named as the video names them: some videos showed *1608p* instead of *1080p*.
* Smaller fixes: a slow speed no longer shows as *7.083333333333334 B/s*; the speed chart stays
  inside its panel; Settings › Browser integration shows *Repair* only when something needs
  repairing; the details and progress windows can't be shrunk until their content overlaps; an
  unknown file size shows *N/A*.
* These come from a pull request by [@uuc110](https://github.com/uuc110) — thank you!
* **After updating, click ↻ next to Prism on `chrome://extensions`** (or restart the browser)
  so it loads the new extension (1.0.9). If you installed it from a downloaded
  `prism-chromium.zip`, use the 1.0.9 zip.

### Also new since 1.0.7 (Prism 1.0.8): security fixes

* Linux: the browser cookies Prism hands to yt-dlp for a video are no longer readable by other
  accounts on the computer.
* The browser extension no longer adds SameSite=Strict cookies to downloads another site
  started, and the in-page *Download video* button reacts only to your own clicks.
* Both were reported privately by [@pepopepopepo](https://github.com/pepopepopepo) — thank you!

### Prism 1.0.7

* LinkedIn: the Download video button finds the post in LinkedIn's new design
  ([#1](https://github.com/FortoGraphy/prism-download-manager/issues/1)).
* Updates are found sooner (every hour, and when you come back to Prism after half an hour).
* AppImage: the browser keeps the extension after Prism restarts.

## Downloads

| Your system | File |
|---|---|
| Windows 10 / 11 | `Prism_1.0.9_x64-setup.exe` (recommended) · `Prism_1.0.9_x64_en-US.msi` (all users) · `Prism-1.0.9-windows-x64-portable.zip` |
| macOS — Apple Silicon | `Prism_1.0.9_aarch64.dmg` |
| macOS — Intel | `Prism_1.0.9_x64.dmg` |
| Ubuntu / Debian / Mint | `Prism_1.0.9_amd64.deb` |
| Fedora / openSUSE | `Prism-1.0.9-1.x86_64.rpm` |
| Any Linux | `Prism_1.0.9_amd64.AppImage` |
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
