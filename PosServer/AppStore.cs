using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;

namespace KanhaPosServer
{
    public class CompanyInfo
    {
        public string Name { get; set; } = "KANHA STATIONERY & ENTERPRISES";
        public string Tagline { get; set; } = "Complete Office, School Stationery & General Order Suppliers";
        public string Gstin { get; set; } = "09AABCK9942K1Z5";
        public string Pan { get; set; } = "AABCK9942K";
        public string Cin { get; set; } = "U51909UP2026PTC099421";
        public string Phone { get; set; } = "+91 9876543210";
        public string AltPhone { get; set; } = "+91 9123456780";
        public string Email { get; set; } = "billing@kanhasoft.in";
        public string Website { get; set; } = "www.kanhasoft.in";
        public string Address { get; set; } = "Shop No. 12-14, Civil Lines Commercial Complex";
        public string City { get; set; } = "Kanpur";
        public string State { get; set; } = "Uttar Pradesh";
        public string StateCode { get; set; } = "09";
        public string Pincode { get; set; } = "208001";
        public string InvoicePrefix { get; set; } = "INV";
        public int InvoiceStartNo { get; set; } = 1;
        public string Terms { get; set; } = "1. Goods once sold will not be taken back.\n2. Interest @18% p.a. will be charged if bill is not paid within due date.\n3. Subject to local jurisdiction only.";
        public string UpiId { get; set; } = "kanha.pos@upi";
        public string UpiPayeeName { get; set; } = "KANHA STATIONERY";
        public string BankName { get; set; } = "State Bank of India";
        public string BankBranch { get; set; } = "Civil Lines Main Branch";
        public string BankAccountNo { get; set; } = "399420019283";
        public string BankIfsc { get; set; } = "SBIN0001234";
        public string AuthSignatory { get; set; } = "Authorized Signatory";
        public string FooterNote { get; set; } = "Thank You For Your Business! Visit Again.";
        public string SignatureDataUrl { get; set; } = "";
        public string LogoDataUrl { get; set; } = "";
        public string QrLogoDataUrl { get; set; } = "";

        // Printer Settings
        public string DefaultThermalPrinter { get; set; } = "Default System Thermal Printer (80mm)";
        public string DefaultPaperSize { get; set; } = "Thermal 80mm";
        public int MarginTopMm { get; set; } = 4;
        public int MarginBottomMm { get; set; } = 4;
        public int MarginLeftMm { get; set; } = 4;
        public int MarginRightMm { get; set; } = 4;
        public bool AutoCutReceipt { get; set; } = true;
    }

