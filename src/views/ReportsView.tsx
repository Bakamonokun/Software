import React, { useState } from 'react';
import { ArrowLeft, Download, Printer, Search } from 'lucide-react';
import { usePos } from '../context/PosContext';
import { PurchaseDocument, SaleDocument } from '../types/pos';
import {
  buildTodaysCashReport,
  computeCustomerBalance,
  computeSupplierBalance,
  computeSupplierPurchaseHistoryFIFO,
  formatMoney,
  formatNumber,
  round2,
} from '../utils/accounting';

export type ReportType =
  | 'SALE_SUMMARY'
  | 'SALE_HISTORY'
  | 'ITEM_STATEMENT'
  | 'CUSTOMER_LEDGER'
  | 'CUSTOMER_STATEMENT'
  | 'SUPPLIER_LEDGER'
  | 'SUPPLIER_PURCHASE_HISTORY'
  | 'PAYMENT_SEARCH'
  | 'RECEIPT_SEARCH'
  | 'PURCHASE_REPORT'
  | 'GST_SALES_SUMMARY'
  | 'GST_PURCHASE_SUMMARY'
  | 'RCM_REPORT'
  | 'STOCK_REPORT'
  | 'STOCK_OUT_REPORT'
  | 'CREDIT_NOTE_REPORT'
  | 'PURCHASE_RETURN_REPORT'
  | 'TODAYS_CASH_REPORT'
  | 'BANK_STATEMENT'
  | 'JOURNAL_REPORT';

export const REPORT_LABELS: Record<ReportType, string> = {
  SALE_SUMMARY: 'Sale Summary',
  SALE_HISTORY: 'Sale History',
  ITEM_STATEMENT: 'Item Account Statement',
  CUSTOMER_LEDGER: 'Customer Ledger',
  CUSTOMER_STATEMENT: 'Customer Account Statement',
  SUPPLIER_LEDGER: 'Supplier Ledger',
  SUPPLIER_PURCHASE_HISTORY: 'Supplier Purchase History',
  PAYMENT_SEARCH: 'Payment Search',
  RECEIPT_SEARCH: 'Receipt Search',
  PURCHASE_REPORT: 'Purchase Report',
  GST_SALES_SUMMARY: 'GST Sales Summary',
  GST_PURCHASE_SUMMARY: 'GST Purchase Summary',
  RCM_REPORT: 'RCM Report',
  STOCK_REPORT: 'Stock Report',
  STOCK_OUT_REPORT: 'Stock Out Report',
  CREDIT_NOTE_REPORT: 'Credit Note Report',
  PURCHASE_RETURN_REPORT: 'Purchase Return Report',
  TODAYS_CASH_REPORT: "Today's Cash Report",
  BANK_STATEMENT: 'Bank Account Statement',
  JOURNAL_REPORT: 'Journal Voucher Report',
};

