@echo off
setlocal
cd /d "%~dp0"
echo ===============================================================
echo Kanha ERP ^& POS v2.5.3 - Windows Build Suite (.NET / C11 / Java)
echo ===============================================================

where dotnet >nul 2>nul
if %errorlevel% equ 0 (
    echo [1/3] Building Self-Contained .NET Solution ^(KanhaPosErp.sln^)...
    dotnet build KanhaPosErp.sln -c Debug -r win-x64 --self-contained true -p:WarningLevel=0
)

where gcc >nul 2>nul
if %errorlevel% equ 0 (
    echo [2/3] Compiling Native C11 Engine ^(native-c\erp_vault_core.c^)...
    if not exist build\win-x64 mkdir build\win-x64
    gcc -std=c11 -O2 -shared native-c\erp_vault_core.c -o build\win-x64\erp_vault_core.dll
)

where javac >nul 2>nul
if %errorlevel% equ 0 (
    echo [3/3] Compiling Java Cross-Platform Desktop Client...
    if not exist build\classes mkdir build\classes
    javac -d build\classes java-erp\src\com\kanhasoft\erp\KanhaErpApplication.java
)

echo.
echo Build finished. Self-contained output folder: stationary\bin\Debug\net8.0-windows\win-x64\POSApp.exe
if exist "stationary\bin\Debug\net8.0-windows\win-x64\POSApp.exe" (
    echo [OK] Launching stationary\bin\Debug\net8.0-windows\win-x64\POSApp.exe...
    start "" "stationary\bin\Debug\net8.0-windows\win-x64\POSApp.exe"
)
exit /b 0
