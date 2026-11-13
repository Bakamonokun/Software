import React, { useCallback, useEffect, useState } from 'react';
import { QrCode } from 'lucide-react';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';
import { CategorizedItemSelector } from '../components/CategorizedItemSelector';
import { ReceiptPrintModal } from '../components/ReceiptPrintModal';
import { usePos } from '../context/PosContext';
import { BillLineItem, ItemMaster, PurchaseDocument } from '../types/pos';
import {
  calculateBillLine,
  computeSupplierBalance,
  formatNumber,
  round2,
} from '../utils/accounting';

interface PurchaseViewProps {
  docType: 'PURCHASE' | 'PURCHASE_RETURN';
  initialDocument?: PurchaseDocument | null;
  onExit: () => void;
}

export const PurchaseView: React.FC<PurchaseViewProps> = ({
  docType,
  initialDocument,
  onExit,
}) => {
  const { state, activeProfile, currentUser, commitTransaction, notify } = usePos();
  const ledger = state.profiles[activeProfile];

  const purchaseCounter = ledger.counters.purchase;
  const purchaseReturnCounter = ledger.counters.purchaseReturn;

  const getNextInvoiceNo = useCallback(() => {
    if (docType === 'PURCHASE_RETURN') {
      return `PRI${String(purchaseReturnCounter).padStart(5, '0')}`;
    }
    return `PIN${String(purchaseCounter).padStart(5, '0')}`;
  }, [docType, purchaseReturnCounter, purchaseCounter]);

  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [unit, setUnit] = useState('PCS');
  const [basePriceInput, setBasePriceInput] = useState('');
  const [stockQtyDisplay, setStockQtyDisplay] = useState('');
  const [qtyInput, setQtyInput] = useState('1');
  const [rateInput, setRateInput] = useState('');
  const [gstPercentInput, setGstPercentInput] = useState('18');
  const [hsnInput, setHsnInput] = useState('');
  const [disc1Input, setDisc1Input] = useState('');
  const [disc2Input, setDisc2Input] = useState('');

  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [supplierBillNo, setSupplierBillNo] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [invoiceNo, setInvoiceNo] = useState(getNextInvoiceNo());
  const [supplierId, setSupplierId] = useState('');
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'UPI' | 'Card' | 'Bank' | 'Credit'>('Cash');
  const [transportRef, setTransportRef] = useState('');
  const [remarks, setRemarks] = useState('');
  const [paidInput, setPaidInput] = useState('');
  const [billDiscountInput, setBillDiscountInput] = useState('');
  const [additionalChargeInput, setAdditionalChargeInput] = useState('');
  const [prevBalanceInput, setPrevBalanceInput] = useState('');
  const [adjustedCreditInput, setAdjustedCreditInput] = useState('');
  const [reverseCharge, setReverseCharge] = useState(false);
  const [adjustCreditedAmount, setAdjustCreditedAmount] = useState(false);

  const [lines, setLines] = useState<BillLineItem[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [printFormat, setPrintFormat] = useState<'A4' | 'A5' | 'THERMAL'>('A4');
  const [printModalOpen, setPrintModalOpen] = useState(false);

  useEffect(() => {
    if (!editingDocId && lines.length === 0) {
      setInvoiceNo(getNextInvoiceNo());
    }
  }, [activeProfile, docType, editingDocId, lines.length, getNextInvoiceNo]);

  useEffect(() => {
    if (initialDocument) {
      setEditingDocId(initialDocument.id);
      setSupplierBillNo(initialDocument.supplierBillNo || '');
      setDate(initialDocument.date);
      setInvoiceNo(initialDocument.invoiceNo);
      setSupplierId(initialDocument.supplierId);
      setPaymentMode(initialDocument.paymentMode);
      setTransportRef(initialDocument.transportRef || '');
      setRemarks(initialDocument.remarks || '');
      setLines(initialDocument.lines);
      setPaidInput(String(initialDocument.paidAmount));
      setBillDiscountInput(String(initialDocument.billDiscount || ''));
      setAdditionalChargeInput(String(initialDocument.additionalCharge || ''));
      setPrevBalanceInput(String(initialDocument.previousBalance || ''));
      setAdjustedCreditInput(String(initialDocument.adjustedCreditAmount || ''));
      setReverseCharge(Boolean(initialDocument.reverseCharge));
      setAdjustCreditedAmount(Boolean(initialDocument.adjustCreditedAmount));
    }
  }, [initialDocument]);

  const populateFromItem = useCallback(
    (item: ItemMaster) => {
      setSelectedItemId(item.id);
      setBarcodeInput(item.barcode || item.code);
      setUnit(item.unit || 'PCS');
      setStockQtyDisplay(String(item.stockQty));
      const rateVal = item.purchasePrice > 0 ? item.purchasePrice : item.sellingPrice;
      setRateInput(String(rateVal));
      if (activeProfile === 'GST') {
        const gstPct = item.gstPercent ?? 18;
        setBasePriceInput(
          String(
            item.basePrice > 0 && item.basePrice <= rateVal
              ? item.basePrice
              : round2(rateVal - (rateVal * gstPct) / 100)
          )
        );
        setGstPercentInput(String(gstPct));
        setHsnInput(item.hsnCode || '');
      } else {
        setBasePriceInput('');
        setGstPercentInput('0');
        setHsnInput('');
      }
    },
    [activeProfile]
  );

  const handleBarcodeMatch = useCallback(
    (codeOrBarcode: string) => {
      const clean = codeOrBarcode.trim().toLowerCase();
      if (!clean) return;
      const matched = state.items.find(
        (i) =>
          (i.barcode && i.barcode.toLowerCase() === clean) ||
          (i.code && i.code.toLowerCase() === clean) ||
          i.name.toLowerCase() === clean
      );
      if (matched) populateFromItem(matched);
      else notify(`No item found matching "${codeOrBarcode}".`, 'error');
    },
    [state.items, populateFromItem, notify]
  );

  const handleAddLineItem = () => {
    const matchedItem = state.items.find((i) => i.id === selectedItemId);
    const rate = Number(rateInput);
    const qty = Number(qtyInput);

    if (!matchedItem && !barcodeInput.trim()) {
      notify('Select an item or enter a barcode.', 'error');
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      notify('Enter a valid quantity.', 'error');
      return;
    }

    const line = calculateBillLine({
      profile: activeProfile === 'GST' && docType === 'PURCHASE' ? 'GST' : 'NON_GST',
      itemId: matchedItem?.id || '',
      code: matchedItem?.code || barcodeInput.trim() || 'ITEM',
      barcode: matchedItem?.barcode || barcodeInput.trim(),
      name: matchedItem?.name || barcodeInput.trim(),
      hsn: activeProfile === 'GST' ? hsnInput || matchedItem?.hsnCode || '' : '',
      unit: unit || matchedItem?.unit || 'PCS',
      qty,
      basePriceInput: activeProfile === 'GST' ? Number(basePriceInput) : 0,
      rateInput: rate || 0,
      disc1Percent: Number(disc1Input) || 0,
      disc2Percent: Number(disc2Input) || 0,
      gstPercentInput: activeProfile === 'GST' ? Number(gstPercentInput) : 0,
    });

    setLines((prev) => [...prev, line]);
    setSelectedItemId('');
    setBarcodeInput('');
    setStockQtyDisplay('');
    setQtyInput('1');
    setRateInput('');
    setBasePriceInput('');
    setDisc1Input('');
    setDisc2Input('');
  };

  const selectedSupplier = state.suppliers.find((s) => s.id === supplierId);
  const supplierLedgerBalance = selectedSupplier
    ? computeSupplierBalance(selectedSupplier, ledger, activeProfile).closingBalance
    : 0;

  const itemsValue = round2(lines.reduce((s, l) => s + l.amount, 0));
  const totalQty = round2(lines.reduce((s, l) => s + l.qty, 0));
  const billDiscount = round2(Math.max(0, Number(billDiscountInput) || 0));
  const additionalCharge = round2(Math.max(0, Number(additionalChargeInput) || 0));
  const billAmount = round2(Math.max(0, itemsValue - billDiscount + additionalCharge));
  const previousBalance = round2(Math.max(0, Number(prevBalanceInput) || 0));
  const adjustedCreditAmount = adjustCreditedAmount
    ? round2(Math.max(0, Number(adjustedCreditInput) || 0))
    : 0;
  const totalAmount = round2(Math.max(0, billAmount + previousBalance - adjustedCreditAmount));
  const paidAmount =
    paidInput.trim() === ''
      ? paymentMode === 'Credit'
        ? 0
        : totalAmount
      : round2(Math.max(0, Number(paidInput) || 0));
  const remainingAmount = round2(Math.max(0, totalAmount - paidAmount));

  const buildCurrentDocument = useCallback((): PurchaseDocument => {
    return {
      id: editingDocId || `PUR-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      profile: activeProfile,
      docType,
      invoiceNo,
      supplierBillNo: supplierBillNo || invoiceNo,
      date,
      supplierId: selectedSupplier?.id || '',
      supplierName: selectedSupplier?.name || '',
      paymentMode,
      transportRef,
      billType: activeProfile === 'GST' ? 'GST Bill' : 'Non-GST Bill',
      lines,
      itemsValue,
      billDiscount,
      additionalCharge,
      billAmount,
      previousBalance,
      adjustedCreditAmount,
      reverseCharge,
      adjustCreditedAmount,
      totalAmount,
      paidAmount,
      remainingAmount,
      remarks,
      storeId: currentUser?.storeId || 'STORE-MAIN',
      createdBy: currentUser?.username || 'Operator',
      createdAt: new Date().toISOString(),
    };
  }, [
    editingDocId,
    activeProfile,
    docType,
    invoiceNo,
    supplierBillNo,
    date,
    selectedSupplier,
    paymentMode,
    transportRef,
    lines,
    itemsValue,
    billDiscount,
    additionalCharge,
    billAmount,
    previousBalance,
    adjustedCreditAmount,
    reverseCharge,
    adjustCreditedAmount,
    totalAmount,
    paidAmount,
    remainingAmount,
    remarks,
    currentUser,
  ]);

  const resetForm = useCallback(() => {
    setEditingDocId(null);
    setLines([]);
    setSelectedLineId(null);
    setSupplierBillNo('');
    setSupplierId('');
    setRemarks('');
    setPaidInput('');
    setBillDiscountInput('');
    setAdditionalChargeInput('');
    setPrevBalanceInput('');
    setAdjustedCreditInput('');
    setReverseCharge(false);
    setAdjustCreditedAmount(false);
    setInvoiceNo(getNextInvoiceNo());
  }, [getNextInvoiceNo]);

  const handleSaveDocument = useCallback(async () => {
    if (lines.length === 0) {
      notify('Add at least one item before saving.', 'error');
      return;
    }
    const doc = buildCurrentDocument();
    await commitTransaction({ category: 'PURCHASE', document: doc });
    notify(`Purchase Bill ${doc.invoiceNo} saved (${activeProfile} Profile).`, 'success');
    resetForm();
  }, [lines.length, buildCurrentDocument, commitTransaction, notify, activeProfile, resetForm]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F4') {
        e.preventDefault();
        handleSaveDocument();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSaveDocument]);

  const isGstPurchaseView = activeProfile === 'GST' && docType === 'PURCHASE';

  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] bg-white">
      <div className="bg-[#0d6e6e] text-white text-center py-1.5 font-bold text-base tracking-wide">
        {docType === 'PURCHASE' ? 'Purchase' : 'Purchase Return'} (
        {activeProfile === 'GST' ? 'GST Profile' : 'Non-GST Profile'})
      </div>

      <div className="p-3 space-y-3 flex-1 flex flex-col">
        <div className="border border-slate-300 rounded p-3 bg-white space-y-3">
          {/* Top Entry Row */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-800 mb-1">Barcode</label>
              <div className="flex">
                <input
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleBarcodeMatch(barcodeInput);
                    }
                  }}
                  placeholder="Scan Barcode"
                  className="w-full rounded-l border border-slate-300 px-2.5 py-1.5 text-xs font-mono focus:border-[#0d6e6e] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="bg-slate-100 border border-l-0 border-slate-300 px-2 rounded-r hover:bg-slate-200 text-slate-700 cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className={isGstPurchaseView ? 'md:col-span-3' : 'md:col-span-4'}>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Item (Word / Substring Search)
              </label>
              <CategorizedItemSelector
                items={state.items}
                profile={activeProfile}
                selectedItemId={selectedItemId}
                onSelect={populateFromItem}
              />
            </div>

            {isGstPurchaseView && (
              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-slate-800 mb-1">Base Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={basePriceInput}
                  onChange={(e) => setBasePriceInput(e.target.value)}
                  placeholder="Base Price"
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs font-mono focus:border-[#0d6e6e] focus:outline-none"
                />
              </div>
            )}

            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-slate-800 mb-1">Stock Qty</label>
              <input
                type="text"
                readOnly
                value={stockQtyDisplay}
                placeholder="Stock Qty"
                className="w-full rounded border border-slate-300 bg-slate-50 px-2 py-1.5 text-xs font-mono text-slate-600"
              />
            </div>

            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-slate-800 mb-1">Qty</label>
              <input
                type="number"
                step="0.01"
                value={qtyInput}
                onChange={(e) => setQtyInput(e.target.value)}
                placeholder="Enter Qty"
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs font-mono focus:border-[#0d6e6e] focus:outline-none"
              />
            </div>

            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-slate-800 mb-1">Rate</label>
              <input
                type="number"
                step="0.01"
                value={rateInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setRateInput(val);
                  if (isGstPurchaseView && val) {
                    const rNum = Number(val);
                    const gstNum = Number(gstPercentInput) || 0;
                    if (rNum > 0) {
                      setBasePriceInput(String(round2(rNum - (rNum * gstNum) / 100)));
                    }
                  }
                }}
                placeholder="Enter Rate"
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs font-mono focus:border-[#0d6e6e] focus:outline-none"
              />
            </div>

            {docType === 'PURCHASE' && (
              <>
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-slate-800 mb-1">Disc 1 %</label>
                  <input
                    type="number"
                    step="0.01"
                    value={disc1Input}
                    onChange={(e) => setDisc1Input(e.target.value)}
                    placeholder="Disc 1 %"
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs font-mono focus:border-[#0d6e6e] focus:outline-none"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-slate-800 mb-1">Disc 2 %</label>
                  <input
                    type="number"
                    step="0.01"
                    value={disc2Input}
                    onChange={(e) => setDisc2Input(e.target.value)}
                    placeholder="Disc 2 %"
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs font-mono focus:border-[#0d6e6e] focus:outline-none"
                  />
                </div>
              </>
            )}

            <div className="md:col-span-1">
              <button
                type="button"
                onClick={handleAddLineItem}
                className="w-full rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold text-xs py-2 px-3 transition-colors cursor-pointer"
              >
                Add Item
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="w-36">
              <label className="block text-xs font-bold text-slate-800 mb-1">Unit</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full rounded border border-slate-300 bg-slate-100 px-2.5 py-1.5 text-xs font-medium focus:border-[#0d6e6e] focus:outline-none"
              >
                <option value="PCS">PCS</option>
                <option value="BOX">BOX</option>
                <option value="PKT">PKT</option>
                <option value="SET">SET</option>
                <option value="DOZ">DOZ</option>
                <option value="KG">KG</option>
              </select>
            </div>

            {isGstPurchaseView && (
              <>
                <div className="w-28">
                  <label className="block text-xs font-bold text-slate-800 mb-1">HSN Code</label>
                  <input
                    type="text"
                    value={hsnInput}
                    onChange={(e) => setHsnInput(e.target.value)}
                    placeholder="HSN Code"
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs font-mono focus:border-[#0d6e6e] focus:outline-none"
                  />
                </div>
                <div className="w-32">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    GST % (CGST+SGST)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={gstPercentInput}
                    onChange={(e) => {
                      const gVal = e.target.value;
                      setGstPercentInput(gVal);
                      const rNum = Number(rateInput);
                      const gNum = Number(gVal) || 0;
                      if (rNum > 0) {
                        setBasePriceInput(String(round2(rNum - (rNum * gNum) / 100)));
                      }
                    }}
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs font-mono focus:border-[#0d6e6e] focus:outline-none"
                  />
                </div>
              </>
            )}
          </div>

          {/* Supplier Bill No, Date, Invoice No */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-slate-200">
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-slate-800 mb-1">
                {docType === 'PURCHASE' ? 'Supplier Bill No' : 'Bill No'}
              </label>
              <input
                type="text"
                value={supplierBillNo}
                onChange={(e) => setSupplierBillNo(e.target.value)}
                placeholder={
                  docType === 'PURCHASE' ? 'Enter Supplier Bill No' : 'Enter Manual Bill No'
                }
                className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs font-mono focus:border-[#0d6e6e] focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-800 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs font-mono focus:border-[#0d6e6e] focus:outline-none"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-slate-800 mb-1">Invoice No</label>
              <input
                type="text"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs font-mono focus:border-[#0d6e6e] focus:outline-none"
              />
            </div>
          </div>

          {/* Supplier, Mode, Transport/Ref, Bill Type */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-5">
              <label className="block text-xs font-bold text-slate-800 mb-1">Supplier</label>
              <select
                value={supplierId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setSupplierId(nextId);
                  const found = state.suppliers.find((s) => s.id === nextId);
                  if (found) {
                    const bal = computeSupplierBalance(found, ledger, activeProfile).closingBalance;
                    if (bal > 0) {
                      setPrevBalanceInput(String(bal));
                    } else if (bal < 0) {
                      setPrevBalanceInput('0');
                      setAdjustCreditedAmount(true);
                      setAdjustedCreditInput(String(Math.abs(bal)));
                    } else {
                      setPrevBalanceInput('0');
                    }
                  } else {
                    setPrevBalanceInput('');
                    setAdjustedCreditInput('');
                    setAdjustCreditedAmount(false);
                  }
                }}
                className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-[#0d6e6e] focus:outline-none"
              >
                <option value="">-- Select Supplier (Blank) --</option>
                {state.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            {docType === 'PURCHASE' && (
              <>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-800 mb-1">Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as any)}
                    className="w-full rounded border border-slate-300 bg-slate-100 px-2.5 py-1.5 text-xs focus:border-[#0d6e6e] focus:outline-none"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank">Bank</option>
                    <option value="Credit">Credit</option>
                  </select>
                </div>

                <div className="md:col-span-5">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Transport/Ref
                  </label>
                  <input
                    type="text"
                    value={transportRef}
                    onChange={(e) => setTransportRef(e.target.value)}
                    placeholder="Enter Transport/Vehicle/Ref"
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs focus:border-[#0d6e6e] focus:outline-none"
                  />
                </div>
              </>
            )}
          </div>

          {docType === 'PURCHASE' && (
            <>
              <div className="md:w-2/3">
                <label className="block text-xs font-bold text-slate-800 mb-1">Remarks</label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter Remarks"
                  className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs focus:border-[#0d6e6e] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Bill Discount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={billDiscountInput}
                    onChange={(e) => setBillDiscountInput(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs font-mono focus:border-[#0d6e6e] focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-800 mb-1">Add. Charge</label>
                  <input
                    type="number"
                    step="0.01"
                    value={additionalChargeInput}
                    onChange={(e) => setAdditionalChargeInput(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs font-mono focus:border-[#0d6e6e] focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Previous Balance (+)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={prevBalanceInput}
                    onChange={(e) => setPrevBalanceInput(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs font-mono focus:border-[#0d6e6e] focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="inline-flex items-center gap-1 text-xs font-bold text-slate-800 mb-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={adjustCreditedAmount}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setAdjustCreditedAmount(checked);
                        if (checked && !adjustedCreditInput && supplierLedgerBalance < 0) {
                          setAdjustedCreditInput(String(Math.abs(supplierLedgerBalance)));
                        }
                      }}
                    />
                    <span>Adjust credit (-)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    disabled={!adjustCreditedAmount}
                    value={adjustedCreditInput}
                    onChange={(e) => setAdjustedCreditInput(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded border border-slate-300 disabled:bg-slate-100 px-2.5 py-1.5 text-xs font-mono focus:border-[#0d6e6e] focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-800 mb-1">Paid Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={paidInput}
                    onChange={(e) => setPaidInput(e.target.value)}
                    placeholder="Enter Paid Amount"
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs font-mono focus:border-[#0d6e6e] focus:outline-none"
                  />
                </div>

                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-slate-800 mb-1">Remaining</label>
                  <input
                    type="text"
                    readOnly
                    value={formatNumber(remainingAmount)}
                    className="w-full rounded border border-slate-300 bg-slate-50 px-2 py-1.5 text-xs font-mono text-slate-700"
                  />
                </div>

                <div className="md:col-span-1 flex items-center pb-1.5">
                  <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reverseCharge}
                      onChange={(e) => setReverseCharge(e.target.checked)}
                    />
                    <span>RCM</span>
                  </label>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Data Grid */}
        <div className="flex-1 border border-slate-300 rounded bg-slate-50/60 overflow-x-auto min-h-[200px]">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-[#e2e8f0] text-slate-800 border-b border-slate-300 text-left">
                <th className="py-2 px-2.5 border-r border-slate-300 font-semibold">Code</th>
                <th className="py-2 px-2.5 border-r border-slate-300 font-semibold">Name</th>
                {isGstPurchaseView && (
                  <th className="py-2 px-2.5 border-r border-slate-300 font-semibold">Hsn</th>
                )}
                <th className="py-2 px-2.5 border-r border-slate-300 font-semibold">Unit</th>
                <th className="py-2 px-2.5 border-r border-slate-300 font-semibold text-right">
                  Qty
                </th>
                <th className="py-2 px-2.5 border-r border-slate-300 font-semibold text-right">
                  Rate
                </th>
                {docType === 'PURCHASE' && (
                  <th className="py-2 px-2.5 border-r border-slate-300 font-semibold text-right">
                    Dis 1 %
                  </th>
                )}
                <th className="py-2 px-2.5 border-r border-slate-300 font-semibold text-right">
                  Amount
                </th>
                {isGstPurchaseView && (
                  <>
                    <th className="py-2 px-2.5 border-r border-slate-300 font-semibold text-right">
                      GST %
                    </th>
                    <th className="py-2 px-2.5 border-r border-slate-300 font-semibold text-right">
                      Base Price
                    </th>
                    <th className="py-2 px-2.5 border-r border-slate-300 font-semibold text-right">
                      CGST
                    </th>
                    <th className="py-2 px-2.5 border-r border-slate-300 font-semibold text-right">
                      SGST
                    </th>
                  </>
                )}
                {docType === 'PURCHASE' && (
                  <th className="py-2 px-2.5 border-r border-slate-300 font-semibold text-right">
                    Dis 2 %
                  </th>
                )}
                <th className="py-2 px-2.5 font-semibold">Unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white font-mono">
              {lines.map((line) => (
                <tr
                  key={line.id}
                  onClick={() => setSelectedLineId(line.id)}
                  className={`cursor-pointer ${
                    line.id === selectedLineId ? 'bg-teal-100/80' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="py-1.5 px-2.5 border-r border-slate-200">{line.code}</td>
                  <td className="py-1.5 px-2.5 border-r border-slate-200 font-sans font-medium">
                    {line.name}
                  </td>
                  {isGstPurchaseView && (
                    <td className="py-1.5 px-2.5 border-r border-slate-200">{line.hsn || '-'}</td>
                  )}
                  <td className="py-1.5 px-2.5 border-r border-slate-200">{line.unit}</td>
                  <td className="py-1.5 px-2.5 border-r border-slate-200 text-right">
                    {formatNumber(line.qty)}
                  </td>
                  <td className="py-1.5 px-2.5 border-r border-slate-200 text-right">
                    {formatNumber(line.rate)}
                  </td>
                  {docType === 'PURCHASE' && (
                    <td className="py-1.5 px-2.5 border-r border-slate-200 text-right">
                      {formatNumber(line.disc1Percent)}
                    </td>
                  )}
                  <td className="py-1.5 px-2.5 border-r border-slate-200 text-right font-semibold">
                    {formatNumber(line.amount)}
                  </td>
                  {isGstPurchaseView && (
                    <>
                      <td className="py-1.5 px-2.5 border-r border-slate-200 text-right">
                        {formatNumber(line.gstPercent)}
                      </td>
                      <td className="py-1.5 px-2.5 border-r border-slate-200 text-right">
                        {formatNumber(line.basePrice)}
                      </td>
                      <td className="py-1.5 px-2.5 border-r border-slate-200 text-right">
                        {formatNumber(line.cgst)}
                      </td>
                      <td className="py-1.5 px-2.5 border-r border-slate-200 text-right">
                        {formatNumber(line.sgst)}
                      </td>
                    </>
                  )}
                  {docType === 'PURCHASE' && (
                    <td className="py-1.5 px-2.5 border-r border-slate-200 text-right">
                      {formatNumber(line.disc2Percent)}
                    </td>
                  )}
                  <td className="py-1.5 px-2.5">{line.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom Summary & Action Buttons */}
        <div className="border border-slate-300 rounded p-3 bg-white space-y-2.5">
          <div className="font-mono text-xs sm:text-sm space-y-0.5 text-slate-900">
            <div className="flex flex-wrap gap-6 font-bold">
              <span>TOTAL ITEMS: {lines.length}</span>
              <span>TOTAL QTY: {formatNumber(totalQty)}</span>
              <span>BILL AMOUNT: ₹{formatNumber(billAmount)}</span>
              {previousBalance > 0 && (
                <span className="text-amber-700">
                  PREVIOUS AMOUNT: +₹{formatNumber(previousBalance)}
                </span>
              )}
              {adjustedCreditAmount > 0 && (
                <span className="text-emerald-700">
                  ADJUSTED CREDIT: -₹{formatNumber(adjustedCreditAmount)}
                </span>
              )}
              <span className="text-[#0d6e6e]">TOTAL AMOUNT: ₹{formatNumber(totalAmount)}</span>
            </div>
            <div className="flex flex-wrap gap-6 text-slate-700">
              <span>Items Value: {formatNumber(itemsValue)}</span>
              <span>Bill Disc: {formatNumber(billDiscount)}</span>
              {docType === 'PURCHASE' && <span>Add.Chg: {formatNumber(additionalCharge)}</span>}
              <span>Previous Bal: {formatNumber(previousBalance)}</span>
              <span>Paid: {formatNumber(paidAmount)}</span>
              <span>Pending: {formatNumber(remainingAmount)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2">
            <button
              type="button"
              onClick={() => {
                if (!selectedLineId) return;
                setLines((prev) => prev.filter((l) => l.id !== selectedLineId));
                setSelectedLineId(null);
              }}
              className="rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold text-xs py-2.5 px-2 cursor-pointer"
            >
              Delete Item
            </button>
            <button
              type="button"
              onClick={() => notify('Purchase draft placed on hold.', 'info')}
              className="rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold text-xs py-2.5 px-2 cursor-pointer"
            >
              Hold Bill
            </button>
            <button
              type="button"
              onClick={() => {
                if (editingDocId) {
                  commitTransaction({ category: 'PURCHASE', deleteId: editingDocId });
                }
                resetForm();
              }}
              className="rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold text-xs py-2.5 px-2 cursor-pointer"
            >
              Delete Bill
            </button>
            <button
              type="button"
              onClick={() => {
                if (lines.length === 0) return;
                setPrintFormat('A4');
                setPrintModalOpen(true);
              }}
              className="rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold text-xs py-2.5 px-2 cursor-pointer"
            >
              Print A4
            </button>
            <button
              type="button"
              onClick={() => {
                if (lines.length === 0) return;
                setPrintFormat('A5');
                setPrintModalOpen(true);
              }}
              className="rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold text-xs py-2.5 px-2 cursor-pointer"
            >
              Print A5
            </button>
            <button
              type="button"
              onClick={() => {
                if (lines.length === 0) return;
                setPrintFormat('THERMAL');
                setPrintModalOpen(true);
              }}
              className="rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold text-xs py-2.5 px-2 cursor-pointer"
            >
              Thermal
            </button>
            <button
              type="button"
              onClick={() => notify('No held purchase drafts.', 'info')}
              className="rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold text-xs py-2.5 px-2 cursor-pointer"
            >
              Resume Bill
            </button>
            <button
              type="button"
              onClick={handleSaveDocument}
              className="rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold text-xs py-2.5 px-2 cursor-pointer"
            >
              Save (F4)
            </button>
            <button
              type="button"
              onClick={() => notify('Ready for profile transfer.', 'info')}
              className="rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold text-xs py-2.5 px-2 cursor-pointer"
            >
              Transfer
            </button>
            <button
              type="button"
              onClick={onExit}
              className="rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold text-xs py-2.5 px-2 cursor-pointer"
            >
              Exit
            </button>
          </div>
        </div>
      </div>

      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        items={state.items}
        onDetected={handleBarcodeMatch}
      />

      <ReceiptPrintModal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        format={printFormat}
        setFormat={setPrintFormat}
        document={buildCurrentDocument()}
        company={state.company}
        profile={activeProfile}
      />
    </div>
  );
};
