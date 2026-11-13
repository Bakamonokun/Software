export type ProfileType = 'GST' | 'NON_GST';

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED';
export type LanguageCode = 'en' | 'hi' | 'es';

export type UserRole = 'DEVELOPER' | 'ADMIN' | 'MANAGER' | 'CASHIER' | 'AUDITOR';

export interface StaffUser {
  id: string;
  username: string;
  passwordHash: string;
  displayName: string;
  role: UserRole;
  allowedProfile: ProfileType | 'BOTH';
  mfaEnabled: boolean;
  mfaCode: string;
  active: boolean;
  storeId: string;
  lastLogin?: string;
}

export interface ItemStockBatch {
  id: string;
  batchNo: string;
  mfgDate?: string;
  expiryDate: string; // YYYY-MM-DD
  qty: number;
  mrp?: number;
  purchaseRate?: number;
}

export interface ItemMaster {
  id: string;
  code: string;
  barcode: string;
  name: string;
  category: string;
  unit: string;
  hsnCode: string;
  gstPercent: number;
  basePrice: number;
  cgstAmount: number;
  sgstAmount: number;
  sellingPrice: number;
  purchasePrice: number;
  stockQty: number;
  minStockLevel: number;
  storeLocation: string;
  updatedAt: string;
  batches?: ItemStockBatch[];
}

export interface CustomerMaster {
  id: string;
  code: string;
  name: string;
  mobile: string;
  email: string;
  address: string;
  gstin: string;
  state: string;
  openingBalanceGst: number;
  openingBalanceNonGst: number;
  signatureDataUrl?: string;
}

export interface SupplierMaster {
  id: string;
  code: string;
  name: string;
  mobile: string;
  email: string;
  address: string;
  gstin: string;
  state: string;
  openingBalanceGst: number;
  openingBalanceNonGst: number;
}

export interface HsnMaster {
  id: string;
  code: string;
  description: string;
  gstPercent: number;
  cgstPercent: number;
  sgstPercent: number;
}

export interface BankMaster {
  id: string;
  bankName: string;
  accountNo: string;
  ifsc: string;
  branch: string;
  openingBalanceGst: number;
  openingBalanceNonGst: number;
}

export type ReceiptPaperSize = 'THERMAL_80MM' | 'THERMAL_58MM' | 'A4' | 'A5';

export interface PrinterSettingsConfig {
  selectedPrinterName: string;
  connectionType: 'USB' | 'BLUETOOTH' | 'LAN_IP' | 'WINDOWS_SPOOLER';
  paperSize: ReceiptPaperSize;
  marginTopMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  autoCutPaper: boolean;
  openCashDrawer: boolean;
  copiesCount: number;
}

export interface CompanyMaster {
  firmName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  state: string;
  upiId: string;
  financialYear: string;
  termsAndConditions: string;
  currency: CurrencyCode;
  language: LanguageCode;
  smtpEmailReceipts: boolean;
  lowStockEmailAlerts: boolean;
  logoDataUrl?: string;
  signatureDataUrl?: string;
  printerSettings?: PrinterSettingsConfig;
}

export interface BillLineItem {
  id: string;
  itemId: string;
  code: string;
  barcode: string;
  name: string;
  hsn: string;
  unit: string;
  qty: number;
  basePrice: number;
  rate: number;
  disc1Percent: number;
  disc2Percent: number;
  gstPercent: number;
  cgst: number;
  sgst: number;
  amount: number;
}

export interface SaleDocument {
  id: string;
  profile: ProfileType;
  docType: 'SALE' | 'STOCK_OUT' | 'CREDIT_NOTE';
  invoiceNo: string;
  manualRefNo: string;
  date: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  customerEmail: string;
  customerDetails: string;
  customerSignatureDataUrl?: string;
  companySignatureDataUrl?: string;
  paymentMode: 'Cash' | 'UPI' | 'Card' | 'Bank' | 'Credit';
  transportRef: string;
  billType: 'GST Bill' | 'Non-GST Bill';
  lines: BillLineItem[];
  itemsValue: number;
  billDiscount: number;
  billAmount?: number;
  previousBalance?: number;
  adjustedCreditAmount?: number;
  totalAmount: number;
  receivedAmount: number;
  remainingAmount: number;
  upiId: string;
  adjustCreditedAmount: boolean;
  remarks: string;
  storeId: string;
  createdBy: string;
  createdAt: string;
  qrSignatureHash: string;
  emailReceiptSent: boolean;
}

