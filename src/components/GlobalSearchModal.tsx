import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  FileText,
  Package,
  Receipt,
  Search,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { usePos } from '../context/PosContext';
import { PurchaseDocument, SaleDocument } from '../types/pos';
import {
  computeCustomerBalance,
  computeSupplierBalance,
  formatMoney,
} from '../utils/accounting';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (target: string) => void;
  onOpenSaleBill: (doc: SaleDocument) => void;
  onOpenPurchaseBill: (doc: PurchaseDocument) => void;
}

type SearchCategoryFilter = 'ALL' | 'ITEMS' | 'CUSTOMERS' | 'BILLS';

interface SearchResultEntry {
  id: string;
  kind: 'ITEM' | 'CUSTOMER' | 'SUPPLIER' | 'SALE_BILL' | 'PURCHASE_BILL';
  title: string;
  codeOrNo: string;
  subtitle: string;
  badgeText: string;
  badgeVariant: 'teal' | 'amber' | 'red' | 'slate';
  rightPrimary: string;
  rightSecondary: string;
  onSelect: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenSaleBill,
  onOpenPurchaseBill,
}) => {
  const { state, activeProfile, currentUser, setActiveProfile } = usePos();
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<SearchCategoryFilter>('ALL');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const currency = state.company.currency;
  const activeLedger = state.profiles[activeProfile];

  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 20);
    }
  }, [isOpen]);

  const results = useMemo<SearchResultEntry[]>(() => {
    const q = query.trim().toLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);

    const matchesQuery = (haystack: string) => {
      if (tokens.length === 0) return true;
      const lower = haystack.toLowerCase();
      return tokens.every((t) => lower.includes(t));
    };

    const entries: SearchResultEntry[] = [];

    // 1. ITEMS
    if (categoryFilter === 'ALL' || categoryFilter === 'ITEMS') {
      for (const item of state.items) {
        const hay = `${item.code} ${item.barcode} ${item.name} ${item.category} ${item.hsnCode} ${item.sellingPrice}`;
        if (!matchesQuery(hay)) continue;

        const isLow = item.stockQty <= item.minStockLevel;
        entries.push({
          id: `itm-${item.id}`,
          kind: 'ITEM',
          title: item.name,
          codeOrNo: item.code,
          subtitle: `Category: ${item.category} · Barcode: ${item.barcode || item.code}${
            activeProfile === 'GST' && item.hsnCode ? ` · HSN: ${item.hsnCode}` : ''
          }`,
          badgeText: isLow
            ? item.stockQty <= 0
              ? 'OUT OF STOCK'
              : 'LOW STOCK'
            : 'ITEM',
          badgeVariant: isLow ? (item.stockQty <= 0 ? 'red' : 'amber') : 'teal',
          rightPrimary: formatMoney(item.sellingPrice, currency),
          rightSecondary: `Stock: ${item.stockQty} / Min: ${item.minStockLevel} ${item.unit}`,
          onSelect: () => {
            onNavigate('MASTER:ITEM');
            onClose();
          },
        });
      }
    }

    // 2. CUSTOMERS & SUPPLIERS
    if (categoryFilter === 'ALL' || categoryFilter === 'CUSTOMERS') {
      for (const cust of state.customers) {
        const hay = `${cust.code} ${cust.name} ${cust.mobile} ${cust.email} ${cust.gstin} ${cust.address} ${cust.state}`;
        if (!matchesQuery(hay)) continue;

        const bal = computeCustomerBalance(cust, activeLedger, activeProfile).closingBalance;
        entries.push({
          id: `cst-${cust.id}`,
          kind: 'CUSTOMER',
          title: cust.name,
          codeOrNo: cust.code,
          subtitle: `Mobile: ${cust.mobile || 'N/A'}${
            cust.gstin ? ` · GSTIN: ${cust.gstin}` : ''
          }${cust.address ? ` · ${cust.address}` : ''}`,
          badgeText: 'CUSTOMER',
          badgeVariant: 'teal',
          rightPrimary: `Bal: ${formatMoney(bal, currency)}`,
          rightSecondary: `${activeProfile} Receivable`,
          onSelect: () => {
            onNavigate('MASTER:CUSTOMER');
            onClose();
          },
        });
      }

      for (const sup of state.suppliers) {
        const hay = `${sup.code} ${sup.name} ${sup.mobile} ${sup.email} ${sup.gstin} ${sup.address} ${sup.state}`;
        if (!matchesQuery(hay)) continue;

        const bal = computeSupplierBalance(sup, activeLedger, activeProfile).closingBalance;
        entries.push({
          id: `sup-${sup.id}`,
          kind: 'SUPPLIER',
          title: sup.name,
          codeOrNo: sup.code,
          subtitle: `Supplier · Mobile: ${sup.mobile || 'N/A'}${
            sup.gstin ? ` · GSTIN: ${sup.gstin}` : ''
          }`,
          badgeText: 'SUPPLIER',
          badgeVariant: 'slate',
          rightPrimary: `Payable: ${formatMoney(bal, currency)}`,
          rightSecondary: `${activeProfile} Ledger`,
          onSelect: () => {
            onNavigate('MASTER:SUPPLIER');
            onClose();
          },
        });
      }
    }

    // 3. BILLS (Sales, Stock Outs, Credit Notes, Purchases, Purchase Returns)
    if (categoryFilter === 'ALL' || categoryFilter === 'BILLS') {
      const profilesToSearch: ('GST' | 'NON_GST')[] =
        currentUser?.allowedProfile === 'BOTH'
          ? [activeProfile, activeProfile === 'GST' ? 'NON_GST' : 'GST']
          : [activeProfile];

      for (const prof of profilesToSearch) {
        const ledger = state.profiles[prof];

        for (const sale of ledger.sales) {
          const lineNames = sale.lines.map((l) => `${l.name} ${l.code}`).join(' ');
          const hay = `${sale.invoiceNo} ${sale.manualRefNo} ${sale.customerName} ${sale.customerMobile} ${sale.date} ${sale.qrSignatureHash} ${sale.docType} ${lineNames}`;
          if (!matchesQuery(hay)) continue;

          entries.push({
            id: `sal-${prof}-${sale.id}`,
            kind: 'SALE_BILL',
            title: `${sale.invoiceNo} — ${sale.customerName}`,
            codeOrNo: sale.invoiceNo,
            subtitle: `${prof} ${sale.docType.replace('_', ' ')} · Date: ${sale.date} · ${
              sale.lines.length
            } item(s) · Mode: ${sale.paymentMode}`,
            badgeText: `${prof} ${sale.docType}`,
            badgeVariant: sale.remainingAmount > 0 ? 'amber' : 'teal',
            rightPrimary: formatMoney(sale.totalAmount, currency),
            rightSecondary:
              sale.remainingAmount > 0
                ? `Due: ${formatMoney(sale.remainingAmount, currency)}`
                : 'Paid',
            onSelect: () => {
              if (prof !== activeProfile) {
                setActiveProfile(prof);
              }
              onOpenSaleBill(sale);
              onClose();
            },
          });
        }

        for (const pur of ledger.purchases) {
          const lineNames = pur.lines.map((l) => `${l.name} ${l.code}`).join(' ');
          const hay = `${pur.invoiceNo} ${pur.supplierBillNo} ${pur.supplierName} ${pur.date} ${pur.docType} ${lineNames}`;
          if (!matchesQuery(hay)) continue;

          entries.push({
            id: `pur-${prof}-${pur.id}`,
            kind: 'PURCHASE_BILL',
            title: `${pur.invoiceNo} (Bill: ${pur.supplierBillNo || pur.invoiceNo}) — ${
              pur.supplierName
            }`,
            codeOrNo: pur.invoiceNo,
            subtitle: `${prof} ${pur.docType.replace('_', ' ')} · Date: ${pur.date} · ${
              pur.lines.length
            } item(s) · Mode: ${pur.paymentMode}`,
            badgeText: `${prof} PURCHASE`,
            badgeVariant: pur.remainingAmount > 0 ? 'amber' : 'slate',
            rightPrimary: formatMoney(pur.totalAmount, currency),
            rightSecondary:
              pur.remainingAmount > 0
                ? `Unpaid: ${formatMoney(pur.remainingAmount, currency)}`
                : 'Fully Paid',
            onSelect: () => {
              if (prof !== activeProfile) {
                setActiveProfile(prof);
              }
              onOpenPurchaseBill(pur);
              onClose();
            },
          });
        }
      }
    }

    return entries.slice(0, 60);
  }, [
    query,
    categoryFilter,
    state.items,
    state.customers,
    state.suppliers,
    state.profiles,
    activeProfile,
    activeLedger,
    currentUser,
    currency,
    onNavigate,
    onOpenSaleBill,
    onOpenPurchaseBill,
    onClose,
    setActiveProfile,
  ]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, categoryFilter]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        results.length > 0 ? (prev - 1 + results.length) % results.length : 0
      );
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      results[selectedIndex].onSelect();
    }
  };

  const totalBillsCount =
    state.profiles[activeProfile].sales.length +
    state.profiles[activeProfile].purchases.length;

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-start justify-center bg-slate-900/60 pt-12 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-lg bg-white border border-slate-300 shadow-2xl overflow-hidden text-xs"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Top Search Input Bar */}
        <div className="bg-[#0d6e6e] text-white px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Search className="w-4 h-4" />
            <span>Global Quick Search — Items, Customers, Suppliers &amp; Bills</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 rounded bg-[#094e4e] text-[10px] font-mono border border-teal-500/40">
              Ctrl+K / Esc
            </kbd>
            <button
              type="button"
              onClick={onClose}
              className="text-teal-100 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-3 border-b border-slate-200 bg-slate-50 space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by Item Name/Code/Barcode, Customer Mobile/GSTIN, or Invoice No (TAX00001)..."
              className="w-full rounded border border-slate-300 bg-white pl-9 pr-8 py-2 text-xs font-medium text-slate-900 focus:border-[#0d6e6e] focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {(
                [
                  ['ALL', `All (${state.items.length + state.customers.length + totalBillsCount})`],
                  ['ITEMS', `Items (${state.items.length})`],
                  [
                    'CUSTOMERS',
                    `Customers & Suppliers (${state.customers.length + state.suppliers.length})`,
                  ],
                  ['BILLS', `Bills & Invoices (${totalBillsCount})`],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCategoryFilter(id)}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${
                    categoryFilter === id
                      ? 'bg-[#0d6e6e] text-white'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              {results.length} match(es)
            </span>
          </div>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
          {results.length === 0 ? (
            <div className="p-8 text-center text-slate-500 space-y-2">
              <p className="font-semibold text-slate-700">
                No matching items, customers, or bills found{query ? ` for "${query}"` : ''}.
              </p>
              <p className="text-[11px]">
                Try searching by item code, customer mobile number, invoice number, or switch
                filter tabs above.
              </p>
            </div>
          ) : (
            results.map((entry, idx) => {
              const active = idx === selectedIndex;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={entry.onSelect}
                  className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                    active ? 'bg-teal-50/80' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="mt-0.5 p-1.5 rounded bg-slate-100 text-[#0d6e6e] shrink-0">
                      {entry.kind === 'ITEM' && <Package className="w-3.5 h-3.5" />}
                      {entry.kind === 'CUSTOMER' && <Users className="w-3.5 h-3.5" />}
                      {entry.kind === 'SUPPLIER' && <Truck className="w-3.5 h-3.5" />}
                      {entry.kind === 'SALE_BILL' && <Receipt className="w-3.5 h-3.5" />}
                      {entry.kind === 'PURCHASE_BILL' && <FileText className="w-3.5 h-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 truncate">{entry.title}</span>
                        <span className="font-mono text-[11px] text-slate-500">
                          [{entry.codeOrNo}]
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                            entry.badgeVariant === 'red'
                              ? 'bg-red-600 text-white'
                              : entry.badgeVariant === 'amber'
                              ? 'bg-amber-600 text-white'
                              : entry.badgeVariant === 'slate'
                              ? 'bg-slate-700 text-white'
                              : 'bg-teal-100 text-[#0d6e6e]'
                          }`}
                        >
                          {entry.badgeVariant === 'red' || entry.badgeVariant === 'amber' ? (
                            <AlertTriangle className="w-2.5 h-2.5 inline mr-0.5" />
                          ) : null}
                          {entry.badgeText}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        {entry.subtitle}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex items-center gap-2">
                    <div>
                      <div className="font-bold font-mono text-slate-900">{entry.rightPrimary}</div>
                      <div className="text-[10px] font-mono text-slate-500">
                        {entry.rightSecondary}
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer Hints */}
        <div className="bg-slate-100 border-t border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
          <div className="flex items-center gap-3 font-mono">
            <span>↑↓ Navigate</span>
            <span>↵ Open Record / Bill</span>
            <span>Esc Close</span>
          </div>
          <div>
            Active Profile: <strong className="text-[#0d6e6e]">{activeProfile}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
