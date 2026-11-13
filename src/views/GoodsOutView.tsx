import React, { useCallback, useEffect, useState } from 'react';
import { Camera, CheckCircle2, PenTool, QrCode, Trash2, Upload } from 'lucide-react';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';
import { CategorizedItemSelector } from '../components/CategorizedItemSelector';
import { ReceiptPrintModal } from '../components/ReceiptPrintModal';
import { usePos } from '../context/PosContext';
import { BillLineItem, ItemMaster, SaleDocument } from '../types/pos';
import {
  calculateBillLine,
  computeBillIntegrityHash,
  computeCustomerBalance,
  formatNumber,
  getItemBatchExpirySummary,
  round2,
} from '../utils/accounting';

interface GoodsOutViewProps {
  docType: 'SALE' | 'STOCK_OUT' | 'CREDIT_NOTE';
  initialDocument?: SaleDocument | null;
  onExit: () => void;
}

interface DraftTaxCalculations {
  totalBaseAmount: number;
  totalCgstAmount: number;
  totalSgstAmount: number;
  totalTaxAmount: number;
  itemsValue: number;
  billDiscount: number;
  billAmount: number;
  previousBalance: number;
  adjustedCreditAmount: number;
  totalAmount: number;
  receivedAmount: number;
  remainingAmount: number;
  totalQty: number;
}

interface DraftBillSnapshot {
  invoiceNo?: string;
  manualRefNo?: string;
  date?: string;
  lines: BillLineItem[];
  customerId: string;
  customerName?: string;
  customerDetails: string;
  paymentMode: 'Cash' | 'UPI' | 'Card' | 'Bank' | 'Credit';
  transportRef: string;
  receivedInput: string;
  billDiscountInput: string;
  prevBalanceInput?: string;
  adjustedCreditInput?: string;
  upiId: string;
  adjustCreditedAmount: boolean;
  remarks: string;
  billSignatureDataUrl?: string;
  taxCalculations?: DraftTaxCalculations;
  updatedAt?: string;
}

const getDraftStorageKey = (profile: string, docType: string) =>
  `kanha_pos_active_draft_${profile}_${docType}`;