interface ReportsViewProps {
  reportType: ReportType;
  setReportType: (r: ReportType) => void;
  onOpenSaleBill: (doc: SaleDocument) => void;
  onOpenPurchaseBill: (doc: PurchaseDocument) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  reportType,
  setReportType,
  onOpenSaleBill,
  onOpenPurchaseBill,
}) => {
  const { state, activeProfile } = usePos();
  const ledger = state.profiles[activeProfile];
  const currency = state.company.currency;

  const [searchFilter, setSearchFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedSupplierIdForHistory, setSelectedSupplierIdForHistory] = useState<string | null>(
    null
  );

  const inDateRange = (dateStr: string) => {
    if (dateFrom && dateStr < dateFrom) return false;
    if (dateTo && dateStr > dateTo) return false;
    return true;
  };

  const exportMonthlyRevenueCsv = () => {
    const monthlyMap = new Map<
      string,
      { salesCount: number; grossSales: number; gstTax: number; expenses: number; netRevenue: number }
    >();

    for (const s of ledger.sales.filter((x) => x.docType === 'SALE')) {
      const monthKey = s.date.slice(0, 7);
      const cur = monthlyMap.get(monthKey) || {
        salesCount: 0,
        grossSales: 0,
        gstTax: 0,
        expenses: 0,
        netRevenue: 0,
      };
      cur.salesCount += 1;
      cur.grossSales = round2(cur.grossSales + s.totalAmount);
      const billTax = s.lines.reduce((acc, l) => acc + l.cgst + l.sgst, 0);
      cur.gstTax = round2(cur.gstTax + billTax);
      cur.netRevenue = round2(cur.grossSales - cur.expenses);
      monthlyMap.set(monthKey, cur);
    }

    for (const v of ledger.vouchers.filter((x) => x.voucherType === 'JOURNAL')) {
      const monthKey = v.date.slice(0, 7);
      const cur = monthlyMap.get(monthKey) || {
        salesCount: 0,
        grossSales: 0,
        gstTax: 0,
        expenses: 0,
        netRevenue: 0,
      };
      cur.expenses = round2(cur.expenses + v.amount);
      cur.netRevenue = round2(cur.grossSales - cur.expenses);
      monthlyMap.set(monthKey, cur);
    }

    const csvLines = [
      'Month,Profile,TotalBills,GrossRevenue,CGST_SGST_Total,Expenses,NetMonthlyRevenue',
      ...Array.from(monthlyMap.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(
          ([month, m]) =>
            `${month},${activeProfile},${m.salesCount},${m.grossSales.toFixed(2)},${m.gstTax.toFixed(
              2
            )},${m.expenses.toFixed(2)},${m.netRevenue.toFixed(2)}`
        ),
    ];

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Monthly_Revenue_${activeProfile}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedSupplier = state.suppliers.find((s) => s.id === selectedSupplierIdForHistory);

  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] bg-white">
      {/* Header Banner */}
      <div className="bg-[#0d6e6e] text-white px-4 py-2 flex flex-wrap items-center justify-between gap-3">
        <div className="font-bold text-sm tracking-wide">
          {REPORT_LABELS[reportType]} — {activeProfile} Profile
        </div>

        <div className="no-print flex flex-wrap items-center gap-2">
          <select
            value={reportType}
            onChange={(e) => {
              setReportType(e.target.value as ReportType);
              setSelectedSupplierIdForHistory(null);
            }}
            className="rounded bg-[#094e4e] text-white border border-teal-600 px-2.5 py-1 text-xs font-semibold focus:outline-none"
          >
            {Object.entries(REPORT_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={exportMonthlyRevenueCsv}
            className="flex items-center gap-1 rounded bg-white text-[#0d6e6e] px-3 py-1 text-xs font-bold hover:bg-slate-100 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Monthly Revenue CSV</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1 rounded bg-white text-[#0d6e6e] px-3 py-1 text-xs font-bold hover:bg-slate-100 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      <div className="p-4 max-w-7xl mx-auto w-full space-y-4 flex-1">
        {/* Filter Bar */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3 p-3 rounded border border-slate-300 bg-slate-50 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search party, bill no, item..."
                className="w-full rounded border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs focus:border-[#0d6e6e] focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-700">From:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded border border-slate-300 bg-white px-2 py-1 font-mono"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-700">To:</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded border border-slate-300 bg-white px-2 py-1 font-mono"
              />
            </div>
          </div>

          <div className="text-[11px] text-slate-600">
            Double-click any invoice or purchase row to open the original saved bill.
          </div>
        </div>

        {/* 1. SUPPLIER PURCHASE HISTORY (v2.4.0 FIFO + Double-click drilldown) */}
        {reportType === 'SUPPLIER_PURCHASE_HISTORY' && (
          <div className="border border-slate-300 rounded bg-white overflow-hidden">
            {!selectedSupplier ? (
              <div>
                <div className="bg-slate-100 px-4 py-2 border-b border-slate-300 text-xs font-bold text-slate-800">
                  Supplier-Wise Summary (Click or Double-Click a Supplier to view complete FIFO Purchase Bill History)
                </div>
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#e2e8f0] border-b border-slate-300 text-left">
                      <th className="py-2 px-3">Supplier Code</th>
                      <th className="py-2 px-3">Supplier Name</th>
                      <th className="py-2 px-3 text-right">Opening Payable</th>
                      <th className="py-2 px-3 text-right">Total Purchased</th>
                      <th className="py-2 px-3 text-right">Total Paid</th>
                      <th className="py-2 px-3 text-right">Net Payable Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    {state.suppliers
                      .filter((s) =>
                        `${s.name} ${s.code}`.toLowerCase().includes(searchFilter.toLowerCase())
                      )
                      .map((sup) => {
                        const bal = computeSupplierBalance(sup, ledger, activeProfile);
                        return (
                          <tr
                            key={sup.id}
                            onClick={() => setSelectedSupplierIdForHistory(sup.id)}
                            onDoubleClick={() => setSelectedSupplierIdForHistory(sup.id)}
                            className="hover:bg-teal-50/70 cursor-pointer"
                          >
                            <td className="py-2 px-3">{sup.code}</td>
                            <td className="py-2 px-3 font-sans font-bold text-[#0d6e6e]">
                              {sup.name}
                            </td>
                            <td className="py-2 px-3 text-right">{formatNumber(bal.opening)}</td>
                            <td className="py-2 px-3 text-right">{formatNumber(bal.purchased)}</td>
                            <td className="py-2 px-3 text-right">
                              {formatNumber(bal.paidOnInvoices + bal.paymentVouchers)}
                            </td>
                            <td className="py-2 px-3 text-right font-bold">
                              {formatMoney(bal.closingBalance, currency)}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div>
                <div className="bg-slate-100 px-4 py-2 border-b border-slate-300 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900">
                    Purchase History for: {selectedSupplier.name} ({selectedSupplier.code}) — FIFO
                    Allocated
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedSupplierIdForHistory(null)}
                    className="flex items-center gap-1 rounded bg-[#0d6e6e] text-white px-3 py-1 font-semibold cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>All Suppliers</span>
                  </button>
                </div>
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#e2e8f0] border-b border-slate-300 text-left">
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Bill No</th>
                      <th className="py-2 px-3">Supplier</th>
                      <th className="py-2 px-3 text-right">Amount</th>
                      <th className="py-2 px-3 text-right">Paid Amount</th>
                      <th className="py-2 px-3 text-right">Remaining Amount</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    {computeSupplierPurchaseHistoryFIFO(selectedSupplier, ledger, activeProfile)
                      .filter((r) => inDateRange(r.date))
                      .map((row) => (
                        <tr
                          key={row.purchase.id}
                          onDoubleClick={() => onOpenPurchaseBill(row.purchase)}
                          onClick={() => onOpenPurchaseBill(row.purchase)}
                          className="hover:bg-teal-50/70 cursor-pointer"
                        >
                          <td className="py-2 px-3">{row.date}</td>
                          <td className="py-2 px-3 font-bold text-[#0d6e6e]">{row.billNo}</td>
                          <td className="py-2 px-3 font-sans">{row.supplierName}</td>
                          <td className="py-2 px-3 text-right">{formatNumber(row.amount)}</td>
                          <td className="py-2 px-3 text-right">{formatNumber(row.paidAmount)}</td>
                          <td className="py-2 px-3 text-right font-semibold">
                            {formatNumber(row.remainingAmount)}
                          </td>
                          <td className="py-2 px-3 font-sans font-bold">
                            <span
                              className={
                                row.status === 'Fully Paid' ? 'text-emerald-700' : 'text-amber-700'
                              }
                            >
                              {row.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-sans">{row.type}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 2. TODAY'S CASH REPORT (v2.4.0 formula: Sale Amount - Expense Amount) */}
        {reportType === 'TODAYS_CASH_REPORT' && (
          <div className="border border-slate-300 rounded bg-white overflow-hidden">
            <div className="bg-slate-100 px-4 py-2 border-b border-slate-300 text-xs font-bold text-slate-800">
              Today&apos;s Cash Report (Date-wise Sale Amount &minus; Journal/Expense Amount,{' '}
              {activeProfile} Profile)
            </div>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#e2e8f0] border-b border-slate-300 text-left">
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3 text-right">Sale Amount</th>
                  <th className="py-2 px-3 text-right">Expense Amount</th>
                  <th className="py-2 px-3 text-right">Today&apos;s Cash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {buildTodaysCashReport(ledger)
                  .filter((r) => inDateRange(r.date))
                  .map((r) => (
                    <tr key={r.date} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-bold">{r.date}</td>
                      <td className="py-2 px-3 text-right text-emerald-700">
                        {formatMoney(r.saleAmount, currency)}
                      </td>
                      <td className="py-2 px-3 text-right text-red-600">
                        {formatMoney(r.expenseAmount, currency)}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">
                        {formatMoney(r.todaysCash, currency)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. PURCHASE REPORT / PURCHASE RETURN / RCM REPORT */}
        {(reportType === 'PURCHASE_REPORT' ||
          reportType === 'PURCHASE_RETURN_REPORT' ||
          reportType === 'RCM_REPORT' ||
          reportType === 'GST_PURCHASE_SUMMARY') && (
          <div className="border border-slate-300 rounded bg-white overflow-hidden">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#e2e8f0] border-b border-slate-300 text-left">
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Invoice No</th>
                  <th className="py-2 px-3">Supplier Bill No</th>
                  <th className="py-2 px-3">Supplier</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3 text-right">Total Amount</th>
                  <th className="py-2 px-3 text-right">Paid</th>
                  <th className="py-2 px-3 text-right">Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {ledger.purchases
                  .filter((p) => {
                    if (reportType === 'PURCHASE_RETURN_REPORT')
                      return p.docType === 'PURCHASE_RETURN';
                    if (reportType === 'RCM_REPORT') return p.reverseCharge;
                    return p.docType === 'PURCHASE';
                  })
                  .filter(
                    (p) =>
                      inDateRange(p.date) &&
                      `${p.invoiceNo} ${p.supplierName} ${p.supplierBillNo}`
                        .toLowerCase()
                        .includes(searchFilter.toLowerCase())
                  )
                  .map((p) => (
                    <tr
                      key={p.id}
                      onDoubleClick={() => onOpenPurchaseBill(p)}
                      onClick={() => onOpenPurchaseBill(p)}
                      className="hover:bg-teal-50/70 cursor-pointer"
                    >
                      <td className="py-2 px-3">{p.date}</td>
                      <td className="py-2 px-3 font-bold text-[#0d6e6e]">{p.invoiceNo}</td>
                      <td className="py-2 px-3">{p.supplierBillNo}</td>
                      <td className="py-2 px-3 font-sans">{p.supplierName}</td>
                      {/* v2.4.0 neutral Purchase Bill wording */}
                      <td className="py-2 px-3 font-sans">
                        {p.docType === 'PURCHASE_RETURN' ? 'Purchase Return' : 'Purchase Bill'}
                      </td>
                      <td className="py-2 px-3 text-right font-bold">
                        {formatNumber(p.totalAmount)}
                      </td>
                      <td className="py-2 px-3 text-right">{formatNumber(p.paidAmount)}</td>
                      <td className="py-2 px-3 text-right">{formatNumber(p.remainingAmount)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. SALE SUMMARY / SALE HISTORY / GST SALES SUMMARY / STOCK OUT / CREDIT NOTE */}
        {(reportType === 'SALE_SUMMARY' ||
          reportType === 'SALE_HISTORY' ||
          reportType === 'GST_SALES_SUMMARY' ||
          reportType === 'STOCK_OUT_REPORT' ||
          reportType === 'CREDIT_NOTE_REPORT') && (
          <div className="border border-slate-300 rounded bg-white overflow-hidden">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#e2e8f0] border-b border-slate-300 text-left">
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Invoice No</th>
                  <th className="py-2 px-3">Customer</th>
                  <th className="py-2 px-3">Mode</th>
                  {activeProfile === 'GST' && (
                    <>
                      <th className="py-2 px-3 text-right">Base Value</th>
                      <th className="py-2 px-3 text-right">CGST</th>
                      <th className="py-2 px-3 text-right">SGST</th>
                    </>
                  )}
                  <th className="py-2 px-3 text-right">Total Amount</th>
                  <th className="py-2 px-3 text-right">Received</th>
                  <th className="py-2 px-3 text-right">Pending</th>
                  <th className="py-2 px-3">QR Integrity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {ledger.sales
                  .filter((s) => {
                    if (reportType === 'STOCK_OUT_REPORT') return s.docType === 'STOCK_OUT';
                    if (reportType === 'CREDIT_NOTE_REPORT') return s.docType === 'CREDIT_NOTE';
                    return s.docType === 'SALE';
                  })
                  .filter(
                    (s) =>
                      inDateRange(s.date) &&
                      `${s.invoiceNo} ${s.customerName}`
                        .toLowerCase()
                        .includes(searchFilter.toLowerCase())
                  )
                  .map((s) => {
                    const baseSum = s.lines.reduce((acc, l) => acc + l.basePrice * l.qty, 0);
                    const cgstSum = s.lines.reduce((acc, l) => acc + l.cgst, 0);
                    const sgstSum = s.lines.reduce((acc, l) => acc + l.sgst, 0);
                    return (
                      <tr
                        key={s.id}
                        onDoubleClick={() => onOpenSaleBill(s)}
                        onClick={() => onOpenSaleBill(s)}
                        className="hover:bg-teal-50/70 cursor-pointer"
                      >
                        <td className="py-2 px-3">{s.date}</td>
                        <td className="py-2 px-3 font-bold text-[#0d6e6e]">{s.invoiceNo}</td>
                        <td className="py-2 px-3 font-sans">{s.customerName}</td>
                        <td className="py-2 px-3 font-sans">{s.paymentMode}</td>
                        {activeProfile === 'GST' && (
                          <>
                            <td className="py-2 px-3 text-right">{formatNumber(baseSum)}</td>
                            <td className="py-2 px-3 text-right">{formatNumber(cgstSum)}</td>
                            <td className="py-2 px-3 text-right">{formatNumber(sgstSum)}</td>
                          </>
                        )}
                        <td className="py-2 px-3 text-right font-bold">
                          {formatNumber(s.totalAmount)}
                        </td>
                        <td className="py-2 px-3 text-right">{formatNumber(s.receivedAmount)}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(s.remainingAmount)}</td>
                        <td className="py-2 px-3 text-[10px] text-slate-500">
                          {s.qrSignatureHash}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. STOCK REPORT / ITEM ACCOUNT STATEMENT */}
        {(reportType === 'STOCK_REPORT' || reportType === 'ITEM_STATEMENT') && (
          <div className="border border-slate-300 rounded bg-white overflow-hidden">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#e2e8f0] border-b border-slate-300 text-left">
                  <th className="py-2 px-3">Code</th>
                  <th className="py-2 px-3">Item Name</th>
                  <th className="py-2 px-3">Category</th>
                  <th className="py-2 px-3">Unit</th>
                  {activeProfile === 'GST' && <th className="py-2 px-3">HSN</th>}
                  <th className="py-2 px-3 text-right">Current Stock</th>
                  <th className="py-2 px-3 text-right">Min Stock Alert</th>
                  <th className="py-2 px-3 text-right">Selling Rate</th>
                  <th className="py-2 px-3 text-right">Stock Valuation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {state.items
                  .filter((i) =>
                    `${i.name} ${i.code} ${i.category}`
                      .toLowerCase()
                      .includes(searchFilter.toLowerCase())
                  )
                  .map((i) => (
                    <tr key={i.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3">{i.code}</td>
                      <td className="py-2 px-3 font-sans font-semibold">{i.name}</td>
                      <td className="py-2 px-3 font-sans">{i.category}</td>
                      <td className="py-2 px-3">{i.unit}</td>
                      {activeProfile === 'GST' && <td className="py-2 px-3">{i.hsnCode || '-'}</td>}
                      <td
                        className={`py-2 px-3 text-right font-bold ${
                          i.stockQty <= i.minStockLevel ? 'text-red-600' : 'text-slate-900'
                        }`}
                      >
                        {formatNumber(i.stockQty)}
                      </td>
                      <td className="py-2 px-3 text-right">{formatNumber(i.minStockLevel)}</td>
                      <td className="py-2 px-3 text-right">{formatNumber(i.sellingPrice)}</td>
                      <td className="py-2 px-3 text-right font-bold">
                        {formatMoney(i.stockQty * i.sellingPrice, currency)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 6. CUSTOMER LEDGER / CUSTOMER ACCOUNT STATEMENT */}
        {(reportType === 'CUSTOMER_LEDGER' || reportType === 'CUSTOMER_STATEMENT') && (
          <div className="border border-slate-300 rounded bg-white overflow-hidden">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#e2e8f0] border-b border-slate-300 text-left">
                  <th className="py-2 px-3">Code</th>
                  <th className="py-2 px-3">Customer Name</th>
                  <th className="py-2 px-3 text-right">Opening</th>
                  <th className="py-2 px-3 text-right">Total Billed</th>
                  <th className="py-2 px-3 text-right">Received on Bills</th>
                  <th className="py-2 px-3 text-right">Receipt Vouchers</th>
                  <th className="py-2 px-3 text-right">Credit Notes</th>
                  <th className="py-2 px-3 text-right">Closing Receivable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {state.customers.map((c) => {
                  const b = computeCustomerBalance(c, ledger, activeProfile);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3">{c.code}</td>
                      <td className="py-2 px-3 font-sans font-semibold">{c.name}</td>
                      <td className="py-2 px-3 text-right">{formatNumber(b.opening)}</td>
                      <td className="py-2 px-3 text-right">{formatNumber(b.billed)}</td>
                      <td className="py-2 px-3 text-right">{formatNumber(b.receivedOnBills)}</td>
                      <td className="py-2 px-3 text-right">{formatNumber(b.receiptVouchers)}</td>
                      <td className="py-2 px-3 text-right">{formatNumber(b.creditNotes)}</td>
                      <td className="py-2 px-3 text-right font-bold">
                        {formatMoney(b.closingBalance, currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 7. SUPPLIER LEDGER */}
        {reportType === 'SUPPLIER_LEDGER' && (
          <div className="border border-slate-300 rounded bg-white overflow-hidden">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#e2e8f0] border-b border-slate-300 text-left">
                  <th className="py-2 px-3">Code</th>
                  <th className="py-2 px-3">Supplier Name</th>
                  <th className="py-2 px-3 text-right">Opening</th>
                  <th className="py-2 px-3 text-right">Purchase Invoices</th>
                  <th className="py-2 px-3 text-right">Paid on Invoices</th>
                  <th className="py-2 px-3 text-right">Payment Vouchers</th>
                  <th className="py-2 px-3 text-right">Closing Payable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {state.suppliers.map((s) => {
                  const b = computeSupplierBalance(s, ledger, activeProfile);
                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3">{s.code}</td>
                      <td className="py-2 px-3 font-sans font-semibold">{s.name}</td>
                      <td className="py-2 px-3 text-right">{formatNumber(b.opening)}</td>
                      <td className="py-2 px-3 text-right">{formatNumber(b.purchased)}</td>
                      <td className="py-2 px-3 text-right">{formatNumber(b.paidOnInvoices)}</td>
                      <td className="py-2 px-3 text-right">{formatNumber(b.paymentVouchers)}</td>
                      <td className="py-2 px-3 text-right font-bold">
                        {formatMoney(b.closingBalance, currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 8. VOUCHER REPORTS: PAYMENT SEARCH, RECEIPT SEARCH, BANK STATEMENT, JOURNAL REPORT */}
        {(reportType === 'PAYMENT_SEARCH' ||
          reportType === 'RECEIPT_SEARCH' ||
          reportType === 'BANK_STATEMENT' ||
          reportType === 'JOURNAL_REPORT') && (
          <div className="border border-slate-300 rounded bg-white overflow-hidden">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#e2e8f0] border-b border-slate-300 text-left">
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Voucher No</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3">Party / Expense Head</th>
                  <th className="py-2 px-3">Payment Mode</th>
                  <th className="py-2 px-3">NEFT / UTR</th>
                  <th className="py-2 px-3">Remarks</th>
                  <th className="py-2 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {ledger.vouchers
                  .filter((v) => {
                    if (reportType === 'PAYMENT_SEARCH') return v.voucherType === 'PAYMENT';
                    if (reportType === 'RECEIPT_SEARCH') return v.voucherType === 'RECEIPT';
                    if (reportType === 'BANK_STATEMENT')
                      return v.voucherType === 'BANK' || v.paymentMode.toLowerCase() !== 'cash';
                    return v.voucherType === 'JOURNAL';
                  })
                  .filter(
                    (v) =>
                      inDateRange(v.date) &&
                      `${v.voucherNo} ${v.partyName} ${v.remarks}`
                        .toLowerCase()
                        .includes(searchFilter.toLowerCase())
                  )
                  .map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3">{v.date}</td>
                      <td className="py-2 px-3 font-bold text-[#0d6e6e]">{v.voucherNo}</td>
                      <td className="py-2 px-3 font-sans">{v.voucherType}</td>
                      <td className="py-2 px-3 font-sans font-medium">{v.partyName}</td>
                      <td className="py-2 px-3 font-sans">{v.paymentMode}</td>
                      <td className="py-2 px-3">{v.neftUtrNo || '-'}</td>
                      <td className="py-2 px-3 font-sans">{v.remarks || '-'}</td>
                      <td className="py-2 px-3 text-right font-bold">{formatNumber(v.amount)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
