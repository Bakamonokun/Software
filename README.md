<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Kanha Software Solution — Enterprise POS & ERP System (v2.5.1d)

Multi-platform Point of Sale (POS), GST/Non-GST Billing, Inventory Batch/Expiry Tracking, Financial Year Rollover, and Multi-Branch Server Synchronization Suite.

## Project Structure

- **`stationary/`** — Windows Forms (.NET 8.0 `net8.0-windows` / `win-x64`) Desktop POS Client (`POSApp.exe`)
  - Builds directly to `stationary\bin\Debug\net8.0-windows\win-x64\POSApp.exe`
- **`PosServer/`** — .NET 8.0 Embedded & Standalone LAN Synchronization & Data Vault Server (`PosServer.exe`)
- **`native-c/`** — Native C AES-256 & CRC64-ECMA Vault Engine (`erp_vault_core.c`, `erp_vault_core.h`)
- **`java-erp/`** — Cross-platform Java Swing/CLI Enterprise Bridge (`KanhaErpApplication.java`)
- **`src/` & `server.ts`** — Full-Stack Web & PWA POS Terminal (React 19 + TypeScript + Express REST API)
- **`READY/`** — Pre-packaged Offline Deployment & Standalone Distribution Directory

## Run Locally

### 1. Web & API Server (Node.js)
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the server:
   ```bash
   npm run dev
   ```

### 2. Windows Desktop POS (.NET 8.0 WinForms)
```bat
dotnet build KanhaPosErp.sln -c Debug
```
Output executable:
`stationary\bin\Debug\net8.0-windows\win-x64\POSApp.exe`

Or run `BUILD-OFFLINE-PACKAGE.bat` / `RUN-WITHOUT-INSTALL.bat` on Windows.
