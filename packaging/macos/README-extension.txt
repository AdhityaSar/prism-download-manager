First start of Prism
====================
Prism isn't notarized by Apple (that needs a paid developer account), so macOS blocks it
the first time. Allow it once: in Terminal run

    xattr -dr com.apple.quarantine /Applications/Prism.app

or open Prism, then System Settings -> Privacy & Security -> "Open Anyway".

Prism browser extension
=======================

1. Drag this "Browser Extension" folder somewhere it can stay, e.g. your Documents
   folder (the browser loads the extension from there, so don't delete it later).

Chrome, Edge, Brave, Opera, Vivaldi
2. Open chrome://extensions (edge://extensions, brave://extensions, ...).
3. Turn on "Developer mode" (top-right corner).
4. Click "Load unpacked" and choose the "Chrome, Edge, Brave" folder.
5. Pin the Prism icon (puzzle icon -> pin). It should say "Connected".

Firefox
2. Open about:debugging#/runtime/this-firefox
3. "Load Temporary Add-on..." -> pick manifest.json in the "Firefox" folder.
   (Firefox forgets temporary add-ons on restart.)

Prism also walks you through this on first start, and any time from
Settings -> Browser integration.
