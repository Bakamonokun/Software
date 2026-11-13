import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  Download,
  FileCheck2,
  FolderUp,
  KeyRound,
  Lock,
  Network,
  Printer,
  RefreshCw,
  Shield,
  Trash2,
  Users,
} from 'lucide-react';
import { usePos } from '../context/PosContext';
import {
  PrinterSettingsConfig,
  ProfileType,
  ReceiptPaperSize,
  StaffUser,
  UserRole,
} from '../types/pos';
import {
  SUPPORTED_POS_EXTENSIONS,
  SUPPORTED_POS_MIME_TYPES,
  computeNextFinancialYear,
  validateDatabaseFilesSelection,
  validateKanhaPayloadStructure,
} from '../utils/kpdImporter';

export type SettingsDatabaseTab =
  | 'FINANCIAL_SESSION'
  | 'PRINTER_SETTINGS'
  | 'CHANGE_PASSWORD'
  | 'RBAC_MFA'
  | 'IMPORT_FILE'
  | 'IMPORT_FOLDER'
  | 'NETWORK_SETUP'
  | 'BACKUP_KPD'
  | 'REMOVE_ALL';

interface SettingsDatabaseViewProps {
  activeSubTab: SettingsDatabaseTab;
  setActiveSubTab: (t: SettingsDatabaseTab) => void;
}

const FILE_PICKER_ACCEPT_STRING = [
  ...SUPPORTED_POS_EXTENSIONS,
  ...SUPPORTED_POS_MIME_TYPES.filter(Boolean),
].join(',');

