import {
  BankMaster,
  BillLineItem,
  CompanyMaster,
  CrmFollowUp,
  CustomerMaster,
  HsnMaster,
  ItemMaster,
  ItemStockBatch,
  ProfileType,
  PurchaseDocument,
  PurchaseOrderDocument,
  SaleDocument,
  ServerState,
  SupplierMaster,
  VoucherDocument,
} from '../types/pos';

export const SUPPORTED_POS_EXTENSIONS = [
  '.kpd',
  '.json',
  '.zip',
  '.bak',
  '.dat',
  '.xml',
] as const;

export const SUPPORTED_POS_MIME_TYPES = [
  '',
  'application/octet-stream',
  'application/x-kpd',
  'application/kpd',
  'application/json',
  'text/json',
  'application/ld+json',
  'application/zip',
  'application/x-zip',
  'application/x-zip-compressed',
  'multipart/x-zip',
  'application/x-compressed',
  'text/plain',
  'application/xml',
  'text/xml',
  'application/x-bak',
  'application/x-dat',
] as const;

const DISALLOWED_MIME_PREFIXES = [
  'image/',
  'video/',
  'audio/',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument',
  'application/x-msdownload',
  'application/x-executable',
];

const IGNORED_SYSTEM_FILENAMES = new Set([
  'desktop.ini',
  'thumbs.db',
  '.ds_store',
  'icon\r',
]);

export interface FileValidationIssue {
  fileName: string;
  mimeType: string;
  extension: string;
  reason: string;
}

export interface FileSelectionValidationResult {
  valid: boolean;
  validFiles: File[];
  rejectedFiles: FileValidationIssue[];
  errorMessage?: string;
}

/**
 * Explicitly validates file extensions and MIME types for all Database Settings file pickers
 * across Windows (.NET WebView2 / Desktop browsers) and Android (Document Picker / Chrome).
 */
export function validateDatabaseFilesSelection(
  fileList: FileList | File[] | null | undefined,
  mode: 'FILE' | 'FOLDER' = 'FILE'
): FileSelectionValidationResult {
  if (!fileList || fileList.length === 0) {
    return {
      valid: false,
      validFiles: [],
      rejectedFiles: [],
      errorMessage: 'No file was selected. Please choose a valid .kpd, .json, .zip, .bak, or .dat file.',
    };
  }

  const rawFiles = Array.from(fileList);
  const validFiles: File[] = [];
  const rejectedFiles: FileValidationIssue[] = [];

  for (const file of rawFiles) {
    const rawName = ((file as any).webkitRelativePath || file.name || '').trim();
    const baseName = rawName.split(/[/\\]/).pop() || rawName;
    const lowerBase = baseName.toLowerCase();

    // Automatically skip OS folder metadata files during folder import
    if (mode === 'FOLDER' && (IGNORED_SYSTEM_FILENAMES.has(lowerBase) || lowerBase.startsWith('.'))) {
      continue;
    }

    const dotIdx = lowerBase.lastIndexOf('.');
    const ext = dotIdx >= 0 ? lowerBase.slice(dotIdx) : '';
    const mime = (file.type || '').trim().toLowerCase();

    // 1. Check for explicitly disallowed media/document/executable MIME types
    const isDisallowedMime = DISALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix));
    if (isDisallowedMime) {
      rejectedFiles.push({
        fileName: baseName,
        mimeType: mime || 'unknown',
        extension: ext || '(none)',
        reason: `Unsupported MIME type "${mime}". Images, PDFs, Office docs, and executables cannot be imported.`,
      });
      continue;
    }

    // 2. Check extension against supported Kanha POS extensions
    const hasSupportedExtension = SUPPORTED_POS_EXTENSIONS.some((allowedExt) =>
      lowerBase.endsWith(allowedExt)
    );

    // On Android content:// URIs, some file managers strip or alter the extension in file.name
    // If extension is missing on Android but MIME is application/octet-stream or application/json or zip, check carefully
    const isAndroidContentFallback =
      !ext &&
      (mime === 'application/octet-stream' ||
        mime === 'application/json' ||
        mime === 'application/zip' ||
        mime === 'application/x-zip-compressed');

    if (!hasSupportedExtension && !isAndroidContentFallback) {
      rejectedFiles.push({
        fileName: baseName,
        mimeType: mime || 'application/octet-stream',
        extension: ext || '(no extension)',
        reason: `Unsupported file extension "${ext || 'none'}". Allowed extensions: ${SUPPORTED_POS_EXTENSIONS.join(', ')}.`,
      });
      continue;
    }

    // 3. Validate MIME type:
    // Custom extensions (.kpd, .bak, .dat) normally report '' or 'application/octet-stream' on Windows & Android.
    const isAllowedMime =
      SUPPORTED_POS_MIME_TYPES.includes(mime as any) ||
      mime.endsWith('+json') ||
      mime.endsWith('+xml') ||
      mime.includes('zip') ||
      mime.includes('json') ||
      mime.includes('octet-stream') ||
      mime.includes('text/');

    if (!isAllowedMime) {
      rejectedFiles.push({
        fileName: baseName,
        mimeType: mime,
        extension: ext,
        reason: `Unrecognized MIME type "${mime}" for file "${baseName}".`,
      });
      continue;
    }

    if (file.size === 0) {
      rejectedFiles.push({
        fileName: baseName,
        mimeType: mime || 'empty',
        extension: ext,
        reason: `File "${baseName}" is empty (0 bytes).`,
      });
      continue;
    }

    validFiles.push(file);
  }

  if (validFiles.length === 0) {
    const firstIssue = rejectedFiles[0];
    const detail = firstIssue
      ? `${firstIssue.reason}`
      : 'No supported Kanha POS data files (.kpd, .json, .zip, .bak, .dat) were found.';
    return {
      valid: false,
      validFiles: [],
      rejectedFiles,
      errorMessage: `Invalid File Selected: ${detail} Please choose a valid Kanha POS backup (.kpd), JSON export (.json), or compressed PosData archive (.zip).`,
    };
  }

  // In single/multi file picker mode, if any file was explicitly rejected, block and warn the user
  if (mode === 'FILE' && rejectedFiles.length > 0) {
    const names = rejectedFiles.map((r) => `${r.fileName} (${r.reason})`).join('; ');
    return {
      valid: false,
      validFiles: [],
      rejectedFiles,
      errorMessage: `Invalid File Type Rejected: ${names}`,
    };
  }

  return {
    valid: true,
    validFiles,
    rejectedFiles,
  };
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function getField(obj: Record<string, any>, ...keys: string[]): any {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  const lowerMap = new Map<string, string>();
  for (const actualKey of Object.keys(obj)) {
    lowerMap.set(actualKey.toLowerCase().replace(/[_-\s]/g, ''), actualKey);
  }
  for (const k of keys) {
    const match = lowerMap.get(k.toLowerCase().replace(/[_-\s]/g, ''));
    if (match !== undefined && obj[match] !== undefined && obj[match] !== null) {
      return obj[match];
    }
  }
  return undefined;
}

export interface KanhaStructureValidationResult {
  isValidKanhaFormat: boolean;
  matchedSections: string[];
  errorMessage?: string;
}

const KANHA_CONTAINER_KEYS = [
  'state',
  'data',
  'database',
  'store',
  'payload',
  'backup',
  'posData',
  'masters',
  'commonMasters',
  'transactions',
  'ledger',
  'newDataSet',
  'kanhaData',
  'posDatabase',
  'kpdBackup',
];

const KANHA_RECOGNIZED_SECTION_KEYS = [
  // Masters
  'items',
  'itemMaster',
  'itemList',
  'products',
  'productMaster',
  'inventory',
  'stockItems',
  'customers',
  'customerMaster',
  'customerList',
  'parties',
  'buyers',
  'suppliers',
  'supplierMaster',
  'supplierList',
  'vendors',
  'vendorMaster',
  'hsnCodes',
  'hsns',
  'hsnMaster',
  'hsnList',
  'taxCodes',
  'banks',
  'bankMaster',
  'bankList',
  'bankAccounts',
  'company',
  'companyMaster',
  'firm',
  'firmInfo',
  'settings',
  // Profiles & Ledgers
  'profiles',
  'gstProfile',
  'nonGstProfile',
  'GST',
  'NON_GST',
  'sales',
  'saleBills',
  'bills',
  'invoices',
  'taxInvoices',
  'posBills',
  'stockOuts',
  'stockOutBills',
  'stockOutList',
  'creditNotes',
  'saleReturns',
  'creditNoteBills',
  'salesReturns',
  'purchases',
  'purchaseBills',
  'purchaseInvoices',
  'purchaseList',
  'purchaseReturns',
  'purchaseReturnBills',
  'debitNotes',
  'vouchers',
  'accountVouchers',
  'receipts',
  'receiptVouchers',
  'payments',
  'paymentVouchers',
  'journalVouchers',
  'journals',
  'expenses',
  'bankVouchers',
  'purchaseOrders',
  'poList',
  'crmFollowUps',
  'followUps',
  // System & Backup envelope keys
  'firmId',
  'dataProfile',
  'cloudBackups',
  'auditLogs',
  'users',
  'devices',
  'stores',
  'cashOpeningBalance',
  'counters',
];

const KANHA_ARRAY_RECORD_FIELDS = [
  'itemCode',
  'productCode',
  'sellingPrice',
  'basePrice',
  'stockQty',
  'minStockLevel',
  'hsnCode',
  'gstPercent',
  'cgstAmount',
  'sgstAmount',
  'customerCode',
  'customerName',
  'openingBalanceGst',
  'openingBalanceNonGst',
  'supplierCode',
  'supplierName',
  'supplierBillNo',
  'bankName',
  'accountNo',
  'ifsc',
  'invoiceNo',
  'billNo',
  'voucherNo',
  'voucherType',
  'docType',
  'qrSignatureHash',
  'itemsValue',
  'receivedAmount',
  'paidAmount',
];

/**
 * Validates whether a parsed payload matches the expected Kanha POS system format
 * (Windows .NET C# export, Android POS export, or Web .kpd / .json structure).
 */
