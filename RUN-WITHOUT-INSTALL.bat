@echo off
setlocal
cd /d "%~dp0"
echo =======================================================================
echo Kanha ERP ^& POS v2.5.3 - Zero-Install Standalone Launcher
echo Developed by Kanha Software Solution
echo =======================================================================

:: 1. If pre-built standalone POSApp.exe exists in READY\POS, launch immediately (0 install required)
if exist "READY\POS\POSApp.exe" (
    echo [OK] Launching standalone READY\POS\POSApp.exe ^(Zero 3rd-party runtime needed^)...
    start "" "READY\POS\POSApp.exe"
    exit /b 0
)

if exist "READY-NET10\POS\POSApp.exe" (
    echo [OK] Launching standalone READY-NET10\POS\POSApp.exe...
    start "" "READY-NET10\POS\POSApp.exe"
    exit /b 0
)

:: 2. Check if a self-contained built binary (with bundled coreclr.dll) already exists in stationary\bin\Debug\net8.0-windows\win-x64
if exist "stationary\bin\Debug\net8.0-windows\win-x64\POSApp.exe" (
    if exist "stationary\bin\Debug\net8.0-windows\win-x64\coreclr.dll" (
        echo [OK] Launching self-contained stationary\bin\Debug\net8.0-windows\win-x64\POSApp.exe...
        start "" "stationary\bin\Debug\net8.0-windows\win-x64\POSApp.exe"
        exit /b 0
    )
)

:: 3. If .NET SDK is available, build self-contained win-x64 directory (bundles coreclr.dll + all runtime DLLs) and launch immediately
where dotnet >nul 2>nul
if %errorlevel% equ 0 (
    echo [BUILD] Building self-contained stationary\bin\Debug\net8.0-windows\win-x64\POSApp.exe ^(0 warnings, 0 external dependencies^)...
    dotnet build stationary\AbhinavPos.csproj -c Debug -r win-x64 --self-contained true -p:WarningLevel=0
    if exist "stationary\bin\Debug\net8.0-windows\win-x64\POSApp.exe" (
        echo [OK] Launching stationary\bin\Debug\net8.0-windows\win-x64\POSApp.exe...
        start "" "stationary\bin\Debug\net8.0-windows\win-x64\POSApp.exe"
        exit /b 0
    )
)

echo [INFO] Please run build-windows.bat or BUILD-OFFLINE-PACKAGE.bat to generate POSApp.exe.
pause
exit /b 0
