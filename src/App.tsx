import React, { useEffect, useRef, useState } from 'react';
import {
  AlertOctagon,
  ChevronDown,
  HelpCircle,
  Keyboard,
  Lock,
  Menu,
  Power,
  X,
} from 'lucide-react';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { PosProvider, usePos } from './context/PosContext';
import { ProfileType, PurchaseDocument, SaleDocument } from './types/pos';
import { AccountVoucherView } from './views/AccountVoucherView';
import { DashboardView } from './views/DashboardView';
import { DeveloperServerAdminView } from './views/DeveloperServerAdminView';
import { ErpWorkspaceView } from './views/ErpWorkspaceView';
import { GoodsOutView } from './views/GoodsOutView';
import { LoginView } from './views/LoginView';
import { MastersView, MasterTabType } from './views/MastersView';
import { PurchaseView } from './views/PurchaseView';
import { REPORT_LABELS, ReportsView, ReportType } from './views/ReportsView';
import { SettingsDatabaseTab, SettingsDatabaseView } from './views/SettingsDatabaseView';

type ActiveScreen =
  | 'DASHBOARD'
  | 'ERP'
  | 'MASTER'
  | 'GOODS_OUT'
  | 'PURCHASE'
  | 'ACCOUNT'
  | 'REPORTS'
  | 'SETTINGS_DB'
  | 'DEVELOPER';