export function validateKanhaPayloadStructure(
  rawPayload: any,
  fileNameHint = ''
): KanhaStructureValidationResult {
  if (rawPayload === null || rawPayload === undefined) {
    return {
      isValidKanhaFormat: false,
      matchedSections: [],
      errorMessage:
        'The file is empty or contains null data and does not match the Kanha POS system format.',
    };
  }

  const matchedSections: string[] = [];
  const upperHint = fileNameHint.toUpperCase();

  if (Array.isArray(rawPayload)) {
    if (rawPayload.length === 0) {
      // An empty JSON array is valid if the filename is a known PosData table file
      if (
        /ITEM|CUSTOMER|SUPPLIER|SALE|BILL|INVOICE|PURCHASE|VOUCHER|HSN|BANK|POS|KANHA|GST/i.test(
          upperHint
        )
      ) {
        return { isValidKanhaFormat: true, matchedSections: ['EmptyKanhaTableArray'] };
      }
      return {
        isValidKanhaFormat: false,
        matchedSections: [],
        errorMessage:
          'The selected file contains an empty array with no recognizable Kanha POS table structure.',
      };
    }

    const sample = rawPayload.find((el) => el && typeof el === 'object') || {};
    const matchedFields = KANHA_ARRAY_RECORD_FIELDS.filter(
      (f) => getField(sample, f) !== undefined
    );

    if (
      matchedFields.length > 0 ||
      (getField(sample, 'code', 'name') !== undefined &&
        getField(sample, 'rate', 'price', 'mobile', 'gstin', 'amount', 'qty', 'stock') !==
          undefined)
    ) {
      return {
        isValidKanhaFormat: true,
        matchedSections: [`ArrayRecords(${matchedFields.slice(0, 4).join(',') || 'MasterOrBill'})`],
      };
    }

    return {
      isValidKanhaFormat: false,
      matchedSections: [],
      errorMessage:
        'Unrecognized JSON Array Structure: The records in this file do not contain expected Kanha POS fields (such as Item Code/SellingPrice, Customer/Supplier details, or Bill InvoiceNo/Lines).',
    };
  }

  if (typeof rawPayload === 'object') {
    const candidates: Record<string, any>[] = [rawPayload];
    for (const containerKey of KANHA_CONTAINER_KEYS) {
      const sub = getField(rawPayload, containerKey);
      if (sub && typeof sub === 'object' && !Array.isArray(sub)) {
        candidates.push(sub);
      }
    }

    for (const candidate of candidates) {
      for (const sectionKey of KANHA_RECOGNIZED_SECTION_KEYS) {
        const val = getField(candidate, sectionKey);
        if (val !== undefined && val !== null) {
          matchedSections.push(sectionKey);
        }
      }
    }

    // Also check if it's a single Kanha record object (e.g. a single exported invoice or company master)
    if (matchedSections.length === 0) {
      const singleRecordMatches = KANHA_ARRAY_RECORD_FIELDS.filter(
        (f) => getField(rawPayload, f) !== undefined
      );
      if (singleRecordMatches.length >= 2) {
        matchedSections.push(`SingleRecord(${singleRecordMatches.slice(0, 3).join(',')})`);
      }
    }

    if (matchedSections.length > 0) {
      return {
        isValidKanhaFormat: true,
        matchedSections: Array.from(new Set(matchedSections)),
      };
    }
  }

  return {
    isValidKanhaFormat: false,
    matchedSections: [],
    errorMessage:
      'Invalid Kanha System Format: The file structure does not match the expected Kanha POS database schema. Expected Common Masters (items, customers, suppliers, hsnCodes, banks, company) or Profile Ledger data (GST / NON_GST sales, purchases, vouchers).',
  };
}

function normalizeLineItem(raw: Record<string, any>, idx: number, profile: ProfileType): BillLineItem {
  const qty = round2(
    Number(
      getField(
        raw,
        'qty',
        'quantity',
        'Qty',
        'Quantity',
        'billQty',
        'saleQty',
        'purQty',
        'purchaseQty',
        'pcs',
        'units',
        'itemQty'
      ) ?? 1
    )
  );
  const rate = round2(
    Number(
      getField(
        raw,
        'rate',
        'sellingPrice',
        'price',
        'unitPrice',
        'saleRate',
        'sRate',
        'purchaseRate',
        'purchasePrice',
        'pRate',
        'mrp',
        'Rate',
        'SellingPrice',
        'Price',
        'MRP'
      ) ?? 0
    )
  );
  const rawCgstPct = Number(getField(raw, 'cgstPercent', 'cgstRate', 'CgstPercent') ?? 0);
  const rawSgstPct = Number(getField(raw, 'sgstPercent', 'sgstRate', 'SgstPercent') ?? 0);
  const explicitGstPct = getField(
    raw,
    'gstPercent',
    'gst',
    'gstRate',
    'taxPercent',
    'taxRate',
    'igst',
    'igstPercent',
    'tax',
    'GstPercent',
    'Gst',
    'GST'
  );
  const gstPercent =
    profile === 'GST'
      ? round2(
          Number(
            explicitGstPct !== undefined
              ? explicitGstPct
              : rawCgstPct + rawSgstPct > 0
              ? rawCgstPct + rawSgstPct
              : 0
          )
        )
      : 0;
  let basePrice =
    profile === 'GST'
      ? round2(
          Number(
            getField(
              raw,
              'basePrice',
              'basicPrice',
              'basicRate',
              'taxableRate',
              'taxableValue',
              'netRate',
              'BasePrice'
            ) ?? 0
          )
        )
      : rate;
  if (profile === 'GST' && basePrice <= 0 && rate > 0) {
    basePrice = gstPercent > 0 ? round2(rate - (rate * gstPercent) / 100) : rate;
  }
  const disc1Percent = round2(
    Number(
      getField(
        raw,
        'disc1Percent',
        'disc1',
        'dis1',
        'discount1',
        'discountPercent',
        'discPercent',
        'discount',
        'Disc1'
      ) ?? 0
    )
  );
  const disc2Percent = round2(
    Number(getField(raw, 'disc2Percent', 'disc2', 'dis2', 'discount2', 'Disc2') ?? 0)
  );
  const amount = round2(
    Number(
      getField(
        raw,
        'amount',
        'total',
        'lineTotal',
        'netAmount',
        'itemAmount',
        'totalAmount',
        'Amount',
        'TotalAmount'
      ) ?? qty * rate * (1 - disc1Percent / 100) * (1 - disc2Percent / 100)
    )
  );
  const totalTax =
    profile === 'GST'
      ? round2(
          Number(
            getField(raw, 'taxAmount', 'gstAmount', 'totalTax', 'igstAmount') ??
              Math.max(0, (rate - basePrice) * qty)
          )
        )
      : 0;
  const cgst =
    profile === 'GST'
      ? round2(Number(getField(raw, 'cgst', 'cgstAmount', 'Cgst', 'CGST') ?? totalTax / 2))
      : 0;
  const sgst =
    profile === 'GST'
      ? round2(Number(getField(raw, 'sgst', 'sgstAmount', 'Sgst', 'SGST') ?? totalTax - cgst))
      : 0;
  const code = String(
    getField(raw, 'code', 'itemCode', 'productCode', 'sku', 'Code', 'ItemCode') ?? `ITM${idx + 1}`
  ).trim();

  return {
    id: String(getField(raw, 'id', 'lineId', 'Id') ?? `ln-${Date.now()}-${idx}`),
    itemId: String(getField(raw, 'itemId', 'productId', 'ItemId') ?? ''),
    code,
    barcode: String(getField(raw, 'barcode', 'barCode', 'ean', 'Barcode') ?? code).trim(),
    name: String(
      getField(
        raw,
        'name',
        'itemName',
        'productName',
        'description',
        'particulars',
        'Name',
        'ItemName'
      ) ?? code
    ).trim(),
    hsn: String(
      getField(raw, 'hsn', 'hsnCode', 'hsnNo', 'sac', 'sacCode', 'Hsn', 'HsnCode', 'HSN') ?? ''
    ).trim(),
    unit: String(getField(raw, 'unit', 'uom', 'unitName', 'Unit', 'Uom') ?? 'PCS').trim(),
    qty: qty > 0 ? qty : 1,
    basePrice,
    rate,
    disc1Percent,
    disc2Percent,
    gstPercent,
    cgst,
    sgst,
    amount,
  };
}

