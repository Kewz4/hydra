; ──────────────────────────────────────────────
; GameHub – custom NSIS installer theming
; ──────────────────────────────────────────────

!macro customHeader
  !define /redef MUI_BGCOLOR               "1A1A2E"
  !define /redef MUI_INSTFILESPAGE_COLORS  "E2E2E2 1A1A2E"
  !define /redef MUI_HEADERIMAGE
  !define /redef MUI_HEADERIMAGE_RIGHT
  !define /redef MUI_WELCOMEPAGE_TITLE       "Welcome to GameHub"
  !define /redef MUI_WELCOMEPAGE_TEXT        "GameHub is your all-in-one game launcher.$\r$\n$\r$\nThis setup will install GameHub ${VERSION} on your computer.$\r$\n$\r$\nClick Next to continue."
  !define /redef MUI_FINISHPAGE_TITLE        "GameHub is ready!"
  !define /redef MUI_FINISHPAGE_TEXT         "GameHub has been successfully installed.$\r$\nClick Finish to launch the app and start gaming."
  !define /redef MUI_FINISHPAGE_RUN          "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  !define /redef MUI_FINISHPAGE_RUN_TEXT     "Launch GameHub"
  !define /redef MUI_FINISHPAGE_LINK         "GameHub on GitHub"
  !define /redef MUI_FINISHPAGE_LINK_LOCATION "https://github.com/Kewz4/hydra"
  !define /redef MUI_ABORTWARNING
  !define /redef MUI_ABORTWARNING_TEXT "Are you sure you want to quit the GameHub installer?"
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
    RMDir /r "$LOCALAPPDATA\gamehub-updater"
  ${endIf}
!macroend