const PosMainShell: React.FC = () => {
  const {
    state,
    activeProfile,
    currentUser,
    deviceId,
    toastMessage,
    login,
    logout,
    controlServerService,
    updateDeviceStatus,
  } = usePos();

  const [screen, setScreen] = useState<ActiveScreen>('DASHBOARD');
  const [masterTab, setMasterTab] = useState<MasterTabType>('ITEM');
  const [goodsOutType, setGoodsOutType] = useState<'SALE' | 'STOCK_OUT' | 'CREDIT_NOTE'>('SALE');
  const [purchaseType, setPurchaseType] = useState<'PURCHASE' | 'PURCHASE_RETURN'>('PURCHASE');
  const [voucherType, setVoucherType] = useState<'RECEIPT' | 'PAYMENT' | 'JOURNAL' | 'BANK'>(
    'RECEIPT'
  );
  const [reportType, setReportType] = useState<ReportType>('SALE_SUMMARY');
  const [settingsDbTab, setSettingsDbTab] = useState<SettingsDatabaseTab>('FINANCIAL_SESSION');

  // Saved Bill Drilldown State
  const [editingSaleDoc, setEditingSaleDoc] = useState<SaleDocument | null>(null);
  const [editingPurchaseDoc, setEditingPurchaseDoc] = useState<PurchaseDocument | null>(null);

  // Classic Top Dropdown Menu State
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  // Switch Profile / Developer Auth Modal State
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginTargetMode, setLoginTargetMode] = useState<'GST' | 'NON_GST' | 'DEVELOPER'>('GST');
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginMfa, setLoginMfa] = useState('');
  const [loginError, setLoginError] = useState('');

  // Global Search Modal (Ctrl+K) & Help / Keyboard Shortcuts Modal
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [quickSearchQuery, setQuickSearchQuery] = useState('');

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    const handleGlobalShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setGlobalSearchOpen((prev) => !prev);
      } else if (e.key === 'F1') {
        e.preventDefault();
        setShortcutsModalOpen((prev) => !prev);
      } else if (e.key === 'F2') {
        e.preventDefault();
        setEditingSaleDoc(null);
        setGoodsOutType('SALE');
        setScreen('GOODS_OUT');
      } else if (e.key === 'F3') {
        e.preventDefault();
        setEditingPurchaseDoc(null);
        setPurchaseType('PURCHASE');
        setScreen('PURCHASE');
      } else if (e.key === 'F4') {
        e.preventDefault();
        setEditingSaleDoc(null);
        setGoodsOutType('STOCK_OUT');
        setScreen('GOODS_OUT');
      } else if (e.key === 'F5') {
        e.preventDefault();
        setScreen('DASHBOARD');
      }
    };
    window.addEventListener('keydown', handleGlobalShortcut);
    return () => window.removeEventListener('keydown', handleGlobalShortcut);
  }, []);

  // Render full-page Login View whenever no user is signed in
  if (!currentUser) {
    return (
      <>
        {toastMessage && (
          <div
            className={`no-print fixed bottom-10 right-4 z-50 rounded px-4 py-2.5 text-xs font-bold text-white shadow-lg ${
              toastMessage.type === 'error'
                ? 'bg-red-700'
                : toastMessage.type === 'info'
                ? 'bg-slate-800'
                : 'bg-[#0d6e6e]'
            }`}
          >
            {toastMessage.text}
          </div>
        )}
        <LoginView
          onLoginSuccess={(mode) => {
            if (mode === 'DEVELOPER') {
              setScreen('DEVELOPER');
            } else {
              setScreen('DASHBOARD');
            }
          }}
        />
      </>
    );
  }

  const openAuthPrompt = (mode: 'GST' | 'NON_GST' | 'DEVELOPER') => {
    setLoginTargetMode(mode);
    setLoginUser('');
    setLoginPass('');
    setLoginMfa('');
    setLoginError('');
    setLoginModalOpen(true);
  };

  const handleQuickNavigate = (target: string) => {
    setOpenMenu(null);
    setMobileDrawerOpen(false);
    setEditingSaleDoc(null);
    setEditingPurchaseDoc(null);

    if (target === 'DEVELOPER') {
      if (currentUser.role !== 'DEVELOPER') {
        openAuthPrompt('DEVELOPER');
        return;
      }
      setScreen('DEVELOPER');
      return;
    }

    if (target === 'DASHBOARD') {
      setScreen('DASHBOARD');
    } else if (target === 'ERP') {
      setScreen('ERP');
    } else if (target === 'DATABASE') {
      setSettingsDbTab('BACKUP_KPD');
      setScreen('SETTINGS_DB');
    } else if (target.startsWith('MASTER:')) {
      setMasterTab(target.split(':')[1] as MasterTabType);
      setScreen('MASTER');
    } else if (target.startsWith('GOODS_OUT:')) {
      setGoodsOutType(target.split(':')[1] as 'SALE' | 'STOCK_OUT' | 'CREDIT_NOTE');
      setScreen('GOODS_OUT');
    } else if (target.startsWith('PURCHASE:')) {
      setPurchaseType(target.split(':')[1] as 'PURCHASE' | 'PURCHASE_RETURN');
      setScreen('PURCHASE');
    } else if (target.startsWith('ACCOUNT:')) {
      setVoucherType(target.split(':')[1] as 'RECEIPT' | 'PAYMENT' | 'JOURNAL' | 'BANK');
      setScreen('ACCOUNT');
    } else if (target.startsWith('REPORT:')) {
      setReportType(target.split(':')[1] as ReportType);
      setScreen('REPORTS');
    } else if (target.startsWith('SETTINGS:')) {
      setSettingsDbTab(target.split(':')[1] as SettingsDatabaseTab);
      setScreen('SETTINGS_DB');
    }
  };

  const currentDevice = state.devices.find((d) => d.deviceId === deviceId);
  const isDeviceStopped =
    currentDevice &&
    (currentDevice.status === 'REVOKED' || currentDevice.status === 'SUSPENDED');

  // Remote Suspension / Shutdown OR Device Revocation / Suspension Lockout Screen
  if ((state.serverStatus !== 'ONLINE' || isDeviceStopped) && screen !== 'DEVELOPER') {
    const isDeviceIssue = Boolean(isDeviceStopped);
    const statusLabel = isDeviceIssue
      ? `Terminal Device ${currentDevice?.status}`
      : `POS Service ${state.serverStatus === 'SHUTDOWN' ? 'Shut Down' : 'Suspended'}`;

    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-lg border border-red-500/40 bg-slate-800 p-6 shadow-2xl space-y-4">
          <div className="flex items-center gap-3 text-red-400">
            <AlertOctagon className="w-7 h-7 shrink-0" />
            <div>
              <h2 className="text-base font-bold text-white">{statusLabel}</h2>
              <p className="text-xs text-slate-300 font-mono">
                Firm ID: {state.firmId} · Device: {deviceId}
              </p>
            </div>
          </div>

          <div className="p-3 rounded bg-slate-900/90 border border-slate-700 text-xs text-slate-200 leading-relaxed">
            <span className="font-bold text-amber-400 block mb-1">
              {isDeviceIssue ? 'Device Access Terminated:' : 'Administrator Notice:'}
            </span>
            {isDeviceIssue
              ? `This POS terminal (${
                  currentDevice?.deviceName || deviceId
                }) has been ${currentDevice?.status} from the Developer Panel. All billing, master edits, and POS operations on this device are stopped until re-authorized by the Developer.`
              : state.suspensionReason ||
                'POS operations have been paused remotely by the Server Administrator / Developer Panel.'}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {currentUser.role === 'DEVELOPER' ? (
              <>
                {isDeviceIssue && currentDevice ? (
                  <button
                    type="button"
                    onClick={() => updateDeviceStatus(currentDevice.deviceId, 'APPROVED')}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 cursor-pointer"
                  >
                    <Power className="w-4 h-4" />
                    <span>Re-Approve This Device ({currentDevice.deviceId})</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => controlServerService('ONLINE', '')}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 cursor-pointer"
                  >
                    <Power className="w-4 h-4" />
                    <span>Resume POS Service</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setScreen('DEVELOPER')}
                  className="rounded border border-slate-600 hover:bg-slate-700 text-slate-200 font-semibold text-xs py-2.5 px-4 cursor-pointer"
                >
                  Open Developer Panel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={logout}
                className="w-full rounded bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs py-2.5 px-4 cursor-pointer"
              >
                Sign In as Developer to Restore Device / Service
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f1f5f9] text-slate-900 select-none">
      {/* Top Menu Strip matching MainForm.cs BuildTopMenu() */}
      <header
        ref={menuContainerRef}
        className="no-print sticky top-0 z-30 bg-[#0f172a] text-white shadow-xs"
      >
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 flex-wrap">
          {/* Left Menu Items matching MainForm.cs */}
          <div className="flex items-center gap-0.5 flex-wrap">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen((v) => !v)}
              className="md:hidden p-1.5 rounded text-white hover:bg-slate-800"
            >
              {mobileDrawerOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>

            <nav className="hidden md:flex items-center gap-0.5 text-[12.5px] font-bold">
              {/* 1. Dashboard */}
              <button
                type="button"
                onClick={() => handleQuickNavigate('DASHBOARD')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer whitespace-nowrap ${
                  screen === 'DASHBOARD' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/80'
                }`}
              >
                Dashboard
              </button>

              {/* 2. Transactions */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenMenu(openMenu === 'TRANSACTIONS' ? null : 'TRANSACTIONS')}
                  className={`px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                    openMenu === 'TRANSACTIONS' || screen === 'GOODS_OUT' || screen === 'PURCHASE'
                      ? 'bg-slate-800 text-white'
                      : 'hover:bg-slate-800/80'
                  }`}
                >
                  <span>Transactions</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {openMenu === 'TRANSACTIONS' && (
                  <div className="absolute left-0 top-full w-60 bg-white text-slate-900 border border-slate-300 shadow-lg py-1 z-50 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => handleQuickNavigate('GOODS_OUT:SALE')}
                      className="w-full text-left px-4 py-1.5 hover:bg-slate-100 cursor-pointer"
                    >
                      POS / Bill (F2)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickNavigate('PURCHASE:PURCHASE')}
                      className="w-full text-left px-4 py-1.5 hover:bg-slate-100 cursor-pointer"
                    >
                      Purchase Entry (F3)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickNavigate('GOODS_OUT:CREDIT_NOTE')}
                      className="w-full text-left px-4 py-1.5 hover:bg-slate-100 cursor-pointer"
                    >
                      Sales Return / Credit Note
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickNavigate('PURCHASE:PURCHASE_RETURN')}
                      className="w-full text-left px-4 py-1.5 hover:bg-slate-100 cursor-pointer"
                    >
                      Purchase Return / Debit Note
                    </button>
                    <div className="my-1 border-t border-slate-200" />
                    <button
                      type="button"
                      onClick={() => handleQuickNavigate('GOODS_OUT:STOCK_OUT')}
                      className="w-full text-left px-4 py-1.5 hover:bg-slate-100 cursor-pointer"
                    >
                      Estimate / Quotation / Stock Out (F4)
                    </button>
                  </div>
                )}
              </div>

              {/* 3. Masters */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenMenu(openMenu === 'MASTERS' ? null : 'MASTERS')}
                  className={`px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                    openMenu === 'MASTERS' || screen === 'MASTER'
                      ? 'bg-slate-800 text-white'
                      : 'hover:bg-slate-800/80'
                  }`}
                >
                  <span>Masters</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {openMenu === 'MASTERS' && (
                  <div className="absolute left-0 top-full w-56 bg-white text-slate-900 border border-slate-300 shadow-lg py-1 z-50 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => handleQuickNavigate('MASTER:COMPANY')}
                      className="w-full text-left px-4 py-1.5 hover:bg-slate-100 cursor-pointer"
                    >
                      Company Master
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickNavigate('MASTER:CUSTOMER')}
                      className="w-full text-left px-4 py-1.5 hover:bg-slate-100 cursor-pointer"
                    >
                      Customer Master
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickNavigate('MASTER:SUPPLIER')}
                      className="w-full text-left px-4 py-1.5 hover:bg-slate-100 cursor-pointer"
                    >
                      Supplier Master
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickNavigate('MASTER:ITEM')}
                      className="w-full text-left px-4 py-1.5 hover:bg-slate-100 cursor-pointer"
                    >
                      Item Master (Batch / Expiry)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickNavigate('MASTER:HSN')}
                      className="w-full text-left px-4 py-1.5 hover:bg-slate-100 cursor-pointer"
                    >
                      HSN Code Master
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickNavigate('MASTER:BANK')}
                      className="w-full text-left px-4 py-1.5 hover:bg-slate-100 cursor-pointer"
                    >
                      Bank Accounts Master
                    </button>
                  </div>
                )}
              </div>

              {/* 4. Reports */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenMenu(openMenu === 'REPORTS' ? null : 'REPORTS')}
                  className={`px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                    openMenu === 'REPORTS' || screen === 'REPORTS'
                      ? 'bg-slate-800 text-white'
                      : 'hover:bg-slate-800/80'
                  }`}
                >
                  <span>Reports</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {openMenu === 'REPORTS' && (
                  <div className="absolute left-0 top-full w-64 max-h-[75vh] overflow-y-auto bg-white text-slate-900 border border-slate-300 shadow-lg py-1 z-50 text-xs font-semibold">
                    {(Object.entries(REPORT_LABELS) as [ReportType, string][]).map(
                      ([rKey, rLabel]) => (
                        <button
                          key={rKey}
                          type="button"
                          onClick={() => handleQuickNavigate(`REPORT:${rKey}`)}
                          className="w-full text-left px-4 py-1.5 hover:bg-slate-100 cursor-pointer"
                        >
                          {rLabel}
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>

              {/* 5. Accounting */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenMenu(openMenu === 'ACCOUNT' ? null : 'ACCOUNT')}
                  className={`px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                    openMenu === 'ACCOUNT' || screen === 'ACCOUNT'
                      ? 'bg-slate-800 text-white'
                      : 'hover:bg-slate-800/80'
                  }`}
                >
                  <span>Accounting</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {openMenu === 'ACCOUNT' && (
                  <div className="absolute left-0 top-full w-56 bg-white text-slate-900 border border-slate-300 shadow-lg py-1 z-50 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => handleQuickNavigate('ACCOUNT:RECEIPT')}
                      className="w-full text-left px-4 py-1.5 hover:bg-slate-100 cursor-pointer"
                    >
                      Receipt Voucher
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickNavigate('ACCOUNT:PAYMENT')}
                      className="w-full text-left px-4 py-1.5 hover:bg-slate-100 cursor-pointer"
                    >
                      Payment Voucher
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickNavigate('ACCOUNT:JOURNAL')}
                      className="w-full text-left px-4 py-1.5 hover:bg-slate-100 cursor-pointer"
                    >
                      Journal / Expense Voucher
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickNavigate('ACCOUNT:BANK')}
                      className="w-full text-left px-4 py-1.5 hover:bg-slate-100 cursor-pointer"
                    >
                      Contra / Bank Voucher
                    </button>
                  </div>
                )}
              </div>

              {/* 6. Orders / CRM */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenMenu(openMenu === 'CRM' ? null : 'CRM')}
                  className={`px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                    openMenu === 'CRM' || screen === 'ERP'
                      ? 'bg-slate-800 text-white'
                      : 'hover:bg-slate-800/80'
                  }`}
                >
                  <span>Orders / CRM</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {openMenu === 'CRM' && (
                  <div className="absolute left-0 top-full w-56 bg-white text-slate-900 border border-slate-300 shadow-lg py-1 z-50 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => handleQuickNavigate('ERP')}
                      className="w-full text-left px-4 py-1.5 hover:bg-slate-100 cursor-pointer"
                    >
                      Purchase Orders (PO) &amp; CRM Leads
                    </button>
                  </div>
                )}
              </div>

              {/* 7. Database (No Windows .NET & Android Apps option) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenMenu(openMenu === 'DATABASE' ? null : 'DATABASE')}
                  className={`px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                    openMenu === 'DATABASE' || screen === 'SETTINGS_DB'
                      ? 'bg-slate-800 text-white'
                      : 'hover:bg-slate-800/80'
                  }`}
                >
                  <span>Database</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {openMenu === 'DATABASE' && (
                  <div className="absolute left-0 top-full w-56 bg-white text-slate-900 border border-slate-300 shadow-lg py-1 z-50 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => handleQuickNavigate('SETTINGS:IMPORT_FILE')}
                      className="w-full text-left px-4 py-1.5 hover:bg-slate-100 cursor-pointer"
                    >
                      Import Data File
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickNavigate('SETTINGS:IMPORT_FOLDER')}
                      className="w-full text-left px-4 py-1.5 hover:bg-slate-100 cursor-pointer"
                    >
                      Import Data Folder
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickNavigate('SETTINGS:NETWORK_SETUP')}
                      className="w-full text-left px-4 py-1.5 hover:bg-slate-100 cursor-pointer"
                    >
                      Network Data Setup
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickNavigate('SETTINGS:PRINTER_SETTINGS')}
                      className="w-full text-left px-4 py-1.5 hover:bg-slate-100 cursor-pointer"
                    >
                      Printer Settings
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickNavigate('SETTINGS:BACKUP_KPD')}
                      className="w-full text-left px-4 py-1.5 hover:bg-slate-100 cursor-pointer"
                    >
                      Backup .kpd
                    </button>
                    <div className="my-1 border-t border-slate-200" />
                    <button
                      type="button"
                      onClick={() => handleQuickNavigate('SETTINGS:REMOVE_ALL')}
                      className="w-full text-left px-4 py-1.5 hover:bg-slate-100 text-red-600 cursor-pointer"
                    >
                      Remove All Data
                    </button>
                  </div>
                )}
              </div>

              {/* 8. Developer / Server */}
              <button
                type="button"
                onClick={() => handleQuickNavigate('DEVELOPER')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer whitespace-nowrap text-[#facc15] ${
                  screen === 'DEVELOPER' ? 'bg-slate-800' : 'hover:bg-slate-800/80'
                }`}
              >
                Developer / Server
              </button>

              {/* 9. Session (FY) */}
              <button
                type="button"
                onClick={() => handleQuickNavigate('SETTINGS:FINANCIAL_SESSION')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer whitespace-nowrap text-[#7dd3fc] ${
                  screen === 'SETTINGS_DB' && settingsDbTab === 'FINANCIAL_SESSION'
                    ? 'bg-slate-800'
                    : 'hover:bg-slate-800/80'
                }`}
              >
                Session (FY)
              </button>

              {/* 10. Logout */}
              <button
                type="button"
                onClick={logout}
                className="px-2.5 py-1 rounded transition-colors cursor-pointer whitespace-nowrap text-[#fca5a5] hover:bg-slate-800/80"
              >
                Logout
              </button>
            </nav>
          </div>

          {/* 11. Quick Search Box inside Menu Bar matching MainForm.cs */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs font-bold text-slate-300">Search:</span>
            <input
              type="text"
              value={quickSearchQuery}
              onChange={(e) => setQuickSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setGlobalSearchOpen(true);
                }
              }}
              placeholder="Item, Barcode, Party, Bill (Ctrl+K)"
              className="w-40 lg:w-48 bg-white text-slate-900 border border-slate-400 px-2 py-0.5 text-xs focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setGlobalSearchOpen(true)}
              className="px-2 py-0.5 text-xs font-bold text-[#86efac] hover:bg-slate-800 rounded cursor-pointer"
            >
              Find
            </button>
          </div>
        </div>

        {/* Mobile Drawer Navigation */}
        {mobileDrawerOpen && (
          <div className="md:hidden border-t border-slate-700 bg-slate-900 p-3 grid grid-cols-2 gap-2 text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleQuickNavigate('DASHBOARD')}
              className="p-2 rounded bg-slate-800 text-left text-white"
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => handleQuickNavigate('GOODS_OUT:SALE')}
              className="p-2 rounded bg-slate-800 text-left text-white"
            >
              POS / Bill (F2)
            </button>
            <button
              type="button"
              onClick={() => handleQuickNavigate('PURCHASE:PURCHASE')}
              className="p-2 rounded bg-slate-800 text-left text-white"
            >
              Purchase Entry (F3)
            </button>
            <button
              type="button"
              onClick={() => handleQuickNavigate('MASTER:COMPANY')}
              className="p-2 rounded bg-slate-800 text-left text-white"
            >
              Masters
            </button>
            <button
              type="button"
              onClick={() => handleQuickNavigate('ACCOUNT:RECEIPT')}
              className="p-2 rounded bg-slate-800 text-left text-white"
            >
              Accounting
            </button>
            <button
              type="button"
              onClick={() => handleQuickNavigate('REPORT:SALE_SUMMARY')}
              className="p-2 rounded bg-slate-800 text-left text-white"
            >
              Reports
            </button>
            <button
              type="button"
              onClick={() => handleQuickNavigate('ERP')}
              className="p-2 rounded bg-slate-800 text-left text-white"
            >
              Orders / CRM
            </button>
            <button
              type="button"
              onClick={() => handleQuickNavigate('SETTINGS:IMPORT_FILE')}
              className="p-2 rounded bg-slate-800 text-left text-white"
            >
              Database
            </button>
            <button
              type="button"
              onClick={() => handleQuickNavigate('DEVELOPER')}
              className="p-2 rounded bg-slate-800 text-left text-[#facc15]"
            >
              Developer / Server
            </button>
            <button
              type="button"
              onClick={logout}
              className="p-2 rounded bg-slate-800 text-left text-[#fca5a5]"
            >
              Logout
            </button>
          </div>
        )}
      </header>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`no-print fixed bottom-10 right-4 z-50 rounded px-4 py-2.5 text-xs font-bold text-white shadow-lg ${
            toastMessage.type === 'error'
              ? 'bg-red-700'
              : toastMessage.type === 'info'
              ? 'bg-slate-800'
              : 'bg-[#16a34a]'
          }`}
        >
          {toastMessage.text}
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="flex-1">
        {screen === 'DASHBOARD' && (
          <DashboardView
            onNavigate={handleQuickNavigate}
            onOpenGlobalSearch={() => setGlobalSearchOpen(true)}
          />
        )}
        {screen === 'ERP' && <ErpWorkspaceView />}
        {screen === 'MASTER' && (
          <MastersView
            activeTab={masterTab}
            setActiveTab={setMasterTab}
            onExit={() => setScreen('DASHBOARD')}
          />
        )}
        {screen === 'GOODS_OUT' && (
          <GoodsOutView
            docType={goodsOutType}
            initialDocument={editingSaleDoc}
            onExit={() => setScreen('DASHBOARD')}
          />
        )}
        {screen === 'PURCHASE' && (
          <PurchaseView
            docType={purchaseType}
            initialDocument={editingPurchaseDoc}
            onExit={() => setScreen('DASHBOARD')}
          />
        )}
        {screen === 'ACCOUNT' && (
          <AccountVoucherView
            voucherType={voucherType}
            onExit={() => setScreen('DASHBOARD')}
          />
        )}
        {screen === 'REPORTS' && (
          <ReportsView
            reportType={reportType}
            setReportType={setReportType}
            onOpenSaleBill={(doc) => {
              setEditingSaleDoc(doc);
              setGoodsOutType(doc.docType);
              setScreen('GOODS_OUT');
            }}
            onOpenPurchaseBill={(doc) => {
              setEditingPurchaseDoc(doc);
              setPurchaseType(doc.docType);
              setScreen('PURCHASE');
            }}
          />
        )}
        {screen === 'SETTINGS_DB' && (
          <SettingsDatabaseView
            activeSubTab={settingsDbTab}
            setActiveSubTab={setSettingsDbTab}
          />
        )}
        {screen === 'DEVELOPER' && <DeveloperServerAdminView />}
      </main>

      {/* Bottom Status Bar matching MainForm.cs BuildStatusBar() */}
      <footer className="no-print bg-[#0f172a] text-white px-3 py-1.5 text-xs font-bold flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-white">
            Company: {state.company.firmName || 'Kanha POS Enterprise'}
          </span>
          <span className="text-[#38bdf8]">
            | Active Profile: {activeProfile} (Operator: {currentUser.username})
          </span>
          <span className="text-[#facc15]">
            | Session: {state.company.financialYear || 'FY2026-27'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShortcutsModalOpen(true)}
            title="Help / Keyboard Shortcuts (F1)"
            className="inline-flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 text-[#7dd3fc] border border-slate-600 px-2 py-0.5 text-[11px] font-bold cursor-pointer transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>?</span>
          </button>
          <div className="text-[#a7f3d0] font-bold">
            Developed by Kanha software solution
          </div>
        </div>
      </footer>

      {/* Help / Keyboard Shortcuts Modal */}
      {shortcutsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded bg-white border border-slate-300 shadow-2xl overflow-hidden text-xs">
            <div className="flex items-center justify-between bg-[#0f172a] text-white px-4 py-3">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Keyboard className="w-4 h-4 text-[#7dd3fc]" />
                <span>Help &amp; System Keyboard Shortcuts</span>
              </div>
              <button
                type="button"
                onClick={() => setShortcutsModalOpen(false)}
                className="text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-2.5">
              {[
                { key: 'F2', desc: 'Open POS / Bill (Tax Invoice / Goods Out)' },
                { key: 'F3', desc: 'Open Supplier Purchase Entry (Goods In)' },
                { key: 'F4', desc: 'Open Proforma Estimate / Quotation' },
                { key: 'F5', desc: 'Return to Main Dashboard & Live KPIs' },
                { key: 'Ctrl + K', desc: 'Open Global Quick Search (Items, Parties, Bills)' },
                { key: 'Enter', desc: 'Quick Add Selected / Typed Item to Current Bill' },
                { key: 'F10', desc: 'Save & Print Active Bill / Invoice' },
                { key: 'F1', desc: 'Toggle this Help / Keyboard Shortcuts Modal' },
              ].map((hk) => (
                <div
                  key={hk.key}
                  className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-b-0 last:pb-0"
                >
                  <span className="text-slate-700 font-semibold">{hk.desc}</span>
                  <kbd className="px-2.5 py-1 rounded bg-slate-100 border border-slate-300 font-mono font-bold text-slate-900">
                    {hk.key}
                  </kbd>
                </div>
              ))}
            </div>
            <div className="bg-slate-50 border-t border-slate-200 px-4 py-2.5 flex justify-end">
              <button
                type="button"
                onClick={() => setShortcutsModalOpen(false)}
                className="rounded bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold px-4 py-1.5 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Search Modal (Ctrl+K) */}
      <GlobalSearchModal
        isOpen={globalSearchOpen}
        onClose={() => setGlobalSearchOpen(false)}
        onNavigate={handleQuickNavigate}
        onOpenSaleBill={(doc) => {
          setEditingSaleDoc(doc);
          setGoodsOutType(doc.docType);
          setScreen('GOODS_OUT');
        }}
        onOpenPurchaseBill={(doc) => {
          setEditingPurchaseDoc(doc);
          setPurchaseType(doc.docType);
          setScreen('PURCHASE');
        }}
      />

      {/* Developer Authentication Modal */}
      {loginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-sm bg-white border border-slate-300 p-5 shadow-xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                <Lock className="w-4 h-4 text-[#0f172a]" />
                <span>
                  {loginTargetMode === 'DEVELOPER'
                    ? 'Developer / Server Authentication'
                    : `Switch to ${loginTargetMode === 'GST' ? 'GST' : 'Non-GST'} Profile`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLoginModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loginError && (
              <div className="p-2 rounded bg-red-50 border border-red-200 text-red-700 font-semibold">
                {loginError}
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setLoginError('');
                if (loginTargetMode === 'DEVELOPER') {
                  const p = loginPass.trim();
                  if (p === '3' || p === 'DEV@123' || p === 'Kanha@1298') {
                    setLoginModalOpen(false);
                    setScreen('DEVELOPER');
                    return;
                  }
                }
                const targetProfile: ProfileType =
                  loginTargetMode === 'NON_GST' ? 'NON_GST' : 'GST';
                const res = await login({
                  username: loginUser.trim() || 'Devloper',
                  password: loginPass,
                  profile: targetProfile,
                  mfaCode: loginMfa,
                });
                if (!res.ok) {
                  setLoginError(res.error || 'Invalid developer password.');
                } else {
                  setLoginModalOpen(false);
                  if (loginTargetMode === 'DEVELOPER') {
                    setScreen('DEVELOPER');
                  }
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="block font-bold mb-1">Enter Developer Password:</label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  placeholder="Enter password"
                  className="w-full border border-slate-300 px-3 py-2 font-mono text-sm"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#0f172a] hover:bg-slate-800 text-white font-bold py-2.5 cursor-pointer"
              >
                Unlock Developer Panel
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <PosProvider>
      <PosMainShell />
    </PosProvider>
  );
}