export function normalizeItemMaster(raw: Record<string, any>, idx: number): ItemMaster {
  const code = String(
    getField(raw, 'code', 'itemCode', 'productCode', 'sku', 'itemNo', 'Code', 'ItemCode') ??
      `ITM${String(idx + 1).padStart(4, '0')}`
  ).trim();
  const sellingPrice = round2(
    Number(
      getField(
        raw,
        'sellingPrice',
        'rate',
        'saleRate',
        'sRate',
        's_rate',
        'price',
        'mrp',
        'sellingRate',
        'unitPrice',
        'retailPrice',
        'SellingPrice',
        'Rate',
        'MRP'
      ) ?? 0
    )
  );
  const rawCgstPct = Number(getField(raw, 'cgstPercent', 'cgstRate', 'CgstPercent') ?? 0);
  const rawSgstPct = Number(getField(raw, 'sgstPercent', 'sgstRate', 'SgstPercent') ?? 0);
  const explicitGst = getField(
    raw,
    'gstPercent',
    'gst',
    'gstRate',
    'taxRate',
    'taxPercent',
    'igst',
    'igstPercent',
    'tax',
    'GstPercent',
    'Gst',
    'GST'
  );
  const gstPercent = round2(
    Number(
      explicitGst !== undefined
        ? explicitGst
        : rawCgstPct + rawSgstPct > 0
        ? rawCgstPct + rawSgstPct
        : 5
    )
  );
  let basePrice = round2(
    Number(
      getField(
        raw,
        'basePrice',
        'basicPrice',
        'basicRate',
        'taxableValue',
        'taxableRate',
        'netRate',
        'BasePrice'
      ) ?? 0
    )
  );
  if (basePrice <= 0 && sellingPrice > 0) {
    basePrice =
      gstPercent > 0 ? round2(sellingPrice - (sellingPrice * gstPercent) / 100) : sellingPrice;
  }
  const totalGst = Math.max(0, round2(sellingPrice - basePrice));
  const cgstAmount = round2(
    Number(getField(raw, 'cgstAmount', 'cgst', 'CgstAmount', 'Cgst', 'CGST') ?? totalGst / 2)
  );
  const sgstAmount = round2(
    Number(
      getField(raw, 'sgstAmount', 'sgst', 'SgstAmount', 'Sgst', 'SGST') ?? totalGst - cgstAmount
    )
  );

  return {
    id: String(getField(raw, 'id', 'itemId', 'Id', 'ItemId') ?? `itm-${idx + 1}-${code}`),
    code: code || `ITM${String(idx + 1).padStart(4, '0')}`,
    barcode: String(
      getField(raw, 'barcode', 'barCode', 'ean', 'upc', 'Barcode', 'BarCode') ?? code
    ).trim(),
    name: String(
      getField(
        raw,
        'name',
        'itemName',
        'productName',
        'title',
        'description',
        'particulars',
        'Name',
        'ItemName'
      ) ?? `Item ${idx + 1}`
    ).trim(),
    category: String(
      getField(
        raw,
        'category',
        'categoryName',
        'group',
        'itemGroup',
        'department',
        'Category',
        'Group'
      ) ?? 'General Items'
    ).trim(),
    unit: String(getField(raw, 'unit', 'uom', 'unitName', 'Unit', 'Uom') ?? 'PCS').trim(),
    hsnCode: String(
      getField(raw, 'hsnCode', 'hsn', 'hsnNo', 'sac', 'sacCode', 'HsnCode', 'Hsn', 'HSN') ?? ''
    ).trim(),
    gstPercent,
    basePrice,
    cgstAmount,
    sgstAmount,
    sellingPrice,
    purchasePrice: round2(
      Number(
        getField(
          raw,
          'purchasePrice',
          'purchaseRate',
          'pRate',
          'p_rate',
          'costPrice',
          'cost',
          'buyPrice',
          'buyRate',
          'landingCost',
          'PurchasePrice',
          'PurchaseRate'
        ) ?? 0
      )
    ),
    stockQty: round2(
      Number(
        getField(
          raw,
          'stockQty',
          'stock',
          'quantity',
          'qty',
          'closingStock',
          'currentStock',
          'openingStock',
          'availableQty',
          'availQty',
          'inStock',
          'balQty',
          'StockQty',
          'Stock',
          'Qty',
          'Quantity'
        ) ?? 0
      )
    ),
    minStockLevel: round2(
      Number(
        getField(
          raw,
          'minStockLevel',
          'minStock',
          'reorderLevel',
          'alertQty',
          'minQty',
          'MinStockLevel'
        ) ?? 5
      )
    ),
    batches: Array.isArray(getField(raw, 'batches', 'stockBatches', 'Batches'))
      ? (getField(raw, 'batches', 'stockBatches', 'Batches') as any[]).map(
          (b, bIdx): ItemStockBatch => ({
            id: String(b?.id ?? `bch-${idx + 1}-${bIdx + 1}`),
            batchNo: String(b?.batchNo ?? b?.batch ?? `BATCH-${bIdx + 1}`).trim(),
            mfgDate: b?.mfgDate ? String(b.mfgDate).slice(0, 10) : undefined,
            expiryDate: String(
              b?.expiryDate ?? b?.expDate ?? new Date().toISOString().slice(0, 10)
            ).slice(0, 10),
            qty: round2(Number(b?.qty ?? b?.quantity ?? b?.stockQty ?? 0)),
            mrp: b?.mrp !== undefined ? round2(Number(b.mrp)) : undefined,
            purchaseRate:
              b?.purchaseRate !== undefined ? round2(Number(b.purchaseRate)) : undefined,
          })
        )
      : undefined,
    storeLocation: String(getField(raw, 'storeLocation', 'storeId', 'location') ?? 'STORE-MAIN'),
    updatedAt: String(
      getField(raw, 'updatedAt', 'modifiedAt', 'createdAt') ?? new Date().toISOString()
    ),
  };
}

export function normalizeCustomerMaster(raw: Record<string, any>, idx: number): CustomerMaster {
  const openBal = round2(
    Number(
      getField(
        raw,
        'openingBalanceGst',
        'openingBalance',
        'balance',
        'pendingAmount',
        'closingBalance',
        'debitBalance',
        'OpeningBalance'
      ) ?? 0
    )
  );
  return {
    id: String(getField(raw, 'id', 'customerId', 'partyId', 'Id') ?? `cst-${idx + 1}`),
    code: String(
      getField(raw, 'code', 'customerCode', 'partyCode', 'Code') ??
        `CUS${String(idx + 1).padStart(4, '0')}`
    ),
    name: String(
      getField(
        raw,
        'name',
        'customerName',
        'partyName',
        'firmName',
        'accountName',
        'Name',
        'CustomerName'
      ) ?? `Customer ${idx + 1}`
    ).trim(),
    mobile: String(
      getField(raw, 'mobile', 'phone', 'contact', 'mobileNo', 'phoneNumber', 'Mobile', 'Phone') ??
        ''
    ).trim(),
    email: String(getField(raw, 'email', 'emailId', 'Email') ?? '').trim(),
    address: String(getField(raw, 'address', 'city', 'street', 'Address') ?? '').trim(),
    gstin: String(getField(raw, 'gstin', 'gstNo', 'gstNumber', 'Gstin', 'GstNo') ?? '').trim(),
    state: String(getField(raw, 'state', 'stateName', 'State') ?? '').trim(),
    openingBalanceGst: openBal,
    openingBalanceNonGst: round2(
      Number(getField(raw, 'openingBalanceNonGst', 'nonGstBalance') ?? openBal)
    ),
    signatureDataUrl: getField(raw, 'signatureDataUrl', 'signature', 'Signature') || undefined,
  };
}

export function normalizeSupplierMaster(raw: Record<string, any>, idx: number): SupplierMaster {
  const openBal = round2(
    Number(
      getField(
        raw,
        'openingBalanceGst',
        'openingBalance',
        'balance',
        'payableBalance',
        'closingBalance',
        'creditBalance',
        'OpeningBalance'
      ) ?? 0
    )
  );
  return {
    id: String(getField(raw, 'id', 'supplierId', 'vendorId', 'partyId', 'Id') ?? `sup-${idx + 1}`),
    code: String(
      getField(raw, 'code', 'supplierCode', 'vendorCode', 'partyCode', 'Code') ??
        `SUP${String(idx + 1).padStart(4, '0')}`
    ),
    name: String(
      getField(
        raw,
        'name',
        'supplierName',
        'vendorName',
        'partyName',
        'firmName',
        'accountName',
        'Name',
        'SupplierName'
      ) ?? `Supplier ${idx + 1}`
    ).trim(),
    mobile: String(
      getField(raw, 'mobile', 'phone', 'whatsApp', 'contact', 'mobileNo', 'Mobile', 'Phone') ?? ''
    ).trim(),
    email: String(getField(raw, 'email', 'emailId', 'Email') ?? '').trim(),
    address: String(getField(raw, 'address', 'city', 'Address') ?? '').trim(),
    gstin: String(getField(raw, 'gstin', 'gstNo', 'gstNumber', 'Gstin', 'GstNo') ?? '').trim(),
    state: String(getField(raw, 'state', 'stateName', 'State') ?? '').trim(),
    openingBalanceGst: openBal,
    openingBalanceNonGst: round2(
      Number(getField(raw, 'openingBalanceNonGst', 'nonGstBalance') ?? openBal)
    ),
  };
}

export function normalizeHsnMaster(raw: Record<string, any>, idx: number): HsnMaster {
  const rawCgst = Number(getField(raw, 'cgstPercent', 'cgst', 'cgstRate') ?? 0);
  const rawSgst = Number(getField(raw, 'sgstPercent', 'sgst', 'sgstRate') ?? 0);
  const explicitGst = getField(
    raw,
    'gstPercent',
    'gst',
    'rate',
    'taxRate',
    'taxPercent',
    'igst',
    'GstPercent',
    'Gst',
    'GST'
  );
  const gstPercent = round2(
    Number(explicitGst !== undefined ? explicitGst : rawCgst + rawSgst > 0 ? rawCgst + rawSgst : 5)
  );
  return {
    id: String(getField(raw, 'id', 'hsnId', 'Id') ?? `hsn-${idx + 1}`),
    code: String(
      getField(raw, 'code', 'hsnCode', 'hsn', 'sac', 'hsnNo', 'Code', 'HsnCode', 'HSN') ?? ''
    ).trim(),
    description: String(
      getField(raw, 'description', 'name', 'details', 'itemName', 'Description') ?? ''
    ).trim(),
    gstPercent,
    cgstPercent: round2(rawCgst > 0 ? rawCgst : gstPercent / 2),
    sgstPercent: round2(rawSgst > 0 ? rawSgst : gstPercent / 2),
  };
}

export function normalizeBankMaster(raw: Record<string, any>, idx: number): BankMaster {
  const openBal = round2(
    Number(getField(raw, 'openingBalanceGst', 'openingBalance', 'balance') ?? 0)
  );
  return {
    id: String(getField(raw, 'id', 'bankId', 'Id') ?? `bnk-${idx + 1}`),
    bankName: String(
      getField(raw, 'bankName', 'name', 'accountName', 'BankName', 'Name') ?? `Bank ${idx + 1}`
    ).trim(),
    accountNo: String(
      getField(raw, 'accountNo', 'accountNumber', 'accNo', 'AccountNo') ?? ''
    ).trim(),
    ifsc: String(getField(raw, 'ifsc', 'ifscCode', 'Ifsc') ?? '').trim(),
    branch: String(getField(raw, 'branch', 'branchName', 'Branch') ?? '').trim(),
    openingBalanceGst: openBal,
    openingBalanceNonGst: round2(
      Number(getField(raw, 'openingBalanceNonGst', 'nonGstBalance') ?? openBal)
    ),
  };
}

