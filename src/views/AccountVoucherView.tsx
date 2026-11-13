import React, { useEffect, useState } from 'react';
import { usePos } from '../context/PosContext';
import { JournalExpenseRow, VoucherDocument } from '../types/pos';
import {
  computeCustomerBalance,
  computeRunningCashBalance,
  computeSupplierBalance,
  formatNumber,
  round2,
} from '../utils/accounting';

interface AccountVoucherViewProps {
  voucherType: 'RECEIPT' | 'PAYMENT' | 'JOURNAL' | 'BANK';
  onExit: () => void;
}

const EXPENSE_HEAD_OPTIONS = [
  'Shop Rent & Lease',
  'Electricity & Utility Bill',
  'Staff Salary & Wages',
  'Tea / Refreshment & Office Expense',
  'Transport & Freight Outward',
  'Stationery & Printing',
  'Repair & Maintenance',
  'Miscellaneous Expense',
];

export const AccountVoucherView: React.FC<AccountVoucherViewProps> = ({
  voucherType,
  onExit,
}) => {
  const { state, activeProfile, currentUser, commitTransaction, notify } = usePos();
  const ledger = state.profiles[activeProfile];

  const getNextVoucherNo = () => {
    if (voucherType === 'RECEIPT') return `RCP${String(ledger.counters.receipt).padStart(5, '0')}`;
    if (voucherType === 'PAYMENT') return `PMT${String(ledger.counters.payment).padStart(5, '0')}`;
    if (voucherType === 'JOURNAL') return `JRN${String(ledger.counters.journal).padStart(5, '0')}`;
    return `BV${String(ledger.counters.bankVoucher).padStart(5, '0')}`;
  };

  const [voucherNo, setVoucherNo] = useState(getNextVoucherNo());
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [partyId, setPartyId] = useState('');
  const [partyName, setPartyName] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [neftUtrNo, setNeftUtrNo] = useState('');
  const [remarks, setRemarks] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [partyBalanceDisplay, setPartyBalanceDisplay] = useState('');

  // Multi-row state for Journal Voucher / Expense Entry
  const [expenseRows, setExpenseRows] = useState<JournalExpenseRow[]>([
    { id: 'row-1', expenseHead: '', description: '', amount: 0 },
  ]);

  useEffect(() => {
    setVoucherNo(getNextVoucherNo());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    voucherType,
    activeProfile,
    ledger.counters.receipt,
    ledger.counters.payment,
    ledger.counters.journal,
    ledger.counters.bankVoucher,
  ]);

  const currentCashBalance = computeRunningCashBalance(ledger);
  const totalJournalExpense = round2(
    expenseRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
  );
  const afterPostBalance = round2(currentCashBalance - totalJournalExpense);

  const handlePartySelect = (id: string) => {
    setPartyId(id);
    if (voucherType === 'RECEIPT') {
      const cust = state.customers.find((c) => c.id === id);
      if (cust) {
        setPartyName(cust.name);
        const bal = computeCustomerBalance(cust, ledger, activeProfile);
        setPartyBalanceDisplay(formatNumber(bal.closingBalance));
      } else {
        setPartyName('');
        setPartyBalanceDisplay('');
      }
    } else if (voucherType === 'PAYMENT') {
      const sup = state.suppliers.find((s) => s.id === id);
      if (sup) {
        setPartyName(sup.name);
        const bal = computeSupplierBalance(sup, ledger, activeProfile);
        setPartyBalanceDisplay(formatNumber(bal.closingBalance));
      } else {
        setPartyName('');
        setPartyBalanceDisplay('');
      }
    }
  };

  const handleClear = () => {
    setVoucherNo(getNextVoucherNo());
    setPartyId('');
    setPartyName('');
    setPartyBalanceDisplay('');
    setNeftUtrNo('');
    setRemarks('');
    setAmountInput('');
    setExpenseRows([{ id: `row-${Date.now()}`, expenseHead: '', description: '', amount: 0 }]);
  };

  const handleSave = async () => {
    const finalAmount =
      voucherType === 'JOURNAL' ? totalJournalExpense : round2(Number(amountInput) || 0);

    if (finalAmount <= 0) {
      notify('Enter a valid voucher amount greater than 0.', 'error');
      return;
    }

    if ((voucherType === 'RECEIPT' || voucherType === 'PAYMENT') && !partyName.trim()) {
      notify(
        `Select a ${voucherType === 'RECEIPT' ? 'customer' : 'supplier'} for this voucher.`,
        'error'
      );
      return;
    }

    const doc: VoucherDocument = {
      id: `VCH-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      profile: activeProfile,
      voucherType,
      voucherNo,
      date,
      partyId,
      partyName:
        voucherType === 'JOURNAL'
          ? expenseRows
              .map((r) => r.expenseHead)
              .filter(Boolean)
              .join(', ') || 'General Expense'
          : partyName.trim(),
      paymentMode,
      neftUtrNo,
      remarks,
      amount: finalAmount,
      expenseRows:
        voucherType === 'JOURNAL'
          ? expenseRows.filter((r) => r.expenseHead.trim() || r.amount > 0)
          : [],
      createdBy: currentUser?.username || 'Operator',
      createdAt: new Date().toISOString(),
    };

    await commitTransaction({ category: 'VOUCHER', document: doc });
    notify(`${voucherNo} posted to ${activeProfile} ledger.`, 'success');
    handleClear();
  };

  const handleExportCsv = () => {
    const rows =
      voucherType === 'JOURNAL'
        ? expenseRows.map((r) => `${voucherNo},${date},"${r.expenseHead}","${r.description}",${r.amount}`)
        : [`${voucherNo},${date},"${partyName}","${remarks}",${amountInput || 0}`];
    const csv = ['VoucherNo,Date,Head_Party,Description,Amount', ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${voucherNo}_${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (voucherType === 'JOURNAL') {
    return (
      <div className="flex flex-col min-h-[calc(100vh-84px)] bg-white">
        <div className="bg-[#0d6e6e] text-white text-center py-2 font-bold text-base tracking-wide">
          Journal Voucher / Expense Entry
        </div>

        <div className="p-6 max-w-6xl mx-auto w-full space-y-5 flex-1 flex flex-col">
          {/* Top Metadata Row matching screenshot media_1793891502718 */}
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <label className="font-bold text-slate-800">Voucher No</label>
              <input
                type="text"
                value={voucherNo}
                onChange={(e) => setVoucherNo(e.target.value)}
                className="w-32 rounded border border-slate-300 px-2.5 py-1.5 font-mono focus:border-[#0d6e6e] focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="font-bold text-slate-800">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-36 rounded border border-slate-300 px-2.5 py-1.5 font-mono focus:border-[#0d6e6e] focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="font-bold text-slate-800">Payment Source</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="w-44 rounded border border-slate-300 bg-slate-100 px-2.5 py-1.5 focus:border-[#0d6e6e] focus:outline-none"
              >
                <option value="Cash">Cash</option>
                {state.banks.map((b) => (
                  <option key={b.id} value={b.bankName}>
                    {b.bankName} ({b.accountNo.slice(-4)})
                  </option>
                ))}
                <option value="Bank">Bank Account</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="font-bold text-slate-800">NEFT/UTR No</label>
              <input
                type="text"
                value={neftUtrNo}
                onChange={(e) => setNeftUtrNo(e.target.value)}
                placeholder="Enter NEFT/UTR No"
                className="w-44 rounded border border-slate-300 px-2.5 py-1.5 focus:border-[#0d6e6e] focus:outline-none"
              />
            </div>
          </div>

          {/* Remarks & Live Cash Balance Row */}
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3 flex-1 min-w-[280px]">
              <label className="font-bold text-slate-800">Remarks</label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter Remarks"
                className="flex-1 rounded border border-slate-300 px-2.5 py-1.5 focus:border-[#0d6e6e] focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-5 font-mono font-bold text-slate-900">
              <span>Current Balance: {formatNumber(currentCashBalance)}</span>
              <span>After Post: {formatNumber(afterPostBalance)}</span>
            </div>
          </div>

          <p className="text-xs font-bold text-slate-800">
            Add multiple expense rows. Press Enter on Amount to add next row. Total and Cash/Bank
            balance updates automatically.
          </p>

          {/* Multi-Row Expense Grid */}
          <div className="flex-1 border border-slate-300 rounded bg-slate-100/70 overflow-x-auto min-h-[260px]">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#e2e8f0] text-slate-800 border-b border-slate-300 text-left">
                  <th className="py-2 px-3 border-r border-slate-300 w-1/3 font-semibold">
                    Expense Account / Head
                  </th>
                  <th className="py-2 px-3 border-r border-slate-300 w-1/2 font-semibold">
                    Description
                  </th>
                  <th className="py-2 px-3 w-1/6 font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {expenseRows.map((row, idx) => (
                  <tr key={row.id}>
                    <td className="p-1.5 border-r border-slate-200">
                      <input
                        list="expense-heads-list"
                        type="text"
                        value={row.expenseHead}
                        onChange={(e) => {
                          const val = e.target.value;
                          setExpenseRows((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, expenseHead: val } : r))
                          );
                        }}
                        placeholder="Select or type Expense Head"
                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:border-[#0d6e6e] focus:outline-none"
                      />
                    </td>
                    <td className="p-1.5 border-r border-slate-200">
                      <input
                        type="text"
                        value={row.description}
                        onChange={(e) => {
                          const val = e.target.value;
                          setExpenseRows((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, description: val } : r))
                          );
                        }}
                        placeholder="Enter expense description"
                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:border-[#0d6e6e] focus:outline-none"
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        type="number"
                        step="0.01"
                        value={row.amount || ''}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setExpenseRows((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, amount: val } : r))
                          );
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            setExpenseRows((prev) => [
                              ...prev,
                              {
                                id: `row-${Date.now()}-${prev.length}`,
                                expenseHead: '',
                                description: '',
                                amount: 0,
                              },
                            ]);
                          }
                        }}
                        placeholder="0.00"
                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-mono text-right focus:border-[#0d6e6e] focus:outline-none"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <datalist id="expense-heads-list">
              {EXPENSE_HEAD_OPTIONS.map((h) => (
                <option key={h} value={h} />
              ))}
            </datalist>
          </div>

          {/* Bottom Bar matching screenshot */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <div className="text-base font-bold font-mono text-slate-900">
              Total Expense: {formatNumber(totalJournalExpense)}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleSave}
                className="rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold text-xs py-2.5 px-5 cursor-pointer"
              >
                Save / Post
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold text-xs py-2.5 px-5 cursor-pointer"
              >
                Print Voucher
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold text-xs py-2.5 px-5 cursor-pointer"
              >
                Export PDF
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                className="rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold text-xs py-2.5 px-5 cursor-pointer"
              >
                Export Excel
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold text-xs py-2.5 px-5 cursor-pointer"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={onExit}
                className="rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold text-xs py-2.5 px-5 cursor-pointer"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Bank Voucher, Receipt Voucher, and Payment Voucher layout matching screenshot media_1793891504368
  const titleMap = {
    BANK: 'Bank Voucher',
    RECEIPT: 'Customer Receipt Voucher',
    PAYMENT: 'Supplier Payment Voucher',
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] bg-white">
      <div className="bg-[#0d6e6e] text-white text-center py-2 font-bold text-base tracking-wide">
        {titleMap[voucherType]} ({activeProfile} Profile)
      </div>

      <div className="p-8 max-w-3xl mx-auto w-full space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-8">
            <label className="block text-xs font-bold text-slate-800 mb-1">Voucher No</label>
            <input
              type="text"
              value={voucherNo}
              onChange={(e) => setVoucherNo(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-xs font-mono focus:border-[#0d6e6e] focus:outline-none"
            />
          </div>
          <div className="md:col-span-4">
            <label className="block text-xs font-bold text-slate-800 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-xs font-mono focus:border-[#0d6e6e] focus:outline-none"
            />
          </div>
        </div>

        <div className="md:w-2/3">
          <label className="block text-xs font-bold text-slate-800 mb-1">
            {voucherType === 'RECEIPT'
              ? 'Customer Name'
              : voucherType === 'PAYMENT'
              ? 'Supplier Name'
              : 'Party Name'}
          </label>
          {voucherType === 'RECEIPT' ? (
            <select
              value={partyId}
              onChange={(e) => handlePartySelect(e.target.value)}
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-xs focus:border-[#0d6e6e] focus:outline-none"
            >
              <option value="">-- Select Customer --</option>
              {state.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          ) : voucherType === 'PAYMENT' ? (
            <select
              value={partyId}
              onChange={(e) => handlePartySelect(e.target.value)}
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-xs focus:border-[#0d6e6e] focus:outline-none"
            >
              <option value="">-- Select Supplier --</option>
              {state.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              placeholder="Enter Party Name"
              className="w-full rounded border border-slate-300 px-3 py-2 text-xs focus:border-[#0d6e6e] focus:outline-none"
            />
          )}
        </div>

        <div className="md:w-2/3">
          <label className="block text-xs font-bold text-slate-800 mb-1">Balance</label>
          <input
            type="text"
            value={partyBalanceDisplay}
            onChange={(e) => setPartyBalanceDisplay(e.target.value)}
            placeholder="Enter Balance"
            className="w-full rounded border border-slate-300 px-3 py-2 text-xs font-mono focus:border-[#0d6e6e] focus:outline-none"
          />
        </div>

        <div className="md:w-2/3">
          <label className="block text-xs font-bold text-slate-800 mb-1">Remarks</label>
          <input
            type="text"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Enter Remarks"
            className="w-full rounded border border-slate-300 px-3 py-2 text-xs focus:border-[#0d6e6e] focus:outline-none"
          />
        </div>

        <div className="md:w-2/3">
          <label className="block text-xs font-bold text-slate-800 mb-1">Payment Mode</label>
          <select
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value)}
            className="w-full rounded border border-slate-300 bg-slate-100 px-3 py-2 text-xs focus:border-[#0d6e6e] focus:outline-none"
          >
            <option value="Cash">Cash</option>
            <option value="Bank">Bank Transfer / NEFT</option>
            <option value="UPI">UPI</option>
            <option value="Cheque">Cheque</option>
          </select>
        </div>

        <div className="md:w-2/3">
          <label className="block text-xs font-bold text-slate-800 mb-1">NEFT/UTR No</label>
          <input
            type="text"
            value={neftUtrNo}
            onChange={(e) => setNeftUtrNo(e.target.value)}
            placeholder="Enter NEFT/UTR No"
            className="w-full rounded border border-slate-300 px-3 py-2 text-xs font-mono focus:border-[#0d6e6e] focus:outline-none"
          />
        </div>

        <div className="md:w-2/3">
          <label className="block text-xs font-bold text-slate-800 mb-1">Amount</label>
          <input
            type="number"
            step="0.01"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            placeholder="Enter Amount"
            className="w-full rounded border border-slate-300 px-3 py-2 text-xs font-mono focus:border-[#0d6e6e] focus:outline-none"
          />
        </div>

        <div className="pt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            className="rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold text-xs py-2.5 px-7 cursor-pointer"
          >
            Save
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold text-xs py-2.5 px-7 cursor-pointer"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onExit}
            className="rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold text-xs py-2.5 px-7 cursor-pointer"
          >
            Exit
          </button>
        </div>
      </div>
    </div>
  );
};