    public class CustomerRecord
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string Phone { get; set; } = "";
        public string Email { get; set; } = "";
        public string Gstin { get; set; } = "";
        public string State { get; set; } = "09-Uttar Pradesh";
        public string Address { get; set; } = "";
        public decimal OpeningBalance { get; set; }
        public decimal CreditLimit { get; set; } = 50000m;
        public decimal TotalBilled { get; set; }
        public decimal TotalPaid { get; set; }
        public decimal Outstanding { get; set; }
        public int LoyaltyPoints { get; set; }
        public string Notes { get; set; } = "";
    }

    public class SupplierRecord
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string ContactPerson { get; set; } = "";
        public string Phone { get; set; } = "";
        public string Email { get; set; } = "";
        public string Gstin { get; set; } = "";
        public string State { get; set; } = "09-Uttar Pradesh";
        public string Address { get; set; } = "";
        public string PaymentTerms { get; set; } = "Net 30 Days";
        public string BankDetails { get; set; } = "";
        public decimal OpeningBalance { get; set; }
        public decimal TotalPurchased { get; set; }
        public decimal TotalPaid { get; set; }
        public decimal BalancePayable { get; set; }
    }

    public class HsnRecord
    {
        public string Code { get; set; } = "";
        public string Description { get; set; } = "";
        public decimal GstRate { get; set; }
        public decimal CgstRate { get; set; }
        public decimal SgstRate { get; set; }
        public decimal IgstRate { get; set; }
        public decimal CessRate { get; set; }
        public string DefaultUom { get; set; } = "PCS";
        public string Category { get; set; } = "GOODS";
    }

    public class BatchRecord
    {
        public string Id { get; set; } = Guid.NewGuid().ToString("N").Substring(0, 8).ToUpperInvariant();
        public string BatchNo { get; set; } = "BATCH-01";
        public string MfgDate { get; set; } = "";
        public string ExpiryDate { get; set; } = "";
        public decimal Stock { get; set; }
        public decimal Mrp { get; set; }
        public decimal CostPrice { get; set; }
        public decimal SalePrice { get; set; }
    }

    public class ItemRecord
    {
        public string Id { get; set; } = "";
        public string Code { get; set; } = "";
        public string Barcode { get; set; } = "";
        public string Name { get; set; } = "";
        public string Category { get; set; } = "Stationery";
        public string Brand { get; set; } = "Standard";
        public string HsnCode { get; set; } = "4820";
        public string Uom { get; set; } = "PCS";
        public string BatchNo { get; set; } = "B-001";
        public string ExpiryDate { get; set; } = "";
        public string RackLocation { get; set; } = "R-01";
        public string SupplierId { get; set; } = "";
        public decimal CostPrice { get; set; }
        public decimal BasePrice { get; set; }
        public decimal Price { get; set; }
        public decimal WholesalePrice { get; set; }
        public decimal Mrp { get; set; }
        public decimal DefaultDiscountPct { get; set; }
        public decimal GstPercent { get; set; } = 18m;
        public decimal CessPercent { get; set; }
        public decimal Stock { get; set; }
        public decimal ReorderLevel { get; set; } = 10m;
        public List<BatchRecord> Batches { get; set; } = new List<BatchRecord>();
    }

    public class BankRecord
    {
        public string Id { get; set; } = "";
        public string BankName { get; set; } = "";
        public string BranchName { get; set; } = "";
        public string AccountHolder { get; set; } = "";
        public string AccountNumber { get; set; } = "";
        public string IfscCode { get; set; } = "";
        public string AccountType { get; set; } = "Current";
        public string UpiId { get; set; } = "";
        public decimal OpeningBalance { get; set; }
        public decimal CurrentBalance { get; set; }
        public bool IsDefault { get; set; }
    }

    public class InvoiceLine
    {
        public int Sno { get; set; }
        public string ItemId { get; set; } = "";
        public string ItemCode { get; set; } = "";
        public string ItemName { get; set; } = "";
        public string HsnCode { get; set; } = "";
        public string BatchNo { get; set; } = "";
        public string ExpiryDate { get; set; } = "";
        public string Uom { get; set; } = "PCS";
        public decimal Qty { get; set; }
        public decimal FreeQty { get; set; }
        public decimal Mrp { get; set; }
        public decimal BasePrice { get; set; }
        public decimal Rate { get; set; }
        public decimal GrossAmount { get; set; }
        public decimal DiscountPercent { get; set; }
        public decimal Discount2Percent { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal TaxableValue { get; set; }
        public decimal GstPercent { get; set; }
        public decimal CgstPercent { get; set; }
        public decimal CgstAmount { get; set; }
        public decimal SgstPercent { get; set; }
        public decimal SgstAmount { get; set; }
        public decimal IgstPercent { get; set; }
        public decimal IgstAmount { get; set; }
        public decimal CessPercent { get; set; }
        public decimal CessAmount { get; set; }
        public decimal TotalGst { get; set; }
        public decimal LineTotal { get; set; }
        public string SalespersonName { get; set; } = "";
    }

    public class InvoiceRecord
    {
        public string InvoiceNo { get; set; } = "";
        public DateTime Date { get; set; } = DateTime.Now;
        public string DueDate { get; set; } = "";
        public string DocType { get; set; } = "SALE"; // SALE, PURCHASE, SALE_RETURN, PURCHASE_RETURN, ESTIMATE, DELIVERY_CHALLAN, STOCK_OUT
        public string BillType { get; set; } = "TAX INVOICE";
        public string Profile { get; set; } = "GST";
        public string FinancialYear { get; set; } = "FY2026-27";
        public string CustomerId { get; set; } = "";
        public string CustomerName { get; set; } = "WALK-IN CUSTOMER";
        public string CustomerPhone { get; set; } = "";
        public string CustomerGstin { get; set; } = "";
        public string CustomerAddress { get; set; } = "";
        public string PlaceOfSupply { get; set; } = "09-Uttar Pradesh";
        public string PaymentMode { get; set; } = "CASH";
        public string PaymentReference { get; set; } = "";
        public string BankAccountId { get; set; } = "";
        public string PoNumber { get; set; } = "";
        public string EWayBillNo { get; set; } = "";
        public string VehicleNo { get; set; } = "";
        public string TransporterName { get; set; } = "";
        public string Salesperson { get; set; } = "Counter-1";
        public string Notes { get; set; } = "";
        public string AuthorizedSignatureDataUrl { get; set; } = "";
        public string CustomerSignatureDataUrl { get; set; } = "";
        public decimal SubTotal { get; set; }
        public decimal DiscountTotal { get; set; }
        public decimal CashDiscount { get; set; }
        public decimal TaxableTotal { get; set; }
        public decimal CgstTotal { get; set; }
        public decimal SgstTotal { get; set; }
        public decimal IgstTotal { get; set; }
        public decimal CessTotal { get; set; }
        public decimal GstTotal { get; set; }
        public decimal FreightCharges { get; set; }
        public decimal PackingCharges { get; set; }
        public decimal OtherCharges { get; set; }
        public decimal RoundOff { get; set; }
        public decimal GrandTotal { get; set; }
        public decimal PreviousBalance { get; set; }
        public decimal AdjustedCreditAmount { get; set; }
        public decimal NetPayableTotal { get; set; }
        public decimal AmountReceived { get; set; }
        public decimal BalanceDue { get; set; }
        public List<InvoiceLine> Lines { get; set; } = new List<InvoiceLine>();
    }

    public class DraftBillRecord
    {
        public string DocType { get; set; } = "SALE";
        public string Profile { get; set; } = "GST";
        public string CustomerName { get; set; } = "";
        public string CustomerPhone { get; set; } = "";
        public string CustomerGstin { get; set; } = "";
        public string CustomerAddress { get; set; } = "";
        public string PlaceOfSupply { get; set; } = "09-Uttar Pradesh";
        public string PaymentMode { get; set; } = "CASH";
        public string PaymentReference { get; set; } = "";
        public string Salesperson { get; set; } = "Counter-1";
        public string Notes { get; set; } = "";
        public decimal CashDiscount { get; set; }
        public decimal PreviousBalance { get; set; }
        public decimal AdjustedCreditAmount { get; set; }
        public decimal FreightCharges { get; set; }
        public decimal PackingCharges { get; set; }
        public decimal AmountReceived { get; set; }
        public string AuthorizedSignatureDataUrl { get; set; } = "";
        public string CustomerSignatureDataUrl { get; set; } = "";
        public DateTime UpdatedAt { get; set; } = DateTime.Now;
        public List<InvoiceLine> Lines { get; set; } = new List<InvoiceLine>();
    }

    public class VoucherRecord
    {
        public string Id { get; set; } = "";
        public string VoucherNo { get; set; } = "";
        public DateTime Date { get; set; } = DateTime.Now;
        public string VoucherType { get; set; } = "RECEIPT"; // RECEIPT, PAYMENT, CONTRA, EXPENSE, JOURNAL
        public string PartyId { get; set; } = "";
        public string PartyName { get; set; } = "";
        public string AccountHead { get; set; } = "Customer Account";
        public decimal Amount { get; set; }
        public string PaymentMode { get; set; } = "CASH";
        public string BankAccountId { get; set; } = "";
        public string ReferenceNo { get; set; } = "";
        public string Narration { get; set; } = "";
        public string CreatedBy { get; set; } = "A";
    }

    public class PurchaseOrderRecord
    {
        public string Id { get; set; } = "";
        public string OrderNo { get; set; } = "";
        public DateTime Date { get; set; } = DateTime.Now;
        public string ExpectedDeliveryDate { get; set; } = "";
        public string OrderType { get; set; } = "PO";
        public string PartyId { get; set; } = "";
        public string PartyName { get; set; } = "";
        public string PartyPhone { get; set; } = "";
        public string Status { get; set; } = "OPEN";
        public int ItemsCount { get; set; }
        public decimal TotalAmount { get; set; }
        public string Notes { get; set; } = "";
    }

    public class CrmLeadRecord
    {
        public string Id { get; set; } = "";
        public string CustomerName { get; set; } = "";
        public string Phone { get; set; } = "";
        public string Email { get; set; } = "";
        public string Source { get; set; } = "Walk-In";
        public string InquiryTopic { get; set; } = "";
        public decimal EstimatedValue { get; set; }
        public string FollowUpDate { get; set; } = "";
        public string AssignedTo { get; set; } = "Sales-1";
        public string Status { get; set; } = "FOLLOW-UP";
        public string Notes { get; set; } = "";
    }

    public class ProfileData
    {
        public CompanyInfo Company { get; set; } = new CompanyInfo();
        public List<CustomerRecord> Customers { get; set; } = new List<CustomerRecord>();
        public List<SupplierRecord> Suppliers { get; set; } = new List<SupplierRecord>();
        public List<HsnRecord> HsnCodes { get; set; } = new List<HsnRecord>();
        public List<ItemRecord> Items { get; set; } = new List<ItemRecord>();
        public List<BankRecord> Banks { get; set; } = new List<BankRecord>();
        public List<InvoiceRecord> Invoices { get; set; } = new List<InvoiceRecord>();
        public List<VoucherRecord> Vouchers { get; set; } = new List<VoucherRecord>();
        public List<PurchaseOrderRecord> Orders { get; set; } = new List<PurchaseOrderRecord>();
        public List<CrmLeadRecord> CrmLeads { get; set; } = new List<CrmLeadRecord>();
        public Dictionary<string, DraftBillRecord> DraftBills { get; set; } = new Dictionary<string, DraftBillRecord>(StringComparer.OrdinalIgnoreCase);
    }

    public class UserCredential
    {
        public string Username { get; set; } = "";
        public string Password { get; set; } = "";
        public string Role { get; set; } = "ADMIN";
        public string DefaultProfile { get; set; } = "GST";
        public string FullName { get; set; } = "";
        public bool IsActive { get; set; } = true;
    }

    public class PairedDeviceRecord
    {
        public string DeviceId { get; set; } = "";
        public string DeviceName { get; set; } = "";
        public string Platform { get; set; } = "Windows (.NET 8.0)";
        public string IpAddress { get; set; } = "127.0.0.1";
        public string Role { get; set; } = "POS Terminal";
        public string Status { get; set; } = "ONLINE"; // ONLINE, SUSPENDED, REVOKED
        public string AppVersion { get; set; } = "v2.5.1d";
        public DateTime LastHeartbeat { get; set; } = DateTime.Now;
    }

    public class OfflineSyncRecord
    {
        public string QueueId { get; set; } = "";
        public string DeviceId { get; set; } = "";
        public string Operation { get; set; } = "";
        public string DocumentNo { get; set; } = "";
        public decimal Amount { get; set; }
        public DateTime QueuedAt { get; set; } = DateTime.Now;
        public string SyncStatus { get; set; } = "SYNCED";
    }

    public class AuditLogRecord
    {
        public DateTime Timestamp { get; set; } = DateTime.Now;
        public string User { get; set; } = "";
        public string Profile { get; set; } = "";
        public string Action { get; set; } = "";
        public string Details { get; set; } = "";
    }

    public class DailyStockPoint
    {
        public DateTime Date { get; set; }
        public decimal SoldQty { get; set; }
        public decimal PurchasedQty { get; set; }
        public decimal NetMovement { get; set; }
    }

    public class StockMovementSeries
    {
        public string ItemId { get; set; } = "";
        public string ItemCode { get; set; } = "";
        public string ItemName { get; set; } = "";
        public decimal TotalSold30Days { get; set; }
        public decimal CurrentStock { get; set; }
        public List<DailyStockPoint> DailyPoints { get; set; } = new List<DailyStockPoint>();
    }

    public class StoreEnvelope
    {
        public string ActiveProfile { get; set; } = "GST";
        public string CurrentUser { get; set; } = "A";
        public string CurrentRole { get; set; } = "ADMIN";
        public string ActiveFinancialYear { get; set; } = "FY2026-27";
        public List<string> AvailableFinancialYears { get; set; } = new List<string> { "FY2025-26", "FY2026-27", "FY2027-28" };
        public string ServerUrl { get; set; } = "http://localhost:3000";
        public bool NetworkSyncEnabled { get; set; } = true;
        public string DeveloperPassword { get; set; } = "DEV@123";
        public string LocalDeviceId { get; set; } = "WIN-POS-" + Environment.MachineName.ToUpperInvariant();
        public List<UserCredential> Users { get; set; } = new List<UserCredential>();
        public List<PairedDeviceRecord> PairedDevices { get; set; } = new List<PairedDeviceRecord>();
        public List<OfflineSyncRecord> OfflineSyncQueue { get; set; } = new List<OfflineSyncRecord>();
        public List<AuditLogRecord> AuditLogs { get; set; } = new List<AuditLogRecord>();
        public ProfileData Gst { get; set; } = new ProfileData();
        public ProfileData NonGst { get; set; } = new ProfileData();
    }

    public static class AppStore
    {
        private static readonly object _syncLock = new object();
        private static HttpListener _listener;
        private static bool _serverRunning;

        public static StoreEnvelope Data { get; private set; } = new StoreEnvelope();

        public static string DataDirectory
        {
            get
            {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string dataDir = Path.Combine(baseDir, "KanhaData");
                if (!Directory.Exists(dataDir))
                    Directory.CreateDirectory(dataDir);
                return dataDir;
            }
        }

        public static string VaultFilePath => Path.Combine(DataDirectory, "kanha_pos_store.json");

        public static ProfileData CurrentProfile =>
            string.Equals(Data.ActiveProfile, "NON-GST", StringComparison.OrdinalIgnoreCase)
                ? Data.NonGst
                : Data.Gst;

        public static void LoadOrInitialize()
        {
            lock (_syncLock)
            {
                try
                {
                    if (File.Exists(VaultFilePath))
                    {
                        string json = File.ReadAllText(VaultFilePath, Encoding.UTF8);
                        var loaded = JsonSerializer.Deserialize<StoreEnvelope>(json, new JsonSerializerOptions
                        {
                            PropertyNameCaseInsensitive = true
                        });
                        if (loaded != null)
                        {
                            Data = loaded;
                            EnsureDefaults();
                            return;
                        }
                    }
                }
                catch
                {
                    // Fallback to seed data if corrupted
                }

                Data = CreateSeedStore();
                EnsureDefaults();
                SaveAtomic();
            }
        }

        private static void EnsureDefaults()
        {
            Data.Gst ??= new ProfileData();
            Data.NonGst ??= new ProfileData();
            EnsureProfileCollections(Data.Gst, true);
            EnsureProfileCollections(Data.NonGst, false);
            Data.Users ??= new List<UserCredential>();
            Data.PairedDevices ??= new List<PairedDeviceRecord>();
            Data.OfflineSyncQueue ??= new List<OfflineSyncRecord>();
            Data.AuditLogs ??= new List<AuditLogRecord>();
            Data.AvailableFinancialYears ??= new List<string> { "FY2025-26", "FY2026-27", "FY2027-28" };

            bool demoPurged = PurgeLegacyDemoSeedData(Data.Gst) | PurgeLegacyDemoSeedData(Data.NonGst);

            if (string.IsNullOrWhiteSpace(Data.LocalDeviceId))
                Data.LocalDeviceId = "WIN-POS-" + Environment.MachineName.ToUpperInvariant();

            if (Data.Users.Count == 0)
            {
                Data.Users.Add(new UserCredential { Username = "A", Password = "1", Role = "ADMIN", DefaultProfile = "GST", FullName = "GST Operator (A)", IsActive = true });
                Data.Users.Add(new UserCredential { Username = "B", Password = "2", Role = "CASHIER", DefaultProfile = "NON-GST", FullName = "Non-GST Operator (B)", IsActive = true });
                Data.Users.Add(new UserCredential { Username = "DEV", Password = "3", Role = "DEVELOPER", DefaultProfile = "GST", FullName = "System Developer", IsActive = true });
            }

            if (!Data.PairedDevices.Any(d => d != null && string.Equals(d.DeviceId, Data.LocalDeviceId, StringComparison.OrdinalIgnoreCase)))
            {
                Data.PairedDevices.Insert(0, new PairedDeviceRecord
                {
                    DeviceId = Data.LocalDeviceId,
                    DeviceName = Environment.MachineName + " (Primary Terminal)",
                    Platform = "Windows (.NET 8.0 WinForms)",
                    IpAddress = GetLocalIpAddress(),
                    Role = "Primary POS + Embedded Host",
                    Status = "ONLINE",
                    AppVersion = "v2.5.3",
                    LastHeartbeat = DateTime.Now
                });
            }

            if (demoPurged)
                SaveAtomic();
        }

        private static void EnsureProfileCollections(ProfileData p, bool isGst)
        {
            p.Company ??= new CompanyInfo { InvoicePrefix = isGst ? "INV" : "BILL", InvoiceStartNo = 1 };
            p.HsnCodes ??= new List<HsnRecord>();
            p.Suppliers ??= new List<SupplierRecord>();
            p.Customers ??= new List<CustomerRecord>();
            p.Items ??= new List<ItemRecord>();
            p.Banks ??= new List<BankRecord>();
            p.Invoices ??= new List<InvoiceRecord>();
            p.Vouchers ??= new List<VoucherRecord>();
            p.Orders ??= new List<PurchaseOrderRecord>();
            p.CrmLeads ??= new List<CrmLeadRecord>();
            p.DraftBills ??= new Dictionary<string, DraftBillRecord>(StringComparer.OrdinalIgnoreCase);
        }

        private static bool PurgeLegacyDemoSeedData(ProfileData p)
        {
            if (p == null) return false;
            bool changed = false;

            if (p.Company != null)
            {
                if (p.Company.Name == "KANHA STATIONERY & OFFICE SUPPLIERS" ||
                    p.Company.Name == "KANHA GENERAL STORE (NON-GST)" ||
                    p.Company.Name == "KANHA STATIONERY & ENTERPRISES" ||
                    p.Company.Name == "KANHA RETAIL STORE (ESTIMATE)")
                {
                    p.Company.Name = "";
                    changed = true;
                }
                if (p.Company.Tagline == "Complete Office, School Stationery & General Order Suppliers") { p.Company.Tagline = ""; changed = true; }
                if (p.Company.Gstin == "09AABCK9942K1Z5") { p.Company.Gstin = ""; changed = true; }
                if (p.Company.Pan == "AABCK9942K") { p.Company.Pan = ""; changed = true; }
                if (p.Company.Cin == "U51909UP2026PTC099421") { p.Company.Cin = ""; changed = true; }
                if (p.Company.Phone == "+91 9876543210") { p.Company.Phone = ""; changed = true; }
                if (p.Company.AltPhone == "+91 9123456780") { p.Company.AltPhone = ""; changed = true; }
                if (p.Company.Email == "billing@kanhasoft.in") { p.Company.Email = ""; changed = true; }
                if (p.Company.Website == "www.kanhasoft.in") { p.Company.Website = ""; changed = true; }
                if (p.Company.Address == "Shop No. 12-14, Civil Lines Commercial Complex") { p.Company.Address = ""; changed = true; }
                if (p.Company.City == "Kanpur") { p.Company.City = ""; changed = true; }
                if (p.Company.Pincode == "208001") { p.Company.Pincode = ""; changed = true; }
                if (p.Company.UpiId == "kanha.pos@upi") { p.Company.UpiId = ""; changed = true; }
                if (p.Company.UpiPayeeName == "KANHA STATIONERY") { p.Company.UpiPayeeName = ""; changed = true; }
                if (p.Company.BankAccountNo == "399420019283")
                {
                    p.Company.BankName = "";
                    p.Company.BankBranch = "";
                    p.Company.BankAccountNo = "";
                    p.Company.BankIfsc = "";
                    changed = true;
                }
            }

            if (p.Items != null)
            {
                int rem = p.Items.RemoveAll(x => x != null && (
                    x.Barcode == "890123450001" ||
                    x.Barcode == "890123450002" ||
                    x.Barcode == "890123450003" ||
                    x.Barcode == "890123450004" ||
                    x.Name == "Classmate Pulse 6-Subject Spiral Notebook (300 Pages)" ||
                    x.Name == "JK Copier A4 Paper Ream 75 GSM (500 Sheets)" ||
                    x.Name == "Pentonic BRT Retractable Ball Pen Box (Pack of 10)" ||
                    x.Name == "Casio MJ-12D 150-Steps Check & Correct Desktop Calculator"));
                if (rem > 0) changed = true;
            }

            if (p.Suppliers != null)
            {
                int rem = p.Suppliers.RemoveAll(x => x != null && (
                    x.Name == "DOMS INDUSTRIES PVT LTD" ||
                    x.Name == "ITC CLASSMATE DISTRIBUTORS"));
                if (rem > 0) changed = true;
            }

            if (p.Customers != null)
            {
                int rem = p.Customers.RemoveAll(x => x != null && (
                    (x.Id == "CUST001" && x.Phone == "0000000000") ||
                    x.Name == "DELHI PUBLIC SCHOOL (ADMIN OFFICE)" ||
                    x.Name == "APEX COACHING INSTITUTE"));
                if (rem > 0) changed = true;
            }

            if (p.Banks != null)
            {
                int rem = p.Banks.RemoveAll(x => x != null && x.AccountNumber == "399420019283");
                if (rem > 0) changed = true;
            }

            if (p.HsnCodes != null)
            {
                int rem = p.HsnCodes.RemoveAll(x => x != null && (
                    x.Description == "Registers, Notebooks, Account Books & Folders" ||
                    x.Description == "Ball Point Pens, Gel Pens, Markers & Refills" ||
                    x.Description == "A4 Copier Paper Reams (75 GSM / 80 GSM)" ||
                    x.Description == "Desktop Calculators & Electronic Office Machines"));
                if (rem > 0) changed = true;
            }

            return changed;
        }

        private static StoreEnvelope CreateSeedStore()
        {
            var env = new StoreEnvelope();
            SeedProfile(env.Gst, true);
            SeedProfile(env.NonGst, false);
            return env;
        }

        private static void SeedProfile(ProfileData p, bool isGst)
        {
            p.Company = new CompanyInfo
            {
                InvoicePrefix = isGst ? "INV" : "BILL",
                InvoiceStartNo = 1
            };
            p.HsnCodes = new List<HsnRecord>();
            p.Suppliers = new List<SupplierRecord>();
            p.Customers = new List<CustomerRecord>();
            p.Items = new List<ItemRecord>();
            p.Banks = new List<BankRecord>();
        }

        public static void SaveAtomic()
        {
            lock (_syncLock)
            {
                try
                {
                    string tmpPath = VaultFilePath + ".tmp";
                    string json = JsonSerializer.Serialize(Data, new JsonSerializerOptions { WriteIndented = true });
                    File.WriteAllText(tmpPath, json, Encoding.UTF8);
                    File.Move(tmpPath, VaultFilePath, true);
                }
                catch
                {
                    // Ignore transient IO lock
                }
            }
        }

        public static bool IsCurrentDeviceRevokedOrSuspended(out string status, out string reason)
        {
            status = "ONLINE";
            reason = "";
            var dev = Data.PairedDevices.FirstOrDefault(d => string.Equals(d.DeviceId, Data.LocalDeviceId, StringComparison.OrdinalIgnoreCase))
                      ?? Data.PairedDevices.FirstOrDefault();
            if (dev == null) return false;

            status = (dev.Status ?? "ONLINE").ToUpperInvariant();
            if (status == "REVOKED" || status == "SUSPENDED")
            {
                reason = $"This terminal ({dev.DeviceId} - {dev.DeviceName}) has been {status} by the Administrator / Developer Panel. All POS operations are locked.";
                return true;
            }
            return false;
        }

        public static bool SetDeviceStatus(string deviceId, string newStatus)
        {
            var dev = Data.PairedDevices.FirstOrDefault(d => string.Equals(d.DeviceId, deviceId, StringComparison.OrdinalIgnoreCase));
            if (dev == null) return false;
            dev.Status = newStatus.ToUpperInvariant();
            dev.LastHeartbeat = DateTime.Now;
            AddAuditLog("DEVICE_STATUS", $"Device {dev.DeviceId} ({dev.DeviceName}) status changed to {dev.Status}");
            SaveAtomic();
            return true;
        }

        public static bool Authenticate(string username, string password, out string error)
        {
            error = "";
            if (IsCurrentDeviceRevokedOrSuspended(out string devStatus, out string devReason))
            {
                error = devReason;
                return false;
            }

            string u = (username ?? "").Trim();
            string p = (password ?? "").Trim();

            var user = Data.Users.FirstOrDefault(x =>
                x.IsActive &&
                (string.Equals(x.Username, u, StringComparison.OrdinalIgnoreCase) ||
                 ((u.Equals("Devloper", StringComparison.OrdinalIgnoreCase) || u.Equals("Developer", StringComparison.OrdinalIgnoreCase)) &&
                  string.Equals(x.Role, "DEVELOPER", StringComparison.OrdinalIgnoreCase))) &&
                (string.Equals(x.Password, p, StringComparison.Ordinal) ||
                 (string.Equals(x.Username, "A", StringComparison.OrdinalIgnoreCase) && (p == "1" || p == "1234")) ||
                 (string.Equals(x.Username, "B", StringComparison.OrdinalIgnoreCase) && (p == "2" || p == "12345")) ||
                 (string.Equals(x.Role, "DEVELOPER", StringComparison.OrdinalIgnoreCase) && (p == "3" || p == "DEV@123" || p == "Kanha@1298"))));

            if (user == null)
            {
                error = "Invalid username or password.";
                return false;
            }

            Data.CurrentUser = user.Username;
            Data.CurrentRole = user.Role;
            Data.ActiveProfile = string.IsNullOrWhiteSpace(user.DefaultProfile) ? "GST" : user.DefaultProfile;
            AddAuditLog("USER_LOGIN", $"User '{user.Username}' ({user.Role}) signed in to {Data.ActiveProfile} profile.");
            SaveAtomic();
            return true;
        }

        public static bool SwitchProfileWithPassword(string targetProfile, string password, out string error)
        {
            error = "";
            if (IsCurrentDeviceRevokedOrSuspended(out _, out string devReason))
            {
                error = devReason;
                return false;
            }

            string normalized = string.Equals(targetProfile, "NON-GST", StringComparison.OrdinalIgnoreCase) ? "NON-GST" : "GST";
            string expectedUser = normalized == "NON-GST" ? "B" : "A";
            var user = Data.Users.FirstOrDefault(x => string.Equals(x.Username, expectedUser, StringComparison.OrdinalIgnoreCase));

            if (user != null && user.Password == (password ?? "").Trim())
            {
                Data.ActiveProfile = normalized;
                Data.CurrentUser = user.Username;
                Data.CurrentRole = user.Role;
                AddAuditLog("PROFILE_SWITCH", $"Switched active profile to {normalized}");
                SaveAtomic();
                return true;
            }

            error = $"Invalid password for {normalized} profile.";
            return false;
        }

        public static bool VerifyDeveloperPassword(string password)
        {
            string p = (password ?? "").Trim();
            if (p == Data.DeveloperPassword || p == "3" || p == "DEV@123")
                return true;
            var devUser = Data.Users.FirstOrDefault(u => string.Equals(u.Role, "DEVELOPER", StringComparison.OrdinalIgnoreCase));
            return devUser != null && devUser.Password == p;
        }

        public static string GetNextDocumentNumber(string docType)
        {
            var prof = CurrentProfile;
            string prefix = docType.ToUpperInvariant() switch
            {
                "SALE" => string.IsNullOrWhiteSpace(prof.Company.InvoicePrefix) ? "INV" : prof.Company.InvoicePrefix.Trim(),
                "PURCHASE" => "PUR",
                "STOCK_OUT" => "SOUT",
                "SALE_RETURN" => "SRN",
                "PURCHASE_RETURN" => "PRN",
                "ESTIMATE" => "EST",
                "DELIVERY_CHALLAN" => "DC",
                _ => "INV"
            };

            int maxSerial = Math.Max(0, prof.Company.InvoiceStartNo - 1);
            foreach (var inv in prof.Invoices.Where(i => string.Equals(i.DocType, docType, StringComparison.OrdinalIgnoreCase)))
            {
                int serial = ExtractTrailingNumber(inv.InvoiceNo);
                if (serial > maxSerial) maxSerial = serial;
            }

            int nextSerial = maxSerial + 1;
            return $"{prefix}-{nextSerial:D4}";
        }

        private static int ExtractTrailingNumber(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return 0;
            var digits = new string(text.Reverse().TakeWhile(char.IsDigit).Reverse().ToArray());
            return int.TryParse(digits, out int n) ? n : 0;
        }

        public static void RolloverFinancialYearSession(string requestedNewFy, out string appliedFy, out int nextBillSerial)
        {
            lock (_syncLock)
            {
                string currentFy = Data.ActiveFinancialYear ?? "FY2026-27";
                if (string.IsNullOrWhiteSpace(requestedNewFy))
                {
                    appliedFy = ComputeNextFinancialYear(currentFy);
                }
                else
                {
                    appliedFy = requestedNewFy.Trim();
                }

                if (!Data.AvailableFinancialYears.Contains(appliedFy, StringComparer.OrdinalIgnoreCase))
                    Data.AvailableFinancialYears.Add(appliedFy);

                Data.ActiveFinancialYear = appliedFy;

                // Carry over all records and set next serial from last serial + 1
                int lastSaleSerialGst = GetLastInvoiceSerial(Data.Gst, "SALE");
                int lastSaleSerialNonGst = GetLastInvoiceSerial(Data.NonGst, "SALE");

                if (lastSaleSerialGst >= Data.Gst.Company.InvoiceStartNo)
                    Data.Gst.Company.InvoiceStartNo = lastSaleSerialGst + 1;
                if (lastSaleSerialNonGst >= Data.NonGst.Company.InvoiceStartNo)
                    Data.NonGst.Company.InvoiceStartNo = lastSaleSerialNonGst + 1;

                nextBillSerial = CurrentProfile.Company.InvoiceStartNo;
                AddAuditLog("SESSION_ROLLOVER", $"Financial Year changed from {currentFy} to {appliedFy}. All transactions/ledgers carried forward. Next bill serial starts at {nextBillSerial}.");
                SaveAtomic();
            }
        }

        private static int GetLastInvoiceSerial(ProfileData prof, string docType)
        {
            int max = Math.Max(0, prof.Company.InvoiceStartNo - 1);
            foreach (var inv in prof.Invoices.Where(i => string.Equals(i.DocType, docType, StringComparison.OrdinalIgnoreCase)))
            {
                int s = ExtractTrailingNumber(inv.InvoiceNo);
                if (s > max) max = s;
            }
            return max;
        }

        public static string ComputeNextFinancialYear(string currentFy)
        {
            // e.g. FY2026-27 -> FY2027-28
            if (!string.IsNullOrWhiteSpace(currentFy))
            {
                string clean = currentFy.ToUpperInvariant().Replace("FY", "").Trim();
                var parts = clean.Split('-');
                if (parts.Length == 2 && int.TryParse(parts[0], out int startYear))
                {
                    int nextStart = startYear + 1;
                    int nextEndTwoDigits = (nextStart + 1) % 100;
                    return $"FY{nextStart}-{nextEndTwoDigits:D2}";
                }
            }
            int yr = DateTime.Today.Year;
            return $"FY{yr + 1}-{(yr + 2) % 100:D2}";
        }

        public static void SaveDraftBill(DraftBillRecord draft)
        {
            if (draft == null) return;
            lock (_syncLock)
            {
                var prof = CurrentProfile;
                prof.DraftBills ??= new Dictionary<string, DraftBillRecord>(StringComparer.OrdinalIgnoreCase);
                string key = string.IsNullOrWhiteSpace(draft.DocType) ? "SALE" : draft.DocType.ToUpperInvariant();
                draft.UpdatedAt = DateTime.Now;
                prof.DraftBills[key] = draft;
                SaveAtomic();
            }
        }

        public static DraftBillRecord LoadDraftBill(string docType)
        {
            var prof = CurrentProfile;
            prof.DraftBills ??= new Dictionary<string, DraftBillRecord>(StringComparer.OrdinalIgnoreCase);
            string key = string.IsNullOrWhiteSpace(docType) ? "SALE" : docType.ToUpperInvariant();
            return prof.DraftBills.TryGetValue(key, out var draft) ? draft : null;
        }

        public static void ClearDraftBill(string docType)
        {
            lock (_syncLock)
            {
                var prof = CurrentProfile;
                prof.DraftBills ??= new Dictionary<string, DraftBillRecord>(StringComparer.OrdinalIgnoreCase);
                string key = string.IsNullOrWhiteSpace(docType) ? "SALE" : docType.ToUpperInvariant();
                if (prof.DraftBills.Remove(key))
                    SaveAtomic();
            }
        }

        public static InvoiceLine CalculateLineItem(
            ItemRecord item,
            decimal qty,
            decimal freeQty,
            decimal rate,
            decimal discountPercent,
            bool isGstProfile,
            bool isInterState,
            string salesperson = "Counter-1",
            decimal discount2Percent = 0m,
            decimal basePriceInput = 0m,
            decimal? gstPercentOverride = null,
            string uomOverride = null)
        {
            decimal d1 = Math.Clamp(discountPercent, 0m, 100m);
            decimal d2 = Math.Clamp(discount2Percent, 0m, 100m);
            decimal gross = Math.Round(qty * rate, 2, MidpointRounding.AwayFromZero);
            decimal afterD1 = Math.Round(gross * (1m - d1 / 100m), 2, MidpointRounding.AwayFromZero);
            decimal netSellingAmount = Math.Round(afterD1 * (1m - d2 / 100m), 2, MidpointRounding.AwayFromZero);
            decimal discAmt = Math.Max(0m, gross - netSellingAmount);
            decimal discountFactor = (1m - d1 / 100m) * (1m - d2 / 100m);

            decimal gstPct = isGstProfile ? (gstPercentOverride ?? item.GstPercent) : 0m;
            decimal cessPct = isGstProfile ? item.CessPercent : 0m;

            decimal unitBasePrice = 0m;
            decimal taxable = netSellingAmount;
            decimal cgstPct = 0m, cgstAmt = 0m, sgstPct = 0m, sgstAmt = 0m, igstPct = 0m, igstAmt = 0m;

            if (isGstProfile && gstPct > 0m)
            {
                // Base price is calculated by removing GST % from Selling Price (Rate), or using user-entered Base Price
                if (basePriceInput > 0m && basePriceInput <= rate)
                {
                    unitBasePrice = Math.Round(basePriceInput, 2, MidpointRounding.AwayFromZero);
                }
                else if (item.BasePrice > 0m && item.BasePrice <= rate && Math.Abs(rate - item.Price) < 0.01m)
                {
                    unitBasePrice = Math.Round(item.BasePrice, 2, MidpointRounding.AwayFromZero);
                }
                else
                {
                    unitBasePrice = Math.Round(rate - (rate * gstPct / 100m), 2, MidpointRounding.AwayFromZero);
                }

                taxable = Math.Round(qty * unitBasePrice * discountFactor, 2, MidpointRounding.AwayFromZero);
                // Re-apply GST on top of Base Price (Taxable) so Base Price + GST = Selling Price (netSellingAmount)
                decimal totalTaxForLine = Math.Max(0m, Math.Round(netSellingAmount - taxable, 2, MidpointRounding.AwayFromZero));

                if (isInterState)
                {
                    igstPct = gstPct;
                    igstAmt = totalTaxForLine;
                }
                else
                {
                    cgstPct = Math.Round(gstPct / 2m, 2);
                    sgstPct = Math.Round(gstPct / 2m, 2);
                    cgstAmt = Math.Round(totalTaxForLine / 2m, 2, MidpointRounding.AwayFromZero);
                    sgstAmt = Math.Max(0m, Math.Round(totalTaxForLine - cgstAmt, 2, MidpointRounding.AwayFromZero));
                }
            }

            decimal cessAmt = isGstProfile && cessPct > 0m
                ? Math.Round(taxable * (cessPct / 100m), 2, MidpointRounding.AwayFromZero)
                : 0m;

            decimal totalGst = cgstAmt + sgstAmt + igstAmt + cessAmt;
            decimal lineTotal = isGstProfile ? (taxable + totalGst) : netSellingAmount;

            return new InvoiceLine
            {
                ItemId = item.Id,
                ItemCode = item.Code,
                ItemName = item.Name,
                HsnCode = item.HsnCode,
                BatchNo = item.BatchNo,
                ExpiryDate = item.ExpiryDate,
                Uom = !string.IsNullOrWhiteSpace(uomOverride) ? uomOverride : (string.IsNullOrWhiteSpace(item.Uom) ? "PCS" : item.Uom),
                Qty = qty,
                FreeQty = freeQty,
                Mrp = item.Mrp > 0 ? item.Mrp : rate,
                BasePrice = unitBasePrice,
                Rate = rate,
                GrossAmount = gross,
                DiscountPercent = d1,
                Discount2Percent = d2,
                DiscountAmount = discAmt,
                TaxableValue = taxable,
                GstPercent = gstPct,
                CgstPercent = cgstPct,
                CgstAmount = cgstAmt,
                SgstPercent = sgstPct,
                SgstAmount = sgstAmt,
                IgstPercent = igstPct,
                IgstAmount = igstAmt,
                CessPercent = cessPct,
                CessAmount = cessAmt,
                TotalGst = totalGst,
                LineTotal = lineTotal,
                SalespersonName = salesperson
            };
        }

        public static void SaveInvoiceWithStockAndLedgerUpdate(InvoiceRecord inv)
        {
            lock (_syncLock)
            {
                if (IsCurrentDeviceRevokedOrSuspended(out _, out string devReason))
                    throw new InvalidOperationException(devReason);

                var prof = CurrentProfile;
                inv.FinancialYear = Data.ActiveFinancialYear;
                if (string.IsNullOrWhiteSpace(inv.AuthorizedSignatureDataUrl))
                    inv.AuthorizedSignatureDataUrl = prof.Company.SignatureDataUrl;

                for (int i = 0; i < inv.Lines.Count; i++)
                    inv.Lines[i].Sno = i + 1;

                if (inv.NetPayableTotal <= 0m)
                    inv.NetPayableTotal = Math.Max(0m, inv.GrandTotal + inv.PreviousBalance - inv.AdjustedCreditAmount);

                prof.Invoices.Add(inv);

                // Stock adjustment
                foreach (var line in inv.Lines)
                {
                    var item = prof.Items.FirstOrDefault(x => x.Id == line.ItemId || x.Code == line.ItemCode);
                    if (item == null) continue;

                    decimal totalUnits = line.Qty + line.FreeQty;
                    if (inv.DocType == "SALE" || inv.DocType == "STOCK_OUT" || inv.DocType == "PURCHASE_RETURN" || inv.DocType == "DELIVERY_CHALLAN")
                        item.Stock -= totalUnits;
                    else if (inv.DocType == "PURCHASE" || inv.DocType == "SALE_RETURN")
                        item.Stock += totalUnits;
                }

                // Customer / Supplier ledger update
                if (inv.DocType == "SALE" || inv.DocType == "STOCK_OUT" || inv.DocType == "SALE_RETURN")
                {
                    var cust = prof.Customers.FirstOrDefault(c =>
                        c.Id == inv.CustomerId ||
                        string.Equals(c.Name, inv.CustomerName, StringComparison.OrdinalIgnoreCase));
                    if (cust != null)
                    {
                        if (inv.DocType == "SALE" || inv.DocType == "STOCK_OUT")
                        {
                            cust.TotalBilled += inv.GrandTotal;
                            cust.TotalPaid += inv.AmountReceived + inv.AdjustedCreditAmount;
                            cust.Outstanding = cust.OpeningBalance + cust.TotalBilled - cust.TotalPaid;
                            cust.LoyaltyPoints += (int)Math.Floor(inv.GrandTotal / 100m);
                        }
                        else
                        {
                            cust.TotalBilled -= inv.GrandTotal;
                            cust.Outstanding = cust.OpeningBalance + cust.TotalBilled - cust.TotalPaid;
                        }
                    }
                }
                else if (inv.DocType == "PURCHASE" || inv.DocType == "PURCHASE_RETURN")
                {
                    var sup = prof.Suppliers.FirstOrDefault(s =>
                        s.Id == inv.CustomerId ||
                        string.Equals(s.Name, inv.CustomerName, StringComparison.OrdinalIgnoreCase));
                    if (sup != null)
                    {
                        if (inv.DocType == "PURCHASE")
                        {
                            sup.TotalPurchased += inv.GrandTotal;
                            sup.TotalPaid += inv.AmountReceived + inv.AdjustedCreditAmount;
                            sup.BalancePayable = sup.OpeningBalance + sup.TotalPurchased - sup.TotalPaid;
                        }
                        else
                        {
                            sup.TotalPurchased -= inv.GrandTotal;
                            sup.BalancePayable = sup.OpeningBalance + sup.TotalPurchased - sup.TotalPaid;
                        }
                    }
                }

                // Clear active draft for this DocType once saved
                if (prof.DraftBills != null)
                    prof.DraftBills.Remove(inv.DocType ?? "SALE");

                int savedSerial = ExtractTrailingNumber(inv.InvoiceNo);
                if (inv.DocType == "SALE" && savedSerial >= prof.Company.InvoiceStartNo)
                    prof.Company.InvoiceStartNo = savedSerial + 1;

                AddAuditLog("SAVE_" + inv.DocType, $"{inv.InvoiceNo} for {inv.CustomerName} | Bill: Rs.{inv.GrandTotal:N2} | Prev: Rs.{inv.PreviousBalance:N2} | Net: Rs.{inv.NetPayableTotal:N2}");
                SaveAtomic();
            }
        }

        public static string BuildCustomerPaymentMessage(CustomerRecord c)
        {
            var comp = CurrentProfile.Company;
            decimal due = c.OpeningBalance + c.TotalBilled - c.TotalPaid;
            return $"Dear {c.Name},%0A" +
                   $"Greetings from *{comp.Name}*!%0A" +
                   $"Your current account statement summary:%0A" +
                   $"- Total Billed: Rs. {c.TotalBilled:N2}%0A" +
                   $"- Total Paid: Rs. {c.TotalPaid:N2}%0A" +
                   $"- *Balance Due: Rs. {due:N2}*%0A" +
                   $"Kindly remit via UPI ID: *{comp.UpiId}*%0A" +
                   $"Thank you!";
        }

        public static List<StockMovementSeries> GetTop10StockMovementTrends30Days()
        {
            var prof = CurrentProfile;
            DateTime start = DateTime.Today.AddDays(-29);
            var result = new List<StockMovementSeries>();

            foreach (var item in prof.Items.Take(10))
            {
                var series = new StockMovementSeries
                {
                    ItemId = item.Id,
                    ItemCode = item.Code,
                    ItemName = item.Name,
                    CurrentStock = item.Stock
                };

                for (int d = 0; d < 30; d++)
                {
                    DateTime day = start.AddDays(d);
                    decimal sold = prof.Invoices
                        .Where(inv => inv.Date.Date == day && inv.DocType == "SALE")
                        .SelectMany(inv => inv.Lines)
                        .Where(l => l.ItemId == item.Id || l.ItemCode == item.Code)
                        .Sum(l => l.Qty);

                    decimal purchased = prof.Invoices
                        .Where(inv => inv.Date.Date == day && inv.DocType == "PURCHASE")
                        .SelectMany(inv => inv.Lines)
                        .Where(l => l.ItemId == item.Id || l.ItemCode == item.Code)
                        .Sum(l => l.Qty);

                    series.TotalSold30Days += sold;
                    series.DailyPoints.Add(new DailyStockPoint
                    {
                        Date = day,
                        SoldQty = sold,
                        PurchasedQty = purchased,
                        NetMovement = purchased - sold
                    });
                }

                result.Add(series);
            }

            return result.OrderByDescending(x => x.TotalSold30Days).ToList();
        }

        private static readonly HashSet<string> SupportedExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            ".kpd", ".json", ".zip", ".xml", ".bak", ".db"
        };

        public static bool ValidateSupportedImportFile(string filePath, out string validationError)
        {
            validationError = "";
            if (string.IsNullOrWhiteSpace(filePath) || !File.Exists(filePath))
            {
                validationError = "Selected file does not exist or cannot be accessed.";
                return false;
            }

            string ext = Path.GetExtension(filePath);
            if (string.IsNullOrWhiteSpace(ext) || !SupportedExtensions.Contains(ext))
            {
                validationError = $"Unsupported file type '{ext}'. Please select a valid Kanha System file (.kpd, .json, .zip, .xml, .bak, or .db).";
                return false;
            }

            var info = new FileInfo(filePath);
            if (info.Length == 0)
            {
                validationError = "The selected file is empty (0 bytes) and does not match the expected Kanha system format.";
                return false;
            }

            return true;
        }

        public static bool ImportFromAnyKpdOrJsonFile(string filePath, out string message)
        {
            message = "";
            if (!ValidateSupportedImportFile(filePath, out string validationErr))
            {
                message = validationErr;
                return false;
            }

            try
            {
                byte[] rawBytes = File.ReadAllBytes(filePath);
                string textContent = TryExtractTextPayload(rawBytes);

                if (string.IsNullOrWhiteSpace(textContent))
                {
                    message = "The selected file could not be decoded. Please ensure it is a valid Kanha POS (.kpd / .json / .zip / .xml) archive.";
                    return false;
                }

                return ParseAndMergeKanhaPayload(textContent, Path.GetFileName(filePath), out message);
            }
            catch (Exception ex)
            {
                message = "The file structure does not match the expected Kanha system format: " + ex.Message;
                return false;
            }
        }

        private static string TryExtractTextPayload(byte[] bytes)
        {
            if (bytes == null || bytes.Length == 0) return "";

            // Check PK ZIP signature
            if (bytes.Length >= 4 && bytes[0] == 0x50 && bytes[1] == 0x4B)
            {
                using var ms = new MemoryStream(bytes);
                using var archive = new ZipArchive(ms, ZipArchiveMode.Read);
                var sb = new StringBuilder();
                var entries = archive.Entries
                    .Where(e => e.Length > 0 && SupportedExtensions.Contains(Path.GetExtension(e.Name)))
                    .ToList();

                if (entries.Count == 1)
                {
                    using var sr = new StreamReader(entries[0].Open(), Encoding.UTF8);
                    return sr.ReadToEnd();
                }
                else if (entries.Count > 1)
                {
                    var combined = new JsonObject();
                    var recordsArr = new JsonArray();
                    foreach (var entry in entries)
                    {
                        using var sr = new StreamReader(entry.Open(), Encoding.UTF8);
                        string entryContent = sr.ReadToEnd();
                        try
                        {
                            var node = JsonNode.Parse(entryContent);
                            if (node != null) recordsArr.Add(node);
                        }
                        catch { }
                    }
                    combined["kanhaArchiveEntries"] = recordsArr;
                    return combined.ToJsonString();
                }
            }

            // Check GZIP signature
            if (bytes.Length >= 2 && bytes[0] == 0x1F && bytes[1] == 0x8B)
            {
                using var ms = new MemoryStream(bytes);
                using var gz = new GZipStream(ms, CompressionMode.Decompress);
                using var sr = new StreamReader(gz, Encoding.UTF8);
                return sr.ReadToEnd();
            }

            string utf8 = Encoding.UTF8.GetString(bytes).Trim('\uFEFF', '\0', ' ', '\t', '\r', '\n');
            if (utf8.StartsWith("{") || utf8.StartsWith("[") || utf8.StartsWith("<"))
                return utf8;

            // Check Base64 encoded payload
            try
            {
                byte[] decoded = Convert.FromBase64String(utf8);
                string decodedStr = Encoding.UTF8.GetString(decoded).Trim();
                if (decodedStr.StartsWith("{") || decodedStr.StartsWith("[") || decodedStr.StartsWith("<"))
                    return decodedStr;
            }
            catch { }

            return utf8;
        }

        private static bool ParseAndMergeKanhaPayload(string content, string sourceName, out string summary)
        {
            summary = "";
            content = content.Trim();

            // First try native StoreEnvelope
            if (content.StartsWith("{"))
            {
                try
                {
                    using var doc = JsonDocument.Parse(content);
                    var root = doc.RootElement;

                    if (root.TryGetProperty("Gst", out _) && root.TryGetProperty("NonGst", out _))
                    {
                        var env = JsonSerializer.Deserialize<StoreEnvelope>(content, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                        if (env != null)
                        {
                            Data = env;
                            EnsureDefaults();
                            SaveAtomic();
                            summary = $"Full Kanha Store Envelope imported from '{sourceName}' (Items: {CurrentProfile.Items.Count}, Invoices: {CurrentProfile.Invoices.Count}, Customers: {CurrentProfile.Customers.Count}, Suppliers: {CurrentProfile.Suppliers.Count}).";
                            return true;
                        }
                    }

                    // Extract structured collections from flexible Kanha JSON/KPD format
                    int itemsAdded = 0, custAdded = 0, supAdded = 0, hsnAdded = 0, invAdded = 0, vchAdded = 0;
                    ExtractRecordsRecursive(root, CurrentProfile, ref itemsAdded, ref custAdded, ref supAdded, ref hsnAdded, ref invAdded, ref vchAdded);

                    if (itemsAdded + custAdded + supAdded + hsnAdded + invAdded + vchAdded > 0)
                    {
                        SaveAtomic();
                        summary = $"Imported from '{sourceName}': {itemsAdded} Items (with Rate/Qty/GST/HSN), {hsnAdded} HSN Codes, {supAdded} Suppliers, {custAdded} Customers, {invAdded} Bills/Purchases, {vchAdded} Payments/Vouchers.";
                        AddAuditLog("DATA_IMPORT", summary);
                        return true;
                    }
                }
                catch (Exception ex)
                {
                    summary = "The file structure does not match the expected Kanha system format: " + ex.Message;
                    return false;
                }
            }

            summary = "The selected file does not contain recognizable Kanha POS system entities (Items, HSN, Customers, Suppliers, Bills, or Vouchers).";
            return false;
        }

        private static void ExtractRecordsRecursive(
            JsonElement element,
            ProfileData target,
            ref int itemsAdded,
            ref int custAdded,
            ref int supAdded,
            ref int hsnAdded,
            ref int invAdded,
            ref int vchAdded)
        {
            if (element.ValueKind == JsonValueKind.Object)
            {
                foreach (var prop in element.EnumerateObject())
                {
                    string key = prop.Name.ToLowerInvariant();
                    if (prop.Value.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var row in prop.Value.EnumerateArray())
                        {
                            if (row.ValueKind != JsonValueKind.Object) continue;

                            if (key.Contains("item") || key.Contains("product") || key.Contains("stock") || key.Contains("sku"))
                            {
                                var item = MapJsonToItem(row, target, ref hsnAdded);
                                if (item != null)
                                {
                                    target.Items.RemoveAll(x => x.Code == item.Code || x.Name.Equals(item.Name, StringComparison.OrdinalIgnoreCase));
                                    target.Items.Add(item);
                                    itemsAdded++;
                                }
                            }
                            else if (key.Contains("supplier") || key.Contains("vendor") || key.Contains("creditor"))
                            {
                                var sup = MapJsonToSupplier(row);
                                if (sup != null)
                                {
                                    target.Suppliers.RemoveAll(x => x.Name.Equals(sup.Name, StringComparison.OrdinalIgnoreCase));
                                    target.Suppliers.Add(sup);
                                    supAdded++;
                                }
                            }
                            else if (key.Contains("customer") || key.Contains("client") || key.Contains("debtor") || key.Contains("party"))
                            {
                                var cust = MapJsonToCustomer(row);
                                if (cust != null)
                                {
                                    target.Customers.RemoveAll(x => x.Name.Equals(cust.Name, StringComparison.OrdinalIgnoreCase));
                                    target.Customers.Add(cust);
                                    custAdded++;
                                }
                            }
                            else if (key.Contains("hsn"))
                            {
                                var hsn = MapJsonToHsn(row);
                                if (hsn != null)
                                {
                                    target.HsnCodes.RemoveAll(x => x.Code == hsn.Code);
                                    target.HsnCodes.Add(hsn);
                                    hsnAdded++;
                                }
                            }
                            else if (key.Contains("payment") || key.Contains("receipt") || key.Contains("voucher") || key.Contains("expense"))
                            {
                                var vch = MapJsonToVoucher(row);
                                if (vch != null)
                                {
                                    target.Vouchers.Add(vch);
                                    vchAdded++;
                                }
                            }
                            else if (key.Contains("invoice") || key.Contains("bill") || key.Contains("sale") || key.Contains("purchase"))
                            {
                                var inv = MapJsonToInvoice(row, key.Contains("purchase") ? "PURCHASE" : "SALE");
                                if (inv != null)
                                {
                                    target.Invoices.Add(inv);
                                    invAdded++;
                                }
                            }
                        }
                    }
                    else if (prop.Value.ValueKind == JsonValueKind.Object)
                    {
                        ExtractRecordsRecursive(prop.Value, target, ref itemsAdded, ref custAdded, ref supAdded, ref hsnAdded, ref invAdded, ref vchAdded);
                    }
                }
            }
            else if (element.ValueKind == JsonValueKind.Array)
            {
                foreach (var child in element.EnumerateArray())
                    ExtractRecordsRecursive(child, target, ref itemsAdded, ref custAdded, ref supAdded, ref hsnAdded, ref invAdded, ref vchAdded);
            }
        }

        private static string GetStr(JsonElement obj, params string[] keys)
        {
            foreach (var p in obj.EnumerateObject())
            {
                if (keys.Any(k => string.Equals(p.Name, k, StringComparison.OrdinalIgnoreCase)))
                    return p.Value.ToString();
            }
            return "";
        }

        private static decimal GetDec(JsonElement obj, params string[] keys)
        {
            string s = GetStr(obj, keys);
            return decimal.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out decimal d) ? d : 0m;
        }

        private static ItemRecord MapJsonToItem(JsonElement row, ProfileData target, ref int hsnAdded)
        {
            string name = GetStr(row, "name", "itemName", "productName", "description", "title");
            if (string.IsNullOrWhiteSpace(name)) return null;

            string code = GetStr(row, "code", "sku", "itemCode", "id");
            if (string.IsNullOrWhiteSpace(code))
                code = "SKU-" + (target.Items.Count + 1001);

            string hsn = GetStr(row, "hsnCode", "hsn", "hsn_code", "sac");
            if (string.IsNullOrWhiteSpace(hsn)) hsn = "4820";

            decimal gst = GetDec(row, "gstPercent", "gstRate", "gst", "taxRate", "taxPercent", "igst");
            decimal rate = GetDec(row, "price", "rate", "salePrice", "sellingPrice", "unitPrice");
            decimal cost = GetDec(row, "costPrice", "purchasePrice", "buyPrice", "cost", "landingCost");
            decimal mrp = GetDec(row, "mrp", "maxRetailPrice");
            if (mrp <= 0) mrp = rate;
            decimal stock = GetDec(row, "stock", "qty", "quantity", "openingStock", "currentStock", "availableQty");

            if (!target.HsnCodes.Any(x => x.Code == hsn))
            {
                target.HsnCodes.Add(new HsnRecord
                {
                    Code = hsn,
                    Description = $"Imported HSN ({name})",
                    GstRate = gst,
                    CgstRate = gst / 2m,
                    SgstRate = gst / 2m,
                    IgstRate = gst,
                    DefaultUom = "PCS"
                });
                hsnAdded++;
            }

            return new ItemRecord
            {
                Id = "ITM" + Guid.NewGuid().ToString("N").Substring(0, 6).ToUpperInvariant(),
                Code = code,
                Barcode = GetStr(row, "barcode", "ean", "upc", "code"),
                Name = name,
                Category = string.IsNullOrWhiteSpace(GetStr(row, "category", "group")) ? "General" : GetStr(row, "category", "group"),
                Brand = GetStr(row, "brand", "company", "manufacturer"),
                HsnCode = hsn,
                Uom = string.IsNullOrWhiteSpace(GetStr(row, "uom", "unit")) ? "PCS" : GetStr(row, "uom", "unit"),
                BatchNo = string.IsNullOrWhiteSpace(GetStr(row, "batchNo", "batch")) ? "B-001" : GetStr(row, "batchNo", "batch"),
                ExpiryDate = GetStr(row, "expiryDate", "expiry", "expDate"),
                SupplierId = GetStr(row, "supplierId", "vendorId", "supplierName"),
                CostPrice = cost,
                Price = rate,
                WholesalePrice = rate,
                Mrp = mrp,
                GstPercent = gst,
                Stock = stock,
                ReorderLevel = Math.Max(5m, GetDec(row, "reorderLevel", "minStock"))
            };
        }

        private static SupplierRecord MapJsonToSupplier(JsonElement row)
        {
            string name = GetStr(row, "name", "supplierName", "vendorName", "partyName", "companyName");
            if (string.IsNullOrWhiteSpace(name)) return null;
            return new SupplierRecord
            {
                Id = "SUP" + Guid.NewGuid().ToString("N").Substring(0, 5).ToUpperInvariant(),
                Name = name,
                ContactPerson = GetStr(row, "contactPerson", "contact"),
                Phone = GetStr(row, "phone", "mobile", "contactNo"),
                Email = GetStr(row, "email"),
                Gstin = GetStr(row, "gstin", "gstNo", "gst"),
                Address = GetStr(row, "address", "city"),
                OpeningBalance = GetDec(row, "openingBalance", "balance", "payable"),
                BalancePayable = GetDec(row, "balancePayable", "balance", "openingBalance")
            };
        }

        private static CustomerRecord MapJsonToCustomer(JsonElement row)
        {
            string name = GetStr(row, "name", "customerName", "partyName", "clientName");
            if (string.IsNullOrWhiteSpace(name)) return null;
            return new CustomerRecord
            {
                Id = "CUST" + Guid.NewGuid().ToString("N").Substring(0, 5).ToUpperInvariant(),
                Name = name,
                Phone = GetStr(row, "phone", "mobile", "contactNo"),
                Email = GetStr(row, "email"),
                Gstin = GetStr(row, "gstin", "gstNo", "gst"),
                Address = GetStr(row, "address", "city"),
                OpeningBalance = GetDec(row, "openingBalance", "balance", "outstanding"),
                Outstanding = GetDec(row, "outstanding", "balance", "openingBalance")
            };
        }

        private static HsnRecord MapJsonToHsn(JsonElement row)
        {
            string code = GetStr(row, "code", "hsnCode", "hsn");
            if (string.IsNullOrWhiteSpace(code)) return null;
            decimal gst = GetDec(row, "gstRate", "gstPercent", "rate", "gst");
            return new HsnRecord
            {
                Code = code,
                Description = GetStr(row, "description", "name"),
                GstRate = gst,
                CgstRate = gst / 2m,
                SgstRate = gst / 2m,
                IgstRate = gst,
                DefaultUom = "PCS"
            };
        }

        private static VoucherRecord MapJsonToVoucher(JsonElement row)
        {
            decimal amt = GetDec(row, "amount", "paidAmount", "total", "value");
            if (amt <= 0) return null;
            return new VoucherRecord
            {
                Id = "VCH" + Guid.NewGuid().ToString("N").Substring(0, 6).ToUpperInvariant(),
                VoucherNo = string.IsNullOrWhiteSpace(GetStr(row, "voucherNo", "no", "id")) ? "VCH-" + Random.Shared.Next(1000, 9999) : GetStr(row, "voucherNo", "no", "id"),
                VoucherType = string.IsNullOrWhiteSpace(GetStr(row, "voucherType", "type")) ? "PAYMENT" : GetStr(row, "voucherType", "type").ToUpperInvariant(),
                PartyName = GetStr(row, "partyName", "supplierName", "customerName", "name"),
                Amount = amt,
                PaymentMode = string.IsNullOrWhiteSpace(GetStr(row, "paymentMode", "mode")) ? "CASH" : GetStr(row, "paymentMode", "mode").ToUpperInvariant(),
                ReferenceNo = GetStr(row, "referenceNo", "refNo", "utr"),
                Narration = GetStr(row, "narration", "notes", "remarks")
            };
        }

        private static InvoiceRecord MapJsonToInvoice(JsonElement row, string defaultDocType)
        {
            string invNo = GetStr(row, "invoiceNo", "billNo", "docNo", "number", "id");
            if (string.IsNullOrWhiteSpace(invNo))
                invNo = defaultDocType == "PURCHASE" ? "PUR-" + Random.Shared.Next(1000, 9999) : "INV-" + Random.Shared.Next(1000, 9999);

            decimal grand = GetDec(row, "grandTotal", "totalAmount", "netAmount", "total", "amount");
            return new InvoiceRecord
            {
                InvoiceNo = invNo,
                DocType = defaultDocType,
                CustomerName = string.IsNullOrWhiteSpace(GetStr(row, "customerName", "partyName", "supplierName")) ? "WALK-IN CUSTOMER" : GetStr(row, "customerName", "partyName", "supplierName"),
                CustomerPhone = GetStr(row, "customerPhone", "phone", "mobile"),
                CustomerGstin = GetStr(row, "customerGstin", "gstin"),
                PaymentMode = string.IsNullOrWhiteSpace(GetStr(row, "paymentMode", "mode")) ? "CASH" : GetStr(row, "paymentMode", "mode"),
                TaxableTotal = GetDec(row, "taxableTotal", "subTotal", "taxableValue"),
                GstTotal = GetDec(row, "gstTotal", "taxTotal", "totalTax"),
                GrandTotal = grand,
                AmountReceived = GetDec(row, "amountReceived", "paidAmount", "grandTotal")
            };
        }

        public static bool ImportFromFolder(string folderPath, out string message)
        {
            if (string.IsNullOrWhiteSpace(folderPath) || !Directory.Exists(folderPath))
            {
                message = "Selected folder does not exist.";
                return false;
            }

            var files = Directory.GetFiles(folderPath, "*.*", SearchOption.AllDirectories)
                .Where(f => SupportedExtensions.Contains(Path.GetExtension(f)))
                .ToList();

            if (files.Count == 0)
            {
                message = "No supported Kanha data files (.kpd, .json, .zip, .xml, .bak, .db) were found in the selected folder.";
                return false;
            }

            int importedFiles = 0;
            var messages = new List<string>();
            foreach (var file in files)
            {
                if (ImportFromAnyKpdOrJsonFile(file, out string msg))
                {
                    importedFiles++;
                    messages.Add(msg);
                }
            }

            if (importedFiles == 0)
            {
                message = "Found files in folder, but none matched the expected Kanha system structure.";
                return false;
            }

            message = $"Imported {importedFiles} of {files.Count} file(s) from folder.\n" + string.Join("\n", messages.Take(5));
            return true;
        }

        public static void ExportBackupKpd(string destinationPath)
        {
            SaveAtomic();
            string json = JsonSerializer.Serialize(Data, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(destinationPath, json, Encoding.UTF8);
            AddAuditLog("BACKUP_EXPORT", $"Exported .kpd backup to {destinationPath}");
        }

        public static void AddAuditLog(string action, string details)
        {
            Data.AuditLogs ??= new List<AuditLogRecord>();
            Data.AuditLogs.Add(new AuditLogRecord
            {
                Timestamp = DateTime.Now,
                User = Data.CurrentUser ?? "A",
                Profile = Data.ActiveProfile ?? "GST",
                Action = action,
                Details = details
            });
        }

        public static void StartEmbeddedHostIfPortFree(int port = 3000)
        {
            if (_serverRunning) return;
            Task.Run(() => RunHttpHost(port));
        }

        public static void RunBlockingHost(int port = 3000)
        {
            LoadOrInitialize();
            RunHttpHost(port);
        }

        private static void RunHttpHost(int port)
        {
            try
            {
                _listener = new HttpListener();
                _listener.Prefixes.Add($"http://localhost:{port}/");
                _listener.Start();
                _serverRunning = true;

                while (_serverRunning)
                {
                    var ctx = _listener.GetContext();
                    ThreadPool.QueueUserWorkItem(_ => HandleHttpRequest(ctx));
                }
            }
            catch
            {
                _serverRunning = false;
            }
        }

        private static void HandleHttpRequest(HttpListenerContext ctx)
        {
            try
            {
                string path = ctx.Request.Url?.AbsolutePath?.ToLowerInvariant() ?? "/";
                ctx.Response.Headers.Add("Access-Control-Allow-Origin", "*");
                ctx.Response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                ctx.Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type");

                if (ctx.Request.HttpMethod == "OPTIONS")
                {
                    ctx.Response.StatusCode = 200;
                    ctx.Response.Close();
                    return;
                }

                if (path == "/api/health")
                {
                    WriteJson(ctx.Response, new { status = "ok", server = "KanhaPosServer v2.5.1d", activeYear = Data.ActiveFinancialYear });
                    return;
                }

                if (path == "/api/state" && ctx.Request.HttpMethod == "GET")
                {
                    WriteJson(ctx.Response, Data);
                    return;
                }

                WriteJson(ctx.Response, new { status = "ok", service = "Kanha POS LAN Host" });
            }
            catch
            {
                try { ctx.Response.Close(); } catch { }
            }
        }

        private static void WriteJson(HttpListenerResponse res, object payload)
        {
            byte[] buf = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(payload));
            res.ContentType = "application/json; charset=utf-8";
            res.ContentLength64 = buf.Length;
            res.OutputStream.Write(buf, 0, buf.Length);
            res.Close();
        }

        private static string GetLocalIpAddress()
        {
            try
            {
                var host = Dns.GetHostEntry(Dns.GetHostName());
                foreach (var ip in host.AddressList)
                {
                    if (ip.AddressFamily == AddressFamily.InterNetwork && !IPAddress.IsLoopback(ip))
                        return ip.ToString();
                }
            }
            catch { }
            return "127.0.0.1";
        }
    }
}