export function normalizeSaleDocument(
  raw: Record<string, any>,
  idx: number,
  profile: ProfileType,
  forcedDocType?: 'SALE' | 'STOCK_OUT' | 'CREDIT_NOTE'
): SaleDocument {
  const rawLines =
    getField(
      raw,
      'lines',
      'items',
      'billItems',
      'lineItems',
      'saleItems',
      'invoiceItems',
      'details',
      'Lines',
      'Items'
    ) || [];
  let lines: BillLineItem[] = Array.isArray(rawLines)
    ? rawLines.map((l, i) => normalizeLineItem(l, i, profile))
    : [];

  // Support flat single-row sale exports where item fields sit directly on the bill object
  if (
    lines.length === 0 &&
    getField(raw, 'itemName', 'productName', 'itemCode', 'rate', 'sellingPrice', 'qty') !==
      undefined
  ) {
    lines = [normalizeLineItem(raw, 0, profile)];
  }

  const itemsValue = round2(
    Number(
      getField(raw, 'itemsValue', 'subTotal', 'grossAmount', 'taxableAmount', 'ItemsValue') ??
        lines.reduce((s, l) => s + l.amount, 0)
    )
  );
  const billDiscount = round2(
    Number(getField(raw, 'billDiscount', 'discount', 'billDisc', 'BillDiscount') ?? 0)
  );
  const totalAmount = round2(
    Number(
      getField(
        raw,
        'totalAmount',
        'netAmount',
        'grandTotal',
        'billAmount',
        'total',
        'amount',
        'TotalAmount',
        'NetAmount'
      ) ?? Math.max(0, itemsValue - billDiscount)
    )
  );
  const receivedAmount = round2(
    Number(
      getField(raw, 'receivedAmount', 'received', 'paidAmount', 'paid', 'cashReceived', 'ReceivedAmount') ??
        totalAmount
    )
  );
  const remainingAmount = round2(
    Number(
      getField(raw, 'remainingAmount', 'remaining', 'balance', 'pending', 'pendingAmount') ??
        Math.max(0, totalAmount - receivedAmount)
    )
  );
  const rawType = String(
    getField(raw, 'docType', 'type', 'billCategory', 'DocType') ?? 'SALE'
  ).toUpperCase();
  const docType: 'SALE' | 'STOCK_OUT' | 'CREDIT_NOTE' =
    forcedDocType ||
    (rawType.includes('STOCK')
      ? 'STOCK_OUT'
      : rawType.includes('CREDIT') || rawType.includes('RETURN')
      ? 'CREDIT_NOTE'
      : 'SALE');

  const invoiceNo = String(
    getField(raw, 'invoiceNo', 'billNo', 'voucherNo', 'docNo', 'InvoiceNo', 'BillNo') ??
      `${profile === 'GST' ? 'TAX' : 'BIL'}${String(idx + 1).padStart(5, '0')}`
  );
  const dateRaw = String(
    getField(raw, 'date', 'billDate', 'invoiceDate', 'createdAt', 'Date', 'BillDate') ??
      new Date().toISOString().slice(0, 10)
  );
  const date = dateRaw.slice(0, 10);

  return {
    id: String(getField(raw, 'id', 'saleId', 'billId', 'Id') ?? `sal-${idx + 1}-${invoiceNo}`),
    profile,
    docType,
    invoiceNo,
    manualRefNo: String(getField(raw, 'manualRefNo', 'refNo', 'referenceNo') ?? ''),
    date,
    customerId: String(getField(raw, 'customerId', 'partyId', 'CustomerId') ?? ''),
    customerName: String(
      getField(raw, 'customerName', 'partyName', 'customer', 'buyerName', 'CustomerName') ??
        'Walk-in Customer'
    ),
    customerMobile: String(getField(raw, 'customerMobile', 'mobile', 'phone') ?? ''),
    customerEmail: String(getField(raw, 'customerEmail', 'email') ?? ''),
    customerDetails: String(getField(raw, 'customerDetails', 'address', 'partyDetails') ?? ''),
    customerSignatureDataUrl: getField(raw, 'customerSignatureDataUrl', 'signatureDataUrl'),
    companySignatureDataUrl: getField(raw, 'companySignatureDataUrl', 'authorizedSignatureDataUrl'),
    paymentMode: (getField(raw, 'paymentMode', 'mode', 'PaymentMode') as any) || 'Cash',
    transportRef: String(getField(raw, 'transportRef', 'transport', 'vehicleNo') ?? ''),
    billType: profile === 'GST' ? 'GST Bill' : 'Non-GST Bill',
    lines,
    itemsValue,
    billDiscount,
    totalAmount,
    receivedAmount,
    remainingAmount,
    upiId: String(getField(raw, 'upiId', 'UpiId') ?? ''),
    adjustCreditedAmount: Boolean(getField(raw, 'adjustCreditedAmount') ?? false),
    remarks: String(getField(raw, 'remarks', 'notes', 'Remarks') ?? ''),
    storeId: String(getField(raw, 'storeId') ?? 'STORE-MAIN'),
    createdBy: String(getField(raw, 'createdBy', 'operator', 'user') ?? 'A'),
    createdAt: String(getField(raw, 'createdAt') ?? new Date().toISOString()),
    qrSignatureHash: String(
      getField(raw, 'qrSignatureHash', 'qrHash') ?? `KPOS-${invoiceNo}-${date.replace(/-/g, '')}`
    ),
    emailReceiptSent: Boolean(getField(raw, 'emailReceiptSent') ?? false),
  };
}

export function normalizePurchaseDocument(
  raw: Record<string, any>,
  idx: number,
  profile: ProfileType,
  forcedDocType?: 'PURCHASE' | 'PURCHASE_RETURN'
): PurchaseDocument {
  const rawLines =
    getField(
      raw,
      'lines',
      'items',
      'purchaseItems',
      'billItems',
      'lineItems',
      'details',
      'Lines',
      'Items'
    ) || [];
  let lines: BillLineItem[] = Array.isArray(rawLines)
    ? rawLines.map((l, i) => normalizeLineItem(l, i, profile))
    : [];

  // Support flat single-row purchase exports
  if (
    lines.length === 0 &&
    getField(raw, 'itemName', 'productName', 'itemCode', 'rate', 'purchaseRate', 'qty') !==
      undefined
  ) {
    lines = [normalizeLineItem(raw, 0, profile)];
  }

  const itemsValue = round2(
    Number(
      getField(raw, 'itemsValue', 'subTotal', 'grossAmount', 'ItemsValue') ??
        lines.reduce((s, l) => s + l.amount, 0)
    )
  );
  const billDiscount = round2(
    Number(getField(raw, 'billDiscount', 'discount', 'BillDiscount') ?? 0)
  );
  const additionalCharge = round2(
    Number(getField(raw, 'additionalCharge', 'extraCharge', 'freight', 'otherCharges') ?? 0)
  );
  const totalAmount = round2(
    Number(
      getField(
        raw,
        'totalAmount',
        'netAmount',
        'grandTotal',
        'billAmount',
        'amount',
        'TotalAmount'
      ) ?? Math.max(0, itemsValue - billDiscount + additionalCharge)
    )
  );
  const paidAmount = round2(
    Number(
      getField(raw, 'paidAmount', 'paid', 'receivedAmount', 'cashPaid', 'PaidAmount') ?? totalAmount
    )
  );
  const remainingAmount = round2(
    Number(
      getField(raw, 'remainingAmount', 'remaining', 'balance', 'pending', 'balanceAmount') ??
        Math.max(0, totalAmount - paidAmount)
    )
  );
  const rawType = String(getField(raw, 'docType', 'type', 'DocType') ?? 'PURCHASE').toUpperCase();
  const docType: 'PURCHASE' | 'PURCHASE_RETURN' =
    forcedDocType || (rawType.includes('RETURN') || rawType.includes('DEBIT') ? 'PURCHASE_RETURN' : 'PURCHASE');

  const invoiceNo = String(
    getField(raw, 'invoiceNo', 'purchaseNo', 'voucherNo', 'docNo', 'InvoiceNo') ??
      `PIN${String(idx + 1).padStart(5, '0')}`
  );
  const dateRaw = String(
    getField(raw, 'date', 'billDate', 'purchaseDate', 'invoiceDate', 'Date') ??
      new Date().toISOString().slice(0, 10)
  );

  return {
    id: String(getField(raw, 'id', 'purchaseId', 'Id') ?? `pur-${idx + 1}-${invoiceNo}`),
    profile,
    docType,
    invoiceNo,
    supplierBillNo: String(
      getField(raw, 'supplierBillNo', 'billNo', 'manualBillNo', 'partyBillNo', 'BillNo') ??
        invoiceNo
    ),
    date: dateRaw.slice(0, 10),
    supplierId: String(getField(raw, 'supplierId', 'vendorId', 'partyId', 'SupplierId') ?? ''),
    supplierName: String(
      getField(
        raw,
        'supplierName',
        'vendorName',
        'supplier',
        'partyName',
        'vendor',
        'SupplierName'
      ) ?? 'Supplier'
    ),
    paymentMode: (getField(raw, 'paymentMode', 'mode', 'PaymentMode') as any) || 'Cash',
    transportRef: String(getField(raw, 'transportRef', 'transport', 'vehicleNo') ?? ''),
    billType: profile === 'GST' ? 'GST Bill' : 'Non-GST Bill',
    lines,
    itemsValue,
    billDiscount,
    additionalCharge,
    reverseCharge: Boolean(getField(raw, 'reverseCharge', 'rcm') ?? false),
    adjustCreditedAmount: Boolean(getField(raw, 'adjustCreditedAmount') ?? false),
    totalAmount,
    paidAmount,
    remainingAmount,
    remarks: String(getField(raw, 'remarks', 'notes', 'Remarks') ?? ''),
    storeId: 'STORE-MAIN',
    createdBy: String(getField(raw, 'createdBy', 'operator') ?? 'A'),
    createdAt: String(getField(raw, 'createdAt') ?? new Date().toISOString()),
  };
}

