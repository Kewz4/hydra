; ──────────────────────────────────────────────
; GameHub – custom NSIS installer
; Adds an Install vs Portable mode-selection page
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

  ; ── Global state ──
  Var /GLOBAL GH_PortableMode   ; "0" = install, "1" = portable
  Var /GLOBAL GH_Dialog
  Var /GLOBAL GH_RadioInstall
  Var /GLOBAL GH_RadioPortable

  ; ── Mode-selection page — inserted first so it appears before the directory page ──
  Page custom GH_ModePage GH_ModePageLeave

  Function GH_ModePage
    StrCpy $GH_PortableMode "0"

    nsDialogs::Create 1018
    Pop $GH_Dialog
    ${If} $GH_Dialog == error
      Abort
    ${EndIf}

    ${NSD_CreateLabel} 0u 0u 100% 16u "How would you like to use GameHub?"
    Pop $0

    ${NSD_CreateRadioButton} 12u 22u 100% 13u "Install  —  add to Start Menu and Programs, create an uninstaller"
    Pop $GH_RadioInstall
    SendMessage $GH_RadioInstall ${BM_SETCHECK} 1 0   ; checked by default

    ${NSD_CreateLabel} 24u 37u 280u 16u "Recommended. Installs to Program Files; adds shortcuts."
    Pop $0

    ${NSD_CreateRadioButton} 12u 58u 100% 13u "Portable  —  extract to a folder, no registry changes"
    Pop $GH_RadioPortable

    ${NSD_CreateLabel} 24u 73u 280u 24u "GameHub runs directly from the folder you choose.$\nNo shortcuts or uninstaller are created."
    Pop $0

    nsDialogs::Show
  FunctionEnd

  Function GH_ModePageLeave
    ${NSD_GetState} $GH_RadioPortable $0
    ${If} $0 == ${BST_CHECKED}
      ; Portable selected — let user choose extract folder
      nsDialogs::SelectFolderDialog "Select a folder to extract GameHub into" "$DESKTOP"
      Pop $0
      ${If} $0 == error
        ; User cancelled the folder dialog → stay on this page
        Abort
      ${EndIf}
      StrCpy $GH_PortableMode "1"
      StrCpy $INSTDIR "$0\GameHub"
    ${Else}
      StrCpy $GH_PortableMode "0"
    ${EndIf}
  FunctionEnd
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
    ; ── Portable mode: remove what electron-builder wrote to registry/shortcuts ──
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
