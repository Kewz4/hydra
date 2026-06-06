; ──────────────────────────────────────────────
; GameHub – custom NSIS installer theming
; ──────────────────────────────────────────────

!macro customHeader
  ; MUI2 color overrides – dark background, accent green
  !define MUI_UI                    "${NSISDIR}\Contrib\UIs\modern_headerbmp.exe"
  !define MUI_BGCOLOR               "1A1A2E"
  !define MUI_INSTFILESPAGE_COLORS  "E2E2E2 1A1A2E"

  ; Header / banner text colors
  !define MUI_HEADERIMAGE
  !define MUI_HEADERIMAGE_RIGHT
  !define MUI_HEADER_TRANSPARENT_TEXT

  ; Welcome / Finish page customization
  !define MUI_WELCOMEPAGE_TITLE       "Welcome to GameHub"
  !define MUI_WELCOMEPAGE_TEXT        "GameHub is your all-in-one game launcher.$\r$\n$\r$\nThis setup will install GameHub ${VERSION} on your computer.$\r$\n$\r$\nClick Next to continue."
  !define MUI_FINISHPAGE_TITLE        "GameHub is ready!"
  !define MUI_FINISHPAGE_TEXT         "GameHub has been successfully installed.$\r$\nClick Finish to launch the app and start gaming."
  !define MUI_FINISHPAGE_RUN          "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  !define MUI_FINISHPAGE_RUN_TEXT     "Launch GameHub"
  !define MUI_FINISHPAGE_SHOWREADME   ""
  !define MUI_FINISHPAGE_LINK         "GameHub on GitHub"
  !define MUI_FINISHPAGE_LINK_LOCATION "https://github.com/Kewz4/hydra"

  ; Sidebar branding image (installerSidebar.bmp placed in build/)
  !define MUI_WELCOMEFINISHPAGE_BITMAP "${BUILD_RESOURCES_DIR}\installerSidebar.bmp"
  !define MUI_UNWELCOMEFINISHPAGE_BITMAP "${BUILD_RESOURCES_DIR}\installerSidebar.bmp"

  ; Abort warning
  !define MUI_ABORTWARNING
  !define MUI_ABORTWARNING_TEXT "Are you sure you want to quit the GameHub installer?"
!macroend

!macro customInstall
  ; Install Visual C++ 2015-2022 Redistributable (x64)
  DetailPrint "Installing Visual C++ Redistributable (x64)…"
  inetc::get /CAPTION "Downloading Visual C++ Redistributable" /POPUP "" \
    "https://aka.ms/vs/17/release/vc_redist.x64.exe" \
    "$TEMP\vc_redist.x64.exe" /END
  Pop $0
  ${If} $0 == "OK"
    ExecWait '"$TEMP\vc_redist.x64.exe" /install /quiet /norestart'
    Delete "$TEMP\vc_redist.x64.exe"
  ${EndIf}

  ; Install Visual C++ 2015-2022 Redistributable (x86)
  DetailPrint "Installing Visual C++ Redistributable (x86)…"
  inetc::get /CAPTION "Downloading Visual C++ Redistributable (x86)" /POPUP "" \
    "https://aka.ms/vs/17/release/vc_redist.x86.exe" \
    "$TEMP\vc_redist.x86.exe" /END
  Pop $0
  ${If} $0 == "OK"
    ExecWait '"$TEMP\vc_redist.x86.exe" /install /quiet /norestart'
    Delete "$TEMP\vc_redist.x86.exe"
  ${EndIf}

  ; Install DirectX End-User Runtime
  DetailPrint "Installing DirectX End-User Runtime…"
  inetc::get /CAPTION "Downloading DirectX Runtime" /POPUP "" \
    "https://download.microsoft.com/download/1/7/1/1718CCC4-6315-4D8E-9543-8E28A4E18C4C/dxwebsetup.exe" \
    "$TEMP\dxwebsetup.exe" /END
  Pop $0
  ${If} $0 == "OK"
    ExecWait '"$TEMP\dxwebsetup.exe" /Q'
    Delete "$TEMP\dxwebsetup.exe"
  ${EndIf}

  ; Install .NET Desktop Runtime 8
  DetailPrint "Installing .NET Desktop Runtime 8…"
  inetc::get /CAPTION "Downloading .NET Desktop Runtime" /POPUP "" \
    "https://aka.ms/dotnet/8.0/dotnet-runtime-win-x64.exe" \
    "$TEMP\dotnet8-runtime.exe" /END
  Pop $0
  ${If} $0 == "OK"
    ExecWait '"$TEMP\dotnet8-runtime.exe" /install /quiet /norestart'
    Delete "$TEMP\dotnet8-runtime.exe"
  ${EndIf}
!macroend

!macro customUnInstall
  ${ifNot} ${isUpdated}
    RMDir /r "$LOCALAPPDATA\gamehub-updater"
    RMDir /r "$LOCALAPPDATA\hydralauncher-updater"
  ${endIf}
!macroend
