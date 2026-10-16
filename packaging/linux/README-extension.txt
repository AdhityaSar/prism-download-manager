Prism browser extension
=======================

Prism ships the unpacked browser extension. Prism -> Settings -> Browser integration
shows the folder to pick:

  deb / rpm   /usr/lib/Prism/extension
  AppImage    ~/.local/share/prism/extension (Prism copies it there: the AppImage's own
              files move to a new place every time it starts)

or use prism-chromium.zip / prism-firefox.zip from the release page, unzipped into a
folder that stays where it is.

  Chrome / Edge / Brave / Opera / Vivaldi / Chromium
    1. Open chrome://extensions (edge://extensions, brave://extensions, ...)
    2. Enable "Developer mode"
    3. "Load unpacked" -> select the `chromium` folder

  Firefox
    about:debugging#/runtime/this-firefox -> "Load Temporary Add-on" -> manifest.json
    in the `firefox` folder (or install the signed .xpi if you have one).

Prism registers its native messaging host automatically. Open Prism -> Settings ->
Browser integration to check the status or repair it with one click.
