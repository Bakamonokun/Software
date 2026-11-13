import React, { useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowUpRight,
  BellRing,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  FolderOpen,
  Laptop,
  Package,
  Printer,
  Receipt,
  Search,
  Server,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { usePos } from '../context/PosContext';
import {
  buildLast7DaysSalesTrend,
  computeCustomerBalance,
  computeSupplierBalance,
  computeTodaysCash,
  formatMoney,
  formatNumber,
  getCategorizedItemSuggestions,
  round2,
} from '../utils/accounting';

interface DashboardViewProps {
  onNavigate: (target: string) => void;
  onOpenGlobalSearch?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenGlobalSearch,
}) => {
  const {
    state,
    activeProfile,
    isOnline,
    pendingSyncCount,
    sendSystemAlert,
    notify,
  } = usePos();
  const ledger = state.profiles[activeProfile];
  const currency = state.company.currency;

  const [quickWordSearch, setQuickWordSearch] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState<
    'ALL_LOW' | 'OUT_OF_STOCK' | 'AT_REORDER' | 'NEAR_THRESHOLD'
  >('ALL_LOW');
  const [lowStockSearch, setLowStockSearch] = useState('');
  const [dismissedLowStockIds, setDismissedLowStockIds] = useState<string[]>([]);
  const [salesChartStyle, setSalesChartStyle] = useState<'AREA' | 'BAR'>('AREA');

  const todayIso = new Date().toISOString().slice(0, 10);
  const { saleAmount, expenseAmount, todaysCash } = computeTodaysCash(ledger, todayIso);
  const dailySalesTrend7d = buildLast7DaysSalesTrend(ledger, todayIso);
  const last7DaysTotalSales = round2(
    dailySalesTrend7d.reduce((sum, d) => sum + d.totalSales, 0)
  );
  const last7DaysBillCount = dailySalesTrend7d.reduce((sum, d) => sum + d.billCount, 0);

  const totalSalesAmount = round2(
    ledger.sales.filter((s) => s.docType === 'SALE').reduce((acc, s) => acc + s.totalAmount, 0)
  );
  const totalPurchasesAmount = round2(
    ledger.purchases
      .filter((p) => p.docType === 'PURCHASE')
      .reduce((acc, p) => acc + p.totalAmount, 0)
  );

  const totalReceivable = round2(
    state.customers.reduce(
      (acc, c) => acc + Math.max(0, computeCustomerBalance(c, ledger, activeProfile).closingBalance),
      0
    )
  );
  const totalPayable = round2(
    state.suppliers.reduce(
      (acc, s) => acc + Math.max(0, computeSupplierBalance(s, ledger, activeProfile).closingBalance),
      0
    )
  );

  // Low-Stock & Reorder Level Inventory Calculations
  const lowStockItems = state.items.filter((i) => i.stockQty <= i.minStockLevel);
  const outOfStockItems = lowStockItems.filter((i) => i.stockQty <= 0);
  const atReorderLevelItems = lowStockItems.filter(
    (i) => i.stockQty > 0 && i.stockQty <= i.minStockLevel
  );
  const nearThresholdItems = state.items.filter(
    (i) =>
      i.minStockLevel > 0 &&
      i.stockQty > i.minStockLevel &&
      i.stockQty <= Math.ceil(i.minStockLevel * 1.25)
  );

  const filteredNotificationItems = state.items
    .filter((item) => !dismissedLowStockIds.includes(item.id))
    .filter((item) => {
      if (lowStockFilter === 'OUT_OF_STOCK') return item.stockQty <= 0;
      if (lowStockFilter === 'AT_REORDER')
        return item.stockQty > 0 && item.stockQty <= item.minStockLevel;
      if (lowStockFilter === 'NEAR_THRESHOLD')
        return (
          item.minStockLevel > 0 &&
          item.stockQty > item.minStockLevel &&
          item.stockQty <= Math.ceil(item.minStockLevel * 1.25)
        );
      // ALL_LOW includes items at/below reorder level
      return item.stockQty <= item.minStockLevel;
    })
    .filter((item) => {
      const q = lowStockSearch.trim().toLowerCase();
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.barcode.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => a.stockQty - b.stockQty);

  const categorizedSearch = getCategorizedItemSuggestions(state.items, quickWordSearch);

  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] bg-white">
      {/* Top Banner */}
      <div className="bg-[#0d6e6e] text-white px-4 py-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-bold text-sm tracking-wide">
            Real-Time POS &amp; Analytics Dashboard ({activeProfile} Profile)
          </span>
          <span className="text-xs text-teal-100 font-mono">
            Session: {state.company.financialYear || 'FY2026-27'}
          </span>
          {onOpenGlobalSearch && (
            <button
              type="button"
              onClick={onOpenGlobalSearch}
              className="flex items-center gap-1.5 rounded bg-[#094e4e] hover:bg-teal-900 border border-teal-400/40 px-2.5 py-1 text-xs font-semibold text-teal-50 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Quick Find Items, Customers, Bills (Ctrl+K)</span>
            </button>
          )}
        </div>
      </div>

      <div className="p-4 max-w-7xl mx-auto w-full space-y-5 flex-1">
        {/* Active System Alerts Banner */}
        {state.alerts.filter((a) => !a.acknowledged).length > 0 && (
          <div className="border border-amber-300 bg-amber-50 rounded p-3 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold">{state.alerts[0].title}:</span>{' '}
                <span>{state.alerts[0].message}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('DEVELOPER')}
              className="rounded bg-amber-700 text-white px-2.5 py-1 font-semibold cursor-pointer shrink-0"
            >
              View Alerts ({state.alerts.filter((a) => !a.acknowledged).length})
            </button>
          </div>
        )}

        {/* Primary KPI Row (including v2.4.0 Today's Cash formula) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="border border-slate-300 rounded p-4 bg-white">
            <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
              <span>Today&apos;s Cash ({activeProfile})</span>
              <button
                type="button"
                onClick={() => onNavigate('REPORT:TODAYS_CASH_REPORT')}
                className="text-[#0d6e6e] hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <span>Report</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {formatMoney(todaysCash, currency)}
            </div>
            <div className="text-[11px] font-mono text-slate-500 mt-1.5">
              Today Sale: {formatMoney(saleAmount, currency)} &minus; Expense:{' '}
              {formatMoney(expenseAmount, currency)}
            </div>
          </div>

          <div className="border border-slate-300 rounded p-4 bg-white">
            <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
              <span>Total Sales ({activeProfile})</span>
              <span className="font-mono text-slate-500">
                {ledger.sales.filter((s) => s.docType === 'SALE').length} Bills
              </span>
            </div>
            <div className="text-2xl font-bold font-mono text-[#0d6e6e] mt-1">
              {formatMoney(totalSalesAmount, currency)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1.5">
              Purchases: {formatMoney(totalPurchasesAmount, currency)} (
              {ledger.purchases.filter((p) => p.docType === 'PURCHASE').length} Bills)
            </div>
          </div>

          <div className="border border-slate-300 rounded p-4 bg-white">
            <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
              <span>Receivables / Payables</span>
              <span className="font-mono text-slate-500">
                {state.customers.length}C / {state.suppliers.length}S
              </span>
            </div>
            <div className="text-lg font-bold font-mono text-slate-900 mt-1">
              Rec: {formatMoney(totalReceivable, currency)}
            </div>
            <div className="text-xs font-mono text-amber-700 mt-1">
              Payable: {formatMoney(totalPayable, currency)}
            </div>
          </div>

          <div
            className={`border rounded p-4 ${
              lowStockItems.length > 0
                ? 'border-amber-400 bg-amber-50/40'
                : 'border-slate-300 bg-white'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
              <span>Inventory Reorder Status</span>
              <span className="font-mono text-slate-500">{state.items.length} Items</span>
            </div>
            <div
              className={`text-lg font-bold font-mono mt-1 ${
                lowStockItems.length > 0 ? 'text-red-700' : 'text-emerald-700'
              }`}
            >
              {lowStockItems.length > 0
                ? `${lowStockItems.length} Reaching Reorder`
                : 'Stock Levels Optimal'}
            </div>
            <div className="text-[11px] text-slate-600 mt-1.5 flex items-center justify-between gap-1.5">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#0d6e6e]" />
                {isOnline
                  ? `Synced (Rev #${state.revision})`
                  : `Offline (${pendingSyncCount} queued)`}
              </span>
              {lowStockItems.length > 0 && (
                <span className="font-mono text-[10px] font-bold text-red-700">
                  {outOfStockItems.length} Out · {atReorderLevelItems.length} Low
                </span>
              )}
            </div>
          </div>
        </div>

        {/* DAILY SALES TREND CHART (LAST 7 DAYS FOR ACTIVE PROFILE VIA RECHARTS) */}
        <div className="border border-slate-300 rounded p-4 bg-white space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-teal-100 text-[#0d6e6e]">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    Daily Sales Trend — Last 7 Days ({activeProfile} Profile)
                  </h3>
                  <span className="px-2 py-0.5 rounded bg-[#0d6e6e] text-white font-mono text-[10px] font-bold">
                    7-DAY TOTAL: {formatMoney(last7DaysTotalSales, currency)} ({last7DaysBillCount}{' '}
                    Bills)
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Visualizes daily gross sales revenue across the last 7 calendar days for the
                  currently active {activeProfile} ledger.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => onNavigate('SETTINGS:PRINTER_SETTINGS')}
                className="flex items-center gap-1 rounded border border-slate-300 bg-slate-50 hover:bg-teal-50 hover:border-[#0d6e6e] px-2.5 py-1 text-[11px] font-semibold text-slate-700 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-[#0d6e6e]" />
                <span>Printer Settings</span>
              </button>
              <div className="flex items-center rounded border border-slate-300 bg-slate-50 p-0.5 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setSalesChartStyle('AREA')}
                  className={`px-2.5 py-1 rounded cursor-pointer ${
                    salesChartStyle === 'AREA'
                      ? 'bg-[#0d6e6e] text-white'
                      : 'text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Area Trend
                </button>
                <button
                  type="button"
                  onClick={() => setSalesChartStyle('BAR')}
                  className={`px-2.5 py-1 rounded cursor-pointer ${
                    salesChartStyle === 'BAR'
                      ? 'bg-[#0d6e6e] text-white'
                      : 'text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Bar Chart
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            <div className="lg:col-span-8 h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {salesChartStyle === 'AREA' ? (
                  <AreaChart
                    data={dailySalesTrend7d}
                    margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="kanhaSalesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0d6e6e" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#0d6e6e" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: '#475569' }}
                      axisLine={{ stroke: '#cbd5e1' }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#475569' }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickFormatter={(val) => `₹${val}`}
                    />
                    <Tooltip
                      formatter={(value: any) => [
                        formatMoney(Number(value) || 0, currency),
                        `${activeProfile} Sales`,
                      ]}
                      labelFormatter={(label) => `Date: ${label}`}
                      contentStyle={{
                        fontSize: '12px',
                        borderRadius: '6px',
                        borderColor: '#cbd5e1',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="totalSales"
                      stroke="#0d6e6e"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#kanhaSalesGradient)"
                    />
                  </AreaChart>
                ) : (
                  <BarChart
                    data={dailySalesTrend7d}
                    margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: '#475569' }}
                      axisLine={{ stroke: '#cbd5e1' }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#475569' }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickFormatter={(val) => `₹${val}`}
                    />
                    <Tooltip
                      formatter={(value: any) => [
                        formatMoney(Number(value) || 0, currency),
                        `${activeProfile} Sales`,
                      ]}
                      labelFormatter={(label) => `Date: ${label}`}
                      contentStyle={{
                        fontSize: '12px',
                        borderRadius: '6px',
                        borderColor: '#cbd5e1',
                      }}
                    />
                    <Bar dataKey="totalSales" fill="#0d6e6e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>

            <div className="lg:col-span-4 border border-slate-200 rounded overflow-hidden text-xs">
              <div className="bg-slate-100 px-3 py-1.5 font-bold text-slate-800 border-b border-slate-200 flex items-center justify-between">
                <span>7-Day Daily Breakdown</span>
                <span className="font-mono text-[10px] text-[#0d6e6e]">{activeProfile}</span>
              </div>
              <div className="divide-y divide-slate-100 font-mono text-[11px]">
                {dailySalesTrend7d.map((day) => (
                  <div
                    key={day.dateIso}
                    className={`px-3 py-1.5 flex items-center justify-between ${
                      day.dateIso === todayIso ? 'bg-teal-50/60 font-bold' : ''
                    }`}
                  >
                    <div>
                      <span className="font-sans text-slate-800">{day.label}</span>
                      {day.dateIso === todayIso && (
                        <span className="ml-1.5 rounded bg-[#0d6e6e] text-white px-1.5 py-0.2 text-[9px] font-sans">
                          TODAY
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-slate-900 font-bold">
                        {formatMoney(day.totalSales, currency)}
                      </span>
                      <span className="text-slate-400 ml-1.5 text-[10px]">
                        ({day.billCount}b)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* LOW-STOCK & REORDER LEVEL NOTIFICATION SYSTEM */}
        <div
          className={`border rounded p-4 space-y-3 text-xs ${
            lowStockItems.length > 0
              ? 'border-amber-400 bg-amber-50/30'
              : 'border-slate-300 bg-white'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2.5">
            <div className="flex items-center gap-2">
              <div
                className={`p-1.5 rounded ${
                  lowStockItems.length > 0
                    ? 'bg-red-100 text-red-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                <BellRing className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    Low-Stock &amp; Reorder Level Notification Center
                  </h3>
                  {lowStockItems.length > 0 ? (
                    <span className="px-2 py-0.5 rounded bg-red-600 text-white font-mono text-[10px] font-bold">
                      {lowStockItems.length} ALERT(S)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-emerald-700 text-white font-mono text-[10px] font-bold">
                      HEALTHY
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600">
                  Automatically highlights Common Item Master inventory reaching or falling below
                  its configured reorder threshold (<code className="font-mono">minStockLevel</code>
                  ).
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded border border-slate-300 bg-white p-0.5 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setLowStockFilter('ALL_LOW')}
                  className={`px-2.5 py-1 rounded cursor-pointer ${
                    lowStockFilter === 'ALL_LOW'
                      ? 'bg-[#0d6e6e] text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  At/Below Reorder ({lowStockItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLowStockFilter('OUT_OF_STOCK')}
                  className={`px-2.5 py-1 rounded cursor-pointer ${
                    lowStockFilter === 'OUT_OF_STOCK'
                      ? 'bg-red-700 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Out of Stock ({outOfStockItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLowStockFilter('AT_REORDER')}
                  className={`px-2.5 py-1 rounded cursor-pointer ${
                    lowStockFilter === 'AT_REORDER'
                      ? 'bg-amber-600 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Reorder Reached ({atReorderLevelItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLowStockFilter('NEAR_THRESHOLD')}
                  className={`px-2.5 py-1 rounded cursor-pointer ${
                    lowStockFilter === 'NEAR_THRESHOLD'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Near Threshold ({nearThresholdItems.length})
                </button>
              </div>

              <div className="relative w-48">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                <input
                  type="text"
                  value={lowStockSearch}
                  onChange={(e) => setLowStockSearch(e.target.value)}
                  placeholder="Filter low-stock items..."
                  className="w-full rounded border border-slate-300 bg-white pl-8 pr-2.5 py-1 text-xs focus:border-[#0d6e6e] focus:outline-none"
                />
              </div>

              {lowStockItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const names = lowStockItems
                      .slice(0, 5)
                      .map((i) => `${i.name} (${i.stockQty}/${i.minStockLevel} ${i.unit})`)
                      .join(', ');
                    sendSystemAlert({
                      severity: outOfStockItems.length > 0 ? 'CRITICAL' : 'WARNING',
                      title: `Low-Stock Reorder Alert (${lowStockItems.length} Items)`,
                      message: `Items at/below reorder level: ${names}`,
                      targetDevice: 'ALL',
                    });
                    notify('Low-stock notification dispatched to all POS terminals.', 'info');
                  }}
                  className="rounded bg-amber-700 hover:bg-amber-800 text-white font-bold px-3 py-1.5 cursor-pointer"
                >
                  Broadcast Reorder Alert
                </button>
              )}
            </div>
          </div>

          {filteredNotificationItems.length === 0 ? (
            <div className="p-4 rounded border border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  {state.items.length === 0
                    ? 'No inventory items configured yet. Add items with a Low Stock Alert level in Item Master.'
                    : dismissedLowStockIds.length > 0
                    ? `All active low-stock notifications in this view are acknowledged (${dismissedLowStockIds.length} hidden).`
                    : 'All inventory items are currently above their configured reorder level.'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {dismissedLowStockIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDismissedLowStockIds([])}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    Restore Dismissed ({dismissedLowStockIds.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onNavigate('MASTER:ITEM')}
                  className="rounded bg-[#0d6e6e] text-white font-bold px-3 py-1 cursor-pointer"
                >
                  Manage Reorder Levels
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-60 border border-slate-200 rounded bg-white">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-left">
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Code</th>
                    <th className="py-2 px-3">Item Name</th>
                    <th className="py-2 px-3">Category</th>
                    <th className="py-2 px-3 text-right">Current Stock</th>
                    <th className="py-2 px-3 text-right">Reorder Level</th>
                    <th className="py-2 px-3 text-right">Suggested Order</th>
                    <th className="py-2 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {filteredNotificationItems.map((item) => {
                    const isOut = item.stockQty <= 0;
                    const isAtReorder = item.stockQty > 0 && item.stockQty <= item.minStockLevel;
                    const suggestedOrder = Math.max(
                      1,
                      round2(Math.max(item.minStockLevel * 2, item.minStockLevel + 5) - item.stockQty)
                    );
                    return (
                      <tr
                        key={item.id}
                        className={
                          isOut
                            ? 'bg-red-50/70 hover:bg-red-100/60'
                            : isAtReorder
                            ? 'bg-amber-50/60 hover:bg-amber-100/50'
                            : 'hover:bg-slate-50'
                        }
                      >
                        <td className="py-1.5 px-3 font-sans">
                          {isOut ? (
                            <span className="inline-flex items-center gap-1 rounded bg-red-600 text-white px-2 py-0.5 text-[10px] font-bold">
                              <AlertOctagon className="w-3 h-3" />
                              OUT OF STOCK
                            </span>
                          ) : isAtReorder ? (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-600 text-white px-2 py-0.5 text-[10px] font-bold">
                              <AlertTriangle className="w-3 h-3" />
                              REORDER NOW
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-slate-700 text-white px-2 py-0.5 text-[10px] font-bold">
                              NEAR THRESHOLD
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 font-bold text-slate-800">{item.code}</td>
                        <td className="py-1.5 px-3 font-sans font-bold text-slate-900">
                          {item.name}
                        </td>
                        <td className="py-1.5 px-3 font-sans text-slate-600">{item.category}</td>
                        <td
                          className={`py-1.5 px-3 text-right font-bold ${
                            isOut ? 'text-red-700' : 'text-amber-800'
                          }`}
                        >
                          {item.stockQty} {item.unit}
                        </td>
                        <td className="py-1.5 px-3 text-right text-slate-700">
                          {item.minStockLevel} {item.unit}
                        </td>
                        <td className="py-1.5 px-3 text-right font-bold text-[#0d6e6e]">
                          +{suggestedOrder} {item.unit}
                        </td>
                        <td className="py-1.5 px-3 text-right font-sans space-x-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onNavigate('PURCHASE:PURCHASE')}
                            className="rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white px-2 py-0.5 text-[11px] font-semibold cursor-pointer"
                          >
                            Restock Bill
                          </button>
                          <button
                            type="button"
                            onClick={() => onNavigate('ERP')}
                            className="rounded border border-[#0d6e6e] text-[#0d6e6e] hover:bg-teal-50 px-2 py-0.5 text-[11px] font-semibold cursor-pointer"
                          >
                            Create PO
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDismissedLowStockIds((prev) => [...prev, item.id])
                            }
                            className="text-slate-500 hover:text-slate-800 text-[11px] px-1 cursor-pointer"
                            title="Dismiss for this session"
                          >
                            Dismiss
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Launch Operational Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('GOODS_OUT:SALE')}
            className="flex flex-col items-start p-3 rounded border border-slate-300 bg-slate-50 hover:bg-teal-50 hover:border-[#0d6e6e] transition-colors text-left cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4 text-[#0d6e6e] mb-1.5" />
            <span className="text-xs font-bold text-slate-900">POS / Bill (Sale)</span>
            <span className="text-[10px] text-slate-500">
              {activeProfile === 'GST' ? 'Base + CGST/SGST' : 'Direct Rate Billing'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('PURCHASE:PURCHASE')}
            className="flex flex-col items-start p-3 rounded border border-slate-300 bg-slate-50 hover:bg-teal-50 hover:border-[#0d6e6e] transition-colors text-left cursor-pointer"
          >
            <Package className="w-4 h-4 text-[#0d6e6e] mb-1.5" />
            <span className="text-xs font-bold text-slate-900">Purchase Invoice</span>
            <span className="text-[10px] text-slate-500">Authoritative Stock In</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('MASTER:ITEM')}
            className="flex flex-col items-start p-3 rounded border border-slate-300 bg-slate-50 hover:bg-teal-50 hover:border-[#0d6e6e] transition-colors text-left cursor-pointer"
          >
            <FolderOpen className="w-4 h-4 text-[#0d6e6e] mb-1.5" />
            <span className="text-xs font-bold text-slate-900">Common Masters</span>
            <span className="text-[10px] text-slate-500">Items, Customers, Suppliers</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('ACCOUNT:JOURNAL')}
            className="flex flex-col items-start p-3 rounded border border-slate-300 bg-slate-50 hover:bg-teal-50 hover:border-[#0d6e6e] transition-colors text-left cursor-pointer"
          >
            <Receipt className="w-4 h-4 text-[#0d6e6e] mb-1.5" />
            <span className="text-xs font-bold text-slate-900">Journal / Expense</span>
            <span className="text-[10px] text-slate-500">Multi-Row Cash/Bank Outflow</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('REPORT:SUPPLIER_PURCHASE_HISTORY')}
            className="flex flex-col items-start p-3 rounded border border-slate-300 bg-slate-50 hover:bg-teal-50 hover:border-[#0d6e6e] transition-colors text-left cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#0d6e6e] mb-1.5" />
            <span className="text-xs font-bold text-slate-900">Supplier History</span>
            <span className="text-[10px] text-slate-500">FIFO Allocation &amp; Bills</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('SETTINGS:PRINTER_SETTINGS')}
            className="flex flex-col items-start p-3 rounded border border-slate-300 bg-slate-50 hover:bg-teal-50 hover:border-[#0d6e6e] transition-colors text-left cursor-pointer"
          >
            <Printer className="w-4 h-4 text-[#0d6e6e] mb-1.5" />
            <span className="text-xs font-bold text-slate-900">Printer Settings</span>
            <span className="text-[10px] text-slate-500">Thermal Roll &amp; Margins</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('DEVELOPER')}
            className="flex flex-col items-start p-3 rounded border border-slate-300 bg-slate-50 hover:bg-teal-50 hover:border-[#0d6e6e] transition-colors text-left cursor-pointer"
          >
            <Server className="w-4 h-4 text-[#0d6e6e] mb-1.5" />
            <span className="text-xs font-bold text-slate-900">Developer / Server</span>
            <span className="text-[10px] text-slate-500">Devices, Shutdown &amp; QR Check</span>
          </button>
        </div>

        {/* Categorized Item Suggestion Explorer & Recent Transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Instant Word/Letter Categorized Item Explorer */}
          <div className="lg:col-span-6 border border-slate-300 rounded p-4 bg-white space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Item Suggestion by Word / Letter (Categorized List)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Type any letter or word to browse matching items grouped by category.
                </p>
              </div>
              <div className="relative w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                <input
                  type="text"
                  value={quickWordSearch}
                  onChange={(e) => setQuickWordSearch(e.target.value)}
                  placeholder="Type letter or word..."
                  className="w-full rounded border border-slate-300 pl-8 pr-2.5 py-1 text-xs focus:border-[#0d6e6e] focus:outline-none"
                />
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2">
              {state.items.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded">
                  No items in Item Master yet.{' '}
                  <button
                    type="button"
                    onClick={() => onNavigate('MASTER:ITEM')}
                    className="text-[#0d6e6e] font-bold underline cursor-pointer"
                  >
                    Add your first item
                  </button>{' '}
                  to see categorized word suggestions.
                </div>
              ) : categorizedSearch.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  No items match &ldquo;{quickWordSearch}&rdquo;.
                </div>
              ) : (
                categorizedSearch.map((group) => (
                  <div
                    key={group.category}
                    className="border border-slate-200 rounded overflow-hidden text-xs"
                  >
                    <div className="bg-slate-100 px-3 py-1 font-bold text-[#0d6e6e] flex justify-between">
                      <span>{group.category}</span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {group.items.length} item(s)
                      </span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {group.items.map((item) => {
                        const reachedReorder = item.stockQty <= item.minStockLevel;
                        return (
                          <div
                            key={item.id}
                            className={`px-3 py-1.5 flex items-center justify-between font-mono ${
                              reachedReorder ? 'bg-amber-50/70' : ''
                            }`}
                          >
                            <div className="font-sans flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-900">{item.name}</span>{' '}
                              <span className="text-[11px] font-mono text-slate-500">
                                [{item.code}]
                              </span>
                              {reachedReorder && (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    item.stockQty <= 0
                                      ? 'bg-red-600 text-white'
                                      : 'bg-amber-600 text-white'
                                  }`}
                                >
                                  {item.stockQty <= 0 ? 'OUT OF STOCK' : 'REORDER'}
                                </span>
                              )}
                            </div>
                            <div>
                              {activeProfile === 'GST' ? (
                                <span className="text-[11px] text-slate-600">
                                  Base ₹{formatNumber(item.basePrice)} + GST &rarr;{' '}
                                  <strong className="text-[#0d6e6e]">
                                    ₹{formatNumber(item.sellingPrice)}
                                  </strong>
                                </span>
                              ) : (
                                <strong className="text-[#0d6e6e]">
                                  ₹{formatNumber(item.sellingPrice)}
                                </strong>
                              )}
                              <span
                                className={`ml-2 text-[10px] ${
                                  reachedReorder
                                    ? 'text-red-700 font-bold'
                                    : 'text-slate-500'
                                }`}
                              >
                                ({item.stockQty}/{item.minStockLevel} {item.unit})
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: Multi-Store Synchronization & Recent Profile Activity */}
          <div className="lg:col-span-6 border border-slate-300 rounded p-4 bg-white space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Multi-Store Synchronization &amp; Recent Bills ({activeProfile})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Real-time inventory &amp; invoice ledger across connected store nodes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('DATABASE')}
                className="flex items-center gap-1 text-xs font-semibold text-[#0d6e6e] hover:underline cursor-pointer"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Cloud Backup</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-left">
                    <th className="py-1.5 px-2.5">Invoice No</th>
                    <th className="py-1.5 px-2.5">Date</th>
                    <th className="py-1.5 px-2.5">Customer</th>
                    <th className="py-1.5 px-2.5 text-right">Amount</th>
                    <th className="py-1.5 px-2.5">QR Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {ledger.sales.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center font-sans text-slate-500">
                        No bills recorded in {activeProfile} profile yet.
                      </td>
                    </tr>
                  ) : (
                    ledger.sales.slice(0, 6).map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="py-1.5 px-2.5 font-bold text-[#0d6e6e]">{s.invoiceNo}</td>
                        <td className="py-1.5 px-2.5">{s.date}</td>
                        <td className="py-1.5 px-2.5 font-sans">{s.customerName}</td>
                        <td className="py-1.5 px-2.5 text-right font-bold">
                          {formatMoney(s.totalAmount, currency)}
                        </td>
                        <td className="py-1.5 px-2.5 text-[10px] text-slate-500">
                          {s.qrSignatureHash}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