export function normalizeVoucherDocument(
  raw: Record<string, any>,
  idx: number,
  profile: ProfileType,
  forcedType?: 'RECEIPT' | 'PAYMENT' | 'JOURNAL' | 'BANK'
): VoucherDocument {
  const rawType = String(
    getField(raw, 'voucherType', 'type', 'entryType', 'transactionType', 'VoucherType') ??
      (getField(raw, 'supplierName', 'vendorName', 'paidAmount') !== undefined
        ? 'PAYMENT'
        : getField(raw, 'customerName', 'receivedAmount') !== undefined
        ? 'RECEIPT'
        : 'JOURNAL')
  ).toUpperCase();
  const voucherType: 'RECEIPT' | 'PAYMENT' | 'JOURNAL' | 'BANK' =
    forcedType ||
    (rawType.includes('REC')
      ? 'RECEIPT'
      : rawType.includes('PAY')
      ? 'PAYMENT'
      : rawType.includes('BANK') || rawType.includes('CONTRA')
      ? 'BANK'
      : 'JOURNAL');

  const rawRows = getField(raw, 'expenseRows', 'rows', 'lines', 'entries', 'ExpenseRows') || [];
  const expenseRows = Array.isArray(rawRows)
    ? rawRows.map((r: any, i: number) => ({
        id: String(getField(r, 'id') ?? `exp-${i + 1}`),
        expenseHead: String(
          getField(r, 'expenseHead', 'accountHead', 'head', 'account', 'ExpenseHead') ?? 'General'
        ),
        description: String(
          getField(r, 'description', 'remarks', 'narration', 'Description') ?? ''
        ),
        amount: round2(Number(getField(r, 'amount', 'Amount') ?? 0)),
      }))
    : [];

  const amount = round2(
    Number(
      getField(
        raw,
        'amount',
        'totalAmount',
        'paidAmount',
        'receivedAmount',
        'totalExpense',
        'paymentAmount',
        'Amount'
      ) ?? expenseRows.reduce((s, r) => s + r.amount, 0)
    )
  );

  const prefix =
    voucherType === 'RECEIPT'
      ? 'RCP'
      : voucherType === 'PAYMENT'
      ? 'PMT'
      : voucherType === 'BANK'
      ? 'BV'
      : 'JRN';

  return {
    id: String(getField(raw, 'id', 'voucherId', 'paymentId', 'receiptId', 'Id') ?? `vch-${idx + 1}`),
    profile,
    voucherType,
    voucherNo: String(
      getField(raw, 'voucherNo', 'paymentNo', 'receiptNo', 'no', 'docNo', 'VoucherNo') ??
        `${prefix}${String(idx + 1).padStart(5, '0')}`
    ),
    date: String(
      getField(raw, 'date', 'voucherDate', 'paymentDate', 'receiptDate', 'Date') ??
        new Date().toISOString().slice(0, 10)
    ).slice(0, 10),
    partyId: String(getField(raw, 'partyId', 'customerId', 'supplierId', 'vendorId') ?? ''),
    partyName: String(
      getField(
        raw,
        'partyName',
        'accountName',
        'customerName',
        'supplierName',
        'vendorName',
        'party',
        'PartyName'
      ) ?? ''
    ),
    paymentMode: String(getField(raw, 'paymentMode', 'paymentSource', 'mode', 'payMode') ?? 'Cash'),
    neftUtrNo: String(
      getField(raw, 'neftUtrNo', 'utrNo', 'refNo', 'chequeNo', 'transactionId') ?? ''
    ),
    remarks: String(getField(raw, 'remarks', 'narration', 'notes', 'description', 'Remarks') ?? ''),
    amount,
    expenseRows,
    createdBy: String(getField(raw, 'createdBy', 'operator') ?? 'A'),
    createdAt: String(getField(raw, 'createdAt') ?? new Date().toISOString()),
  };
}

/**
 * Extracts trailing numeric serial from an invoice/voucher code (e.g. "TAX00042" -> 42, "INV-2026-019" -> 19)
 */
export function extractTrailingSerialNumber(docNumber: string): number {
  if (!docNumber) return 0;
  const match = String(docNumber).trim().match(/(\d+)\s*$/);
  if (!match) return 0;
  const parsed = parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 && parsed < 10000000 ? parsed : 0;
}

/**
 * Computes the next Financial Year string automatically (e.g. "FY2026-27" -> "FY2027-28")
 */
export function computeNextFinancialYear(currentFy: string): string {
  const clean = String(currentFy || '').trim();
  // Match e.g. FY2026-27 or FY 2026-27 or 2026-27
  const shortMatch = clean.match(/^(.*?)(\d{4})\s*[-/]\s*(\d{2})$/);
  if (shortMatch) {
    const prefix = shortMatch[1] || 'FY';
    const startYear = parseInt(shortMatch[2], 10) + 1;
    const endYearShort = String((startYear + 1) % 100).padStart(2, '0');
    return `${prefix}${startYear}-${endYearShort}`;
  }
  // Match e.g. FY2026-2027 or 2026-2027
  const fullMatch = clean.match(/^(.*?)(\d{4})\s*[-/]\s*(\d{4})$/);
  if (fullMatch) {
    const prefix = fullMatch[1] || '';
    const startYear = parseInt(fullMatch[2], 10) + 1;
    const endYear = startYear + 1;
    return `${prefix}${startYear}-${endYear}`;
  }
  const currentYear = new Date().getFullYear();
  return `FY${currentYear + 1}-${String((currentYear + 2) % 100).padStart(2, '0')}`;
}

/**
 * Synchronizes all document counters in GST and NON_GST ledgers so new bills
 * always start from (last serial + 1) across imports and financial year rollovers.
 */
export function syncAllLedgerCounters(state: ServerState): void {
  for (const prof of ['GST', 'NON_GST'] as const) {
    const ledger = state.profiles[prof];
    if (!ledger) continue;

    const saleDocs = ledger.sales.filter((s) => s.docType === 'SALE');
    const stockOutDocs = ledger.sales.filter((s) => s.docType === 'STOCK_OUT');
    const creditNoteDocs = ledger.sales.filter((s) => s.docType === 'CREDIT_NOTE');
    const purchaseDocs = ledger.purchases.filter((p) => p.docType === 'PURCHASE');
    const purchaseReturnDocs = ledger.purchases.filter((p) => p.docType === 'PURCHASE_RETURN');

    const receiptDocs = ledger.vouchers.filter((v) => v.voucherType === 'RECEIPT');
    const paymentDocs = ledger.vouchers.filter((v) => v.voucherType === 'PAYMENT');
    const journalDocs = ledger.vouchers.filter((v) => v.voucherType === 'JOURNAL');
    const bankDocs = ledger.vouchers.filter((v) => v.voucherType === 'BANK');

    const maxSerial = (docs: { invoiceNo?: string; voucherNo?: string; poNo?: string }[]) =>
      docs.reduce(
        (max, d) =>
          Math.max(
            max,
            extractTrailingSerialNumber(d.invoiceNo || d.voucherNo || d.poNo || '')
          ),
        0
      );

    ledger.counters.sale = Math.max(
      ledger.counters.sale || 1,
      saleDocs.length + 1,
      maxSerial(saleDocs) + 1
    );
    ledger.counters.stockOut = Math.max(
      ledger.counters.stockOut || 1,
      stockOutDocs.length + 1,
      maxSerial(stockOutDocs) + 1
    );
    ledger.counters.creditNote = Math.max(
      ledger.counters.creditNote || 1,
      creditNoteDocs.length + 1,
      maxSerial(creditNoteDocs) + 1
    );
    ledger.counters.purchase = Math.max(
      ledger.counters.purchase || 1,
      purchaseDocs.length + 1,
      maxSerial(purchaseDocs) + 1
    );
    ledger.counters.purchaseReturn = Math.max(
      ledger.counters.purchaseReturn || 1,
      purchaseReturnDocs.length + 1,
      maxSerial(purchaseReturnDocs) + 1
    );
    ledger.counters.receipt = Math.max(
      ledger.counters.receipt || 1,
      receiptDocs.length + 1,
      maxSerial(receiptDocs) + 1
    );
    ledger.counters.payment = Math.max(
      ledger.counters.payment || 1,
      paymentDocs.length + 1,
      maxSerial(paymentDocs) + 1
    );
    ledger.counters.journal = Math.max(
      ledger.counters.journal || 1,
      journalDocs.length + 1,
      maxSerial(journalDocs) + 1
    );
    ledger.counters.bankVoucher = Math.max(
      ledger.counters.bankVoucher || 1,
      bankDocs.length + 1,
      maxSerial(bankDocs) + 1
    );
    ledger.counters.purchaseOrder = Math.max(
      ledger.counters.purchaseOrder || 1,
      ledger.purchaseOrders.length + 1,
      maxSerial(ledger.purchaseOrders) + 1
    );
  }
}

/**
 * Cross-links imported bills, vouchers, items, HSN codes, customers, and suppliers so
 * all rate, quantity, GST, HSN codes, suppliers, and payments are completely populated.
 */