export const GoodsOutView: React.FC<GoodsOutViewProps> = ({
  docType,
  initialDocument,
  onExit,
}) => {
  const { state, activeProfile, currentUser, commitTransaction, saveMaster, notify } = usePos();
  const ledger = state.profiles[activeProfile];
  const saleCounter = ledger.counters.sale;
  const stockOutCounter = ledger.counters.stockOut;
  const creditNoteCounter = ledger.counters.creditNote;

  const getNextDocNumber = useCallback(() => {
    if (docType === 'STOCK_OUT') {
      return `STK${String(stockOutCounter).padStart(5, '0')}`;
    }
    if (docType === 'CREDIT_NOTE') {
      return `CRN${String(creditNoteCounter).padStart(5, '0')}`;
    }
    return activeProfile === 'GST'
      ? `TAX${String(saleCounter).padStart(5, '0')}`
      : `BIL${String(saleCounter).padStart(5, '0')}`;
  }, [docType, stockOutCounter, creditNoteCounter, saleCounter, activeProfile]);

  const getNextSecondaryRef = useCallback(() => {
    if (docType === 'STOCK_OUT') {
      return `STI${String(stockOutCounter).padStart(5, '0')}`;
    }
    if (docType === 'CREDIT_NOTE') {
      return `CNI${String(creditNoteCounter).padStart(5, '0')}`;
    }
    return '';
  }, [docType, stockOutCounter, creditNoteCounter]);

  // Line Entry State (Customer and Item always start empty)
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

  const loadSavedDraft = useCallback(
    (profileKey: string, typeKey: string): DraftBillSnapshot | null => {
      try {
        const raw = localStorage.getItem(getDraftStorageKey(profileKey, typeKey));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as DraftBillSnapshot;
        if (parsed && Array.isArray(parsed.lines)) {
          return parsed;
        }
      } catch {
        // ignore corrupted draft
      }
      return null;
    },
    []
  );

  const initialDraft = !initialDocument ? loadSavedDraft(activeProfile, docType) : null;

  // Document Header State
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [invoiceNo, setInvoiceNo] = useState(() => initialDraft?.invoiceNo || getNextDocNumber());
  const [manualRefNo, setManualRefNo] = useState(
    () => initialDraft?.manualRefNo || getNextSecondaryRef()
  );
  const [date, setDate] = useState(
    () => initialDraft?.date || new Date().toISOString().slice(0, 10)
  );
  const [customerId, setCustomerId] = useState(() => initialDraft?.customerId || '');
  const [customerDetails, setCustomerDetails] = useState(
    () => initialDraft?.customerDetails || ''
  );
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'UPI' | 'Card' | 'Bank' | 'Credit'>(
    () => initialDraft?.paymentMode || 'Cash'
  );
  const [transportRef, setTransportRef] = useState(() => initialDraft?.transportRef || '');
  const [receivedInput, setReceivedInput] = useState(() => initialDraft?.receivedInput || '');
  const [billDiscountInput, setBillDiscountInput] = useState(
    () => initialDraft?.billDiscountInput || ''
  );
  const [prevBalanceInput, setPrevBalanceInput] = useState(
    () => initialDraft?.prevBalanceInput || ''
  );
  const [adjustedCreditInput, setAdjustedCreditInput] = useState(
    () => initialDraft?.adjustedCreditInput || ''
  );
  const [upiId, setUpiId] = useState(() => initialDraft?.upiId || state.company.upiId || '');
  const [adjustCreditedAmount, setAdjustCreditedAmount] = useState(
    () => initialDraft?.adjustCreditedAmount || false
  );
  const [remarks, setRemarks] = useState(() => initialDraft?.remarks || '');
  const [billSignatureDataUrl, setBillSignatureDataUrl] = useState<string>(
    () => initialDraft?.billSignatureDataUrl || state.company.signatureDataUrl || ''
  );

  // Lines & Selection (Held in bill until saved)
  const [lines, setLines] = useState<BillLineItem[]>(() => initialDraft?.lines || []);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

  // Modals
  const [scannerOpen, setScannerOpen] = useState(false);
  const [resumeModalOpen, setResumeModalOpen] = useState(false);
  const [printFormat, setPrintFormat] = useState<'A4' | 'A5' | 'THERMAL'>(() => {
    const ps = state.company.printerSettings?.paperSize;
    if (ps === 'A5') return 'A5';
    if (ps === 'THERMAL_80MM' || ps === 'THERMAL_58MM') return 'THERMAL';
    return 'A4';
  });
  const [printModalOpen, setPrintModalOpen] = useState(false);

  // Automatically sync Company Master signature into bill option if bill doesn't have a custom override yet
  useEffect(() => {
    if (state.company.signatureDataUrl && !billSignatureDataUrl) {
      setBillSignatureDataUrl(state.company.signatureDataUrl);
    }
  }, [state.company.signatureDataUrl, billSignatureDataUrl]);

  // Restore held draft bill when switching between docTypes or profiles
  useEffect(() => {
    if (initialDocument) return;
    const saved = loadSavedDraft(activeProfile, docType);
    setEditingDocId(null);
    if (saved && (saved.lines?.length > 0 || saved.customerId || saved.customerDetails)) {
      setInvoiceNo(saved.invoiceNo || getNextDocNumber());
      setManualRefNo(saved.manualRefNo || getNextSecondaryRef());
      setDate(saved.date || new Date().toISOString().slice(0, 10));
      setLines(saved.lines || []);
      setCustomerId(saved.customerId || '');
      setCustomerDetails(saved.customerDetails || '');
      setPaymentMode(saved.paymentMode || 'Cash');
      setTransportRef(saved.transportRef || '');
      setReceivedInput(saved.receivedInput || '');
      setBillDiscountInput(saved.billDiscountInput || '');
      setPrevBalanceInput(saved.prevBalanceInput || '');
      setAdjustedCreditInput(saved.adjustedCreditInput || '');
      setUpiId(saved.upiId || state.company.upiId || '');
      setAdjustCreditedAmount(Boolean(saved.adjustCreditedAmount));
      setRemarks(saved.remarks || '');
      setBillSignatureDataUrl(
        saved.billSignatureDataUrl || state.company.signatureDataUrl || ''
      );
    } else {
      setInvoiceNo(getNextDocNumber());
      setManualRefNo(getNextSecondaryRef());
      setDate(new Date().toISOString().slice(0, 10));
      setLines([]);
      setCustomerId('');
      setCustomerDetails('');
      setPaymentMode('Cash');
      setTransportRef('');
      setReceivedInput('');
      setBillDiscountInput('');
      setPrevBalanceInput('');
      setAdjustedCreditInput('');
      setUpiId(state.company.upiId || '');
      setAdjustCreditedAmount(false);
      setRemarks('');
      setBillSignatureDataUrl(state.company.signatureDataUrl || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfile, docType, initialDocument]);

  // Update invoice number when counter increments and bill is empty
  useEffect(() => {
    if (!editingDocId && lines.length === 0) {
      setInvoiceNo(getNextDocNumber());
      setManualRefNo(getNextSecondaryRef());
    }
  }, [editingDocId, lines.length, getNextDocNumber, getNextSecondaryRef]);

  useEffect(() => {
    if (initialDocument) {
      setEditingDocId(initialDocument.id);
      setInvoiceNo(initialDocument.invoiceNo);
      setManualRefNo(initialDocument.manualRefNo || '');
      setDate(initialDocument.date);
      setCustomerId(initialDocument.customerId);
      setCustomerDetails(initialDocument.customerDetails || '');
      setPaymentMode(initialDocument.paymentMode);
      setTransportRef(initialDocument.transportRef || '');
      setLines(initialDocument.lines);
      setReceivedInput(String(initialDocument.receivedAmount));
      setBillDiscountInput(String(initialDocument.billDiscount || ''));
      setPrevBalanceInput(String(initialDocument.previousBalance || ''));
      setAdjustedCreditInput(String(initialDocument.adjustedCreditAmount || ''));
      setUpiId(initialDocument.upiId || state.company.upiId || '');
      setAdjustCreditedAmount(Boolean(initialDocument.adjustCreditedAmount));
      setRemarks(initialDocument.remarks || '');
      setBillSignatureDataUrl(
        initialDocument.companySignatureDataUrl || state.company.signatureDataUrl || ''
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDocument]);

  const handleBillSignatureUpload = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      notify('Please select a valid signature image file (PNG, JPG, WebP).', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setBillSignatureDataUrl(dataUrl);
      // Also save to Company Master so it stays synchronized with Company Master signature
      saveMaster('COMPANY', { ...state.company, signatureDataUrl: dataUrl });
      notify('Authorized signature uploaded to Bill & Company Master.', 'success');
    };
    reader.readAsDataURL(file);
  };

  const populateFromItem = useCallback(
    (item: ItemMaster) => {
      setSelectedItemId(item.id);
      setBarcodeInput(item.barcode || item.code);
      setUnit(item.unit || 'PCS');
      setStockQtyDisplay(String(item.stockQty));
      setRateInput(String(item.sellingPrice));
      if (activeProfile === 'GST') {
        const gstPct = item.gstPercent ?? 18;
        setBasePriceInput(
          String(
            item.basePrice > 0 && item.basePrice <= item.sellingPrice
              ? item.basePrice
              : round2(item.sellingPrice - (item.sellingPrice * gstPct) / 100)
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
    (codeOrBarcode: string, isContinuous?: boolean) => {
      const clean = codeOrBarcode.trim().toLowerCase();
      if (!clean) return;
      const matched = state.items.find(
        (i) =>
          (i.barcode && i.barcode.toLowerCase() === clean) ||
          (i.code && i.code.toLowerCase() === clean) ||
          i.name.toLowerCase() === clean
      );
      if (!matched) {
        notify(`No item found matching barcode/code "${codeOrBarcode}".`, 'error');
        return;
      }

      if (isContinuous) {
        const calcProfile = activeProfile === 'GST' && docType === 'SALE' ? 'GST' : 'NON_GST';
        const defaultBasePrice =
          activeProfile === 'GST'
            ? matched.basePrice ||
              round2(
                matched.sellingPrice -
                  (matched.sellingPrice * (matched.gstPercent || 18)) / 100
              )
            : 0;

        setLines((prev) => {
          const existingIdx = prev.findIndex((l) => l.itemId === matched.id);
          if (existingIdx >= 0) {
            const existing = prev[existingIdx];
            const nextQty = round2(existing.qty + 1);
            const updatedLine = calculateBillLine({
              profile: calcProfile,
              itemId: matched.id,
              code: matched.code,
              barcode: matched.barcode,
              name: matched.name,
              hsn: activeProfile === 'GST' ? matched.hsnCode || '' : '',
              unit: matched.unit || 'PCS',
              qty: nextQty,
              basePriceInput: defaultBasePrice,
              rateInput: existing.rate,
              disc1Percent: existing.disc1Percent,
              disc2Percent: existing.disc2Percent,
              gstPercentInput: activeProfile === 'GST' ? matched.gstPercent ?? 18 : 0,
            });
            updatedLine.id = existing.id;
            const copy = [...prev];
            copy[existingIdx] = updatedLine;
            return copy;
          }

          const newLine = calculateBillLine({
            profile: calcProfile,
            itemId: matched.id,
            code: matched.code,
            barcode: matched.barcode,
            name: matched.name,
            hsn: activeProfile === 'GST' ? matched.hsnCode || '' : '',
            unit: matched.unit || 'PCS',
            qty: 1,
            basePriceInput: defaultBasePrice,
            rateInput: matched.sellingPrice,
            disc1Percent: 0,
            disc2Percent: 0,
            gstPercentInput: activeProfile === 'GST' ? matched.gstPercent ?? 18 : 0,
          });
          return [...prev, newLine];
        });

        const expSummary = getItemBatchExpirySummary(matched);
        if (expSummary.expiredCount > 0) {
          notify(
            `Scanned "${matched.name}" (+1) — WARNING: ${expSummary.expiredCount} batch(es) EXPIRED!`,
            'error'
          );
        } else if (expSummary.expiringSoonCount > 0 && expSummary.nearestBatch) {
          notify(
            `Scanned "${matched.name}" (+1) — Batch ${expSummary.nearestBatch.batchNo} expires in ${expSummary.nearestBatch.daysRemaining}d`,
            'info'
          );
        } else {
          notify(`Continuous Scan: Added "${matched.name}" (+1 ${matched.unit})`, 'success');
        }
        return;
      }

      populateFromItem(matched);
    },
    [state.items, activeProfile, docType, populateFromItem, notify]
  );

  const handleAddLineItem = () => {
    const matchedItem = state.items.find((i) => i.id === selectedItemId);
    const rate = Number(rateInput);
    const qty = Number(qtyInput);

    if (!matchedItem && !barcodeInput.trim()) {
      notify('Select an item from the suggestion list or scan a barcode.', 'error');
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      notify('Enter a valid quantity greater than 0.', 'error');
      return;
    }
    if (!Number.isFinite(rate) || rate < 0) {
      notify('Enter a valid selling rate.', 'error');
      return;
    }

    const line = calculateBillLine({
      profile: activeProfile === 'GST' && docType === 'SALE' ? 'GST' : 'NON_GST',
      itemId: matchedItem?.id || '',
      code: matchedItem?.code || barcodeInput.trim() || 'ITEM',
      barcode: matchedItem?.barcode || barcodeInput.trim(),
      name: matchedItem?.name || barcodeInput.trim(),
      hsn: activeProfile === 'GST' ? hsnInput || matchedItem?.hsnCode || '' : '',
      unit: unit || matchedItem?.unit || 'PCS',
      qty,
      basePriceInput: activeProfile === 'GST' ? Number(basePriceInput) : 0,
      rateInput: rate,
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

  const selectedCustomer = state.customers.find((c) => c.id === customerId);
  const customerLedgerBalance = selectedCustomer
    ? computeCustomerBalance(selectedCustomer, ledger, activeProfile).closingBalance
    : 0;

  const totalBaseAmount = round2(lines.reduce((sum, l) => sum + (l.basePrice || 0) * l.qty, 0));
  const totalCgstAmount = round2(lines.reduce((sum, l) => sum + (l.cgst || 0), 0));
  const totalSgstAmount = round2(lines.reduce((sum, l) => sum + (l.sgst || 0), 0));
  const totalTaxAmount = round2(totalCgstAmount + totalSgstAmount);
  const itemsValue = round2(lines.reduce((sum, l) => sum + l.amount, 0));
  const totalQty = round2(lines.reduce((sum, l) => sum + l.qty, 0));
  const billDiscount = round2(Math.max(0, Number(billDiscountInput) || 0));
  const billAmount = round2(Math.max(0, itemsValue - billDiscount));
  const previousBalance = round2(Math.max(0, Number(prevBalanceInput) || 0));
  const adjustedCreditAmount = adjustCreditedAmount
    ? round2(Math.max(0, Number(adjustedCreditInput) || 0))
    : 0;
  const totalAmount = round2(Math.max(0, billAmount + previousBalance - adjustedCreditAmount));
  const receivedAmount =
    receivedInput.trim() === ''
      ? paymentMode === 'Credit'
        ? 0
        : totalAmount
      : round2(Math.max(0, Number(receivedInput) || 0));
  const remainingAmount = round2(Math.max(0, totalAmount - receivedAmount));

  // Automatically persist current draft bill state (items, customer details, tax calculations) in localStorage
  useEffect(() => {
    if (editingDocId || initialDocument) return;
    const key = getDraftStorageKey(activeProfile, docType);
    try {
      const snapshot: DraftBillSnapshot = {
        invoiceNo,
        manualRefNo,
        date,
        lines,
        customerId,
        customerName: selectedCustomer?.name || '',
        customerDetails,
        paymentMode,
        transportRef,
        receivedInput,
        billDiscountInput,
        prevBalanceInput,
        adjustedCreditInput,
        upiId,
        adjustCreditedAmount,
        remarks,
        billSignatureDataUrl,
        taxCalculations: {
          totalBaseAmount,
          totalCgstAmount,
          totalSgstAmount,
          totalTaxAmount,
          itemsValue,
          billDiscount,
          billAmount,
          previousBalance,
          adjustedCreditAmount,
          totalAmount,
          receivedAmount,
          remainingAmount,
          totalQty,
        },
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(key, JSON.stringify(snapshot));
    } catch {
      // ignore storage quota errors
    }
  }, [
    activeProfile,
    docType,
    editingDocId,
    initialDocument,
    invoiceNo,
    manualRefNo,
    date,
    lines,
    customerId,
    selectedCustomer,
    customerDetails,
    paymentMode,
    transportRef,
    receivedInput,
    billDiscountInput,
    prevBalanceInput,
    adjustedCreditInput,
    upiId,
    adjustCreditedAmount,
    remarks,
    billSignatureDataUrl,
    totalBaseAmount,
    totalCgstAmount,
    totalSgstAmount,
    totalTaxAmount,
    itemsValue,
    billDiscount,
    billAmount,
    previousBalance,
    adjustedCreditAmount,
    totalAmount,
    receivedAmount,
    remainingAmount,
    totalQty,
  ]);

  const buildCurrentDocument = useCallback((): SaleDocument => {
    const custName = selectedCustomer?.name || '';
    const qrSignatureHash = computeBillIntegrityHash({
      invoiceNo,
      date,
      profile: activeProfile,
      customerName: custName,
      totalAmount,
      itemsCount: lines.length,
    });

    return {
      id: editingDocId || `SAL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      profile: activeProfile,
      docType,
      invoiceNo,
      manualRefNo,
      date,
      customerId: selectedCustomer?.id || '',
      customerName: custName,
      customerMobile: selectedCustomer?.mobile || '',
      customerEmail: selectedCustomer?.email || '',
      customerDetails:
        customerDetails ||
        (selectedCustomer
          ? `${selectedCustomer.mobile || ''} ${selectedCustomer.address || ''}`.trim()
          : ''),
      customerSignatureDataUrl:
        selectedCustomer?.signatureDataUrl || initialDocument?.customerSignatureDataUrl,
      companySignatureDataUrl:
        billSignatureDataUrl ||
        state.company.signatureDataUrl ||
        initialDocument?.companySignatureDataUrl,
      paymentMode,
      transportRef,
      billType: activeProfile === 'GST' ? 'GST Bill' : 'Non-GST Bill',
      lines,
      itemsValue,
      billDiscount,
      billAmount,
      previousBalance,
      adjustedCreditAmount,
      totalAmount,
      receivedAmount,
      remainingAmount,
      upiId,
      adjustCreditedAmount,
      remarks,
      storeId: currentUser?.storeId || 'STORE-MAIN',
      createdBy: currentUser?.username || 'Operator',
      createdAt: new Date().toISOString(),
      qrSignatureHash,
      emailReceiptSent: Boolean(selectedCustomer?.email && state.company.smtpEmailReceipts),
    };
  }, [
    selectedCustomer,
    invoiceNo,
    date,
    activeProfile,
    totalAmount,
    lines,
    editingDocId,
    docType,
    manualRefNo,
    customerDetails,
    billSignatureDataUrl,
    state.company.signatureDataUrl,
    paymentMode,
    transportRef,
    itemsValue,
    billDiscount,
    billAmount,
    previousBalance,
    adjustedCreditAmount,
    receivedAmount,
    remainingAmount,
    upiId,
    adjustCreditedAmount,
    remarks,
    currentUser,
    state.company.smtpEmailReceipts,
    initialDocument,
  ]);

  const resetForm = useCallback(() => {
    try {
      localStorage.removeItem(getDraftStorageKey(activeProfile, docType));
    } catch {
      // ignore
    }
    setEditingDocId(null);
    setLines([]);
    setSelectedLineId(null);
    setCustomerId('');
    setCustomerDetails('');
    setReceivedInput('');
    setBillDiscountInput('');
    setPrevBalanceInput('');
    setAdjustedCreditInput('');
    setAdjustCreditedAmount(false);
    setTransportRef('');
    setRemarks('');
    setBillSignatureDataUrl(state.company.signatureDataUrl || '');
    setInvoiceNo(getNextDocNumber());
    setManualRefNo(getNextSecondaryRef());
  }, [
    activeProfile,
    docType,
    state.company.signatureDataUrl,
    getNextDocNumber,
    getNextSecondaryRef,
  ]);

  const handleSaveDocument = useCallback(async () => {
    if (lines.length === 0) {
      notify('Add at least one item before saving the bill.', 'error');
      return;
    }
    const doc = buildCurrentDocument();
    await commitTransaction({ category: 'SALE', document: doc });
    notify(
      `${doc.invoiceNo} saved (${activeProfile} Profile). ${
        doc.emailReceiptSent ? 'Automated email receipt dispatched.' : ''
      }`,
      'success'
    );
    resetForm();
  }, [lines.length, buildCurrentDocument, commitTransaction, notify, activeProfile, resetForm]);

  // F4 keyboard shortcut for Save
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

  const handleHoldBill = async () => {
    if (lines.length === 0) {
      notify('Cannot hold an empty bill.', 'error');
      return;
    }
    const doc = buildCurrentDocument();
    await commitTransaction({
      category: 'HOLD_BILL',
      document: {
        id: `HLD-${Date.now()}`,
        label: `${doc.invoiceNo} - ${doc.customerName || 'Customer'} (${formatNumber(doc.totalAmount)})`,
        savedAt: new Date().toISOString(),
        docType,
        payload: doc,
      },
    });
    notify(`Bill ${doc.invoiceNo} placed on hold.`, 'info');
    resetForm();
  };

  const handleTransferProfile = async () => {
    if (lines.length === 0) {
      notify('Add items to transfer or duplicate across profiles.', 'error');
      return;
    }
    notify(
      `Ready to process ${lines.length} item(s). Switch active profile in top bar to post in ${
        activeProfile === 'GST' ? 'NON-GST' : 'GST'
      }.`,
      'info'
    );
  };

  const screenTitle =
    docType === 'SALE' ? 'Sale' : docType === 'STOCK_OUT' ? 'Stock Out' : 'Credit Note';

  const isGstSaleView = activeProfile === 'GST' && docType === 'SALE';

  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] bg-white">
      {/* Teal Title Banner matching Windows POS App */}
      <div className="bg-[#0d6e6e] text-white px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 shadow-xs">
        <span className="font-bold text-base tracking-wide">
          {screenTitle} ({activeProfile === 'GST' ? 'GST Profile' : 'Non-GST Profile'})
        </span>
        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          className="flex items-center gap-1.5 rounded bg-[#094e4e] hover:bg-teal-950 border border-teal-400/50 px-3 py-1 text-xs font-bold text-white cursor-pointer"
        >
          <Camera className="w-3.5 h-3.5 text-teal-200" />
          <span>Camera Barcode Scan (Continuous Mode)</span>
        </button>
      </div>

      <div className="p-3 space-y-3 flex-1 flex flex-col">
        {/* Top Entry Box */}
        <div className="border border-slate-300 rounded p-3 bg-white space-y-3">
          {/* Row 1: Barcode, Item (Categorized Suggestion), Base Price (GST only), Stock Qty, Qty, Rate, Disc 1, Disc 2, Add Item */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Barcode / Scan
              </label>
              <div className="flex">
                <input
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleBarcodeMatch(barcodeInput, true);
                      setBarcodeInput('');
                    }
                  }}
                  placeholder="Scan Barcode"
                  className="w-full rounded-l border border-slate-300 px-2.5 py-1.5 text-xs font-mono focus:border-[#0d6e6e] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="bg-[#0d6e6e] hover:bg-[#094e4e] border border-l-0 border-[#0d6e6e] px-2.5 rounded-r text-white cursor-pointer flex items-center gap-1"
                  title="Open Continuous Camera Barcode Scanner"
                >
                  <QrCode className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className={isGstSaleView ? 'md:col-span-3' : 'md:col-span-4'}>
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

            {isGstSaleView && (
              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-slate-800 mb-1">Base Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={basePriceInput}
                  onChange={(e) => {
                    const bp = e.target.value;
                    setBasePriceInput(bp);
                    const bpNum = Number(bp);
                    const gstNum = Number(gstPercentInput) || 18;
                    if (bpNum > 0 && !rateInput) {
                      setRateInput(String(round2(bpNum + (bpNum * gstNum) / 100)));
                    }
                  }}
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
                  if (isGstSaleView && val) {
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

            {docType === 'SALE' && (
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
                className="w-full rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold text-xs py-2 px-3 transition-colors cursor-pointer whitespace-nowrap"
              >
                Add Item
              </button>
            </div>
          </div>

          {/* Row 2: Unit & GST % / HSN (when GST Profile is active) */}
          <div className="flex flex-wrap items-center gap-4 pt-1">
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

            {isGstSaleView && (
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
                <div className="text-[11px] text-slate-600 pt-4 font-mono">
                  {Number(rateInput) > 0 && Number(basePriceInput) > 0 && (
                    <span>
                      Base ₹{formatNumber(Number(basePriceInput))} + CGST ₹
                      {formatNumber(Math.max(0, Number(rateInput) - Number(basePriceInput)) / 2)} +
                      SGST ₹
                      {formatNumber(Math.max(0, Number(rateInput) - Number(basePriceInput)) / 2)} =
                      Selling Price ₹{formatNumber(Number(rateInput))}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Row 3: Invoice / Customer / Payment Details */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-slate-200">
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-slate-800 mb-1">
                {docType === 'SALE'
                  ? activeProfile === 'GST'
                    ? 'Tax Invoice No'
                    : 'Bill No'
                  : 'Bill No'}
              </label>
              <input
                type="text"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
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

            {docType !== 'SALE' && (
              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-slate-800 mb-1">Invoice No</label>
                <input
                  type="text"
                  value={manualRefNo}
                  onChange={(e) => setManualRefNo(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs font-mono focus:border-[#0d6e6e] focus:outline-none"
                />
              </div>
            )}

            {docType === 'STOCK_OUT' ? (
              <div className="md:col-span-7">
                <label className="block text-xs font-bold text-slate-800 mb-1">Remarks</label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter Remarks"
                  className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs focus:border-[#0d6e6e] focus:outline-none"
                />
              </div>
            ) : (
              <div className="md:col-span-4">
                <label className="block text-xs font-bold text-slate-800 mb-1">Customer</label>
                <select
                  value={customerId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setCustomerId(nextId);
                    const found = state.customers.find((c) => c.id === nextId);
                    if (found) {
                      const bal = computeCustomerBalance(found, ledger, activeProfile).closingBalance;
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
                  <option value="">-- Select Customer (Blank) --</option>
                  {state.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code}) {c.mobile ? `- ${c.mobile}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Extra Sale Controls (Customer Details, Mode, Transport/Ref, Signature, Received, Remaining, Bill Discount, Previous Balance, Adjust Credit, UPI ID) */}
          {docType === 'SALE' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-4">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Customer Details
                  </label>
                  <input
                    type="text"
                    value={customerDetails}
                    onChange={(e) => setCustomerDetails(e.target.value)}
                    placeholder={
                      selectedCustomer
                        ? `${selectedCustomer.mobile} ${selectedCustomer.address}`
                        : 'Optional mobile / address note'
                    }
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs focus:border-[#0d6e6e] focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-800 mb-1">Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as any)}
                    className="w-full rounded border border-slate-300 bg-slate-100 px-2.5 py-1.5 text-xs focus:border-[#0d6e6e] focus:outline-none"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Card">Card</option>
                    <option value="Bank">Bank</option>
                    <option value="Credit">Credit</option>
                  </select>
                </div>

                <div className="md:col-span-3">
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

                <div className="md:col-span-3">
                  <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <PenTool className="w-3 h-3 text-[#0d6e6e]" />
                      <span>Bill Signature (Company Master)</span>
                    </span>
                    {(billSignatureDataUrl || state.company.signatureDataUrl) && (
                      <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Attached
                      </span>
                    )}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-8 rounded border border-slate-300 bg-slate-50 px-2 flex items-center justify-center overflow-hidden">
                      {billSignatureDataUrl || state.company.signatureDataUrl ? (
                        <img
                          src={billSignatureDataUrl || state.company.signatureDataUrl}
                          alt="Bill Authorized Signature"
                          className="max-h-7 max-w-full object-contain"
                        />
                      ) : (
                        <span className="text-[10px] text-slate-400 truncate">
                          No signature uploaded
                        </span>
                      )}
                    </div>
                    <label
                      title="Upload Authorized Signature for Bill & Company Master"
                      className="inline-flex items-center gap-1 rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold px-2.5 py-1.5 text-[11px] cursor-pointer shrink-0"
                    >
                      <Upload className="w-3 h-3" />
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleBillSignatureUpload(e.target.files?.[0])}
                        className="hidden"
                      />
                    </label>
                    {billSignatureDataUrl && (
                      <button
                        type="button"
                        title="Clear signature from this bill"
                        onClick={() => setBillSignatureDataUrl('')}
                        className="rounded border border-slate-300 hover:bg-red-50 hover:border-red-300 text-slate-600 hover:text-red-600 p-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Bill Discount (Cash)
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

                <div className="md:col-span-3">
                  <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={adjustCreditedAmount}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setAdjustCreditedAmount(checked);
                        if (checked && !adjustedCreditInput && customerLedgerBalance < 0) {
                          setAdjustedCreditInput(String(Math.abs(customerLedgerBalance)));
                        }
                      }}
                      className="rounded border-slate-300 text-[#0d6e6e] focus:ring-[#0d6e6e]"
                    />
                    <span>Adjust credited amount (-)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    disabled={!adjustCreditedAmount}
                    value={adjustedCreditInput}
                    onChange={(e) => setAdjustedCreditInput(e.target.value)}
                    placeholder="Credited Amt to Adjust"
                    className="w-full rounded border border-slate-300 disabled:bg-slate-100 px-2.5 py-1.5 text-xs font-mono focus:border-[#0d6e6e] focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-800 mb-1">Received</label>
                  <input
                    type="number"
                    step="0.01"
                    value={receivedInput}
                    onChange={(e) => setReceivedInput(e.target.value)}
                    placeholder="Enter Received Amount"
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

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-800 mb-1">UPI ID</label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="merchant@upi"
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs font-mono focus:border-[#0d6e6e] focus:outline-none"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Data Grid Table matching exact columns from screenshots */}
        <div className="flex-1 border border-slate-300 rounded bg-slate-50/60 overflow-x-auto min-h-[210px]">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-[#e2e8f0] text-slate-800 border-b border-slate-300 text-left">
                <th className="py-2 px-2.5 border-r border-slate-300 font-semibold">Code</th>
                <th className="py-2 px-2.5 border-r border-slate-300 font-semibold">Name</th>
                {isGstSaleView && (
                  <th className="py-2 px-2.5 border-r border-slate-300 font-semibold">Hsn</th>
                )}
                <th className="py-2 px-2.5 border-r border-slate-300 font-semibold">Unit</th>
                <th className="py-2 px-2.5 border-r border-slate-300 font-semibold text-right">
                  Qty
                </th>
                <th className="py-2 px-2.5 border-r border-slate-300 font-semibold text-right">
                  Rate
                </th>
                {docType === 'SALE' && (
                  <th className="py-2 px-2.5 border-r border-slate-300 font-semibold text-right">
                    Dis 1 %
                  </th>
                )}
                <th className="py-2 px-2.5 border-r border-slate-300 font-semibold text-right">
                  Amount
                </th>
                {isGstSaleView && (
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
                {docType === 'SALE' && (
                  <th className="py-2 px-2.5 border-r border-slate-300 font-semibold text-right">
                    Dis 2 %
                  </th>
                )}
                <th className="py-2 px-2.5 font-semibold">Unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white font-mono">
              {lines.map((line) => {
                const isSelected = line.id === selectedLineId;
                return (
                  <tr
                    key={line.id}
                    onClick={() => setSelectedLineId(line.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-teal-100/80' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-1.5 px-2.5 border-r border-slate-200">{line.code}</td>
                    <td className="py-1.5 px-2.5 border-r border-slate-200 font-sans font-medium">
                      {line.name}
                    </td>
                    {isGstSaleView && (
                      <td className="py-1.5 px-2.5 border-r border-slate-200">
                        {line.hsn || '-'}
                      </td>
                    )}
                    <td className="py-1.5 px-2.5 border-r border-slate-200">{line.unit}</td>
                    <td className="py-1.5 px-2.5 border-r border-slate-200 text-right">
                      {formatNumber(line.qty)}
                    </td>
                    <td className="py-1.5 px-2.5 border-r border-slate-200 text-right">
                      {formatNumber(line.rate)}
                    </td>
                    {docType === 'SALE' && (
                      <td className="py-1.5 px-2.5 border-r border-slate-200 text-right">
                        {formatNumber(line.disc1Percent)}
                      </td>
                    )}
                    <td className="py-1.5 px-2.5 border-r border-slate-200 text-right font-semibold">
                      {formatNumber(line.amount)}
                    </td>
                    {isGstSaleView && (
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
                    {docType === 'SALE' && (
                      <td className="py-1.5 px-2.5 border-r border-slate-200 text-right">
                        {formatNumber(line.disc2Percent)}
                      </td>
                    )}
                    <td className="py-1.5 px-2.5">{line.unit}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bottom Totals, Live Tax Calculations, Draft Status & 10 Action Buttons */}
        <div className="border border-slate-300 rounded p-3 bg-white space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
            <div className="font-mono text-xs sm:text-sm space-y-0.5 text-slate-900">
              <div className="flex flex-wrap gap-6 font-bold">
                <span>TOTAL ITEMS: {lines.length}</span>
                <span>TOTAL QTY: {formatNumber(totalQty)}</span>
                {isGstSaleView && (
                  <>
                    <span className="text-slate-700">
                      BASE: ₹{formatNumber(totalBaseAmount)}
                    </span>
                    <span className="text-[#0d6e6e]">
                      CGST+SGST: ₹{formatNumber(totalCgstAmount)} + ₹
                      {formatNumber(totalSgstAmount)} (₹{formatNumber(totalTaxAmount)})
                    </span>
                  </>
                )}
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
                <span className="text-[#0d6e6e]">
                  TOTAL AMOUNT: ₹{formatNumber(totalAmount)}
                </span>
              </div>
              <div className="flex flex-wrap gap-6 text-slate-700">
                <span>Items Value: {formatNumber(itemsValue)}</span>
                <span>Bill Disc: {formatNumber(billDiscount)}</span>
                <span>Previous Bal: {formatNumber(previousBalance)}</span>
                {adjustCreditedAmount && (
                  <span>Adj. Credit: {formatNumber(adjustedCreditAmount)}</span>
                )}
                <span>Received: {formatNumber(receivedAmount)}</span>
                <span>Pending: {formatNumber(remainingAmount)}</span>
              </div>
            </div>

            {!editingDocId && (lines.length > 0 || customerId || customerDetails) && (
              <div className="flex items-center gap-2 rounded bg-teal-50 border border-teal-200 px-2.5 py-1 text-[11px]">
                <span className="text-[#0d6e6e] font-semibold">
                  ● Draft Auto-Saved in LocalStorage ({lines.length} items)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    notify('Active bill draft cleared from localStorage.', 'info');
                  }}
                  className="rounded bg-white hover:bg-red-50 border border-slate-300 hover:border-red-300 text-red-600 font-bold px-2 py-0.5 cursor-pointer"
                >
                  Clear Draft
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2">
            <button
              type="button"
              onClick={() => {
                if (!selectedLineId) {
                  notify('Click a row in the table first to delete it.', 'info');
                  return;
                }
                setLines((prev) => prev.filter((l) => l.id !== selectedLineId));
                setSelectedLineId(null);
              }}
              className="rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold text-xs py-2.5 px-2 transition-colors cursor-pointer"
            >
              Delete Item
            </button>

            <button
              type="button"
              onClick={handleHoldBill}
              className="rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold text-xs py-2.5 px-2 transition-colors cursor-pointer"
            >
              Hold Bill
            </button>

            <button
              type="button"
              onClick={() => {
                if (editingDocId) {
                  commitTransaction({ category: 'SALE', deleteId: editingDocId });
                  notify('Saved bill deleted.', 'info');
                }
                resetForm();
              }}
              className="rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold text-xs py-2.5 px-2 transition-colors cursor-pointer"
            >
              Delete Bill
            </button>

            <button
              type="button"
              onClick={() => {
                if (lines.length === 0) {
                  notify('Add items to preview/print A4 invoice.', 'error');
                  return;
                }
                setPrintFormat('A4');
                setPrintModalOpen(true);
              }}
              className="rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold text-xs py-2.5 px-2 transition-colors cursor-pointer"
            >
              Print A4
            </button>

            <button
              type="button"
              onClick={() => {
                if (lines.length === 0) {
                  notify('Add items to preview/print A5 invoice.', 'error');
                  return;
                }
                setPrintFormat('A5');
                setPrintModalOpen(true);
              }}
              className="rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold text-xs py-2.5 px-2 transition-colors cursor-pointer"
            >
              Print A5
            </button>

            <button
              type="button"
              onClick={() => {
                if (lines.length === 0) {
                  notify('Add items to preview/print Thermal receipt.', 'error');
                  return;
                }
                setPrintFormat('THERMAL');
                setPrintModalOpen(true);
              }}
              className="rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold text-xs py-2.5 px-2 transition-colors cursor-pointer"
            >
              Thermal
            </button>

            <button
              type="button"
              onClick={() => setResumeModalOpen(true)}
              className="rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold text-xs py-2.5 px-2 transition-colors cursor-pointer"
            >
              Resume Bill ({ledger.heldBills.length})
            </button>

            <button
              type="button"
              onClick={handleSaveDocument}
              className="rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold text-xs py-2.5 px-2 transition-colors cursor-pointer"
            >
              Save (F4)
            </button>

            <button
              type="button"
              onClick={handleTransferProfile}
              className="rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold text-xs py-2.5 px-2 transition-colors cursor-pointer"
            >
              Transfer
            </button>

            <button
              type="button"
              onClick={onExit}
              className="rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold text-xs py-2.5 px-2 transition-colors cursor-pointer"
            >
              Exit
            </button>
          </div>
        </div>
      </div>

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        items={state.items}
        onDetected={handleBarcodeMatch}
      />

      {/* Print & QR Integrity Modal */}
      <ReceiptPrintModal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        format={printFormat}
        setFormat={setPrintFormat}
        document={buildCurrentDocument()}
        company={state.company}
        profile={activeProfile}
        onEmailReceipt={(email) =>
          notify(`Automated receipt with QR integrity hash dispatched to ${email}.`, 'success')
        }
      />

      {/* Resume Held Bill Modal */}
      {resumeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-lg bg-white border border-slate-300 p-4 shadow-xl">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
              Held Bills ({ledger.heldBills.length})
            </h3>
            <div className="mt-3 max-h-60 overflow-y-auto divide-y divide-slate-100">
              {ledger.heldBills.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No held bills in queue.</p>
              ) : (
                ledger.heldBills.map((hb) => (
                  <div
                    key={hb.id}
                    className="py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-800">{hb.label}</p>
                      <p className="text-[10px] text-slate-500">{hb.savedAt.slice(0, 19)}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const payload = hb.payload as SaleDocument;
                          if (payload && payload.lines) {
                            setLines(payload.lines);
                            setCustomerId(payload.customerId || '');
                          }
                          commitTransaction({ category: 'HOLD_BILL', deleteId: hb.id });
                          setResumeModalOpen(false);
                        }}
                        className="bg-[#0d6e6e] text-white px-2.5 py-1 rounded font-semibold cursor-pointer"
                      >
                        Resume
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setResumeModalOpen(false)}
                className="bg-slate-200 text-slate-800 px-3 py-1.5 rounded text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
