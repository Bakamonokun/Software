@echo off
setlocal
cd /d "%~dp0"
echo =======================================================================
echo POS ERP v2.5.3 - Zero-Dependency Self-Contained Windows Build
echo Developed by Kanha Software Solution
echo =======================================================================
dotnet --version
dotnet publish PosServer\PosServer.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:IncludeAllContentForSelfExtract=true -p:EnableCompressionInSingleFile=true -o READY-NET10\SERVER
if errorlevel 1 goto failed

dotnet publish stationary\AbhinavPos.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:IncludeAllContentForSelfExtract=true -p:EnableCompressionInSingleFile=true -o READY-NET10\POS
if errorlevel 1 goto failed

if not exist READY\SERVER mkdir READY\SERVER
if not exist READY\POS mkdir READY\POS
xcopy /Y /E /Q READY-NET10\SERVER\* READY\SERVER\ >nul 2>nul
xcopy /Y /E /Q READY-NET10\POS\* READY\POS\ >nul 2>nul

echo.
echo SUCCESS: Standalone single-file binaries generated in READY\POS and READY-NET10\POS.
echo No third-party runtime or external software installation is required on any client PC.
pause
exit /b 0

:failed
echo.
echo BUILD FAILED. Copy the complete error output for troubleshooting.
pause
exit /b 1
