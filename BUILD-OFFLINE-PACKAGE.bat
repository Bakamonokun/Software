@echo off
setlocal
cd /d "%~dp0"
echo =======================================================================
echo POS App v2.5.3 - Zero-Install Self-Contained Standalone Windows Package
echo Developed by Kanha Software Solution
echo (No .NET Runtime, SQL Server, or 3rd-Party Software Needed on Target PC)
echo =======================================================================

dotnet publish PosServer\PosServer.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:IncludeAllContentForSelfExtract=true -p:EnableCompressionInSingleFile=true -o READY\SERVER
if errorlevel 1 goto failed

dotnet publish stationary\AbhinavPos.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:IncludeAllContentForSelfExtract=true -p:EnableCompressionInSingleFile=true -o READY\POS
if errorlevel 1 goto failed

echo.
echo =======================================================================
echo SUCCESS! 100%% Self-Contained Single-File Executables Created:
echo   1. READY\POS\POSApp.exe     (Includes built-in Embedded Server + Runtime)
echo   2. READY\SERVER\PosServer.exe (Optional Dedicated LAN Host Console)
echo.
echo End users DO NOT need to install .NET, SQL Server, WhatsApp Desktop,
echo or any third-party software. Simply copy READY\POS\POSApp.exe and run!
echo =======================================================================
pause
exit /b 0

:failed
echo.
echo BUILD FAILED. Copy the error text above for troubleshooting.
pause
exit /b 1
