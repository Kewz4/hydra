; ──────────────────────────────────────────────
; GameHub – custom NSIS installer
; Mode selection shown before any pages via .onInit
; ──────────────────────────────────────────────

!include "nsDialogs.nsh"
!include "LogicLib.nsh"

!macro customHeader
  ; ── Theme ──
  !define /redef MUI_BGCOLOR               "1A1A2E"
  !define /redef MUI_INSTFILESPAGE_COLORS  "E2E2E2 1A1A2E"
  !define /redef MUI_HEADERIMAGE
  !define /redef MUI_HEADERIMAGE_RIGHT
  !define /redef MUI_WELCOMEPAGE_TITLE       "Welcome to GameHub"
  !define /redef MUI_WELCOMEPAGE_TEXT        "GameHub is your all-in-one game launcher.$\r$\n$\r$\nThis setup will install GameHub ${VERSION} on your computer.$\r$\n$\r$\nClick Next to continue."
  !define /redef MUI_FINISHPAGE_TITLE        "GameHub is ready!"
  !define /redef MUI_FINISHPAGE_TEXT         "GameHub has been installed successfully.$\r$\nClick Finish to launch GameHub."
  !define /redef MUI_FINISHPAGE_RUN          "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  !define /redef MUI_FINISHPAGE_RUN_TEXT     "Launch GameHub"
  !define /redef MUI_FINISHPAGE_LINK         "GameHub on GitHub"
  !define /redef MUI_FINISHPAGE_LINK_LOCATION "https://github.com/Kewz4/hydra"
  !define /redef MUI_ABORTWARNING
  !define /redef MUI_ABORTWARNING_TEXT       "Are you sure you want to quit the GameHub installer?"

  ; ── Global state (installer pass only; uninstaller pass has no customInit) ──
  !ifndef BUILD_UNINSTALLER
    Var /GLOBAL GH_PortableMode   ; "0" = install, "1" = portable
  !endif
!macroend

; ── Mode selection runs in .onInit, before any pages ──
!macro customInit
  StrCpy $GH_PortableMode "0"

  MessageBox MB_YESNO|MB_ICONQUESTION "How would you like to use GameHub?$\r$\n$\r$\nYes = Install  (Program Files, Start Menu, uninstaller)$\r$\nNo  = Portable (choose any folder, no shortcuts)" IDYES GH_InstallMode

  ; ── Portable branch ──
  nsDialogs::SelectFolderDialog \
    "Select a folder to extract GameHub into" "$DESKTOP"
  Pop $0
  ${If} $0 == error
    ; user cancelled the folder picker — abort installer
    Quit
  ${EndIf}
  StrCpy $GH_PortableMode "1"
  StrCpy $INSTDIR "$0\GameHub"
  Goto GH_ModeEnd

  GH_InstallMode:
  ; Default INSTDIR (Program Files) is set by electron-builder; leave it.
  StrCpy $GH_PortableMode "0"

  GH_ModeEnd:
!macroend

!macro customInstall
  ${If} $GH_PortableMode == "0"
    ; ── Install mode: runtime prerequisites ──
    DetailPrint "Installing Visual C++ Redistributable (x64)…"
    inetc::get /CAPTION "Downloading Visual C++ Redistributable" /POPUP "" \
      "https://aka.ms/vs/17/release/vc_redist.x64.exe" \
      "$TEMP\vc_redist.x64.exe" /END
    Pop $0
    ${If} $0 == "OK"
      ExecWait '"$TEMP\vc_redist.x64.exe" /install /quiet /norestart'
      Delete "$TEMP\vc_redist.x64.exe"
    ${EndIf}

    DetailPrint "Installing Visual C++ Redistributable (x86)…"
    inetc::get /CAPTION "Downloading Visual C++ Redistributable (x86)" /POPUP "" \
      "https://aka.ms/vs/17/release/vc_redist.x86.exe" \
      "$TEMP\vc_redist.x86.exe" /END
    Pop $0
    ${If} $0 == "OK"
      ExecWait '"$TEMP\vc_redist.x86.exe" /install /quiet /norestart'
      Delete "$TEMP\vc_redist.x86.exe"
    ${EndIf}

    DetailPrint "Installing DirectX End-User Runtime…"
    inetc::get /CAPTION "Downloading DirectX Runtime" /POPUP "" \
      "https://download.microsoft.com/download/1/7/1/1718CCC4-6315-4D8E-9543-8E28A4E18C4C/dxwebsetup.exe" \
      "$TEMP\dxwebsetup.exe" /END
    Pop $0
    ${If} $0 == "OK"
      ExecWait '"$TEMP\dxwebsetup.exe" /Q'
      Delete "$TEMP\dxwebsetup.exe"
    ${EndIf}

    DetailPrint "Installing .NET Desktop Runtime 8…"
    inetc::get /CAPTION "Downloading .NET Desktop Runtime" /POPUP "" \
      "https://aka.ms/dotnet/8.0/dotnet-runtime-win-x64.exe" \
      "$TEMP\dotnet8-runtime.exe" /END
    Pop $0
    ${If} $0 == "OK"
      ExecWait '"$TEMP\dotnet8-runtime.exe" /install /quiet /norestart'
      Delete "$TEMP\dotnet8-runtime.exe"
    ${EndIf}
  ${Else}
    ; ── Portable mode: strip what electron-builder wrote to registry/shortcuts ──
    ; Delete uninstaller executable
    FindFirst $R0 $R1 "$INSTDIR\Uninstall*.exe"
    ${If} $R1 != ""
      Delete "$INSTDIR\$R1"
    ${EndIf}
    FindClose $R0

    ; Delete registry uninstall entries (try both HKCU and HKLM)
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}"
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}"

    ; Delete Start Menu shortcuts
    Delete "$SMPROGRAMS\${PRODUCT_NAME}.lnk"
    RMDir /r "$SMPROGRAMS\${PRODUCT_NAME}"

    ; Write a portable marker so the app can detect its mode
    FileOpen $R0 "$INSTDIR\portable" w
    FileClose $R0
  ${EndIf}
!macroend

!macro customUnInstall
  ${ifNot} ${isUpdated}
    RMDir /r "$LOCALAPPDATA\gamehub-updater"
  ${endIf}
!macroend
