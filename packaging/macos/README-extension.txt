First start of Prism
====================
Prism isn't notarized by Apple (that needs a paid developer account), so macOS blocks it
the first time. Allow it once: in Terminal run

    xattr -dr com.apple.quarantine /Applications/Prism.app

or open Prism, then System Settings -> Privacy & Security -> "Open Anyway".

Prism browser extension
=======================

Load the extension from the folder Prism shows in Settings -> Browser integration:

    ~/Library/Application Support/Prism/extension/chromium   (Chrome, Edge, Brave, ...)
    ~/Library/Application Support/Prism/extension/firefox    (Firefox)

Prism refreshes that folder when it updates. Don't load a copy of the "Browser Extension"
folder from this disk image instead: nothing updates a copy, so the browser would keep an
old extension. Prism creates the folder the first time you open Settings -> Browser
integration (or the guide on first start), which walks you through these steps:

Chrome, Edge, Brave, Opera, Vivaldi
1. Open chrome://extensions (edge://extensions, brave://extensions, ...).
2. Turn on "Developer mode" (top-right corner).
3. Click "Load unpacked" and choose the folder Prism shows.
4. Pin the Prism icon (puzzle icon -> pin). It should say "Connected".

Firefox
1. Open about:debugging#/runtime/this-firefox
2. "Load Temporary Add-on..." -> pick manifest.json in the folder Prism shows.
   (Firefox forgets temporary add-ons on restart.)

After Prism updates, click the reload arrow next to Prism on the extensions page (or
restart the browser): browsers don't reload an unpacked extension's files by themselves.
Prism shows a reminder when the browser still runs an older extension.
