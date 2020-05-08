!macro customInstall
  DeleteRegKey HKCR "xmcl"
  WriteRegStr HKCR "xmcl" "" "URL:xmcl"
  WriteRegStr HKCR "xmcl" "URL Protocol" ""
  WriteRegStr HKCR "xmcl\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  WriteRegStr HKCR "xmcl\shell" "" ""
  WriteRegStr HKCR "xmcl\shell\Open" "" ""
  WriteRegStr HKCR "xmcl\shell\Open\command" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME} %1"
!macroend