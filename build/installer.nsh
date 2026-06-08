; ──────────────────────────────────────────────
; GameHub – custom NSIS installer
; Custom mode-selection page (Install vs Portable)
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

  ; ── Global state (installer pass only) ──
  !ifndef BUILD_UNINSTALLER
    Var /GLOBAL GH_PortableMode   ; "0" = install, "1" = portable
    Var /GLOBAL GH_Dialog
    Var /GLOBAL GH_RadioInstall
    Var /GLOBAL GH_RadioPortable
    Var /GLOBAL GH_DirText

    ; Insert our mode page before the install-files page
    Page custom GH_ModePage GH_ModePageLeave

    Function GH_ModePage
      StrCpy $GH_PortableMode "0"

      nsDialogs::Create 1018
      Pop $GH_Dialog
      ${If} $GH_Dialog == error
        Abort
      ${EndIf}

      ; Heading
      ${NSD_CreateLabel} 0u 0u 100% 20u "Choose how to install GameHub"
      Pop $0
      SetCtlColors $0 "E2E2E2" "1A1A2E"

      ; Install option
      ${NSD_CreateRadioButton} 8u 28u 100% 14u "Install  (Program Files, Start Menu, uninstaller)"
      Pop $GH_RadioInstall
      SetCtlColors $GH_RadioInstall "E2E2E2" "1A1A2E"
      SendMessage $GH_RadioInstall ${BM_SETCHECK} 1 0

      ${NSD_CreateLabel} 22u 44u 270u 12u "Recommended. Adds shortcuts and an uninstaller."
      Pop $0
      SetCtlColors $0 "AAAAAA" "1A1A2E"

      ; Portable option
      ${NSD_CreateRadioButton} 8u 62u 100% 14u "Portable  (choose any folder, no system changes)"
      Pop $GH_RadioPortable
      SetCtlColors $GH_RadioPortable "E2E2E2" "1A1A2E"

      ${NSD_CreateLabel} 22u 78u 270u 12u "Runs directly from the folder you choose. No shortcuts or uninstaller created."
      Pop $0
      SetCtlColors $0 "AAAAAA" "1A1A2E"

      ; Install path row (shown for Install mode)
      ${NSD_CreateLabel} 0u 100u 60u 12u "Install location:"
      Pop $0
      SetCtlColors $0 "E2E2E2" "1A1A2E"

      ${NSD_CreateDirRequest} 66u 98u 152u 14u "$PROGRAMFILES64\GameHub"
      Pop $GH_DirText

      ${NSD_CreateBrowseButton} 222u 97u 60u 16u "Browse..."
      Pop $0
      ${NSD_OnClick} $0 GH_BrowseInstallDir

      nsDialogs::Show
    FunctionEnd

    Function GH_BrowseInstallDir
      nsDialogs::SelectFolderDialog "Select install folder" "$PROGRAMFILES64\GameHub"
      Pop $0
      ${If} $0 != error
        ${NSD_SetText} $GH_DirText "$0"
      ${EndIf}
    FunctionEnd

    Function GH_ModePageLeave
      ${NSD_GetState} $GH_RadioPortable $0
      ${If} $0 == ${BST_CHECKED}
        ; Portable: let user pick the extract folder
        nsDialogs::SelectFolderDialog "Select a folder to extract GameHub into" "$DESKTOP"
        Pop $0
        ${If} $0 == error
          ; Cancelled — stay on this page
          Abort
        ${EndIf}
        StrCpy $GH_PortableMode "1"
        StrCpy $INSTDIR "$0\GameHub"
      ${Else}
        ; Install: use whatever path is in the text field
        StrCpy $GH_PortableMode "0"
        ${NSD_GetText} $GH_DirText $0
        ${If} $0 != ""
          StrCpy $INSTDIR "$0"
        ${EndIf}
      ${EndIf}
    FunctionEnd
  !endif
!macroend

!macro customInstall
  ${If} $GH_PortableMode == "0"
    ; ── Install mode: runtime prerequisites ──
    DetailPrint "Installing Visual C++ Redistributable (x64)..."
    inetc::get /CAPTION "Downloading Visual C++ Redistributable" /POPUP "" \
      "https://aka.ms/vs/17/release/vc_redist.x64.exe" \
      "$TEMP\vc_redist.x64.exe" /END
    Pop $0
    ${If} $0 == "OK"
      ExecWait '"$TEMP\vc_redist.x64.exe" /install /quiet /norestart'
      Delete "$TEMP\vc_redist.x64.exe"
    ${EndIf}

    DetailPrint "Installing Visual C++ Redistributable (x86)..."
    inetc::get /CAPTION "Downloading Visual C++ Redistributable (x86)" /POPUP "" \
      "https://aka.ms/vs/17/release/vc_redist.x86.exe" \
      "$TEMP\vc_redist.x86.exe" /END
    Pop $0
    ${If} $0 == "OK"
      ExecWait '"$TEMP\vc_redist.x86.exe" /install /quiet /norestart'
      Delete "$TEMP\vc_redist.x86.exe"
    ${EndIf}

    DetailPrint "Installing DirectX End-User Runtime..."
    inetc::get /CAPTION "Downloading DirectX Runtime" /POPUP "" \
      "https://download.microsoft.com/download/1/7/1/1718CCC4-6315-4D8E-9543-8E28A4E18C4C/dxwebsetup.exe" \
      "$TEMP\dxwebsetup.exe" /END
    Pop $0
    ${If} $0 == "OK"
      ExecWait '"$TEMP\dxwebsetup.exe" /Q'
      Delete "$TEMP\dxwebsetup.exe"
    ${EndIf}

    DetailPrint "Installing .NET Desktop Runtime 8..."
    inetc::get /CAPTION "Downloading .NET Desktop Runtime" /POPUP "" \
      "https://aka.ms/dotnet/8.0/dotnet-runtime-win-x64.exe" \
      "$TEMP\dotnet8-runtime.exe" /END
    Pop $0
    ${If} $0 == "OK"
      ExecWait '"$TEMP\dotnet8-runtime.exe" /install /quiet /norestart'
      Delete "$TEMP\dotnet8-runtime.exe"
    ${EndIf}
  ${Else}
    ; ── Portable mode: strip registry/shortcuts that electron-builder wrote ──
    FindFirst $R0 $R1 "$INSTDIR\Uninstall*.exe"
    ${If} $R1 != ""
      Delete "$INSTDIR\$R1"
    ${EndIf}
    FindClose $R0

    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}"
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}"

    Delete "$SMPROGRAMS\${PRODUCT_NAME}.lnk"
    RMDir /r "$SMPROGRAMS\${PRODUCT_NAME}"

    ; Marker file so the app knows it is in portable mode
    FileOpen $R0 "$INSTDIR\portable" w
    FileClose $R0
  ${EndIf}
!macroend

!macro customUnInstall
  ${ifNot} ${isUpdated}
    RMDir /r "$LOCALAPPDATA\gamehub-updater"
  ${endIf}
!macroend
