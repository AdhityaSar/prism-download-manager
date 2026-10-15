; Prism NSIS installer hooks (included by Tauri's NSIS template).
; Registers the browser native messaging host and the magnet: link handler for the
; current user, and removes them again on uninstall.

!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "Registering browser integration..."
  nsExec::ExecToLog '"$INSTDIR\prism-native-host.exe" register'
  WriteRegStr HKCU "Software\Classes\magnet" "" "URL:Magnet link"
  WriteRegStr HKCU "Software\Classes\magnet" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\magnet\DefaultIcon" "" "$INSTDIR\prism.exe,0"
  WriteRegStr HKCU "Software\Classes\magnet\shell\open\command" "" '"$INSTDIR\prism.exe" "%1"'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DetailPrint "Removing browser integration..."
  nsExec::ExecToLog '"$INSTDIR\prism-native-host.exe" unregister'
  ; Only remove the magnet handler if it still points at this installation.
  ReadRegStr $0 HKCU "Software\Classes\magnet\shell\open\command" ""
  StrCmp $0 '"$INSTDIR\prism.exe" "%1"' 0 +2
    DeleteRegKey HKCU "Software\Classes\magnet"
!macroend
