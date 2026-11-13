import React, { useState } from 'react';
import { MessageSquare, Plus, Send, Trash2 } from 'lucide-react';
import { CategorizedItemSelector } from '../components/CategorizedItemSelector';
import { usePos } from '../context/PosContext';
import { CrmFollowUp, ItemMaster, PurchaseOrderDocument } from '../types/pos';
import {
  computeCustomerBalance,
  computeSupplierBalance,
  formatMoney,
  formatNumber,
  round2,
} from '../utils/accounting';

export const ErpWorkspaceView: React.FC = () => {
  const { state, activeProfile, commitTransaction, notify } = usePos();
  const ledger = state.profiles[activeProfile];
  const currency = state.company.currency;

  const [tab, setTab] = useState<'OVERVIEW' | 'WHATSAPP_PO' | 'REORDER' | 'AGEING' | 'CRM'>(
    'OVERVIEW'
  );

  // WhatsApp PO Form State
  const [poSupplierId, setPoSupplierId] = useState('');
  const [poDate, setPoDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [poNotes, setPoNotes] = useState('');
  const [poItemId, setPoItemId] = useState('');
  const [poQty, setPoQty] = useState('10');
  const [poRate, setPoRate] = useState('');
  const [poLines, setPoLines] = useState<PurchaseOrderDocument['lines']>([]);

  // CRM Form State
  const [crmName, setCrmName] = useState('');
  const [crmMobile, setCrmMobile] = useState('');
  const [crmSubject, setCrmSubject] = useState('');
  const [crmDate, setCrmDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [crmNotes, setCrmNotes] = useState('');

  const lowStockItems = state.items.filter((i) => i.stockQty <= i.minStockLevel);
  const stockValuationSelling = round2(
    state.items.reduce((acc, i) => acc + i.stockQty * i.sellingPrice, 0)
  );
  const stockValuationCost = round2(
    state.items.reduce(
      (acc, i) => acc + i.stockQty * (i.purchasePrice > 0 ? i.purchasePrice : i.sellingPrice),
      0
    )
  );

  const totalReceivables = round2(
    state.customers.reduce(
      (acc, c) => acc + Math.max(0, computeCustomerBalance(c, ledger, activeProfile).closingBalance),
      0
    )
  );
  const totalPayables = round2(
    state.suppliers.reduce(
      (acc, s) => acc + Math.max(0, computeSupplierBalance(s, ledger, activeProfile).closingBalance),
      0
    )
  );

  const handleAddPoLine = () => {
    const item = state.items.find((i) => i.id === poItemId);
    if (!item) {
      notify('Select an item for the Purchase Order.', 'error');
      return;
    }
    const qty = Math.max(1, Number(poQty) || 1);
    const rate = Math.max(0, Number(poRate) || item.purchasePrice || item.sellingPrice);
    setPoLines((prev) => [
      ...prev,
      {
        itemId: item.id,
        code: item.code,
        name: item.name,
        unit: item.unit,
        qty,
        rate,
        amount: round2(qty * rate),
      },
    ]);
    setPoItemId('');
    setPoQty('10');
    setPoRate('');
  };

  const handleSavePurchaseOrder = async (sendWhatsApp: boolean) => {
    const supplier = state.suppliers.find((s) => s.id === poSupplierId);
    if (!supplier) {
      notify('Select a supplier from Supplier Master.', 'error');
      return;
    }
    if (poLines.length === 0) {
      notify('Add at least one item to the Purchase Order.', 'error');
      return;
    }

    const poNo = `PO${String(ledger.counters.purchaseOrder).padStart(5, '0')}`;
    const totalAmount = round2(poLines.reduce((acc, l) => acc + l.amount, 0));

    const poDoc: PurchaseOrderDocument = {
      id: `PO-${Date.now()}`,
      profile: activeProfile,
      poNo,
      date: poDate,
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierMobile: supplier.mobile,
      lines: poLines,
      totalAmount,
      status: sendWhatsApp ? 'SENT_WHATSAPP' : 'DRAFT',
      notes: poNotes,
      createdAt: new Date().toISOString(),
    };

    await commitTransaction({ category: 'PO', document: poDoc });
    setPoLines([]);
    setPoNotes('');

    if (sendWhatsApp) {
      const digits = (supplier.mobile || '').replace(/\D/g, '');
      const normalizedPhone = digits.length === 10 ? `91${digits}` : digits;
      const linesText = poDoc.lines
        .map(
          (l, idx) =>
            `${idx + 1}. ${l.name} (${l.qty} ${l.unit} x ₹${l.rate.toFixed(2)}) = ₹${l.amount.toFixed(
              2
            )}`
        )
        .join('\n');
      const message = `*PURCHASE ORDER: ${poDoc.poNo}*\nDate: ${poDoc.date}\nSupplier: ${
        supplier.name
      }\n\n*Items:*\n${linesText}\n\n*Total Order Value: ₹${poDoc.totalAmount.toFixed(2)}*${
        poDoc.notes ? `\nNotes: ${poDoc.notes}` : ''
      }`;
      const waUrl = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
      notify(
        `PO ${poDoc.poNo} saved! WhatsApp order payload prepared for +${
          normalizedPhone || 'Supplier'
        }.`,
        'success'
      );
      const a = document.createElement('a');
      a.href = waUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.click();
    } else {
      notify(`Purchase Order ${poDoc.poNo} saved.`, 'success');
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] bg-white">
      <div className="bg-[#0d6e6e] text-white px-4 py-2 flex flex-wrap items-center justify-between gap-3">
        <div className="font-bold text-sm tracking-wide">
          ERP Workspace &amp; Supply Chain Optimization ({activeProfile} Profile)
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {(
            [
              ['OVERVIEW', 'ERP Command Center'],
              ['WHATSAPP_PO', 'Purchase Orders (WhatsApp)'],
              ['REORDER', 'Inventory Reorder & Valuation'],
              ['AGEING', 'Receivable & Payable Ageing'],
              ['CRM', 'CRM Leads & Follow-Ups'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer ${
                tab === id
                  ? 'bg-white text-[#0d6e6e]'
                  : 'bg-[#094e4e] text-slate-100 hover:bg-teal-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 max-w-7xl mx-auto w-full space-y-5">
        {tab === 'OVERVIEW' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="border border-slate-300 rounded p-4 bg-white">
                <div className="text-xs text-slate-500 font-semibold">
                  Stock Valuation (Selling)
                </div>
                <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                  {formatMoney(stockValuationSelling, currency)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 font-mono">
                  Cost Value: {formatMoney(stockValuationCost, currency)}
                </div>
              </div>

              <div className="border border-slate-300 rounded p-4 bg-white">
                <div className="text-xs text-slate-500 font-semibold">
                  Low-Stock Reorder Alerts
                </div>
                <div className="text-xl font-bold font-mono text-red-600 mt-1">
                  {lowStockItems.length} Item(s)
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Automated email notifications active
                </div>
              </div>

              <div className="border border-slate-300 rounded p-4 bg-white">
                <div className="text-xs text-slate-500 font-semibold">
                  Total Customer Receivables
                </div>
                <div className="text-xl font-bold font-mono text-[#0d6e6e] mt-1">
                  {formatMoney(totalReceivables, currency)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Across {state.customers.length} customer(s)
                </div>
              </div>

              <div className="border border-slate-300 rounded p-4 bg-white">
                <div className="text-xs text-slate-500 font-semibold">
                  Total Supplier Payables
                </div>
                <div className="text-xl font-bold font-mono text-amber-700 mt-1">
                  {formatMoney(totalPayables, currency)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  FIFO allocated across {state.suppliers.length} supplier(s)
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'WHATSAPP_PO' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
            <div className="lg:col-span-6 border border-slate-300 rounded p-4 bg-white space-y-3">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
                Create Purchase Order &amp; WhatsApp Dispatch (v2.5.2)
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Supplier *</label>
                  <select
                    value={poSupplierId}
                    onChange={(e) => setPoSupplierId(e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5"
                  >
                    <option value="">-- Select Supplier --</option>
                    {state.suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.mobile || 'No mobile'})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1">Order Date</label>
                  <input
                    type="date"
                    value={poDate}
                    onChange={(e) => setPoDate(e.target.value)}
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end pt-2 border-t border-slate-100">
                <div className="sm:col-span-6">
                  <label className="block font-bold mb-1">Item</label>
                  <CategorizedItemSelector
                    items={state.items}
                    profile={activeProfile}
                    selectedItemId={poItemId}
                    onSelect={(item: ItemMaster) => {
                      setPoItemId(item.id);
                      setPoRate(String(item.purchasePrice || item.sellingPrice));
                    }}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-bold mb-1">Qty</label>
                  <input
                    type="number"
                    value={poQty}
                    onChange={(e) => setPoQty(e.target.value)}
                    className="w-full rounded border border-slate-300 px-2 py-1.5 font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-bold mb-1">Rate</label>
                  <input
                    type="number"
                    step="0.01"
                    value={poRate}
                    onChange={(e) => setPoRate(e.target.value)}
                    className="w-full rounded border border-slate-300 px-2 py-1.5 font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={handleAddPoLine}
                    className="w-full rounded bg-[#0d6e6e] text-white font-bold py-1.5 px-2 cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 rounded overflow-hidden">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-left">
                      <th className="py-1.5 px-2">Item</th>
                      <th className="py-1.5 px-2 text-right">Qty</th>
                      <th className="py-1.5 px-2 text-right">Rate</th>
                      <th className="py-1.5 px-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {poLines.map((l, idx) => (
                      <tr key={idx}>
                        <td className="py-1.5 px-2 font-sans">{l.name}</td>
                        <td className="py-1.5 px-2 text-right">
                          {l.qty} {l.unit}
                        </td>
                        <td className="py-1.5 px-2 text-right">{formatNumber(l.rate)}</td>
                        <td className="py-1.5 px-2 text-right font-bold">
                          {formatNumber(l.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <label className="block font-bold mb-1">Order Notes</label>
                <input
                  type="text"
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  placeholder="Delivery instructions"
                  className="w-full rounded border border-slate-300 px-2.5 py-1.5"
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleSavePurchaseOrder(false)}
                  className="rounded bg-slate-800 text-white font-bold py-2 px-4 cursor-pointer"
                >
                  Save Purchase Order
                </button>
                <button
                  type="button"
                  onClick={() => handleSavePurchaseOrder(true)}
                  className="flex items-center gap-1.5 rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold py-2 px-4 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Save &amp; Send WhatsApp</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-6 border border-slate-300 rounded p-4 bg-white">
              <h3 className="text-sm font-bold text-slate-900 mb-3">
                Saved Purchase Orders ({ledger.purchaseOrders.length})
              </h3>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-left">
                    <th className="py-2 px-2.5">PO No</th>
                    <th className="py-2 px-2.5">Date</th>
                    <th className="py-2 px-2.5">Supplier</th>
                    <th className="py-2 px-2.5 text-right">Total</th>
                    <th className="py-2 px-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {ledger.purchaseOrders.map((po) => (
                    <tr key={po.id}>
                      <td className="py-1.5 px-2.5 font-bold text-[#0d6e6e]">{po.poNo}</td>
                      <td className="py-1.5 px-2.5">{po.date}</td>
                      <td className="py-1.5 px-2.5 font-sans">{po.supplierName}</td>
                      <td className="py-1.5 px-2.5 text-right font-bold">
                        {formatMoney(po.totalAmount, currency)}
                      </td>
                      <td className="py-1.5 px-2.5 font-sans">{po.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'REORDER' && (
          <div className="border border-slate-300 rounded p-4 bg-white">
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              Automated Reorder Suggestions &amp; Low-Stock Alerts ({lowStockItems.length})
            </h3>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-left">
                  <th className="py-2 px-3">Code</th>
                  <th className="py-2 px-3">Item Name</th>
                  <th className="py-2 px-3">Category</th>
                  <th className="py-2 px-3 text-right">Current Stock</th>
                  <th className="py-2 px-3 text-right">Min Alert Level</th>
                  <th className="py-2 px-3 text-right">Suggested Reorder Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {lowStockItems.map((it) => (
                  <tr key={it.id}>
                    <td className="py-2 px-3">{it.code}</td>
                    <td className="py-2 px-3 font-sans font-bold">{it.name}</td>
                    <td className="py-2 px-3 font-sans">{it.category}</td>
                    <td className="py-2 px-3 text-right text-red-600 font-bold">
                      {it.stockQty} {it.unit}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {it.minStockLevel} {it.unit}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-[#0d6e6e]">
                      {Math.max(10, it.minStockLevel * 2 - it.stockQty)} {it.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'AGEING' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="border border-slate-300 rounded p-4 bg-white">
              <h3 className="text-sm font-bold text-slate-900 mb-3">
                Customer Receivable Ageing ({activeProfile})
              </h3>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-left">
                    <th className="py-2 px-2.5">Customer</th>
                    <th className="py-2 px-2.5">Mobile</th>
                    <th className="py-2 px-2.5 text-right">Receivable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {state.customers.map((c) => {
                    const bal = computeCustomerBalance(c, ledger, activeProfile);
                    return (
                      <tr key={c.id}>
                        <td className="py-1.5 px-2.5 font-sans font-medium">{c.name}</td>
                        <td className="py-1.5 px-2.5">{c.mobile || '-'}</td>
                        <td className="py-1.5 px-2.5 text-right font-bold">
                          {formatMoney(bal.closingBalance, currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="border border-slate-300 rounded p-4 bg-white">
              <h3 className="text-sm font-bold text-slate-900 mb-3">
                Supplier Payable Ageing ({activeProfile})
              </h3>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-left">
                    <th className="py-2 px-2.5">Supplier</th>
                    <th className="py-2 px-2.5">Mobile</th>
                    <th className="py-2 px-2.5 text-right">Payable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {state.suppliers.map((s) => {
                    const bal = computeSupplierBalance(s, ledger, activeProfile);
                    return (
                      <tr key={s.id}>
                        <td className="py-1.5 px-2.5 font-sans font-medium">{s.name}</td>
                        <td className="py-1.5 px-2.5">{s.mobile || '-'}</td>
                        <td className="py-1.5 px-2.5 text-right font-bold">
                          {formatMoney(bal.closingBalance, currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'CRM' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 text-xs">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!crmName.trim()) return;
                const doc: CrmFollowUp = {
                  id: `CRM-${Date.now()}`,
                  profile: activeProfile,
                  partyName: crmName.trim(),
                  mobile: crmMobile.trim(),
                  email: '',
                  subject: crmSubject.trim(),
                  nextFollowUpDate: crmDate,
                  status: 'OPEN',
                  notes: crmNotes.trim(),
                  createdAt: new Date().toISOString(),
                };
                commitTransaction({ category: 'CRM', document: doc });
                setCrmName('');
                setCrmMobile('');
                setCrmSubject('');
                setCrmNotes('');
                notify('CRM Lead & Follow-Up logged.', 'success');
              }}
              className="md:col-span-5 border border-slate-300 rounded p-4 bg-white space-y-3 h-fit"
            >
              <h3 className="text-sm font-bold text-slate-900">CRM Lead &amp; Follow-Up Capture</h3>
              <div>
                <label className="block font-bold mb-1">Lead / Customer Name *</label>
                <input
                  type="text"
                  required
                  value={crmName}
                  onChange={(e) => setCrmName(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2.5 py-1.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Mobile</label>
                  <input
                    type="text"
                    value={crmMobile}
                    onChange={(e) => setCrmMobile(e.target.value)}
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Follow-Up Date</label>
                  <input
                    type="date"
                    value={crmDate}
                    onChange={(e) => setCrmDate(e.target.value)}
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">Requirement / Subject</label>
                <input
                  type="text"
                  value={crmSubject}
                  onChange={(e) => setCrmSubject(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2.5 py-1.5"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded bg-[#0d6e6e] text-white font-bold py-2 cursor-pointer"
              >
                Save Follow-Up
              </button>
            </form>

            <div className="md:col-span-7 border border-slate-300 rounded p-4 bg-white">
              <h3 className="text-sm font-bold text-slate-900 mb-3">
                CRM Pipeline ({ledger.crmFollowUps.length})
              </h3>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-left">
                    <th className="py-2 px-2.5">Party</th>
                    <th className="py-2 px-2.5">Mobile</th>
                    <th className="py-2 px-2.5">Requirement</th>
                    <th className="py-2 px-2.5">Follow-Up</th>
                    <th className="py-2 px-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {ledger.crmFollowUps.map((c) => (
                    <tr key={c.id}>
                      <td className="py-1.5 px-2.5 font-semibold">{c.partyName}</td>
                      <td className="py-1.5 px-2.5 font-mono">{c.mobile}</td>
                      <td className="py-1.5 px-2.5">{c.subject}</td>
                      <td className="py-1.5 px-2.5 font-mono">{c.nextFollowUpDate}</td>
                      <td className="py-1.5 px-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => commitTransaction({ category: 'CRM', deleteId: c.id })}
                          className="text-red-600 hover:text-red-800 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
