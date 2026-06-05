!macro customInstall
  ; Install Visual C++ 2015-2022 Redistributable (x64)
  DetailPrint "Installing Visual C++ 2015-2022 Redistributable (x64)..."
  inetc::get /CAPTION "Downloading Visual C++ Redistributable" /POPUP "" \
    "https://aka.ms/vs/17/release/vc_redist.x64.exe" \
    "$TEMP\vc_redist.x64.exe" /END
  Pop $0
  ${If} $0 == "OK"
    ExecWait '"$TEMP\vc_redist.x64.exe" /install /quiet /norestart'
    Delete "$TEMP\vc_redist.x64.exe"
  ${EndIf}

  ; Install Visual C++ 2015-2022 Redistributable (x86)
  DetailPrint "Installing Visual C++ 2015-2022 Redistributable (x86)..."
  inetc::get /CAPTION "Downloading Visual C++ Redistributable (x86)" /POPUP "" \
    "https://aka.ms/vs/17/release/vc_redist.x86.exe" \
    "$TEMP\vc_redist.x86.exe" /END
  Pop $0
  ${If} $0 == "OK"
    ExecWait '"$TEMP\vc_redist.x86.exe" /install /quiet /norestart'
    Delete "$TEMP\vc_redist.x86.exe"
  ${EndIf}

  ; Install DirectX End-User Runtime
  DetailPrint "Installing DirectX End-User Runtime..."
  inetc::get /CAPTION "Downloading DirectX Runtime" /POPUP "" \
    "https://download.microsoft.com/download/1/7/1/1718CCC4-6315-4D8E-9543-8E28A4E18C4C/dxwebsetup.exe" \
    "$TEMP\dxwebsetup.exe" /END
  Pop $0
  ${If} $0 == "OK"
    ExecWait '"$TEMP\dxwebsetup.exe" /Q'
    Delete "$TEMP\dxwebsetup.exe"
  ${EndIf}

  ; Install .NET Desktop Runtime 8
  DetailPrint "Installing .NET Desktop Runtime 8..."
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
    RMDir /r "$LOCALAPPDATA\hydralauncher-updater"
  ${endIf}
!macroend