function crossLinkAndSynthesizeImportedData(state: ServerState, stats: ImportSummaryStats): void {
  const itemByCode = new Map<string, ItemMaster>();
  const itemByName = new Map<string, ItemMaster>();
  for (const it of state.items) {
    if (it.code) itemByCode.set(it.code.toLowerCase(), it);
    if (it.name) itemByName.set(it.name.toLowerCase(), it);
  }

  const hsnMap = new Map<string, HsnMaster>();
  for (const h of state.hsnCodes) {
    if (h.code) hsnMap.set(h.code.toLowerCase(), h);
  }

  const supplierByName = new Map<string, SupplierMaster>();
  for (const s of state.suppliers) {
    if (s.name) supplierByName.set(s.name.toLowerCase(), s);
  }

  const customerByName = new Map<string, CustomerMaster>();
  for (const c of state.customers) {
    if (c.name) customerByName.set(c.name.toLowerCase(), c);
  }

  // 1. Ensure all HSN codes from Item Master exist in HSN Master
  for (const it of state.items) {
    if (it.hsnCode && !hsnMap.has(it.hsnCode.toLowerCase())) {
      const gst = round2(Number(it.gstPercent) || 5);
      const newHsn: HsnMaster = {
        id: `hsn-auto-${state.hsnCodes.length + 1}-${it.hsnCode}`,
        code: it.hsnCode,
        description: `${it.category || it.name || 'Imported HSN'}`,
        gstPercent: gst,
        cgstPercent: round2(gst / 2),
        sgstPercent: round2(gst / 2),
      };
      state.hsnCodes.push(newHsn);
      hsnMap.set(newHsn.code.toLowerCase(), newHsn);
      stats.hsnImported += 1;
    } else if (!it.hsnCode && it.gstPercent > 0) {
      const matchingHsn = state.hsnCodes.find((h) => h.gstPercent === it.gstPercent);
      if (matchingHsn) {
        it.hsnCode = matchingHsn.code;
      }
    }
  }

  // 2. Enrich bill lines & synthesize missing items, HSN codes, customers, and suppliers from transactions
  for (const prof of ['GST', 'NON_GST'] as const) {
    const ledger = state.profiles[prof];

    // Process Sales
    for (const sale of ledger.sales) {
      if (
        sale.customerName &&
        sale.customerName.trim() &&
        sale.customerName.toLowerCase() !== 'walk-in customer'
      ) {
        const cKey = sale.customerName.trim().toLowerCase();
        const existingCust = customerByName.get(cKey);
        if (existingCust) {
          if (!sale.customerId) sale.customerId = existingCust.id;
          if (!sale.customerMobile && existingCust.mobile) sale.customerMobile = existingCust.mobile;
        } else {
          const newCust: CustomerMaster = {
            id: sale.customerId || `cst-auto-${state.customers.length + 1}`,
            code: `CUS${String(state.customers.length + 1).padStart(4, '0')}`,
            name: sale.customerName.trim(),
            mobile: sale.customerMobile || '',
            email: sale.customerEmail || '',
            address: sale.customerDetails || '',
            gstin: '',
            state: state.company.state || '',
            openingBalanceGst: 0,
            openingBalanceNonGst: 0,
          };
          state.customers.push(newCust);
          customerByName.set(cKey, newCust);
          sale.customerId = newCust.id;
          stats.customersImported += 1;
        }
      }

      for (const ln of sale.lines) {
        const matchedItem =
          (ln.code && itemByCode.get(ln.code.toLowerCase())) ||
          (ln.name && itemByName.get(ln.name.toLowerCase()));
        if (matchedItem) {
          if (!ln.itemId) ln.itemId = matchedItem.id;
          if (!ln.hsn && matchedItem.hsnCode) ln.hsn = matchedItem.hsnCode;
          if (ln.rate <= 0 && matchedItem.sellingPrice > 0) ln.rate = matchedItem.sellingPrice;
          if (prof === 'GST' && ln.gstPercent <= 0 && matchedItem.gstPercent > 0) {
            ln.gstPercent = matchedItem.gstPercent;
          }
          if (prof === 'GST' && ln.basePrice <= 0 && ln.rate > 0) {
            ln.basePrice =
              ln.gstPercent > 0 ? round2(ln.rate - (ln.rate * ln.gstPercent) / 100) : ln.rate;
          }
        } else if (ln.name || ln.code) {
          const gst = ln.gstPercent > 0 ? ln.gstPercent : 5;
          const sellRate = ln.rate > 0 ? ln.rate : ln.amount / Math.max(1, ln.qty);
          const base =
            ln.basePrice > 0
              ? ln.basePrice
              : round2(sellRate - (sellRate * gst) / 100);
          const newItem: ItemMaster = {
            id: ln.itemId || `itm-auto-${state.items.length + 1}`,
            code: ln.code || `ITM${String(state.items.length + 1).padStart(4, '0')}`,
            barcode: ln.barcode || ln.code || `ITM${String(state.items.length + 1).padStart(4, '0')}`,
            name: ln.name || ln.code,
            category: 'General Items',
            unit: ln.unit || 'PCS',
            hsnCode: ln.hsn || '',
            gstPercent: gst,
            basePrice: base,
            cgstAmount: round2(Math.max(0, sellRate - base) / 2),
            sgstAmount: round2(Math.max(0, sellRate - base) / 2),
            sellingPrice: round2(sellRate),
            purchasePrice: 0,
            stockQty: 0,
            minStockLevel: 5,
            storeLocation: 'STORE-MAIN',
            updatedAt: new Date().toISOString(),
          };
          state.items.push(newItem);
          itemByCode.set(newItem.code.toLowerCase(), newItem);
          itemByName.set(newItem.name.toLowerCase(), newItem);
          ln.itemId = newItem.id;
          stats.itemsImported += 1;
        }

        if (ln.hsn && !hsnMap.has(ln.hsn.toLowerCase())) {
          const gst = round2(ln.gstPercent || 5);
          const newHsn: HsnMaster = {
            id: `hsn-auto-${state.hsnCodes.length + 1}-${ln.hsn}`,
            code: ln.hsn,
            description: ln.name || 'Imported HSN',
            gstPercent: gst,
            cgstPercent: round2(gst / 2),
            sgstPercent: round2(gst / 2),
          };
          state.hsnCodes.push(newHsn);
          hsnMap.set(newHsn.code.toLowerCase(), newHsn);
          stats.hsnImported += 1;
        }
      }
    }

    // Process Purchases
    for (const pur of ledger.purchases) {
      if (pur.supplierName && pur.supplierName.trim()) {
        const sKey = pur.supplierName.trim().toLowerCase();
        const existingSup = supplierByName.get(sKey);
        if (existingSup) {
          if (!pur.supplierId) pur.supplierId = existingSup.id;
        } else {
          const newSup: SupplierMaster = {
            id: pur.supplierId || `sup-auto-${state.suppliers.length + 1}`,
            code: `SUP${String(state.suppliers.length + 1).padStart(4, '0')}`,
            name: pur.supplierName.trim(),
            mobile: '',
            email: '',
            address: '',
            gstin: '',
            state: state.company.state || '',
            openingBalanceGst: 0,
            openingBalanceNonGst: 0,
          };
          state.suppliers.push(newSup);
          supplierByName.set(sKey, newSup);
          pur.supplierId = newSup.id;
          stats.suppliersImported += 1;
        }
      }

      for (const ln of pur.lines) {
        const matchedItem =
          (ln.code && itemByCode.get(ln.code.toLowerCase())) ||
          (ln.name && itemByName.get(ln.name.toLowerCase()));
        if (matchedItem) {
          if (!ln.itemId) ln.itemId = matchedItem.id;
          if (!ln.hsn && matchedItem.hsnCode) ln.hsn = matchedItem.hsnCode;
          if (matchedItem.purchasePrice <= 0 && ln.rate > 0) {
            matchedItem.purchasePrice = ln.rate;
          }
        } else if (ln.name || ln.code) {
          const gst = ln.gstPercent > 0 ? ln.gstPercent : 5;
          const purRate = ln.rate > 0 ? ln.rate : ln.amount / Math.max(1, ln.qty);
          const newItem: ItemMaster = {
            id: ln.itemId || `itm-auto-${state.items.length + 1}`,
            code: ln.code || `ITM${String(state.items.length + 1).padStart(4, '0')}`,
            barcode: ln.barcode || ln.code || `ITM${String(state.items.length + 1).padStart(4, '0')}`,
            name: ln.name || ln.code,
            category: 'General Items',
            unit: ln.unit || 'PCS',
            hsnCode: ln.hsn || '',
            gstPercent: gst,
            basePrice: round2(purRate - (purRate * gst) / 100),
            cgstAmount: round2(((purRate * gst) / 100) / 2),
            sgstAmount: round2(((purRate * gst) / 100) / 2),
            sellingPrice: round2(purRate),
            purchasePrice: round2(purRate),
            stockQty: round2(ln.qty || 0),
            minStockLevel: 5,
            storeLocation: 'STORE-MAIN',
            updatedAt: new Date().toISOString(),
          };
          state.items.push(newItem);
          itemByCode.set(newItem.code.toLowerCase(), newItem);
          itemByName.set(newItem.name.toLowerCase(), newItem);
          ln.itemId = newItem.id;
          stats.itemsImported += 1;
        }

        if (ln.hsn && !hsnMap.has(ln.hsn.toLowerCase())) {
          const gst = round2(ln.gstPercent || 5);
          const newHsn: HsnMaster = {
            id: `hsn-auto-${state.hsnCodes.length + 1}-${ln.hsn}`,
            code: ln.hsn,
            description: ln.name || 'Imported HSN',
            gstPercent: gst,
            cgstPercent: round2(gst / 2),
            sgstPercent: round2(gst / 2),
          };
          state.hsnCodes.push(newHsn);
          hsnMap.set(newHsn.code.toLowerCase(), newHsn);
          stats.hsnImported += 1;
        }
      }
    }

    // Process Payments & Receipts in Vouchers to link/synthesize Suppliers & Customers
    for (const vch of ledger.vouchers) {
      const pName = (vch.partyName || '').trim();
      if (!pName) continue;
      if (vch.voucherType === 'PAYMENT') {
        const sKey = pName.toLowerCase();
        const existingSup = supplierByName.get(sKey);
        if (existingSup) {
          if (!vch.partyId) vch.partyId = existingSup.id;
        } else {
          const newSup: SupplierMaster = {
            id: vch.partyId || `sup-auto-${state.suppliers.length + 1}`,
            code: `SUP${String(state.suppliers.length + 1).padStart(4, '0')}`,
            name: pName,
            mobile: '',
            email: '',
            address: '',
            gstin: '',
            state: state.company.state || '',
            openingBalanceGst: 0,
            openingBalanceNonGst: 0,
          };
          state.suppliers.push(newSup);
          supplierByName.set(sKey, newSup);
          vch.partyId = newSup.id;
          stats.suppliersImported += 1;
        }
      } else if (vch.voucherType === 'RECEIPT') {
        const cKey = pName.toLowerCase();
        const existingCust = customerByName.get(cKey);
        if (existingCust) {
          if (!vch.partyId) vch.partyId = existingCust.id;
        } else {
          const newCust: CustomerMaster = {
            id: vch.partyId || `cst-auto-${state.customers.length + 1}`,
            code: `CUS${String(state.customers.length + 1).padStart(4, '0')}`,
            name: pName,
            mobile: '',
            email: '',
            address: '',
            gstin: '',
            state: state.company.state || '',
            openingBalanceGst: 0,
            openingBalanceNonGst: 0,
          };
          state.customers.push(newCust);
          customerByName.set(cKey, newCust);
          vch.partyId = newCust.id;
          stats.customersImported += 1;
        }
      }
    }
  }
}

function mergeByKey<T>(existing: T[], incoming: T[], keyFn: (item: T) => string): T[] {
  const map = new Map<string, T>();
  for (const item of existing) {
    map.set(keyFn(item), item);
  }
  for (const item of incoming) {
    map.set(keyFn(item), item);
  }
  return Array.from(map.values());
}

export interface ImportSummaryStats {
  itemsImported: number;
  customersImported: number;
  suppliersImported: number;
  hsnImported: number;
  banksImported: number;
  salesImported: number;
  purchasesImported: number;
  vouchersImported: number;
  targetProfile: ProfileType;
  isValidKanhaFormat: boolean;
  matchedSections: string[];
}

/**
 * Merges any Kanha POS JSON object or array (from .kpd, .json, or data folder)
 * into the target ServerState, supporting Windows .NET PascalCase, Android, and Web camelCase schemas.
 */
