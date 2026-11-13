import {
  BillLineItem,
  CurrencyCode,
  CustomerMaster,
  ItemMaster,
  ProfileLedgerData,
  ProfileType,
  PurchaseDocument,
  SupplierMaster,
} from '../types/pos';

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'AED ',
};

export function round2(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function formatMoney(value: number, currency: CurrencyCode = 'INR'): string {
  const num = Number.isFinite(value) ? value : 0;
  return `${CURRENCY_SYMBOLS[currency] || '₹'}${num.toFixed(2)}`;
}

export function formatNumber(value: number): string {
  const num = Number.isFinite(value) ? value : 0;
  return num.toFixed(2);
}

/**
 * Calculates a billing line item for either GST or NON_GST profile.
 * In GST profile:
 *   Base Price + GST (CGST + SGST) = Selling Price (Rate).
 *   For example, if Rate = 5.00 and Base Price = 4.50 (with 5% GST = 2.50% CGST + 2.50% SGST),
 *   Base Price (4.50) + GST (0.50) = 5.00 Selling Price.
 * In NON_GST profile:
 *   Direct Selling Price (Rate) is used without Base Price, HSN, CGST, or SGST.
 */
export function calculateBillLine(params: {
  profile: ProfileType;
  itemId: string;
  code: string;
  barcode: string;
  name: string;
  hsn: string;
  unit: string;
  qty: number;
  basePriceInput?: number;
  rateInput: number;
  disc1Percent?: number;
  disc2Percent?: number;
  gstPercentInput?: number;
}): BillLineItem {
  const qty = Math.max(0, Number(params.qty) || 0);
  const rate = Math.max(0, Number(params.rateInput) || 0);
  const disc1 = Math.min(100, Math.max(0, Number(params.disc1Percent) || 0));
  const disc2 = Math.min(100, Math.max(0, Number(params.disc2Percent) || 0));

  const grossSellingTotal = qty * rate;
  const afterDisc1 = grossSellingTotal * (1 - disc1 / 100);
  const netSellingAmount = round2(afterDisc1 * (1 - disc2 / 100));
  const discountFactor = (1 - disc1 / 100) * (1 - disc2 / 100);

  if (params.profile === 'NON_GST') {
    return {
      id: `${params.itemId || params.code}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      itemId: params.itemId,
      code: params.code,
      barcode: params.barcode,
      name: params.name,
      hsn: '',
      unit: params.unit || 'PCS',
      qty,
      basePrice: 0,
      rate: round2(rate),
      disc1Percent: round2(disc1),
      disc2Percent: round2(disc2),
      gstPercent: 0,
      cgst: 0,
      sgst: 0,
      amount: netSellingAmount,
    };
  }

  const gstPercent = Math.max(0, Number(params.gstPercentInput ?? 5));
  let unitBasePrice = Number(params.basePriceInput);
  if (!Number.isFinite(unitBasePrice) || unitBasePrice <= 0 || unitBasePrice > rate) {
    unitBasePrice = round2(rate - (rate * gstPercent) / 100);
    if (unitBasePrice <= 0) {
      unitBasePrice = round2(rate / (1 + gstPercent / 100));
    }
  }

  const lineBaseTotal = round2(qty * unitBasePrice * discountFactor);
  const totalTaxForLine = round2(Math.max(0, netSellingAmount - lineBaseTotal));
  const cgst = round2(totalTaxForLine / 2);
  const sgst = round2(totalTaxForLine - cgst);

  return {
    id: `${params.itemId || params.code}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    itemId: params.itemId,
    code: params.code,
    barcode: params.barcode,
    name: params.name,
    hsn: params.hsn || '',
    unit: params.unit || 'PCS',
    qty,
    basePrice: round2(unitBasePrice),
    rate: round2(rate),
    disc1Percent: round2(disc1),
    disc2Percent: round2(disc2),
    gstPercent: round2(gstPercent),
    cgst,
    sgst,
    amount: netSellingAmount,
  };
}

/**
 * Generates deterministic cryptographic integrity hash for QR codes on bills.
 */
export function computeBillIntegrityHash(payload: {
  invoiceNo: string;
  date: string;
  profile: ProfileType;
  customerName: string;
  totalAmount: number;
  itemsCount: number;
}): string {
  const raw = `${payload.profile}|${payload.invoiceNo}|${payload.date}|${payload.customerName.trim().toUpperCase()}|${payload.totalAmount.toFixed(2)}|${payload.itemsCount}`;
  let h1 = 0xdeadbeef ^ raw.length;
  let h2 = 0x41c6ce57 ^ raw.length;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `KPOS-${hex1}-${hex2}`.toUpperCase();
}

export function buildBillQrData(params: {
  firmName: string;
  upiId: string;
  invoiceNo: string;
  date: string;
  customerName: string;
  totalAmount: number;
  qrSignatureHash: string;
}): string {
  if (params.upiId && params.upiId.includes('@')) {
    const note = encodeURIComponent(`Bill ${params.invoiceNo} | ${params.qrSignatureHash}`);
    const payeeName = encodeURIComponent(params.firmName || 'Kanha POS');
    return `upi://pay?pa=${encodeURIComponent(params.upiId.trim())}&pn=${payeeName}&am=${params.totalAmount.toFixed(2)}&cu=INR&tn=${note}`;
  }
  return JSON.stringify({
    v: 'KANHA-POS-QR-v2.5',
    inv: params.invoiceNo,
    dt: params.date,
    cust: params.customerName || 'Walk-in',
    amt: params.totalAmount.toFixed(2),
    sig: params.qrSignatureHash,
  });
}

/**
 * Today's Cash formula (v2.4.0):
 * Today's Cash = today's Sale/POS bill amount - today's Journal/Expense amount
 * Profile-specific and does not carry forward previous-day opening/closing cash.
 */
export function computeTodaysCash(ledger: ProfileLedgerData, targetDateIso: string): {
  saleAmount: number;
  expenseAmount: number;
  todaysCash: number;
} {
  const saleAmount = round2(
    ledger.sales
      .filter((s) => s.docType === 'SALE' && s.date === targetDateIso)
      .reduce((acc, s) => acc + s.totalAmount, 0)
  );
  const expenseAmount = round2(
    ledger.vouchers
      .filter((v) => v.voucherType === 'JOURNAL' && v.date === targetDateIso)
      .reduce((acc, v) => acc + v.amount, 0)
  );
  return {
    saleAmount,
    expenseAmount,
    todaysCash: round2(saleAmount - expenseAmount),
  };
}

/**
 * Date-wise Today's Cash Report rows
 */
export function buildTodaysCashReport(ledger: ProfileLedgerData): {
  date: string;
  saleAmount: number;
  expenseAmount: number;
  todaysCash: number;
}[] {
  const dates = new Set<string>();
  ledger.sales.filter((s) => s.docType === 'SALE').forEach((s) => dates.add(s.date));
  ledger.vouchers.filter((v) => v.voucherType === 'JOURNAL').forEach((v) => dates.add(v.date));

  return Array.from(dates)
    .sort((a, b) => b.localeCompare(a))
    .map((date) => {
      const { saleAmount, expenseAmount, todaysCash } = computeTodaysCash(ledger, date);
      return { date, saleAmount, expenseAmount, todaysCash };
    });
}

/**
 * Cash Balance Rule (v2.3.1):
 * Profile Cash Opening + cash sale/receipt inflows - cash purchase payments
 * - supplier payment vouchers - bank vouchers paid from cash - journal/expense vouchers paid from cash.
 */
export function computeRunningCashBalance(ledger: ProfileLedgerData): number {
  let balance = Number(ledger.cashOpeningBalance) || 0;

  for (const s of ledger.sales) {
    if (s.docType === 'SALE' && s.paymentMode === 'Cash') {
      balance += Number(s.receivedAmount) || 0;
    }
  }
  for (const p of ledger.purchases) {
    if (p.docType === 'PURCHASE' && p.paymentMode === 'Cash') {
      balance -= Number(p.paidAmount) || 0;
    }
  }
  for (const v of ledger.vouchers) {
    const isCash = (v.paymentMode || '').toLowerCase() === 'cash';
    if (!isCash) continue;
    if (v.voucherType === 'RECEIPT') {
      balance += Number(v.amount) || 0;
    } else if (
      v.voucherType === 'PAYMENT' ||
      v.voucherType === 'BANK' ||
      v.voucherType === 'JOURNAL'
    ) {
      balance -= Number(v.amount) || 0;
    }
  }
  return round2(balance);
}

/**
 * Customer Balance Rule (v2.3.1):
 * Opening Balance + Sale Invoice Total - Amount Received on Sale Invoices - Customer Receipt Vouchers - Credit Notes.
 * Bank vouchers and Journal expense heads never change a customer balance.
 */
export function computeCustomerBalance(
  customer: CustomerMaster,
  ledger: ProfileLedgerData,
  profile: ProfileType
): {
  opening: number;
  billed: number;
  receivedOnBills: number;
  receiptVouchers: number;
  creditNotes: number;
  closingBalance: number;
} {
  const opening =
    profile === 'GST'
      ? Number(customer.openingBalanceGst) || 0
      : Number(customer.openingBalanceNonGst) || 0;

  const matchesCustomer = (id: string, name: string) =>
    (id && id === customer.id) ||
    (name &&
      (name.trim().toLowerCase() === customer.name.trim().toLowerCase() ||
        name.trim().toLowerCase() === customer.code.trim().toLowerCase()));

  let billed = 0;
  let receivedOnBills = 0;
  let creditNotes = 0;

  for (const s of ledger.sales) {
    if (!matchesCustomer(s.customerId, s.customerName)) continue;
    if (s.docType === 'SALE') {
      billed += Number(s.totalAmount) || 0;
      receivedOnBills += Number(s.receivedAmount) || 0;
    } else if (s.docType === 'CREDIT_NOTE') {
      creditNotes += Number(s.totalAmount) || 0;
    }
  }

  let receiptVouchers = 0;
  for (const v of ledger.vouchers) {
    if (v.voucherType === 'RECEIPT' && matchesCustomer(v.partyId, v.partyName)) {
      receiptVouchers += Number(v.amount) || 0;
    }
  }

  const closingBalance = round2(opening + billed - receivedOnBills - receiptVouchers - creditNotes);
  return {
    opening: round2(opening),
    billed: round2(billed),
    receivedOnBills: round2(receivedOnBills),
    receiptVouchers: round2(receiptVouchers),
    creditNotes: round2(creditNotes),
    closingBalance,
  };
}

/**
 * Supplier Balance Rule (v2.3.1):
 * Opening Balance + Purchase Invoice Total - Amount Paid On Purchase Invoices - Supplier Payment Vouchers.
 * Purchase returns remain adjustment-only under the v2.3.0+ workflow.
 * Bank vouchers and Journal expense heads never change a supplier balance.
 */
export function computeSupplierBalance(
  supplier: SupplierMaster,
  ledger: ProfileLedgerData,
  profile: ProfileType
): {
  opening: number;
  purchased: number;
  paidOnInvoices: number;
  paymentVouchers: number;
  closingBalance: number;
} {
  const opening =
    profile === 'GST'
      ? Number(supplier.openingBalanceGst) || 0
      : Number(supplier.openingBalanceNonGst) || 0;

  const matchesSupplier = (id: string, name: string) =>
    (id && id === supplier.id) ||
    (name &&
      (name.trim().toLowerCase() === supplier.name.trim().toLowerCase() ||
        name.trim().toLowerCase() === supplier.code.trim().toLowerCase()));

  let purchased = 0;
  let paidOnInvoices = 0;

  for (const p of ledger.purchases) {
    if (p.docType === 'PURCHASE' && matchesSupplier(p.supplierId, p.supplierName)) {
      purchased += Number(p.totalAmount) || 0;
      paidOnInvoices += Number(p.paidAmount) || 0;
    }
  }

  let paymentVouchers = 0;
  for (const v of ledger.vouchers) {
    if (v.voucherType === 'PAYMENT' && matchesSupplier(v.partyId, v.partyName)) {
      paymentVouchers += Number(v.amount) || 0;
    }
  }

  const closingBalance = round2(opening + purchased - paidOnInvoices - paymentVouchers);
  return {
    opening: round2(opening),
    purchased: round2(purchased),
    paidOnInvoices: round2(paidOnInvoices),
    paymentVouchers: round2(paymentVouchers),
    closingBalance,
  };
}

/**
 * FIFO Supplier Purchase History (v2.4.0):
 * Payment vouchers are applied deterministically FIFO:
 * 1) Supplier opening payable first
 * 2) Oldest unpaid purchase bills
 * Status is "Fully Paid" when nothing remains, otherwise "Unpaid".
 */
export interface SupplierBillAllocationRow {
  purchase: PurchaseDocument;
  date: string;
  billNo: string;
  invoiceNo: string;
  supplierName: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  status: 'Fully Paid' | 'Unpaid';
  type: 'Purchase Bill';
}

export function computeSupplierPurchaseHistoryFIFO(
  supplier: SupplierMaster,
  ledger: ProfileLedgerData,
  profile: ProfileType
): SupplierBillAllocationRow[] {
  const matchesSupplier = (id: string, name: string) =>
    (id && id === supplier.id) ||
    (name &&
      (name.trim().toLowerCase() === supplier.name.trim().toLowerCase() ||
        name.trim().toLowerCase() === supplier.code.trim().toLowerCase()));

  const opening =
    profile === 'GST'
      ? Math.max(0, Number(supplier.openingBalanceGst) || 0)
      : Math.max(0, Number(supplier.openingBalanceNonGst) || 0);

  const totalPaymentVouchers = ledger.vouchers
    .filter((v) => v.voucherType === 'PAYMENT' && matchesSupplier(v.partyId, v.partyName))
    .reduce((acc, v) => acc + (Number(v.amount) || 0), 0);

  // Apply FIFO to opening payable first
  let unallocatedVoucherPool = Math.max(0, totalPaymentVouchers - opening);

  const bills = ledger.purchases
    .filter((p) => p.docType === 'PURCHASE' && matchesSupplier(p.supplierId, p.supplierName))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  return bills.map((bill) => {
    const amount = round2(bill.totalAmount);
    const directPaid = round2(Math.min(amount, Number(bill.paidAmount) || 0));
    const initialUnpaid = round2(Math.max(0, amount - directPaid));

    const allocatedFromVouchers = round2(Math.min(initialUnpaid, unallocatedVoucherPool));
    unallocatedVoucherPool = round2(Math.max(0, unallocatedVoucherPool - allocatedFromVouchers));

    const totalPaid = round2(directPaid + allocatedFromVouchers);
    const remaining = round2(Math.max(0, amount - totalPaid));

    return {
      purchase: bill,
      date: bill.date,
      billNo: bill.supplierBillNo || bill.invoiceNo,
      invoiceNo: bill.invoiceNo,
      supplierName: bill.supplierName || supplier.name,
      amount,
      paidAmount: totalPaid,
      remainingAmount: remaining,
      status: remaining <= 0.005 ? 'Fully Paid' : 'Unpaid',
      type: 'Purchase Bill',
    };
  });
}

/**
 * Categorized Item Suggestion Filter:
 * Matches items by word, prefix, substring, code, or barcode and groups them by category.
 */
export function getCategorizedItemSuggestions(
  items: ItemMaster[],
  query: string
): { category: string; items: ItemMaster[] }[] {
  const q = query.trim().toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);

  const filtered =
    tokens.length === 0
      ? items
      : items.filter((item) => {
          const haystack = `${item.name} ${item.code} ${item.barcode} ${item.category} ${item.hsnCode}`.toLowerCase();
          return tokens.every((token) => haystack.includes(token));
        });

  const groups = new Map<string, ItemMaster[]>();
  for (const item of filtered) {
    const cat = item.category?.trim() || 'General Items';
    const list = groups.get(cat) || [];
    list.push(item);
    groups.set(cat, list);
  }

  return Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([category, groupItems]) => ({
      category,
      items: groupItems.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

/**
 * Evaluates a batch expiry date against today's date (or referenceDateIso)
 * and flags batches expiring within 30 days ('EXPIRING_SOON') or already expired ('EXPIRED').
 */
export function getBatchExpiryStatus(
  expiryDateIso: string,
  referenceDateIso?: string
): {
  status: 'EXPIRED' | 'EXPIRING_SOON' | 'VALID' | 'NO_EXPIRY';
  daysRemaining: number;
} {
  if (!expiryDateIso || !/^\d{4}-\d{2}-\d{2}/.test(expiryDateIso)) {
    return { status: 'NO_EXPIRY', daysRemaining: 9999 };
  }
  const refStr = referenceDateIso || new Date().toISOString().slice(0, 10);
  const refMs = Date.parse(`${refStr.slice(0, 10)}T00:00:00Z`);
  const expMs = Date.parse(`${expiryDateIso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(expMs) || Number.isNaN(refMs)) {
    return { status: 'NO_EXPIRY', daysRemaining: 9999 };
  }
  const daysRemaining = Math.round((expMs - refMs) / (1000 * 60 * 60 * 24));
  if (daysRemaining < 0) {
    return { status: 'EXPIRED', daysRemaining };
  }
  if (daysRemaining <= 30) {
    return { status: 'EXPIRING_SOON', daysRemaining };
  }
  return { status: 'VALID', daysRemaining };
}

export function getItemBatchExpirySummary(
  item: ItemMaster,
  referenceDateIso?: string
): {
  totalBatches: number;
  expiredCount: number;
  expiringSoonCount: number;
  nearestBatch?: {
    batchNo: string;
    expiryDate: string;
    daysRemaining: number;
    status: 'EXPIRED' | 'EXPIRING_SOON' | 'VALID' | 'NO_EXPIRY';
    qty: number;
  };
} {
  const batches = Array.isArray(item.batches) ? item.batches : [];
  if (batches.length === 0) {
    return { totalBatches: 0, expiredCount: 0, expiringSoonCount: 0 };
  }

  let expiredCount = 0;
  let expiringSoonCount = 0;
  let nearestBatch:
    | {
        batchNo: string;
        expiryDate: string;
        daysRemaining: number;
        status: 'EXPIRED' | 'EXPIRING_SOON' | 'VALID' | 'NO_EXPIRY';
        qty: number;
      }
    | undefined;

  for (const b of batches) {
    const evalRes = getBatchExpiryStatus(b.expiryDate, referenceDateIso);
    if (evalRes.status === 'EXPIRED') expiredCount += 1;
    else if (evalRes.status === 'EXPIRING_SOON') expiringSoonCount += 1;

    if (!nearestBatch || evalRes.daysRemaining < nearestBatch.daysRemaining) {
      nearestBatch = {
        batchNo: b.batchNo,
        expiryDate: b.expiryDate,
        daysRemaining: evalRes.daysRemaining,
        status: evalRes.status,
        qty: b.qty,
      };
    }
  }

  return {
    totalBatches: batches.length,
    expiredCount,
    expiringSoonCount,
    nearestBatch,
  };
}

/**
 * Builds the last 7 days of Daily Sales Trend data for the active profile.
 */
export function buildLast7DaysSalesTrend(
  ledger: ProfileLedgerData,
  endDateIso?: string
): {
  dateIso: string;
  label: string;
  totalSales: number;
  billCount: number;
}[] {
  const baseIso = endDateIso || new Date().toISOString().slice(0, 10);
  const baseDate = new Date(`${baseIso}T00:00:00Z`);
  const result: {
    dateIso: string;
    label: string;
    totalSales: number;
    billCount: number;
  }[] = [];

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let offset = 6; offset >= 0; offset--) {
    const d = new Date(baseDate.getTime() - offset * 24 * 60 * 60 * 1000);
    const iso = d.toISOString().slice(0, 10);
    const dayNum = String(d.getUTCDate()).padStart(2, '0');
    const mon = monthNames[d.getUTCMonth()];

    const daySalesDocs = ledger.sales.filter((s) => s.docType === 'SALE' && s.date === iso);
    const totalSales = round2(daySalesDocs.reduce((acc, s) => acc + (Number(s.totalAmount) || 0), 0));

    result.push({
      dateIso: iso,
      label: offset === 0 ? `${dayNum} ${mon} (Today)` : `${dayNum} ${mon}`,
      totalSales,
      billCount: daySalesDocs.length,
    });
  }

  return result;
}