export interface PurchaseDocument {
  id: string;
  profile: ProfileType;
  docType: 'PURCHASE' | 'PURCHASE_RETURN';
  invoiceNo: string;
  supplierBillNo: string;
  date: string;
  supplierId: string;
  supplierName: string;
  paymentMode: 'Cash' | 'UPI' | 'Card' | 'Bank' | 'Credit';
  transportRef: string;
  billType: 'GST Bill' | 'Non-GST Bill';
  lines: BillLineItem[];
  itemsValue: number;
  billDiscount: number;
  additionalCharge: number;
  billAmount?: number;
  previousBalance?: number;
  adjustedCreditAmount?: number;
  reverseCharge: boolean;
  adjustCreditedAmount: boolean;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  remarks: string;
  storeId: string;
  createdBy: string;
  createdAt: string;
}

export interface JournalExpenseRow {
  id: string;
  expenseHead: string;
  description: string;
  amount: number;
}

export interface VoucherDocument {
  id: string;
  profile: ProfileType;
  voucherType: 'RECEIPT' | 'PAYMENT' | 'JOURNAL' | 'BANK';
  voucherNo: string;
  date: string;
  partyId: string;
  partyName: string;
  paymentMode: string;
  neftUtrNo: string;
  remarks: string;
  amount: number;
  expenseRows: JournalExpenseRow[];
  createdBy: string;
  createdAt: string;
}

export interface PurchaseOrderDocument {
  id: string;
  profile: ProfileType;
  poNo: string;
  date: string;
  supplierId: string;
  supplierName: string;
  supplierMobile: string;
  lines: {
    itemId: string;
    code: string;
    name: string;
    unit: string;
    qty: number;
    rate: number;
    amount: number;
  }[];
  totalAmount: number;
  status: 'DRAFT' | 'SENT_WHATSAPP' | 'RECEIVED';
  notes: string;
  createdAt: string;
}

export interface CrmFollowUp {
  id: string;
  profile: ProfileType;
  partyName: string;
  mobile: string;
  email: string;
  subject: string;
  nextFollowUpDate: string;
  status: 'OPEN' | 'FOLLOW_UP' | 'CONVERTED' | 'CLOSED';
  notes: string;
  createdAt: string;
}

export interface ProfileLedgerData {
  profile: ProfileType;
  cashOpeningBalance: number;
  sales: SaleDocument[];
  purchases: PurchaseDocument[];
  vouchers: VoucherDocument[];
  purchaseOrders: PurchaseOrderDocument[];
  crmFollowUps: CrmFollowUp[];
  heldBills: {
    id: string;
    label: string;
    savedAt: string;
    docType: 'SALE' | 'PURCHASE' | 'STOCK_OUT' | 'CREDIT_NOTE' | 'PURCHASE_RETURN';
    payload: unknown;
  }[];
  counters: {
    sale: number;
    stockOut: number;
    creditNote: number;
    purchase: number;
    purchaseReturn: number;
    receipt: number;
    payment: number;
    journal: number;
    bankVoucher: number;
    purchaseOrder: number;
  };
}

export interface RegisteredDevice {
  deviceId: string;
  deviceName: string;
  platform: 'Windows' | 'Android' | 'iOS' | 'Linux' | 'Mac';
  ipAddress: string;
  status: 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'REVOKED';
  deviceKey: string;
  storeId: string;
  lastSeen: string;
  appVersion: string;
}

export interface StoreNode {
  storeId: string;
  storeName: string;
  city: string;
  syncStatus: 'SYNCED' | 'OFFLINE_QUEUED' | 'SYNCING';
  lastSyncAt: string;
  activeTerminals: number;
}

export interface SystemAlert {
  id: string;
  timestamp: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  targetDevice: string;
  acknowledged: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  profile: string;
  module: string;
  action: string;
  details: string;
  integrityHash: string;
}

export interface CloudBackupSnapshot {
  id: string;
  timestamp: string;
  profile: ProfileType | 'FULL_SUITE';
  fileName: string;
  sizeBytes: number;
  sha256Checksum: string;
  encrypted: boolean;
  createdBy: string;
}

export interface ServerState {
  revision: number;
  firmId: string;
  serverStatus: 'ONLINE' | 'SUSPENDED' | 'SHUTDOWN';
  suspensionReason: string;
  certificateSha256: string;
  udpDiscoveryPort: number;
  httpsPort: number;
  pciComplianceActive: boolean;
  e2eEncryptionActive: boolean;
  autoCloudBackup: boolean;
  multiStoreSyncEnabled: boolean;
  manualOverrides: Record<string, string>;
  company: CompanyMaster;
  items: ItemMaster[];
  customers: CustomerMaster[];
  suppliers: SupplierMaster[];
  hsnCodes: HsnMaster[];
  banks: BankMaster[];
  profiles: {
    GST: ProfileLedgerData;
    NON_GST: ProfileLedgerData;
  };
  users: StaffUser[];
  devices: RegisteredDevice[];
  stores: StoreNode[];
  alerts: SystemAlert[];
  auditLogs: AuditLogEntry[];
  cloudBackups: CloudBackupSnapshot[];
}