export function applyImportedObjectToState(
  state: ServerState,
  rawPayload: any,
  defaultProfile: ProfileType,
  fileNameHint = ''
): ImportSummaryStats {
  const validation = validateKanhaPayloadStructure(rawPayload, fileNameHint);

  const stats: ImportSummaryStats = {
    itemsImported: 0,
    customersImported: 0,
    suppliersImported: 0,
    hsnImported: 0,
    banksImported: 0,
    salesImported: 0,
    purchasesImported: 0,
    vouchersImported: 0,
    targetProfile: defaultProfile,
    isValidKanhaFormat: validation.isValidKanhaFormat,
    matchedSections: validation.matchedSections,
  };

  if (!rawPayload || !validation.isValidKanhaFormat) return stats;

  const upperHint = fileNameHint.toUpperCase();
  if (
    upperHint.includes('NON_GST') ||
    upperHint.includes('NONGST') ||
    upperHint.includes('NON-GST')
  ) {
    stats.targetProfile = 'NON_GST';
  } else if (upperHint.includes('GST')) {
    stats.targetProfile = 'GST';
  }

  // If payload is a top-level Array, classify by element properties or filename
  if (Array.isArray(rawPayload)) {
    if (rawPayload.length === 0) return stats;
    const sample = rawPayload.find((el) => el && typeof el === 'object') || {};
    if (
      upperHint.includes('ITEM') ||
      upperHint.includes('PRODUCT') ||
      upperHint.includes('STOCK') ||
      getField(
        sample,
        'sellingPrice',
        'basePrice',
        'stockQty',
        'minStockLevel',
        'itemCode',
        'purchasePrice'
      ) !== undefined
    ) {
      const normalized = rawPayload.map((r, i) => normalizeItemMaster(r, i));
      state.items = mergeByKey(
        state.items,
        normalized,
        (it) => (it.code || it.name || it.id).toLowerCase()
      );
      stats.itemsImported += normalized.length;
    } else if (
      upperHint.includes('SUPPLIER') ||
      upperHint.includes('VENDOR') ||
      upperHint.includes('CREDITOR') ||
      getField(sample, 'supplierName', 'supplierCode', 'vendorName', 'vendorCode') !== undefined
    ) {
      const normalized = rawPayload.map((r, i) => normalizeSupplierMaster(r, i));
      state.suppliers = mergeByKey(
        state.suppliers,
        normalized,
        (s) => (s.code || s.name || s.id).toLowerCase()
      );
      stats.suppliersImported += normalized.length;
    } else if (
      upperHint.includes('CUSTOMER') ||
      upperHint.includes('DEBTOR') ||
      upperHint.includes('CLIENT') ||
      (upperHint.includes('PARTY') && !upperHint.includes('SUPPLIER')) ||
      getField(sample, 'customerName', 'customerCode') !== undefined
    ) {
      const normalized = rawPayload.map((r, i) => normalizeCustomerMaster(r, i));
      state.customers = mergeByKey(
        state.customers,
        normalized,
        (c) => (c.code || c.name || c.id).toLowerCase()
      );
      stats.customersImported += normalized.length;
    } else if (
      upperHint.includes('HSN') ||
      (getField(sample, 'hsnCode', 'cgstPercent', 'sgstPercent') !== undefined &&
        getField(sample, 'sellingPrice', 'rate', 'invoiceNo') === undefined)
    ) {
      const normalized = rawPayload.map((r, i) => normalizeHsnMaster(r, i));
      state.hsnCodes = mergeByKey(
        state.hsnCodes,
        normalized,
        (h) => (h.code || h.id).toLowerCase()
      );
      stats.hsnImported += normalized.length;
    } else if (
      upperHint.includes('BANK') ||
      getField(sample, 'bankName', 'accountNo', 'ifsc') !== undefined
    ) {
      const normalized = rawPayload.map((r, i) => normalizeBankMaster(r, i));
      state.banks = mergeByKey(
        state.banks,
        normalized,
        (b) => (b.accountNo || b.bankName || b.id).toLowerCase()
      );
      stats.banksImported += normalized.length;
    } else if (
      upperHint.includes('PURCHASE') ||
      getField(sample, 'supplierBillNo', 'supplierName', 'purchaseNo') !== undefined
    ) {
      const normalized = rawPayload.map((r, i) =>
        normalizePurchaseDocument(r, i, stats.targetProfile)
      );
      state.profiles[stats.targetProfile].purchases = mergeByKey(
        state.profiles[stats.targetProfile].purchases,
        normalized,
        (p) => (p.invoiceNo || p.id).toLowerCase()
      );
      stats.purchasesImported += normalized.length;
    } else if (
      upperHint.includes('VOUCHER') ||
      upperHint.includes('PAYMENT') ||
      upperHint.includes('RECEIPT') ||
      upperHint.includes('JOURNAL') ||
      upperHint.includes('EXPENSE') ||
      getField(sample, 'voucherNo', 'voucherType', 'expenseRows', 'paymentNo', 'receiptNo') !==
        undefined
    ) {
      const forcedType = upperHint.includes('PAYMENT')
        ? 'PAYMENT'
        : upperHint.includes('RECEIPT')
        ? 'RECEIPT'
        : upperHint.includes('BANK')
        ? 'BANK'
        : upperHint.includes('JOURNAL') || upperHint.includes('EXPENSE')
        ? 'JOURNAL'
        : undefined;
      const normalized = rawPayload.map((r, i) =>
        normalizeVoucherDocument(r, i, stats.targetProfile, forcedType)
      );
      state.profiles[stats.targetProfile].vouchers = mergeByKey(
        state.profiles[stats.targetProfile].vouchers,
        normalized,
        (v) => (v.voucherNo || v.id).toLowerCase()
      );
      stats.vouchersImported += normalized.length;
    } else if (
      upperHint.includes('SALE') ||
      upperHint.includes('BILL') ||
      upperHint.includes('INVOICE') ||
      getField(sample, 'invoiceNo', 'billNo', 'lines', 'billItems') !== undefined
    ) {
      const normalized = rawPayload.map((r, i) =>
        normalizeSaleDocument(r, i, stats.targetProfile)
      );
      state.profiles[stats.targetProfile].sales = mergeByKey(
        state.profiles[stats.targetProfile].sales,
        normalized,
        (s) => (s.invoiceNo || s.id).toLowerCase()
      );
      stats.salesImported += normalized.length;
    }

    crossLinkAndSynthesizeImportedData(state, stats);
    syncAllLedgerCounters(state);
    return stats;
  }

  if (typeof rawPayload !== 'object') return stats;

  // Unwrap nested container if present (e.g., { state: {...} }, { data: {...} }, { NewDataSet: {...} })
  const rootCandidates = [
    rawPayload,
    getField(
      rawPayload,
      'state',
      'data',
      'database',
      'store',
      'payload',
      'backup',
      'posData',
      'newDataSet',
      'kanhaData',
      'posDatabase',
      'kpdBackup'
    ),
    getField(rawPayload, 'masters', 'commonMasters'),
    getField(rawPayload, 'transactions', 'ledger'),
  ].filter((c) => c && typeof c === 'object' && !Array.isArray(c));

  for (const obj of rootCandidates) {
    const explicitProfile = getField(obj, 'dataProfile', 'profile', 'Profile', 'activeProfile');
    if (
      explicitProfile === 'NON_GST' ||
      explicitProfile === 'NonGst' ||
      explicitProfile === 'Non-GST'
    ) {
      stats.targetProfile = 'NON_GST';
    } else if (explicitProfile === 'GST' || explicitProfile === 'Gst') {
      stats.targetProfile = 'GST';
    }

    // 1. Common Masters (merged non-destructively so multi-file/multi-section imports retain all records)
    const rawItems = getField(
      obj,
      'items',
      'itemMaster',
      'itemList',
      'products',
      'productMaster',
      'inventory',
      'stockItems',
      'skuList'
    );
    if (Array.isArray(rawItems) && rawItems.length > 0) {
      const normalized = rawItems.map((r, i) => normalizeItemMaster(r, i));
      state.items = mergeByKey(
        state.items,
        normalized,
        (it) => (it.code || it.name || it.id).toLowerCase()
      );
      stats.itemsImported = state.items.length;
    }

    const rawCustomers = getField(
      obj,
      'customers',
      'customerMaster',
      'customerList',
      'buyers',
      'debtors',
      'clients'
    );
    if (Array.isArray(rawCustomers) && rawCustomers.length > 0) {
      const normalized = rawCustomers.map((r, i) => normalizeCustomerMaster(r, i));
      state.customers = mergeByKey(
        state.customers,
        normalized,
        (c) => (c.code || c.name || c.id).toLowerCase()
      );
      stats.customersImported = state.customers.length;
    }

    const rawSuppliers = getField(
      obj,
      'suppliers',
      'supplierMaster',
      'supplierList',
      'vendors',
      'vendorMaster',
      'creditors'
    );
    if (Array.isArray(rawSuppliers) && rawSuppliers.length > 0) {
      const normalized = rawSuppliers.map((r, i) => normalizeSupplierMaster(r, i));
      state.suppliers = mergeByKey(
        state.suppliers,
        normalized,
        (s) => (s.code || s.name || s.id).toLowerCase()
      );
      stats.suppliersImported = state.suppliers.length;
    }

    // Also split combined 'parties' / 'ledgers' arrays into Customers and Suppliers if present
    const rawParties = getField(obj, 'parties', 'partyMaster', 'ledgers', 'accounts');
    if (Array.isArray(rawParties) && rawParties.length > 0) {
      const supList: SupplierMaster[] = [];
      const custList: CustomerMaster[] = [];
      rawParties.forEach((p, idx) => {
        const pType = String(
          getField(p, 'partyType', 'accountType', 'group', 'type', 'ledgerGroup') ?? ''
        ).toUpperCase();
        if (
          pType.includes('SUP') ||
          pType.includes('VEND') ||
          pType.includes('CREDITOR') ||
          getField(p, 'supplierName', 'supplierCode', 'vendorName') !== undefined
        ) {
          supList.push(normalizeSupplierMaster(p, idx));
        } else {
          custList.push(normalizeCustomerMaster(p, idx));
        }
      });
      if (supList.length > 0) {
        state.suppliers = mergeByKey(
          state.suppliers,
          supList,
          (s) => (s.code || s.name || s.id).toLowerCase()
        );
        stats.suppliersImported = state.suppliers.length;
      }
      if (custList.length > 0) {
        state.customers = mergeByKey(
          state.customers,
          custList,
          (c) => (c.code || c.name || c.id).toLowerCase()
        );
        stats.customersImported = state.customers.length;
      }
    }

    const rawHsns = getField(
      obj,
      'hsnCodes',
      'hsns',
      'hsnMaster',
      'hsnList',
      'taxCodes',
      'gstRates'
    );
    if (Array.isArray(rawHsns) && rawHsns.length > 0) {
      const normalized = rawHsns.map((r, i) => normalizeHsnMaster(r, i));
      state.hsnCodes = mergeByKey(
        state.hsnCodes,
        normalized,
        (h) => (h.code || h.id).toLowerCase()
      );
      stats.hsnImported = state.hsnCodes.length;
    }

    const rawBanks = getField(obj, 'banks', 'bankMaster', 'bankList', 'bankAccounts');
    if (Array.isArray(rawBanks) && rawBanks.length > 0) {
      const normalized = rawBanks.map((r, i) => normalizeBankMaster(r, i));
      state.banks = mergeByKey(
        state.banks,
        normalized,
        (b) => (b.accountNo || b.bankName || b.id).toLowerCase()
      );
      stats.banksImported = state.banks.length;
    }

    const rawCompany = getField(obj, 'company', 'companyMaster', 'firm', 'firmInfo', 'settings');
    if (rawCompany && typeof rawCompany === 'object' && !Array.isArray(rawCompany)) {
      const mergedCompany: Partial<CompanyMaster> = {
        firmName: String(
          getField(rawCompany, 'firmName', 'companyName', 'name', 'shopName') ??
            state.company.firmName
        ),
        tagline: String(getField(rawCompany, 'tagline', 'subTitle') ?? state.company.tagline),
        address: String(getField(rawCompany, 'address', 'shopAddress') ?? state.company.address),
        phone: String(
          getField(rawCompany, 'phone', 'mobile', 'contactNo') ?? state.company.phone
        ),
        email: String(getField(rawCompany, 'email') ?? state.company.email),
        gstin: String(getField(rawCompany, 'gstin', 'gstNo') ?? state.company.gstin),
        state: String(getField(rawCompany, 'state', 'stateName') ?? state.company.state),
        upiId: String(getField(rawCompany, 'upiId', 'upi') ?? state.company.upiId),
        financialYear: String(
          getField(rawCompany, 'financialYear', 'session', 'fy') ?? state.company.financialYear
        ),
        termsAndConditions: String(
          getField(rawCompany, 'termsAndConditions', 'terms') ?? state.company.termsAndConditions
        ),
        logoDataUrl:
          getField(rawCompany, 'logoDataUrl', 'logo', 'companyLogo') ?? state.company.logoDataUrl,
        signatureDataUrl:
          getField(rawCompany, 'signatureDataUrl', 'signature', 'authorizedSignature') ??
          state.company.signatureDataUrl,
        printerSettings:
          getField(rawCompany, 'printerSettings', 'printerConfig') ?? state.company.printerSettings,
      };
      state.company = { ...state.company, ...mergedCompany };
    }

    // 2. Multi-profile block (`profiles: { GST: {...}, NON_GST: {...} }`)
    const profilesObj = getField(obj, 'profiles', 'Profiles');
    if (profilesObj && typeof profilesObj === 'object') {
      const gstProf = getField(profilesObj, 'GST', 'gst', 'gstProfile');
      const nonGstProf = getField(profilesObj, 'NON_GST', 'nonGst', 'nonGstProfile');
      if (gstProf && typeof gstProf === 'object') {
        applyLedgerTransactions(state, 'GST', gstProf, stats);
      }
      if (nonGstProf && typeof nonGstProf === 'object') {
        applyLedgerTransactions(state, 'NON_GST', nonGstProf, stats);
      }
    }

    // 3. Direct profile transactions on the object itself (e.g. Windows single-profile .kpd)
    applyLedgerTransactions(state, stats.targetProfile, obj, stats);
  }

  // 4. Cross-link and synthesize HSN codes, suppliers, customers, and item rates/GST from bills & payments
  crossLinkAndSynthesizeImportedData(state, stats);

  // 5. Synchronize all counters so new bills start from the last serial to the next serial
  syncAllLedgerCounters(state);

  return stats;
}