export const SettingsDatabaseView: React.FC<SettingsDatabaseViewProps> = ({
  activeSubTab,
  setActiveSubTab,
}) => {
  const {
    state,
    activeProfile,
    currentUser,
    deviceId,
    devicePlatform,
    isOnline,
    offlineSimulated,
    setOfflineSimulated,
    saveMaster,
    rolloverFinancialSession,
    manageStaffUser,
    createCloudBackup,
    importDatabaseData,
    clearAllDatabaseData,
    registerCurrentDevice,
    notify,
  } = usePos();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  // Financial Year & Cash Opening State
  const [fyInput, setFyInput] = useState(state.company.financialYear || 'FY2026-27');
  const [currencyInput, setCurrencyInput] = useState(state.company.currency || 'INR');
  const [languageInput, setLanguageInput] = useState(state.company.language || 'en');

  // Password Change State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // New Staff User Form State
  const [staffUsername, setStaffUsername] = useState('');
  const [staffDisplayName, setStaffDisplayName] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffRole, setStaffRole] = useState<UserRole>('CASHIER');
  const [staffAllowedProfile, setStaffAllowedProfile] = useState<ProfileType | 'BOTH'>('GST');
  const [staffMfaEnabled, setStaffMfaEnabled] = useState(false);
  const [staffMfaPin, setStaffMfaPin] = useState('123456');

  // Remove All Confirmation & KPD Import State
  const [confirmClearText, setConfirmClearText] = useState('');
  const [kpdPassword, setKpdPassword] = useState('');
  const [importingBusy, setImportingBusy] = useState(false);
  const [importValidationError, setImportValidationError] = useState<string>('');
  const [importValidationSuccess, setImportValidationSuccess] = useState<string>('');
  const [selectedFileSummary, setSelectedFileSummary] = useState<
    { name: string; sizeBytes: number; mimeType: string; ext: string }[]
  >([]);

  // Thermal Printer Settings State
  const availablePrinters = [
    {
      name: 'EPSON TM-T82III Receipt (USB001)',
      connectionType: 'USB' as const,
      status: 'Ready (Online)',
      recommendedSize: 'THERMAL_80MM' as ReceiptPaperSize,
    },
    {
      name: 'TVS Electronics RP-3200 Star (USB002)',
      connectionType: 'USB' as const,
      status: 'Ready (Online)',
      recommendedSize: 'THERMAL_80MM' as ReceiptPaperSize,
    },
    {
      name: 'Xprinter XP-58IIH Thermal (BT-SPP)',
      connectionType: 'BLUETOOTH' as const,
      status: 'Paired (Android / Windows)',
      recommendedSize: 'THERMAL_58MM' as ReceiptPaperSize,
    },
    {
      name: 'Rugtek RP80 Network POS (192.168.1.210:9100)',
      connectionType: 'LAN_IP' as const,
      status: 'Connected (ESC/POS 9100)',
      recommendedSize: 'THERMAL_80MM' as ReceiptPaperSize,
    },
    {
      name: 'Windows Default Print Spooler (A4 / A5 Laser)',
      connectionType: 'WINDOWS_SPOOLER' as const,
      status: 'Spooler Active',
      recommendedSize: 'A4' as ReceiptPaperSize,
    },
  ];

  const [printerConfig, setPrinterConfig] = useState<PrinterSettingsConfig>(() => ({
    selectedPrinterName:
      state.company.printerSettings?.selectedPrinterName ||
      'EPSON TM-T82III Receipt (USB001)',
    connectionType: state.company.printerSettings?.connectionType || 'USB',
    paperSize: state.company.printerSettings?.paperSize || 'THERMAL_80MM',
    marginTopMm: state.company.printerSettings?.marginTopMm ?? 4,
    marginBottomMm: state.company.printerSettings?.marginBottomMm ?? 4,
    marginLeftMm: state.company.printerSettings?.marginLeftMm ?? 3,
    marginRightMm: state.company.printerSettings?.marginRightMm ?? 3,
    autoCutPaper: state.company.printerSettings?.autoCutPaper ?? true,
    openCashDrawer: state.company.printerSettings?.openCashDrawer ?? false,
    copiesCount: state.company.printerSettings?.copiesCount ?? 1,
  }));

  useEffect(() => {
    if (activeSubTab === 'PRINTER_SETTINGS' && state.company.printerSettings) {
      setPrinterConfig(state.company.printerSettings);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubTab]);

  // Listen for Windows .NET WebView2 native file picker messages if running inside .NET desktop shell
  useEffect(() => {
    const webview = (window as any).chrome?.webview;
    if (!webview) return;
    const handler = async (event: any) => {
      try {
        const msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (msg?.type === 'KANHA_NATIVE_KPD_SELECTED' && msg.base64Data) {
          setImportingBusy(true);
          setImportValidationError('');
          setImportValidationSuccess('');
          const res = await importDatabaseData(
            {
              files: [{ fileName: msg.fileName || 'backup.kpd', base64Data: msg.base64Data }],
              password: kpdPassword.trim() || undefined,
            },
            activeProfile
          );
          if (!res.ok) {
            setImportValidationError(
              res.error ||
                'Invalid Kanha System Format: The file structure does not match the expected Kanha POS schema.'
            );
          } else {
            setImportValidationSuccess(
              res.summary || `Successfully imported ${msg.fileName} via Windows .NET Native Host.`
            );
          }
          setImportingBusy(false);
        }
      } catch {
        setImportingBusy(false);
      }
    };
    webview.addEventListener('message', handler);
    return () => webview.removeEventListener('message', handler);
  }, [activeProfile, importDatabaseData, kpdPassword]);

  const fileToBase64 = (file: File): Promise<{ fileName: string; base64Data: string }> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const commaIdx = result.indexOf(',');
        const base64Data = commaIdx >= 0 ? result.slice(commaIdx + 1) : result;
        resolve({
          fileName: (file as any).webkitRelativePath || file.name,
          base64Data,
        });
      };
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
      reader.readAsDataURL(file);
    });

  const readFileTextPreview = (file: File): Promise<string> =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => resolve('');
      reader.readAsText(file);
    });

  const processSelectedFiles = async (fileList: FileList | null, mode: 'FILE' | 'FOLDER') => {
    setImportValidationError('');
    setImportValidationSuccess('');

    // 1. Explicit MIME-type and extension validation
    const selectionCheck = validateDatabaseFilesSelection(fileList, mode);
    if (!selectionCheck.valid) {
      const msg =
        selectionCheck.errorMessage ||
        'Invalid file chosen. Please select a valid Kanha POS (.kpd, .json, .zip, .bak, .dat) file.';
      setImportValidationError(msg);
      setSelectedFileSummary([]);
      notify(msg, 'error');
      return;
    }

    const validFiles = selectionCheck.validFiles;
    setSelectedFileSummary(
      validFiles.slice(0, 8).map((f) => {
        const lower = f.name.toLowerCase();
        const dotIdx = lower.lastIndexOf('.');
        return {
          name: (f as any).webkitRelativePath || f.name,
          sizeBytes: f.size,
          mimeType: f.type || 'application/octet-stream (.kpd/binary)',
          ext: dotIdx >= 0 ? lower.slice(dotIdx) : '(auto)',
        };
      })
    );

    setImportingBusy(true);
    try {
      // 2. Client-side Kanha system structure validation for plain-text JSON / .kpd files
      for (const file of validFiles) {
        const lower = file.name.toLowerCase();
        if (lower.endsWith('.json') || lower.endsWith('.kpd')) {
          const textPreview = (await readFileTextPreview(file)).replace(/^\uFEFF/, '').trim();
          // If it starts with '{' or '[', it's plain-text JSON (not binary ZIP/GZip/AES)
          if (textPreview.startsWith('{') || textPreview.startsWith('[')) {
            let parsedJson: any;
            try {
              parsedJson = JSON.parse(textPreview);
            } catch {
              const syntaxErr = `File Format Error in "${file.name}": The file contains malformed JSON and cannot be parsed as a Kanha POS archive.`;
              setImportValidationError(syntaxErr);
              notify(syntaxErr, 'error');
              return;
            }

            const structureCheck = validateKanhaPayloadStructure(parsedJson, file.name);
            if (!structureCheck.isValidKanhaFormat) {
              const structErr =
                structureCheck.errorMessage ||
                `Invalid Kanha System Format: "${file.name}" does not match the expected Kanha POS schema.`;
              setImportValidationError(structErr);
              notify(structErr, 'error');
              return;
            }
          }
        }
      }

      // 3. Encode validated files and send to server / offline importer
      const encodedFiles = await Promise.all(validFiles.map((f) => fileToBase64(f)));

      const result = await importDatabaseData(
        {
          files: encodedFiles,
          password: kpdPassword.trim() || undefined,
        },
        activeProfile
      );

      if (!result.ok) {
        setImportValidationError(
          result.error ||
            'Invalid Kanha System Format: The file structure does not match the expected Kanha POS database format.'
        );
      } else {
        setImportValidationSuccess(
          result.summary ||
            `Successfully validated and imported ${validFiles.length} Kanha POS file(s) into ${activeProfile} profile.`
        );
      }
    } catch {
      const readErr =
        'Could not read the selected archive file. Verify file permissions and ensure it is a valid Kanha POS (.kpd / .json / .zip) file.';
      setImportValidationError(readErr);
      notify(readErr, 'error');
    } finally {
      setImportingBusy(false);
    }
  };

  const handleImportFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    try {
      await processSelectedFiles(files, 'FILE');
    } finally {
      // Always reset input value so selecting the same .kpd file again triggers onChange
      e.target.value = '';
    }
  };

  const handleImportFolderInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    try {
      await processSelectedFiles(files, 'FOLDER');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] bg-white">
      <div className="bg-[#0d6e6e] text-white px-4 py-2 flex flex-wrap items-center justify-between gap-3">
        <div className="font-bold text-sm tracking-wide">
          Settings, Security (RBAC/MFA), Printer &amp; Database Management
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {(
            [
              ['FINANCIAL_SESSION', 'Financial Session'],
              ['PRINTER_SETTINGS', 'Printer Settings'],
              ['CHANGE_PASSWORD', 'Change Password'],
              ['RBAC_MFA', 'Role & Access Control (MFA)'],
              ['NETWORK_SETUP', 'Network & Offline Setup'],
              ['BACKUP_KPD', 'Backup .kpd & Cloud'],
              ['IMPORT_FILE', 'Import Data File (.kpd)'],
              ['REMOVE_ALL', 'Remove All Data'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveSubTab(id)}
              className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                activeSubTab === id ||
                (id === 'IMPORT_FILE' && activeSubTab === 'IMPORT_FOLDER')
                  ? 'bg-white text-[#0d6e6e]'
                  : 'bg-[#094e4e] text-slate-100 hover:bg-teal-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 max-w-5xl mx-auto w-full space-y-5 text-xs">
        {/* 1. VIEW FINANCIAL YEAR / SESSION & ROLLOVER */}
        {activeSubTab === 'FINANCIAL_SESSION' && (
          <div className="border border-slate-300 rounded p-5 bg-white space-y-5 max-w-3xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Financial Year / Session Rollover &amp; Serial Continuation
                </h3>
                <p className="text-[11px] text-slate-500">
                  When the session is changed, all transactions, masters, and ledgers are carried
                  forward to the new financial year and new bills continue from (last serial + 1).
                </p>
              </div>
              <span className="px-2.5 py-1 rounded bg-teal-50 border border-teal-200 font-mono text-xs font-bold text-[#0d6e6e]">
                Active: {state.company.financialYear || 'FY2026-27'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div className="sm:col-span-2">
                <label className="block font-bold mb-1">
                  Active Financial Year / Session (Auto or Manual)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={fyInput}
                    onChange={(e) => setFyInput(e.target.value)}
                    placeholder="e.g. FY2026-27"
                    className="flex-1 rounded border border-slate-300 px-3 py-2 font-mono font-bold text-slate-900 focus:border-[#0d6e6e] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const nextFy = await rolloverFinancialSession(undefined, true);
                      setFyInput(nextFy);
                    }}
                    className="flex items-center gap-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold px-3.5 py-2 text-xs cursor-pointer whitespace-nowrap"
                    title="Auto-calculate next financial year, carry all transactions & records forward, and continue bill serials"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>
                      Auto Rollover to {computeNextFinancialYear(state.company.financialYear || fyInput)}
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Multi-Currency Processing</label>
                <select
                  value={currencyInput}
                  onChange={(e) => setCurrencyInput(e.target.value as any)}
                  className="w-full rounded border border-slate-300 bg-slate-50 px-3 py-2"
                >
                  <option value="INR">INR (₹ - Indian Rupee)</option>
                  <option value="USD">USD ($ - US Dollar)</option>
                  <option value="EUR">EUR (€ - Euro)</option>
                  <option value="GBP">GBP (£ - British Pound)</option>
                  <option value="AED">AED (UAE Dirham)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold mb-1">Interface Localization Language</label>
                <select
                  value={languageInput}
                  onChange={(e) => setLanguageInput(e.target.value as any)}
                  className="w-full rounded border border-slate-300 bg-slate-50 px-3 py-2"
                >
                  <option value="en">English (Global / India)</option>
                  <option value="hi">Hindi (हिन्दी)</option>
                  <option value="es">Spanish (Español)</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={async () => {
                    const targetFy = fyInput.trim() || computeNextFinancialYear(state.company.financialYear);
                    await rolloverFinancialSession(targetFy, false);
                    await saveMaster('COMPANY', {
                      financialYear: targetFy,
                      currency: currencyInput,
                      language: languageInput,
                    });
                    setFyInput(targetFy);
                  }}
                  className="w-full rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold py-2 px-5 cursor-pointer"
                >
                  Save Session &amp; Carry All Records to {fyInput || state.company.financialYear}
                </button>
              </div>
            </div>

            {/* Carry-Forward Records & Next Bill Serial Continuation Summary */}
            <div className="p-4 rounded border border-slate-200 bg-slate-50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">
                  Carried-Forward Records &amp; Next Bill Serial Continuation (Last Serial &rarr; Next Serial)
                </span>
                <span className="text-[11px] font-semibold text-emerald-700">
                  ● Zero Data Loss Rollover Active
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-[11px]">
                <div className="p-2.5 rounded bg-white border border-slate-200">
                  <span className="text-slate-500 block font-sans">Items &amp; HSN Master</span>
                  <span className="font-bold text-slate-900 text-xs">
                    {state.items.length} Items · {state.hsnCodes.length} HSN
                  </span>
                </div>
                <div className="p-2.5 rounded bg-white border border-slate-200">
                  <span className="text-slate-500 block font-sans">Customers &amp; Suppliers</span>
                  <span className="font-bold text-slate-900 text-xs">
                    {state.customers.length} Cust · {state.suppliers.length} Supp
                  </span>
                </div>
                <div className="p-2.5 rounded bg-white border border-slate-200">
                  <span className="text-slate-500 block font-sans">Carried Bills (GST/Non-GST)</span>
                  <span className="font-bold text-slate-900 text-xs">
                    {state.profiles.GST.sales.length + state.profiles.GST.purchases.length} GST ·{' '}
                    {state.profiles.NON_GST.sales.length + state.profiles.NON_GST.purchases.length}{' '}
                    Non-GST
                  </span>
                </div>
                <div className="p-2.5 rounded bg-white border border-slate-200">
                  <span className="text-slate-500 block font-sans">Payments &amp; Vouchers</span>
                  <span className="font-bold text-slate-900 text-xs">
                    {state.profiles.GST.vouchers.length + state.profiles.NON_GST.vouchers.length}{' '}
                    Vouchers
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-[11px] pt-1">
                <div className="p-2 rounded bg-teal-50/70 border border-teal-200">
                  <span className="text-slate-600 block font-sans">Next GST Tax Invoice</span>
                  <span className="font-bold text-[#0d6e6e]">
                    TAX{String(state.profiles.GST.counters.sale).padStart(5, '0')}
                  </span>
                </div>
                <div className="p-2 rounded bg-teal-50/70 border border-teal-200">
                  <span className="text-slate-600 block font-sans">Next Non-GST Bill</span>
                  <span className="font-bold text-[#0d6e6e]">
                    BIL{String(state.profiles.NON_GST.counters.sale).padStart(5, '0')}
                  </span>
                </div>
                <div className="p-2 rounded bg-teal-50/70 border border-teal-200">
                  <span className="text-slate-600 block font-sans">Next Purchase Invoice</span>
                  <span className="font-bold text-[#0d6e6e]">
                    PIN{String(state.profiles[activeProfile].counters.purchase).padStart(5, '0')}
                  </span>
                </div>
                <div className="p-2 rounded bg-teal-50/70 border border-teal-200">
                  <span className="text-slate-600 block font-sans">Next Payment / Receipt</span>
                  <span className="font-bold text-[#0d6e6e]">
                    PMT{String(state.profiles[activeProfile].counters.payment).padStart(5, '0')} / RCP
                    {String(state.profiles[activeProfile].counters.receipt).padStart(5, '0')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 1B. PRINTER SETTINGS (Connected Thermal Printers, Paper Size & Margins) */}
        {activeSubTab === 'PRINTER_SETTINGS' && (
          <div className="border border-slate-300 rounded p-5 bg-white space-y-5 max-w-3xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-[#0d6e6e]" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Thermal &amp; Receipt Printer Settings
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Select your connected thermal printer, default receipt paper size, and custom
                    print margins (in mm).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  notify(
                    `Refreshed connected printers (${availablePrinters.length} devices detected).`,
                    'info'
                  )
                }
                className="flex items-center gap-1 rounded border border-slate-300 bg-slate-50 hover:bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Scan Connected Printers</span>
              </button>
            </div>

            <div className="space-y-2">
              <label className="block font-bold text-slate-800">
                1. Select Connected Thermal / POS Printer
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {availablePrinters.map((p) => {
                  const isSelected = printerConfig.selectedPrinterName === p.name;
                  return (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() =>
                        setPrinterConfig((prev) => ({
                          ...prev,
                          selectedPrinterName: p.name,
                          connectionType: p.connectionType,
                          paperSize: p.recommendedSize,
                        }))
                      }
                      className={`p-3 rounded border text-left transition-colors cursor-pointer flex flex-col justify-between gap-1 ${
                        isSelected
                          ? 'border-[#0d6e6e] bg-teal-50/60'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 text-xs">{p.name}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold ${
                            isSelected
                              ? 'bg-[#0d6e6e] text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {p.connectionType}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-600 font-mono">
                        <span className="text-emerald-700 font-semibold">● {p.status}</span>
                        <span>Default: {p.recommendedSize}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  2. Default Receipt Paper Size
                </label>
                <select
                  value={printerConfig.paperSize}
                  onChange={(e) =>
                    setPrinterConfig((prev) => ({
                      ...prev,
                      paperSize: e.target.value as ReceiptPaperSize,
                    }))
                  }
                  className="w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 font-semibold"
                >
                  <option value="THERMAL_80MM">Thermal Roll — 80mm (3.15&quot; Standard)</option>
                  <option value="THERMAL_58MM">Thermal Roll — 58mm (2.25&quot; Compact)</option>
                  <option value="A4">Full Tax Invoice — A4 Sheet (210 &times; 297mm)</option>
                  <option value="A5">Half Sheet Bill — A5 Sheet (148 &times; 210mm)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Connection Interface</label>
                <select
                  value={printerConfig.connectionType}
                  onChange={(e) =>
                    setPrinterConfig((prev) => ({
                      ...prev,
                      connectionType: e.target.value as PrinterSettingsConfig['connectionType'],
                    }))
                  }
                  className="w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 font-mono"
                >
                  <option value="USB">USB Direct (ESC/POS)</option>
                  <option value="BLUETOOTH">Bluetooth SPP (Android / Desktop)</option>
                  <option value="LAN_IP">Ethernet LAN IP (Port 9100)</option>
                  <option value="WINDOWS_SPOOLER">Windows .NET Print Spooler</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Default Print Copies
                </label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={printerConfig.copiesCount}
                  onChange={(e) =>
                    setPrinterConfig((prev) => ({
                      ...prev,
                      copiesCount: Math.max(1, Number(e.target.value) || 1),
                    }))
                  }
                  className="w-full rounded border border-slate-300 px-3 py-2 font-mono"
                />
              </div>
            </div>

            <div className="p-3.5 rounded border border-slate-200 bg-slate-50 space-y-3">
              <div className="font-bold text-slate-900">
                3. Default Receipt Print Margins (in Millimeters — mm)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Top Margin (mm)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={printerConfig.marginTopMm}
                    onChange={(e) =>
                      setPrinterConfig((prev) => ({
                        ...prev,
                        marginTopMm: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Bottom Margin (mm)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={printerConfig.marginBottomMm}
                    onChange={(e) =>
                      setPrinterConfig((prev) => ({
                        ...prev,
                        marginBottomMm: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Left Margin (mm)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={printerConfig.marginLeftMm}
                    onChange={(e) =>
                      setPrinterConfig((prev) => ({
                        ...prev,
                        marginLeftMm: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Right Margin (mm)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={printerConfig.marginRightMm}
                    onChange={(e) =>
                      setPrinterConfig((prev) => ({
                        ...prev,
                        marginRightMm: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-5 pt-1">
                <label className="inline-flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={printerConfig.autoCutPaper}
                    onChange={(e) =>
                      setPrinterConfig((prev) => ({
                        ...prev,
                        autoCutPaper: e.target.checked,
                      }))
                    }
                  />
                  <span>ESC/POS Auto-Cut Paper After Receipt</span>
                </label>
                <label className="inline-flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={printerConfig.openCashDrawer}
                    onChange={(e) =>
                      setPrinterConfig((prev) => ({
                        ...prev,
                        openCashDrawer: e.target.checked,
                      }))
                    }
                  />
                  <span>Kick Cash Drawer (RJ11 Pulse) on Print</span>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  saveMaster('COMPANY', { printerSettings: printerConfig });
                  notify(
                    `Printer settings saved: ${printerConfig.selectedPrinterName} (${printerConfig.paperSize})`,
                    'success'
                  );
                }}
                className="rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold py-2 px-5 cursor-pointer"
              >
                Save Printer Settings
              </button>
              <button
                type="button"
                onClick={() => {
                  notify(
                    `Dispatched test page to ${printerConfig.selectedPrinterName} (${printerConfig.paperSize}, Margins ${printerConfig.marginTopMm}/${printerConfig.marginBottomMm}/${printerConfig.marginLeftMm}/${printerConfig.marginRightMm}mm).`,
                    'info'
                  );
                }}
                className="rounded border border-[#0d6e6e] text-[#0d6e6e] hover:bg-teal-50 font-bold py-2 px-4 cursor-pointer"
              >
                Send Test Thermal Receipt
              </button>
            </div>
          </div>
        )}

        {/* 2. CHANGE PASSWORD */}
        {activeSubTab === 'CHANGE_PASSWORD' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newPassword.trim() || newPassword !== confirmPassword) {
                notify('Passwords do not match or are empty.', 'error');
                return;
              }
              const target = state.users.find((u) => u.username === currentUser?.username);
              if (target) {
                manageStaffUser({ ...target, passwordHash: newPassword.trim() });
                setNewPassword('');
                setConfirmPassword('');
              }
            }}
            className="border border-slate-300 rounded p-5 bg-white space-y-4 max-w-md"
          >
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <KeyRound className="w-4 h-4 text-[#0d6e6e]" />
              <h3 className="text-sm font-bold text-slate-900">
                Change Password ({currentUser?.username || 'A'})
              </h3>
            </div>
            <div>
              <label className="block font-bold mb-1">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2"
              />
            </div>
            <button
              type="submit"
              className="rounded bg-[#0d6e6e] text-white font-bold py-2 px-5 cursor-pointer"
            >
              Update Password
            </button>
          </form>
        )}

        {/* 3. ROLE-BASED ACCESS CONTROL (RBAC) & MFA */}
        {activeSubTab === 'RBAC_MFA' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!staffUsername.trim() || !staffPassword.trim()) return;
                const userRecord: StaffUser = {
                  id: `usr-${Date.now()}`,
                  username: staffUsername.trim(),
                  passwordHash: staffPassword.trim(),
                  displayName: staffDisplayName.trim() || staffUsername.trim(),
                  role: staffRole,
                  allowedProfile: staffAllowedProfile,
                  mfaEnabled: staffMfaEnabled,
                  mfaCode: staffMfaPin.trim() || '123456',
                  active: true,
                  storeId: 'STORE-MAIN',
                };
                manageStaffUser(userRecord);
                setStaffUsername('');
                setStaffDisplayName('');
                setStaffPassword('');
              }}
              className="md:col-span-5 border border-slate-300 rounded p-4 bg-white space-y-3 h-fit"
            >
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900 border-b border-slate-200 pb-2">
                <Users className="w-4 h-4 text-[#0d6e6e]" />
                <span>Add Staff Account (RBAC &amp; MFA)</span>
              </div>
              <div>
                <label className="block font-bold mb-1">Username *</label>
                <input
                  type="text"
                  required
                  value={staffUsername}
                  onChange={(e) => setStaffUsername(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Display Name</label>
                <input
                  type="text"
                  value={staffDisplayName}
                  onChange={(e) => setStaffDisplayName(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Password *</label>
                <input
                  type="password"
                  required
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2.5 py-1.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Role</label>
                  <select
                    value={staffRole}
                    onChange={(e) => setStaffRole(e.target.value as UserRole)}
                    className="w-full rounded border border-slate-300 bg-slate-50 px-2.5 py-1.5"
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="MANAGER">MANAGER</option>
                    <option value="CASHIER">CASHIER</option>
                    <option value="AUDITOR">AUDITOR</option>
                    <option value="DEVELOPER">DEVELOPER</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1">Profile Access</label>
                  <select
                    value={staffAllowedProfile}
                    onChange={(e) => setStaffAllowedProfile(e.target.value as any)}
                    className="w-full rounded border border-slate-300 bg-slate-50 px-2.5 py-1.5"
                  >
                    <option value="GST">GST Only</option>
                    <option value="NON_GST">Non-GST Only</option>
                    <option value="BOTH">Both Profiles</option>
                  </select>
                </div>
              </div>
              <div className="p-2.5 rounded border border-slate-200 bg-slate-50 space-y-2">
                <label className="inline-flex items-center gap-2 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={staffMfaEnabled}
                    onChange={(e) => setStaffMfaEnabled(e.target.checked)}
                  />
                  <span>Require Multi-Factor Authentication (MFA PIN)</span>
                </label>
                {staffMfaEnabled && (
                  <input
                    type="text"
                    value={staffMfaPin}
                    onChange={(e) => setStaffMfaPin(e.target.value)}
                    placeholder="6-digit MFA PIN"
                    className="w-full rounded border border-slate-300 bg-white px-2.5 py-1 font-mono"
                  />
                )}
              </div>
              <button
                type="submit"
                className="w-full rounded bg-[#0d6e6e] text-white font-bold py-2 cursor-pointer"
              >
                Save Staff User
              </button>
            </form>

            <div className="md:col-span-7 border border-slate-300 rounded p-4 bg-white">
              <h3 className="text-sm font-bold text-slate-900 mb-3">
                Configured Staff Accounts ({state.users.length})
              </h3>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-left">
                    <th className="py-2 px-2.5">Username</th>
                    <th className="py-2 px-2.5">Role</th>
                    <th className="py-2 px-2.5">Profile</th>
                    <th className="py-2 px-2.5">MFA</th>
                    <th className="py-2 px-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {state.users.map((u) => (
                    <tr key={u.id}>
                      <td className="py-1.5 px-2.5 font-bold">{u.username}</td>
                      <td className="py-1.5 px-2.5 font-sans">{u.role}</td>
                      <td className="py-1.5 px-2.5">{u.allowedProfile}</td>
                      <td className="py-1.5 px-2.5 font-sans">
                        {u.mfaEnabled ? `Active (${u.mfaCode})` : 'Off'}
                      </td>
                      <td className="py-1.5 px-2.5 text-right">
                        {u.username !== 'developer' && u.username !== 'Devloper' && (
                          <button
                            type="button"
                            onClick={() => manageStaffUser(undefined, u.id)}
                            className="text-red-600 hover:text-red-800 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 inline" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. NETWORK DATA SETUP & OFFLINE SIMULATION */}
        {activeSubTab === 'NETWORK_SETUP' && (
          <div className="border border-slate-300 rounded p-5 bg-white space-y-4 max-w-2xl">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900 border-b border-slate-200 pb-2">
              <Network className="w-4 h-4 text-[#0d6e6e]" />
              <span>Automatic LAN / Cloud Server Pairing &amp; Offline Mode</span>
            </div>
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded border border-slate-200 font-mono">
              <div>
                <span className="text-slate-500 font-sans block">Local Device ID:</span>
                <strong>{deviceId}</strong>
              </div>
              <div>
                <span className="text-slate-500 font-sans block">Connection Status:</span>
                <strong className={isOnline ? 'text-emerald-700' : 'text-amber-700'}>
                  {isOnline ? 'ONLINE (Auto-Paired)' : 'OFFLINE QUEUE ACTIVE'}
                </strong>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500 font-sans block">
                  Pinned Server Certificate SHA-256:
                </span>
                <span className="text-[11px] break-all">{state.certificateSha256}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => registerCurrentDevice()}
                className="rounded bg-[#0d6e6e] text-white font-bold py-2 px-4 cursor-pointer"
              >
                Auto-Pair This Device with Server
              </button>

              <button
                type="button"
                onClick={() => setOfflineSimulated(!offlineSimulated)}
                className={`rounded font-bold py-2 px-4 cursor-pointer ${
                  offlineSimulated
                    ? 'bg-amber-600 text-white'
                    : 'border border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {offlineSimulated
                  ? 'Reconnect to Server (Exit Offline Mode)'
                  : 'Test Offline Mode (Uninterrupted Billing)'}
              </button>
            </div>
          </div>
        )}

        {/* 5. BACKUP .KPD & CLOUD SNAPSHOTS */}
        {activeSubTab === 'BACKUP_KPD' && (
          <div className="border border-slate-300 rounded p-5 bg-white space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                <Cloud className="w-4 h-4 text-[#0d6e6e]" />
                <span>Encrypted Cloud &amp; Local .kpd Backup System</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => createCloudBackup('GST')}
                  className="flex items-center gap-1 rounded bg-[#0d6e6e] text-white font-bold px-3 py-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Backup GST.kpd</span>
                </button>
                <button
                  type="button"
                  onClick={() => createCloudBackup('NON_GST')}
                  className="flex items-center gap-1 rounded bg-[#0d6e6e] text-white font-bold px-3 py-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Backup NON_GST.kpd</span>
                </button>
                <button
                  type="button"
                  onClick={() => createCloudBackup('FULL_SUITE')}
                  className="flex items-center gap-1 rounded bg-slate-800 text-white font-bold px-3 py-1.5 cursor-pointer"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Full Suite Cloud Snapshot</span>
                </button>
              </div>
            </div>

            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-left">
                  <th className="py-2 px-3">Timestamp</th>
                  <th className="py-2 px-3">Archive Name</th>
                  <th className="py-2 px-3">Profile</th>
                  <th className="py-2 px-3">SHA-256 Checksum</th>
                  <th className="py-2 px-3 text-right">Size</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {state.cloudBackups.map((b) => (
                  <tr key={b.id}>
                    <td className="py-1.5 px-3">{b.timestamp.slice(0, 19).replace('T', ' ')}</td>
                    <td className="py-1.5 px-3 font-bold text-[#0d6e6e]">{b.fileName}</td>
                    <td className="py-1.5 px-3">{b.profile}</td>
                    <td className="py-1.5 px-3 text-[11px]">{b.sha256Checksum}</td>
                    <td className="py-1.5 px-3 text-right">{b.sizeBytes} B</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 6. IMPORT DATA FILE / FOLDER (with explicit MIME-type, extension & Kanha schema validation) */}
        {(activeSubTab === 'IMPORT_FILE' || activeSubTab === 'IMPORT_FOLDER') && (
          <div className="border border-slate-300 rounded p-5 bg-white space-y-4 max-w-3xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                <FolderUp className="w-4 h-4 text-[#0d6e6e]" />
                <span>
                  Import POS Data File / Folder (.kpd / .json / .zip / .bak / .dat)
                </span>
              </div>
              <span className="text-[11px] font-mono text-[#0d6e6e] font-bold">
                Target Profile: {activeProfile}
              </span>
            </div>

            <div className="p-3 rounded border border-teal-200 bg-teal-50/50 text-slate-700 leading-relaxed space-y-1">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <FileCheck2 className="w-4 h-4 text-[#0d6e6e]" />
                <span>
                  MIME-Type, Extension &amp; Kanha System Format Validation Active (Windows .NET &amp; Android Compatible)
                </span>
              </div>
              <p>
                Supported file extensions:{' '}
                <code className="bg-white px-1.5 py-0.5 rounded border border-teal-200 font-mono text-[#0d6e6e]">
                  {SUPPORTED_POS_EXTENSIONS.join(', ')}
                </code>
                . Accepted MIME types include{' '}
                <code className="bg-white px-1 py-0.5 rounded font-mono text-[11px]">
                  application/octet-stream
                </code>
                ,{' '}
                <code className="bg-white px-1 py-0.5 rounded font-mono text-[11px]">
                  application/json
                </code>
                ,{' '}
                <code className="bg-white px-1 py-0.5 rounded font-mono text-[11px]">
                  application/zip
                </code>
                , and{' '}
                <code className="bg-white px-1 py-0.5 rounded font-mono text-[11px]">
                  application/xml
                </code>
                . Unsupported file types or non-Kanha structures are automatically blocked before processing.
              </p>
            </div>

            {importValidationError && (
              <div className="p-3.5 rounded border border-red-300 bg-red-50 text-red-800 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-red-900">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>File Validation / Kanha Format Error</span>
                </div>
                <p className="leading-relaxed">{importValidationError}</p>
              </div>
            )}

            {importValidationSuccess && (
              <div className="p-3.5 rounded border border-emerald-300 bg-emerald-50 text-emerald-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Kanha POS Archive Validated &amp; Imported</span>
                </div>
                <p className="leading-relaxed">{importValidationSuccess}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 rounded border border-slate-200 bg-slate-50 space-y-2">
                <label className="block font-bold text-slate-800">
                  Option 1: Choose .kpd / .json / .zip File(s)
                </label>
                <p className="text-[11px] text-slate-500">
                  Works on Windows (.NET Desktop), Android file picker, and Web browsers.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={FILE_PICKER_ACCEPT_STRING}
                  disabled={importingBusy}
                  onChange={handleImportFileInput}
                  className="block w-full text-xs text-slate-700 file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-bold file:bg-[#0d6e6e] file:text-white hover:file:bg-[#094e4e] cursor-pointer"
                />
                {(window as any).chrome?.webview && (
                  <button
                    type="button"
                    onClick={() =>
                      (window as any).chrome.webview.postMessage('OPEN_NATIVE_KPD_DIALOG')
                    }
                    className="w-full mt-1.5 rounded border border-[#0d6e6e] text-[#0d6e6e] hover:bg-teal-50 font-bold py-1.5 px-3 cursor-pointer"
                  >
                    Open Windows .NET Native File Dialog
                  </button>
                )}
              </div>

              <div className="p-3.5 rounded border border-slate-200 bg-slate-50 space-y-2">
                <label className="block font-bold text-slate-800">
                  Option 2: Import Entire PosData Folder
                </label>
                <p className="text-[11px] text-slate-500">
                  Automatically validates all <code className="font-mono">.kpd</code> /{' '}
                  <code className="font-mono">.json</code> files inside the folder.
                </p>
                <input
                  ref={folderInputRef}
                  type="file"
                  {...({ webkitdirectory: '', directory: '' } as any)}
                  multiple
                  accept={FILE_PICKER_ACCEPT_STRING}
                  disabled={importingBusy}
                  onChange={handleImportFolderInput}
                  className="block w-full text-xs text-slate-700 file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-bold file:bg-slate-700 file:text-white hover:file:bg-slate-800 cursor-pointer"
                />
              </div>
            </div>

            {selectedFileSummary.length > 0 && (
              <div className="border border-slate-200 rounded overflow-hidden">
                <div className="bg-slate-100 px-3 py-1.5 font-bold text-slate-700 border-b border-slate-200">
                  Validated Selection ({selectedFileSummary.length} file(s))
                </div>
                <div className="divide-y divide-slate-100 font-mono text-[11px]">
                  {selectedFileSummary.map((f, idx) => (
                    <div key={idx} className="px-3 py-1.5 flex items-center justify-between">
                      <span className="font-bold text-slate-900">{f.name}</span>
                      <span className="text-slate-500">
                        Ext: {f.ext} · MIME: {f.mimeType} · {f.sizeBytes} B
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-1">
              <label className="block font-bold text-slate-700 mb-1">
                Archive Password (Optional — only if your .kpd file has a custom password)
              </label>
              <input
                type="password"
                value={kpdPassword}
                onChange={(e) => setKpdPassword(e.target.value)}
                placeholder="Leave blank for standard Kanha POS .kpd backups"
                className="w-full max-w-sm rounded border border-slate-300 px-3 py-1.5 font-mono"
              />
            </div>

            {importingBusy && (
              <div className="p-2.5 rounded bg-teal-50 border border-teal-200 text-[#0d6e6e] font-bold">
                Validating Kanha POS schema and importing archive records...
              </div>
            )}

            <div className="p-3 rounded border border-slate-200 bg-slate-50 flex flex-wrap gap-4 font-mono text-xs text-slate-700">
              <span>Items Loaded: {state.items.length}</span>
              <span>Customers: {state.customers.length}</span>
              <span>Suppliers: {state.suppliers.length}</span>
              <span>HSN Codes: {state.hsnCodes.length}</span>
              <span>
                {activeProfile} Bills:{' '}
                {state.profiles[activeProfile].sales.length +
                  state.profiles[activeProfile].purchases.length}
              </span>
            </div>
          </div>
        )}

        {/* 8. REMOVE ALL DATA */}
        {activeSubTab === 'REMOVE_ALL' && (
          <div className="border border-red-300 rounded p-5 bg-white space-y-4 max-w-xl">
            <div className="flex items-center gap-2 font-bold text-sm text-red-700 border-b border-red-200 pb-2">
              <Lock className="w-4 h-4" />
              <span>Remove All Data (v2.5.2 Deliberate Clear)</span>
            </div>
            <p className="text-slate-600">
              Type <strong>CLEAR</strong> below to confirm clearing transactions or all masters.
            </p>
            <input
              type="text"
              value={confirmClearText}
              onChange={(e) => setConfirmClearText(e.target.value)}
              placeholder="Type CLEAR to confirm"
              className="w-full rounded border border-slate-300 px-3 py-2 font-mono"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={confirmClearText !== 'CLEAR'}
                onClick={() => {
                  clearAllDatabaseData(activeProfile);
                  setConfirmClearText('');
                }}
                className="rounded bg-amber-600 disabled:opacity-40 text-white font-bold py-2 px-4 cursor-pointer"
              >
                Clear {activeProfile} Profile Transactions Only
              </button>
              <button
                type="button"
                disabled={confirmClearText !== 'CLEAR'}
                onClick={() => {
                  clearAllDatabaseData('ALL');
                  setConfirmClearText('');
                }}
                className="rounded bg-red-600 disabled:opacity-40 text-white font-bold py-2 px-4 cursor-pointer"
              >
                Remove All Masters &amp; Both Profiles
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
