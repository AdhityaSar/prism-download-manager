Prism browser extension
=======================

The browser extension packages are shipped in /usr/share/prism/extension (or next to
the AppImage in the release archive):

  Chrome / Edge / Brave / Opera / Vivaldi / Chromium
    1. Open chrome://extensions (edge://extensions, brave://extensions, ...)
    2. Enable "Developer mode"
    3. "Load unpacked" -> select the `chromium` folder

  Firefox
    about:debugging#/runtime/this-firefox -> "Load Temporary Add-on" -> manifest.json
    in the `firefox` folder (or install the signed .xpi if you have one).

Prism registers its native messaging host automatically. Open Prism -> Settings ->
Browser integration to check the status or repair it with one click.