function applyLedgerTransactions(
  state: ServerState,
  profile: ProfileType,
  sourceObj: Record<string, any>,
  stats: ImportSummaryStats
) {
  const ledger = state.profiles[profile];

  const rawCashOpen = getField(sourceObj, 'cashOpeningBalance', 'openingCash', 'cashBalance');
  if (rawCashOpen !== undefined && Number.isFinite(Number(rawCashOpen))) {
    ledger.cashOpeningBalance = round2(Number(rawCashOpen));
  }

  const rawSales = getField(
    sourceObj,
    'sales',
    'saleBills',
    'bills',
    'invoices',
    'taxInvoices',
    'posBills'
  );
  const rawStockOuts = getField(sourceObj, 'stockOuts', 'stockOutBills', 'stockOutList');
  const rawCreditNotes = getField(
    sourceObj,
    'creditNotes',
    'saleReturns',
    'creditNoteBills',
    'salesReturns'
  );

  const combinedSales: SaleDocument[] = [];
  if (Array.isArray(rawSales) && rawSales.length > 0) {
    combinedSales.push(...rawSales.map((s, i) => normalizeSaleDocument(s, i, profile)));
  }
  if (Array.isArray(rawStockOuts) && rawStockOuts.length > 0) {
    combinedSales.push(
      ...rawStockOuts.map((s, i) => normalizeSaleDocument(s, i, profile, 'STOCK_OUT'))
    );
  }
  if (Array.isArray(rawCreditNotes) && rawCreditNotes.length > 0) {
    combinedSales.push(
      ...rawCreditNotes.map((s, i) => normalizeSaleDocument(s, i, profile, 'CREDIT_NOTE'))
    );
  }
  if (combinedSales.length > 0) {
    ledger.sales = mergeByKey(
      ledger.sales,
      combinedSales,
      (s) => `${s.docType}:${(s.invoiceNo || s.id).toLowerCase()}`
    );
    stats.salesImported += combinedSales.length;
  }

  const rawPurchases = getField(
    sourceObj,
    'purchases',
    'purchaseBills',
    'purchaseInvoices',
    'purchaseList',
    'inwardBills'
  );
  const rawPurchaseReturns = getField(
    sourceObj,
    'purchaseReturns',
    'purchaseReturnBills',
    'debitNotes'
  );
  const combinedPurchases: PurchaseDocument[] = [];
  if (Array.isArray(rawPurchases) && rawPurchases.length > 0) {
    combinedPurchases.push(
      ...rawPurchases.map((p, i) => normalizePurchaseDocument(p, i, profile))
    );
  }
  if (Array.isArray(rawPurchaseReturns) && rawPurchaseReturns.length > 0) {
    combinedPurchases.push(
      ...rawPurchaseReturns.map((p, i) =>
        normalizePurchaseDocument(p, i, profile, 'PURCHASE_RETURN')
      )
    );
  }
  if (combinedPurchases.length > 0) {
    ledger.purchases = mergeByKey(
      ledger.purchases,
      combinedPurchases,
      (p) => `${p.docType}:${(p.invoiceNo || p.id).toLowerCase()}`
    );
    stats.purchasesImported += combinedPurchases.length;
  }

  const rawVouchers = getField(
    sourceObj,
    'vouchers',
    'accountVouchers',
    'ledgerEntries',
    'cashBook',
    'dayBook'
  );
  const rawReceipts = getField(
    sourceObj,
    'receipts',
    'receiptVouchers',
    'customerReceipts',
    'moneyReceipts'
  );
  const rawPayments = getField(
    sourceObj,
    'payments',
    'paymentVouchers',
    'supplierPayments',
    'vendorPayments'
  );
  const rawJournals = getField(
    sourceObj,
    'journalVouchers',
    'journals',
    'expenses',
    'expenseVouchers'
  );
  const rawBankVouchers = getField(sourceObj, 'bankVouchers', 'bankEntries', 'contraVouchers');

  const combinedVouchers: VoucherDocument[] = [];
  if (Array.isArray(rawVouchers) && rawVouchers.length > 0) {
    combinedVouchers.push(...rawVouchers.map((v, i) => normalizeVoucherDocument(v, i, profile)));
  }
  if (Array.isArray(rawReceipts) && rawReceipts.length > 0) {
    combinedVouchers.push(
      ...rawReceipts.map((v, i) => normalizeVoucherDocument(v, i, profile, 'RECEIPT'))
    );
  }
  if (Array.isArray(rawPayments) && rawPayments.length > 0) {
    combinedVouchers.push(
      ...rawPayments.map((v, i) => normalizeVoucherDocument(v, i, profile, 'PAYMENT'))
    );
  }
  if (Array.isArray(rawJournals) && rawJournals.length > 0) {
    combinedVouchers.push(
      ...rawJournals.map((v, i) => normalizeVoucherDocument(v, i, profile, 'JOURNAL'))
    );
  }
  if (Array.isArray(rawBankVouchers) && rawBankVouchers.length > 0) {
    combinedVouchers.push(
      ...rawBankVouchers.map((v, i) => normalizeVoucherDocument(v, i, profile, 'BANK'))
    );
  }
  if (combinedVouchers.length > 0) {
    ledger.vouchers = mergeByKey(
      ledger.vouchers,
      combinedVouchers,
      (v) => `${v.voucherType}:${(v.voucherNo || v.id).toLowerCase()}`
    );
    stats.vouchersImported += combinedVouchers.length;
  }

  const rawPos = getField(sourceObj, 'purchaseOrders', 'poList');
  if (Array.isArray(rawPos) && rawPos.length > 0) {
    ledger.purchaseOrders = mergeByKey(
      ledger.purchaseOrders,
      rawPos as PurchaseOrderDocument[],
      (po) => (po.poNo || po.id).toLowerCase()
    );
  }

  const rawCrm = getField(sourceObj, 'crmFollowUps', 'followUps', 'leads');
  if (Array.isArray(rawCrm) && rawCrm.length > 0) {
    ledger.crmFollowUps = mergeByKey(
      ledger.crmFollowUps,
      rawCrm as CrmFollowUp[],
      (c) => c.id || `${c.partyName}-${c.subject}`
    );
  }
}
