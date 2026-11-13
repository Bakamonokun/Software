using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Printing;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Windows.Forms;
using KanhaPosServer;

namespace POSApp
{
    // ========================================================================
    // SECURE LOGIN DIALOG (OPERATOR & SERVER AUTHENTICATION)
    // ========================================================================
    public class SecureLoginForm : Form
    {
        private TextBox _txtUsername;
        private TextBox _txtPassword;
        private TextBox _txtServerUrl;
        private CheckBox _chkShowPassword;
        private Label _lblError;
        private Label _lblServerStatus;

        public SecureLoginForm()
        {
            Text = "Sign in — Kanha Software Solution";
            Size = new Size(460, 520);
            StartPosition = FormStartPosition.CenterScreen;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = false;
            BackColor = Color.FromArgb(241, 245, 249);
            Font = new Font("Segoe UI", 9.5f);

            BuildLoginUi();
        }

        private void BuildLoginUi()
        {
            var card = new Panel
            {
                Location = new Point(28, 24),
                Size = new Size(390, 430),
                BackColor = Color.White,
                BorderStyle = BorderStyle.FixedSingle
            };

            var headerBanner = new Panel
            {
                Dock = DockStyle.Top,
                Height = 92,
                BackColor = Color.FromArgb(15, 23, 42)
            };

            var lblBrand = new Label
            {
                Text = "KANHA POS & ERP",
                Font = new Font("Segoe UI", 16f, FontStyle.Bold),
                ForeColor = Color.White,
                Location = new Point(24, 18),
                AutoSize = true
            };

            var lblSub = new Label
            {
                Text = "Enter your username and password to sign in",
                Font = new Font("Segoe UI", 9f, FontStyle.Regular),
                ForeColor = Color.FromArgb(148, 163, 184),
                Location = new Point(26, 52),
                AutoSize = true
            };

            headerBanner.Controls.Add(lblBrand);
            headerBanner.Controls.Add(lblSub);
            card.Controls.Add(headerBanner);

            int y = 112;

            var lblUser = new Label
            {
                Text = "Username",
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(51, 65, 85),
                Location = new Point(28, y),
                AutoSize = true
            };
            card.Controls.Add(lblUser);
            y += 24;

            _txtUsername = new TextBox
            {
                Location = new Point(28, y),
                Width = 332,
                Font = new Font("Segoe UI", 11f),
                PlaceholderText = "Enter username"
            };
            card.Controls.Add(_txtUsername);
            y += 42;

            var lblPass = new Label
            {
                Text = "Password",
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(51, 65, 85),
                Location = new Point(28, y),
                AutoSize = true
            };
            card.Controls.Add(lblPass);
            y += 24;

            _txtPassword = new TextBox
            {
                Location = new Point(28, y),
                Width = 332,
                Font = new Font("Segoe UI", 11f),
                UseSystemPasswordChar = true,
                PlaceholderText = "Enter password"
            };
            card.Controls.Add(_txtPassword);
            y += 32;

            _chkShowPassword = new CheckBox
            {
                Text = "Show password",
                Font = new Font("Segoe UI", 8.5f),
                ForeColor = Color.FromArgb(100, 116, 139),
                Location = new Point(28, y),
                AutoSize = true
            };
            _chkShowPassword.CheckedChanged += (s, e) =>
            {
                _txtPassword.UseSystemPasswordChar = !_chkShowPassword.Checked;
            };
            card.Controls.Add(_chkShowPassword);
            y += 30;

            _lblError = new Label
            {
                Text = "",
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(220, 38, 38),
                Location = new Point(28, y),
                Size = new Size(332, 22)
            };
            card.Controls.Add(_lblError);
            y += 24;

            var btnSignIn = new Button
            {
                Text = "Sign in",
                Location = new Point(28, y),
                Size = new Size(332, 42),
                BackColor = Color.FromArgb(37, 99, 235),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 10.5f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnSignIn.FlatAppearance.BorderSize = 0;
            btnSignIn.Click += (s, e) => AttemptLogin();
            card.Controls.Add(btnSignIn);
            y += 56;

            var sep = new Panel
            {
                Location = new Point(28, y),
                Size = new Size(332, 1),
                BackColor = Color.FromArgb(226, 232, 240)
            };
            card.Controls.Add(sep);
            y += 12;

            var lblSrv = new Label
            {
                Text = "Server Connection:",
                Font = new Font("Segoe UI", 8f, FontStyle.Bold),
                ForeColor = Color.FromArgb(100, 116, 139),
                Location = new Point(28, y + 4),
                AutoSize = true
            };
            card.Controls.Add(lblSrv);

            _txtServerUrl = new TextBox
            {
                Text = AppStore.Data.ServerUrl ?? "http://localhost:3000",
                Location = new Point(140, y),
                Width = 152,
                Font = new Font("Segoe UI", 8.5f)
            };
            card.Controls.Add(_txtServerUrl);

            var btnPing = new Button
            {
                Text = "Verify",
                Location = new Point(298, y - 1),
                Size = new Size(62, 24),
                BackColor = Color.FromArgb(241, 245, 249),
                ForeColor = Color.FromArgb(30, 41, 59),
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 8f, FontStyle.Bold)
            };
            btnPing.Click += async (s, e) =>
            {
                _lblServerStatus.Text = "Checking server...";
                _lblServerStatus.ForeColor = Color.DimGray;
                try
                {
                    using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
                    string url = _txtServerUrl.Text.Trim().TrimEnd('/') + "/api/health";
                    var resp = await client.GetAsync(url);
                    if (resp.IsSuccessStatusCode)
                    {
                        _lblServerStatus.Text = "Connected to Server (" + _txtServerUrl.Text.Trim() + ")";
                        _lblServerStatus.ForeColor = Color.FromArgb(22, 163, 74);
                    }
                    else
                    {
                        _lblServerStatus.Text = "Local Embedded Mode Active";
                        _lblServerStatus.ForeColor = Color.FromArgb(217, 119, 6);
                    }
                }
                catch
                {
                    _lblServerStatus.Text = "Offline / Local Embedded Vault Active";
                    _lblServerStatus.ForeColor = Color.FromArgb(217, 119, 6);
                }
            };
            card.Controls.Add(btnPing);
            y += 28;

            _lblServerStatus = new Label
            {
                Text = "Ready — Embedded Server & Local Vault Active",
                Font = new Font("Segoe UI", 8f, FontStyle.Regular),
                ForeColor = Color.FromArgb(22, 163, 74),
                Location = new Point(28, y),
                Size = new Size(332, 18)
            };
            card.Controls.Add(_lblServerStatus);

            Controls.Add(card);
            AcceptButton = btnSignIn;
            Shown += (s, e) => _txtUsername.Focus();
        }

        private void AttemptLogin()
        {
            _lblError.Text = "";
            string username = _txtUsername.Text.Trim();
            string password = _txtPassword.Text.Trim();

            if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(password))
            {
                _lblError.Text = "Please enter both username and password.";
                return;
            }

            AppStore.Data.ServerUrl = _txtServerUrl.Text.Trim();
            if (AppStore.Authenticate(username, password, out string err))
            {
                DialogResult = DialogResult.OK;
                Close();
            }
            else
            {
                _lblError.Text = err;
                _txtPassword.SelectAll();
                _txtPassword.Focus();
            }
        }
    }

    // ========================================================================
    // MAIN ENTERPRISE POS & ERP SHELL
    // ========================================================================
    public class MainForm : Form
    {
        private MenuStrip _menuStrip;
        private Panel _contentPanel;
        private StatusStrip _statusStrip;
        private ToolStripStatusLabel _lblStatusCompany;
        private ToolStripStatusLabel _lblStatusProfile;
        private ToolStripStatusLabel _lblStatusYear;
        private ToolStripStatusLabel _lblStatusRight;
        private ToolStripTextBox _txtQuickSearch;

        // Billing screen state
        private List<InvoiceLine> _currentLines = new List<InvoiceLine>();
        private string _currentDocType = "SALE";
        private string _currentBillAuthSignatureDataUrl = "";
        private string _currentBillCustomerSignatureDataUrl = "";
        private bool _suppressDraftAutoSave = false;

        public MainForm()
        {
            UpdateWindowTitle();
            WindowState = FormWindowState.Maximized;
            MinimumSize = new Size(1240, 760);
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.FromArgb(241, 245, 249);
            Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);
            KeyPreview = true;

            BuildTopMenu();
            BuildStatusBar();

            _contentPanel = new Panel
            {
                Dock = DockStyle.Fill,
                BackColor = Color.FromArgb(241, 245, 249),
                Padding = new Padding(12)
            };
            Controls.Add(_contentPanel);
            _contentPanel.BringToFront();

            KeyDown += MainForm_KeyDown;
            ShowDashboard();
        }

        private void UpdateWindowTitle()
        {
            var comp = AppStore.CurrentProfile.Company;
            string compName = string.IsNullOrWhiteSpace(comp?.Name) ? "Kanha POS Enterprise" : comp.Name;
            Text = $"{compName} — Kanha POS & Accounting ERP [{AppStore.Data.ActiveProfile} Profile | {AppStore.Data.ActiveFinancialYear} | User: {AppStore.Data.CurrentUser}]";
        }

        private bool EnforceDeviceActiveGuard()
        {
            if (AppStore.IsCurrentDeviceRevokedOrSuspended(out string status, out string reason))
            {
                MessageBox.Show(this,
                    reason + "\n\nThis terminal session will now lock.",
                    $"Terminal {status} — Security Enforcement",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Stop);
                SwitchOperatorRelogin();
                return false;
            }
            return true;
        }

        private void MainForm_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.KeyCode == Keys.F1) { ShowKeyboardShortcutsHelpDialog(); e.Handled = true; }
            else if (e.KeyCode == Keys.F2) { ShowBillingScreen("SALE"); e.Handled = true; }
            else if (e.KeyCode == Keys.F3) { ShowBillingScreen("PURCHASE"); e.Handled = true; }
            else if (e.KeyCode == Keys.F4) { ShowBillingScreen("ESTIMATE"); e.Handled = true; }
            else if (e.KeyCode == Keys.F5) { ShowDashboard(); e.Handled = true; }
            else if (e.Control && e.KeyCode == Keys.K)
            {
                _txtQuickSearch?.Focus();
                _txtQuickSearch?.SelectAll();
                e.Handled = true;
            }
        }

        // ====================================================================
        // TOP MENU BAR + GLOBAL QUICK SEARCH
        // ====================================================================
        private void BuildTopMenu()
        {
            _menuStrip = new MenuStrip
            {
                BackColor = Color.FromArgb(15, 23, 42),
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                Padding = new Padding(8, 5, 8, 5),
                Dock = DockStyle.Top
            };

            // 1. Dashboard
            var mDashboard = new ToolStripMenuItem("Dashboard");
            mDashboard.ForeColor = Color.White;
            mDashboard.Click += (s, e) => { if (EnforceDeviceActiveGuard()) ShowDashboard(); };

            // 2. Transactions
            var mTx = new ToolStripMenuItem("Transactions") { ForeColor = Color.White };
            mTx.DropDownItems.Add("POS / Bill (F2)", null, (s, e) => { if (EnforceDeviceActiveGuard()) ShowBillingScreen("SALE"); });
            mTx.DropDownItems.Add("Purchase Entry (F3)", null, (s, e) => { if (EnforceDeviceActiveGuard()) ShowBillingScreen("PURCHASE"); });
            mTx.DropDownItems.Add("Stock Out", null, (s, e) => { if (EnforceDeviceActiveGuard()) ShowBillingScreen("STOCK_OUT"); });
            mTx.DropDownItems.Add("Estimate / Quotation (F4)", null, (s, e) => { if (EnforceDeviceActiveGuard()) ShowBillingScreen("ESTIMATE"); });
            mTx.DropDownItems.Add(new ToolStripSeparator());
            mTx.DropDownItems.Add("Sales Return / Credit Note", null, (s, e) => { if (EnforceDeviceActiveGuard()) ShowBillingScreen("SALE_RETURN"); });
            mTx.DropDownItems.Add("Purchase Return / Debit Note", null, (s, e) => { if (EnforceDeviceActiveGuard()) ShowBillingScreen("PURCHASE_RETURN"); });
            mTx.DropDownItems.Add("Delivery Challan", null, (s, e) => { if (EnforceDeviceActiveGuard()) ShowBillingScreen("DELIVERY_CHALLAN"); });

            // 3. Masters
            var mMasters = new ToolStripMenuItem("Masters") { ForeColor = Color.White };
            mMasters.DropDownItems.Add("Company Master", null, (s, e) => { if (EnforceDeviceActiveGuard()) ShowCompanyMasterView(); });
            mMasters.DropDownItems.Add("Customer Master", null, (s, e) => { if (EnforceDeviceActiveGuard()) ShowCustomerMasterView(); });
            mMasters.DropDownItems.Add("Supplier Master", null, (s, e) => { if (EnforceDeviceActiveGuard()) ShowSupplierMasterView(); });
            mMasters.DropDownItems.Add("Item Master (with Batch/Expiry)", null, (s, e) => { if (EnforceDeviceActiveGuard()) ShowItemMasterView(); });
            mMasters.DropDownItems.Add("HSN Code Master", null, (s, e) => { if (EnforceDeviceActiveGuard()) ShowHsnMasterView(); });
            mMasters.DropDownItems.Add("Bank Accounts Master", null, (s, e) => { if (EnforceDeviceActiveGuard()) ShowBankMasterView(); });

            // 4. Reports (All 20 Reports matching the user's screenshots + financial reports)
            var mReports = new ToolStripMenuItem("Reports") { ForeColor = Color.White };
            mReports.DropDownItems.Add("Sale Summary", null, (s, e) => ShowReportView("SALE_SUMMARY"));
            mReports.DropDownItems.Add("Sale History", null, (s, e) => ShowReportView("SALE_HISTORY"));
            mReports.DropDownItems.Add("Item Account Statement", null, (s, e) => ShowReportView("ITEM_STATEMENT"));
            mReports.DropDownItems.Add("Customer Ledger", null, (s, e) => ShowReportView("CUSTOMER_LEDGER"));
            mReports.DropDownItems.Add("Customer Account Statement", null, (s, e) => ShowReportView("CUSTOMER_STATEMENT"));
            mReports.DropDownItems.Add("Supplier Ledger", null, (s, e) => ShowReportView("SUPPLIER_LEDGER"));
            mReports.DropDownItems.Add("Supplier Purchase History", null, (s, e) => ShowReportView("SUPPLIER_PURCHASE_HISTORY"));
            mReports.DropDownItems.Add("Payment Search", null, (s, e) => ShowReportView("PAYMENT_SEARCH"));
            mReports.DropDownItems.Add("Receipt Search", null, (s, e) => ShowReportView("RECEIPT_SEARCH"));
            mReports.DropDownItems.Add("Purchase Report", null, (s, e) => ShowReportView("PURCHASE_REPORT"));
            mReports.DropDownItems.Add("GST Sales Summary", null, (s, e) => ShowReportView("GST_SALES_SUMMARY"));
            mReports.DropDownItems.Add("GST Purchase Summary", null, (s, e) => ShowReportView("GST_PURCHASE_SUMMARY"));
            mReports.DropDownItems.Add("RCM Report", null, (s, e) => ShowReportView("RCM_REPORT"));
            mReports.DropDownItems.Add("Stock Report", null, (s, e) => ShowReportView("STOCK_REPORT"));
            mReports.DropDownItems.Add("Stock Out Report", null, (s, e) => ShowReportView("STOCK_OUT_REPORT"));
            mReports.DropDownItems.Add("Credit Note Report", null, (s, e) => ShowReportView("CREDIT_NOTE_REPORT"));
            mReports.DropDownItems.Add("Purchase Return Report", null, (s, e) => ShowReportView("PURCHASE_RETURN_REPORT"));
            mReports.DropDownItems.Add("Today's Cash Report", null, (s, e) => ShowReportView("TODAYS_CASH_REPORT"));
            mReports.DropDownItems.Add("Bank Account Statement", null, (s, e) => ShowReportView("BANK_STATEMENT"));
            mReports.DropDownItems.Add("Journal Voucher Report", null, (s, e) => ShowReportView("JOURNAL_REPORT"));
            mReports.DropDownItems.Add(new ToolStripSeparator());
            mReports.DropDownItems.Add("Day Book", null, (s, e) => ShowReportView("DAY_BOOK"));
            mReports.DropDownItems.Add("HSN-wise GST Summary", null, (s, e) => ShowReportView("HSN_SUMMARY"));
            mReports.DropDownItems.Add("GSTR-1 & GSTR-3B Return", null, (s, e) => ShowReportView("GSTR_RETURN"));
            mReports.DropDownItems.Add("Profit & Loss Statement", null, (s, e) => ShowReportView("PROFIT_LOSS"));
            mReports.DropDownItems.Add("Balance Sheet", null, (s, e) => ShowReportView("BALANCE_SHEET"));

            // 5. Accounting
            var mAcc = new ToolStripMenuItem("Accounting") { ForeColor = Color.White };
            mAcc.DropDownItems.Add("Receipt Voucher (Customer In)", null, (s, e) => ShowVoucherView("RECEIPT"));
            mAcc.DropDownItems.Add("Payment Voucher (Supplier Out)", null, (s, e) => ShowVoucherView("PAYMENT"));
            mAcc.DropDownItems.Add("Contra Voucher (Cash <-> Bank)", null, (s, e) => ShowVoucherView("CONTRA"));
            mAcc.DropDownItems.Add("Expense Entry", null, (s, e) => ShowVoucherView("EXPENSE"));
            mAcc.DropDownItems.Add("Journal Voucher", null, (s, e) => ShowVoucherView("JOURNAL"));
            mAcc.DropDownItems.Add(new ToolStripSeparator());
            mAcc.DropDownItems.Add("Cash Book", null, (s, e) => ShowLedgerBookView("CASH_BOOK"));
            mAcc.DropDownItems.Add("Bank Book", null, (s, e) => ShowLedgerBookView("BANK_BOOK"));

            // 6. Orders / CRM
            var mCrm = new ToolStripMenuItem("Orders / CRM") { ForeColor = Color.White };
            mCrm.DropDownItems.Add("Purchase Orders (PO)", null, (s, e) => ShowOrdersView("PO"));
            mCrm.DropDownItems.Add("Sales Orders (SO)", null, (s, e) => ShowOrdersView("SO"));
            mCrm.DropDownItems.Add("CRM Leads & Follow-ups", null, (s, e) => ShowCrmLeadsView());
            mCrm.DropDownItems.Add("Customer Loyalty Points", null, (s, e) => ShowLoyaltyPointsView());

            // 7. Database (No Windows .NET & Android Apps menu item per user instruction)
            var mDb = new ToolStripMenuItem("Database") { ForeColor = Color.White };
            mDb.DropDownItems.Add("Import Data File (.kpd / .json / .zip / .xml)", null, (s, e) => ShowDatabaseUtilityView("IMPORT_FILE"));
            mDb.DropDownItems.Add("Import Data Folder", null, (s, e) => ShowDatabaseUtilityView("IMPORT_FOLDER"));
            mDb.DropDownItems.Add("Network Data Setup", null, (s, e) => ShowDatabaseUtilityView("NETWORK_SETUP"));
            mDb.DropDownItems.Add("Printer Settings", null, (s, e) => ShowDatabaseUtilityView("PRINTER_SETTINGS"));
            mDb.DropDownItems.Add("Backup .kpd", null, (s, e) => ShowDatabaseUtilityView("BACKUP"));
            mDb.DropDownItems.Add(new ToolStripSeparator());
            var mRemoveAll = new ToolStripMenuItem("Remove All Data") { ForeColor = Color.Firebrick };
            mRemoveAll.Click += (s, e) => ShowDatabaseUtilityView("REMOVE_ALL");
            mDb.DropDownItems.Add(mRemoveAll);

            // 8. Developer / Server (Password Protected)
            var mDev = new ToolStripMenuItem("Developer / Server") { ForeColor = Color.FromArgb(250, 204, 21) };
            mDev.Click += (s, e) => ShowDeveloperPanelWithPassword();

            // 9. Financial Year / Session Selector
            var mYear = new ToolStripMenuItem("Session (FY)") { ForeColor = Color.FromArgb(125, 211, 252) };
            mYear.Click += (s, e) => ShowFinancialYearDialog();

            // 10. Switch Operator / Lock
            var mLogout = new ToolStripMenuItem("Logout") { ForeColor = Color.FromArgb(252, 165, 165) };
            mLogout.Click += (s, e) => SwitchOperatorRelogin();

            // 11. Quick Search Box inside Menu Bar
            var lblSearch = new ToolStripLabel("   Search:") { ForeColor = Color.Silver };
            _txtQuickSearch = new ToolStripTextBox
            {
                Size = new Size(180, 24),
                Font = new Font("Segoe UI", 9f),
                ToolTipText = "Search Item, Barcode, Customer, or Invoice No and press Enter (Ctrl+K)"
            };
            _txtQuickSearch.KeyDown += (s, e) =>
            {
                if (e.KeyCode == Keys.Enter)
                {
                    e.SuppressKeyPress = true;
                    RunGlobalQuickSearch(_txtQuickSearch.Text.Trim());
                }
            };
            var btnFind = new ToolStripMenuItem("Find") { ForeColor = Color.LightGreen };
            btnFind.Click += (s, e) => RunGlobalQuickSearch(_txtQuickSearch.Text.Trim());

            _menuStrip.Items.AddRange(new ToolStripItem[]
            {
                mDashboard, mTx, mMasters, mReports, mAcc, mCrm, mDb, mDev, mYear, mLogout,
                lblSearch, _txtQuickSearch, btnFind
            });

            MainMenuStrip = _menuStrip;
            Controls.Add(_menuStrip);
        }

        private void BuildStatusBar()
        {
            _statusStrip = new StatusStrip
            {
                BackColor = Color.FromArgb(15, 23, 42),
                ForeColor = Color.White,
                SizingGrip = false
            };

            string compDisp = string.IsNullOrWhiteSpace(AppStore.CurrentProfile.Company.Name)
                ? "Kanha POS Enterprise"
                : AppStore.CurrentProfile.Company.Name;

            _lblStatusCompany = new ToolStripStatusLabel
            {
                Text = "Company: " + compDisp,
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 9f, FontStyle.Bold)
            };

            _lblStatusProfile = new ToolStripStatusLabel
            {
                Text = $"   |   Active Profile: {AppStore.Data.ActiveProfile} (Operator: {AppStore.Data.CurrentUser})",
                ForeColor = Color.FromArgb(56, 189, 248),
                Font = new Font("Segoe UI", 9f, FontStyle.Bold)
            };

            _lblStatusYear = new ToolStripStatusLabel
            {
                Text = $"   |   Session: {AppStore.Data.ActiveFinancialYear}",
                ForeColor = Color.FromArgb(250, 204, 21),
                Font = new Font("Segoe UI", 9f, FontStyle.Bold)
            };

            var spring = new ToolStripStatusLabel { Spring = true };

            var lblHelpIcon = new ToolStripStatusLabel
            {
                Text = "[ ? ] Help / Shortcuts   |   ",
                ForeColor = Color.FromArgb(125, 211, 252),
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                IsLink = false,
                ToolTipText = "Click to view Help & Keyboard Shortcuts (F2, F3, F4, F5, Ctrl+K)"
            };
            lblHelpIcon.Click += (s, e) => ShowKeyboardShortcutsHelpDialog();

            _lblStatusRight = new ToolStripStatusLabel
            {
                Text = "Developed by Kanha software solution",
                ForeColor = Color.FromArgb(167, 243, 208),
                Font = new Font("Segoe UI", 9f, FontStyle.Bold)
            };

            _statusStrip.Items.AddRange(new ToolStripItem[]
            {
                _lblStatusCompany, _lblStatusProfile, _lblStatusYear, spring, lblHelpIcon, _lblStatusRight
            });
            Controls.Add(_statusStrip);
        }

        private void ShowKeyboardShortcutsHelpDialog()
        {
            using var dlg = new Form
            {
                Text = "Help & System Keyboard Shortcuts",
                Size = new Size(520, 420),
                StartPosition = FormStartPosition.CenterParent,
                FormBorderStyle = FormBorderStyle.FixedDialog,
                MaximizeBox = false,
                MinimizeBox = false,
                BackColor = Color.White
            };

            var hdr = new Panel
            {
                Dock = DockStyle.Top,
                Height = 52,
                BackColor = Color.FromArgb(15, 23, 42)
            };
            hdr.Controls.Add(new Label
            {
                Text = "KEYBOARD SHORTCUTS & QUICK REFERENCE",
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 11.5f, FontStyle.Bold),
                Location = new Point(16, 14),
                AutoSize = true
            });
            dlg.Controls.Add(hdr);

            var grid = CreateStandardGrid();
            grid.Location = new Point(16, 66);
            grid.Size = new Size(472, 250);
            grid.Dock = DockStyle.None;
            grid.Columns.Add("Key", "Shortcut Key");
            grid.Columns.Add("Action", "System Action / Screen");
            grid.Columns[0].FillWeight = 32f;
            grid.Columns[1].FillWeight = 68f;

            grid.Rows.Add("F2", "Open POS / Bill (Tax Invoice / Retail Billing)");
            grid.Rows.Add("F3", "Open Supplier Purchase Entry (Goods In)");
            grid.Rows.Add("F4", "Open Proforma Estimate / Quotation");
            grid.Rows.Add("F5", "Return to Main Dashboard & Live KPIs");
            grid.Rows.Add("Ctrl + K", "Focus Global Quick Search (Items, Parties, Invoices)");
            grid.Rows.Add("Enter", "Quick Add Selected/Typed Item to Current Bill");
            grid.Rows.Add("F10", "Save & Print Active Bill / Invoice");
            grid.Rows.Add("F1", "Open this Help / Keyboard Shortcuts Window");

            var btnClose = CreateActionButton("Close", Color.FromArgb(37, 99, 235), 120);
            btnClose.Location = new Point(368, 330);
            btnClose.Height = 34;
            btnClose.Click += (s, e) => dlg.Close();

            dlg.Controls.Add(grid);
            dlg.Controls.Add(btnClose);
            dlg.ShowDialog(this);
        }

        private void RefreshStatusAndHeader()
        {
            UpdateWindowTitle();
            string compDisp = string.IsNullOrWhiteSpace(AppStore.CurrentProfile.Company.Name)
                ? "Kanha POS Enterprise"
                : AppStore.CurrentProfile.Company.Name;
            if (_lblStatusCompany != null)
                _lblStatusCompany.Text = "Company: " + compDisp;
            if (_lblStatusProfile != null)
                _lblStatusProfile.Text = $"   |   Active Profile: {AppStore.Data.ActiveProfile} (Operator: {AppStore.Data.CurrentUser})";
            if (_lblStatusYear != null)
                _lblStatusYear.Text = $"   |   Session: {AppStore.Data.ActiveFinancialYear}";
        }

        private void SwitchOperatorRelogin()
        {
            Hide();
            using (var login = new SecureLoginForm())
            {
                if (login.ShowDialog() == DialogResult.OK)
                {
                    RefreshStatusAndHeader();
                    Show();
                    ShowDashboard();
                }
                else
                {
                    Close();
                }
            }
        }

        private void ShowFinancialYearDialog()
        {
            using var dlg = new Form
            {
                Text = "Select / Rollover Financial Year (Session)",
                Size = new Size(460, 290),
                StartPosition = FormStartPosition.CenterParent,
                FormBorderStyle = FormBorderStyle.FixedDialog,
                MaximizeBox = false,
                MinimizeBox = false,
                BackColor = Color.White
            };

            var lbl = new Label
            {
                Text = "Select Active Financial Year or Rollover to Next Year:\n(Carries all transactions & records forward and continues bill serials from Last Serial + 1)",
                Location = new Point(20, 16),
                Size = new Size(410, 42),
                Font = new Font("Segoe UI", 9f, FontStyle.Bold)
            };
            var cmb = new ComboBox
            {
                Location = new Point(20, 68),
                Width = 400,
                DropDownStyle = ComboBoxStyle.DropDown,
                Font = new Font("Segoe UI", 10.5f)
            };
            foreach (var fy in AppStore.Data.AvailableFinancialYears) cmb.Items.Add(fy);
            cmb.Text = AppStore.Data.ActiveFinancialYear;

            var btnAutoRollover = new Button
            {
                Text = "Auto-Rollover to Next Financial Year (" + AppStore.ComputeNextFinancialYear(AppStore.Data.ActiveFinancialYear) + ")",
                Location = new Point(20, 112),
                Size = new Size(400, 38),
                BackColor = Color.FromArgb(15, 118, 110),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold)
            };
            btnAutoRollover.Click += (s, e) =>
            {
                AppStore.RolloverFinancialYearSession("", out string newFy, out int nextSerial);
                RefreshStatusAndHeader();
                ShowDashboard();
                MessageBox.Show(dlg,
                    $"Session automatically rolled over to {newFy}.\nAll transactions, items, customers, and ledgers have been carried forward.\nNew bills will continue from Serial #{nextSerial}.",
                    "Financial Year Auto-Rollover Complete",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
                dlg.Close();
            };

            var btnApply = new Button
            {
                Text = "Apply Selected Session",
                Location = new Point(20, 165),
                Size = new Size(400, 38),
                BackColor = Color.FromArgb(37, 99, 235),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 10f, FontStyle.Bold)
            };
            btnApply.Click += (s, e) =>
            {
                string fy = cmb.Text.Trim();
                if (!string.IsNullOrEmpty(fy))
                {
                    AppStore.RolloverFinancialYearSession(fy, out string appliedFy, out int nextSerial);
                    RefreshStatusAndHeader();
                    ShowDashboard();
                    MessageBox.Show(dlg,
                        $"Active Session switched to {appliedFy}.\nAll transactions carried forward. Next bill serial starts at #{nextSerial}.",
                        "Session Updated",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Information);
                    dlg.Close();
                }
            };

            dlg.Controls.AddRange(new Control[] { lbl, cmb, btnAutoRollover, btnApply });
            dlg.ShowDialog(this);
        }

        private void RunGlobalQuickSearch(string query)
        {
            if (string.IsNullOrWhiteSpace(query)) return;
            var prof = AppStore.CurrentProfile;
            string q = query.ToLowerInvariant();

            var matchedItems = prof.Items.Where(i => i.Name.ToLowerInvariant().Contains(q) || i.Code.ToLowerInvariant().Contains(q) || i.Barcode.ToLowerInvariant().Contains(q)).ToList();
            var matchedCusts = prof.Customers.Where(c => c.Name.ToLowerInvariant().Contains(q) || c.Phone.Contains(q)).ToList();
            var matchedInvs = prof.Invoices.Where(inv => inv.InvoiceNo.ToLowerInvariant().Contains(q) || inv.CustomerName.ToLowerInvariant().Contains(q)).ToList();

            var sb = new StringBuilder();
            sb.AppendLine($"Search Results for \"{query}\":");
            sb.AppendLine("--------------------------------------------------");
            sb.AppendLine($"Items Found ({matchedItems.Count}):");
            foreach (var it in matchedItems.Take(5))
                sb.AppendLine($"  • [{it.Code}] {it.Name} | Rate: Rs.{it.Price:N2} | Stock: {it.Stock} {it.Uom}");

            sb.AppendLine($"\nCustomers Found ({matchedCusts.Count}):");
            foreach (var c in matchedCusts.Take(5))
                sb.AppendLine($"  • {c.Name} ({c.Phone}) | Due: Rs.{c.Outstanding:N2}");

            sb.AppendLine($"\nInvoices Found ({matchedInvs.Count}):");
            foreach (var inv in matchedInvs.Take(5))
                sb.AppendLine($"  • {inv.InvoiceNo} ({inv.Date:dd-MMM-yyyy}) | {inv.CustomerName} | Rs.{inv.GrandTotal:N2}");

            MessageBox.Show(this, sb.ToString(), "Global Quick Search (Ctrl+K)", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }

        // ====================================================================
        // 1. DASHBOARD VIEW (WITH LOW-STOCK ALERT, 7-DAY SALES & STOCK GRAPH)
        // ====================================================================
        private void ShowDashboard()
        {
            _contentPanel.Controls.Clear();
            var prof = AppStore.CurrentProfile;

            var root = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                ColumnCount = 1,
                RowCount = 4,
                BackColor = Color.FromArgb(241, 245, 249)
            };
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 58f));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 108f));
            root.RowStyles.Add(new RowStyle(SizeType.Percent, 54f));
            root.RowStyles.Add(new RowStyle(SizeType.Percent, 46f));

            // Row 0: Welcome Banner & Quick Action Buttons
            var topBar = new Panel { Dock = DockStyle.Fill, Size = new Size(1000, 58), BackColor = Color.White, Padding = new Padding(14, 8, 14, 8) };
            string firmTitle = string.IsNullOrWhiteSpace(prof.Company.Name) ? "Kanha POS Enterprise" : prof.Company.Name;
            var lblWelcome = new Label
            {
                Text = $"{firmTitle} — {AppStore.Data.ActiveProfile} Dashboard ({AppStore.Data.ActiveFinancialYear})",
                Font = new Font("Segoe UI", 13.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(15, 23, 42),
                Location = new Point(14, 14),
                AutoSize = true
            };
            topBar.Controls.Add(lblWelcome);

            var btnNewBill = CreateActionButton("+ New POS Bill (F2)", Color.FromArgb(22, 163, 74), 160);
            btnNewBill.Location = new Point(topBar.Width - 520, 10);
            btnNewBill.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            btnNewBill.Click += (s, e) => ShowBillingScreen("SALE");

            var btnPurchase = CreateActionButton("+ Purchase Entry (F3)", Color.FromArgb(37, 99, 235), 170);
            btnPurchase.Location = new Point(topBar.Width - 350, 10);
            btnPurchase.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            btnPurchase.Click += (s, e) => ShowBillingScreen("PURCHASE");

            var btnEstimate = CreateActionButton("+ Estimate (F4)", Color.FromArgb(124, 58, 237), 155);
            btnEstimate.Location = new Point(topBar.Width - 170, 10);
            btnEstimate.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            btnEstimate.Click += (s, e) => ShowBillingScreen("ESTIMATE");

            topBar.Controls.AddRange(new Control[] { btnNewBill, btnPurchase, btnEstimate });
            root.Controls.Add(topBar, 0, 0);

            // Row 1: 5 KPI Cards
            var kpiGrid = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 5, RowCount = 1, Margin = new Padding(0, 6, 0, 6) };
            for (int i = 0; i < 5; i++) kpiGrid.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 20f));

            decimal todaySales = prof.Invoices.Where(x => x.DocType == "SALE" && x.Date.Date == DateTime.Today).Sum(x => x.GrandTotal);
            decimal totalSales = prof.Invoices.Where(x => x.DocType == "SALE").Sum(x => x.GrandTotal);
            decimal totalPurchases = prof.Invoices.Where(x => x.DocType == "PURCHASE").Sum(x => x.GrandTotal);
            decimal receivables = prof.Customers.Sum(c => c.Outstanding);
            int lowStockCount = prof.Items.Count(i => i.Stock <= i.ReorderLevel);

            kpiGrid.Controls.Add(BuildKpiCard("TODAY'S SALES", $"Rs. {todaySales:N2}", $"Total Sales: Rs. {totalSales:N2}", Color.FromArgb(22, 163, 74)), 0, 0);
            kpiGrid.Controls.Add(BuildKpiCard("TOTAL PURCHASES", $"Rs. {totalPurchases:N2}", $"Suppliers: {prof.Suppliers.Count}", Color.FromArgb(37, 99, 235)), 1, 0);
            kpiGrid.Controls.Add(BuildKpiCard("RECEIVABLES (DUE)", $"Rs. {receivables:N2}", $"Customers: {prof.Customers.Count}", Color.FromArgb(217, 119, 6)), 2, 0);
            kpiGrid.Controls.Add(BuildKpiCard("INVENTORY SKUS", $"{prof.Items.Count} Items", $"Low Stock Alerts: {lowStockCount}", Color.FromArgb(124, 58, 237)), 3, 0);
            kpiGrid.Controls.Add(BuildKpiCard("ACTIVE PROFILE", AppStore.Data.ActiveProfile, $"Session: {AppStore.Data.ActiveFinancialYear}", Color.FromArgb(15, 118, 110)), 4, 0);
            root.Controls.Add(kpiGrid, 0, 1);

            // Row 2: 7-Day Daily Sales Trend & Top-10 Stock Movement Line Graph
            var chartCard = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(12), Margin = new Padding(0, 0, 0, 6) };
            var lblChartTitle = new Label
            {
                Text = "DAILY SALES TREND (LAST 7 DAYS) & TOP 10 ITEMS STOCK MOVEMENT (30 DAYS)",
                Font = new Font("Segoe UI", 10f, FontStyle.Bold),
                ForeColor = Color.FromArgb(30, 41, 59),
                Dock = DockStyle.Top,
                Height = 24
            };
            var canvas = new Panel { Dock = DockStyle.Fill, BackColor = Color.White };
            var seriesList = AppStore.GetTop10StockMovementTrends30Days();
            canvas.Paint += (s, e) => DrawStockMovementChart(e.Graphics, canvas.ClientRectangle, seriesList);
            canvas.Resize += (s, e) => canvas.Invalidate();

            chartCard.Controls.Add(canvas);
            chartCard.Controls.Add(lblChartTitle);
            root.Controls.Add(chartCard, 0, 2);

            // Row 3: Recent Invoices + Low Stock / Expiring Batch Notification Panel
            var bottomSplit = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 1 };
            bottomSplit.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 65f));
            bottomSplit.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 35f));

            var recentCard = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(10), Margin = new Padding(0, 0, 6, 0) };
            var lblRecent = new Label
            {
                Text = "RECENT INVOICES / TRANSACTIONS (DOUBLE-CLICK TO PREVIEW / PRINT)",
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(30, 41, 59),
                Dock = DockStyle.Top,
                Height = 24
            };
            var grid = CreateStandardGrid();
            grid.Columns.Add("InvNo", "Document No");
            grid.Columns.Add("Date", "Date & Time");
            grid.Columns.Add("Type", "Type");
            grid.Columns.Add("Party", "Customer / Supplier");
            grid.Columns.Add("PayMode", "Payment Mode");
            grid.Columns.Add("Taxable", "Taxable (Rs.)");
            grid.Columns.Add("Gst", "GST (Rs.)");
            grid.Columns.Add("Grand", "Grand Total (Rs.)");

            foreach (var inv in prof.Invoices.OrderByDescending(x => x.Date).Take(25))
            {
                grid.Rows.Add(inv.InvoiceNo, inv.Date.ToString("dd-MMM-yyyy HH:mm"), inv.DocType, inv.CustomerName,
                    inv.PaymentMode, inv.TaxableTotal.ToString("N2"), inv.GstTotal.ToString("N2"), inv.GrandTotal.ToString("N2"));
            }

            grid.CellDoubleClick += (s, e) =>
            {
                if (e.RowIndex < 0) return;
                string invNo = grid.Rows[e.RowIndex].Cells[0].Value?.ToString();
                var found = prof.Invoices.FirstOrDefault(x => x.InvoiceNo == invNo);
                if (found != null)
                {
                    BillingEngine.ShowInvoicePrintPreview(this, found, prof.Company, "A4");
                }
            };

            recentCard.Controls.Add(grid);
            recentCard.Controls.Add(lblRecent);
            bottomSplit.Controls.Add(recentCard, 0, 0);

            // Low-Stock & Expiring Batch Notification Panel
            var alertCard = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(10) };
            var lblAlert = new Label
            {
                Text = "LOW-STOCK & 30-DAY EXPIRY NOTIFICATIONS",
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(185, 28, 28),
                Dock = DockStyle.Top,
                Height = 24
            };
            var alertGrid = CreateStandardGrid();
            alertGrid.Columns.Add("Code", "SKU");
            alertGrid.Columns.Add("Item", "Item Name");
            alertGrid.Columns.Add("Stock", "Stock / Reorder");
            alertGrid.Columns.Add("Status", "Alert");

            foreach (var it in prof.Items)
            {
                bool isLow = it.Stock <= it.ReorderLevel;
                bool isExpiring = false;
                if (DateTime.TryParse(it.ExpiryDate, out DateTime expDt))
                {
                    double days = (expDt.Date - DateTime.Today).TotalDays;
                    if (days <= 30) isExpiring = true;
                }
                if (isLow || isExpiring)
                {
                    string statusTag = (isLow ? "LOW STOCK " : "") + (isExpiring ? $"EXP: {it.ExpiryDate}" : "");
                    int rIdx = alertGrid.Rows.Add(it.Code, it.Name, $"{it.Stock:0.##} / {it.ReorderLevel:0.##}", statusTag.Trim());
                    alertGrid.Rows[rIdx].DefaultCellStyle.ForeColor = Color.FromArgb(185, 28, 28);
                }
            }

            alertCard.Controls.Add(alertGrid);
            alertCard.Controls.Add(lblAlert);
            bottomSplit.Controls.Add(alertCard, 1, 0);

            root.Controls.Add(bottomSplit, 0, 3);
            _contentPanel.Controls.Add(root);
        }

        private Panel BuildKpiCard(string title, string mainValue, string subText, Color accentColor)
        {
            var card = new Panel
            {
                Dock = DockStyle.Fill,
                BackColor = Color.White,
                Margin = new Padding(4),
                Padding = new Padding(12, 10, 12, 10)
            };
            var leftStripe = new Panel { Dock = DockStyle.Left, Width = 5, BackColor = accentColor };
            var lblTitle = new Label
            {
                Text = title,
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(100, 116, 139),
                Location = new Point(16, 10),
                AutoSize = true
            };
            var lblVal = new Label
            {
                Text = mainValue,
                Font = new Font("Segoe UI", 15f, FontStyle.Bold),
                ForeColor = Color.FromArgb(15, 23, 42),
                Location = new Point(14, 32),
                AutoSize = true
            };
            var lblSub = new Label
            {
                Text = subText,
                Font = new Font("Segoe UI", 8.5f, FontStyle.Regular),
                ForeColor = accentColor,
                Location = new Point(16, 66),
                AutoSize = true
            };
            card.Controls.AddRange(new Control[] { leftStripe, lblTitle, lblVal, lblSub });
            return card;
        }

        private void DrawStockMovementChart(Graphics g, Rectangle bounds, List<StockMovementSeries> series)
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.Clear(Color.White);

            if (bounds.Width < 200 || bounds.Height < 100)
                return;

            int left = 54, right = 230, top = 16, bottom = 32;
            int w = bounds.Width - left - right;
            int h = bounds.Height - top - bottom;
            if (w <= 50 || h <= 40) return;

            using var gridPen = new Pen(Color.FromArgb(226, 232, 240), 1f);
            using var axisFont = new Font("Segoe UI", 8f);

            if (series == null || series.Count == 0)
            {
                // Draw 7-Day Daily Sales Trend when no item stock series exist yet
                var prof = AppStore.CurrentProfile;
                decimal[] dailyTotals = new decimal[7];
                string[] dayLabels = new string[7];
                for (int i = 0; i < 7; i++)
                {
                    DateTime d = DateTime.Today.AddDays(-6 + i);
                    dayLabels[i] = d.ToString("dd MMM");
                    dailyTotals[i] = prof.Invoices
                        .Where(inv => inv.DocType == "SALE" && inv.Date.Date == d)
                        .Sum(inv => inv.GrandTotal);
                }

                decimal maxSale = Math.Max(1000m, dailyTotals.Max());
                for (int i = 0; i <= 4; i++)
                {
                    int y = top + h - (int)(h * (i / 4.0));
                    g.DrawLine(gridPen, left, y, left + w, y);
                    decimal v = Math.Round(maxSale * i / 4m, 0);
                    g.DrawString(v.ToString("0"), axisFont, Brushes.Gray, 6, y - 6);
                }

                var salesPts = new List<PointF>();
                for (int i = 0; i < 7; i++)
                {
                    float x = left + (w * i / 6f);
                    float y = top + h - (float)((double)dailyTotals[i] / (double)maxSale * h);
                    salesPts.Add(new PointF(x, y));
                    g.DrawString(dayLabels[i], axisFont, Brushes.DimGray, x - 16, top + h + 6);
                }

                using var salesPen = new Pen(Color.FromArgb(13, 148, 136), 2.5f);
                if (salesPts.Count > 1)
                    g.DrawLines(salesPen, salesPts.ToArray());
                foreach (var pt in salesPts)
                    g.FillEllipse(Brushes.Teal, pt.X - 3.5f, pt.Y - 3.5f, 7f, 7f);

                int lx = left + w + 16;
                g.FillRectangle(Brushes.Teal, lx, top + 4, 12, 12);
                g.DrawString("7-Day Sales Trend (Rs.)", axisFont, Brushes.Black, lx + 16, top + 2);
                return;
            }

            decimal maxVal = Math.Max(10m, series.SelectMany(s => s.DailyPoints).Select(p => p.SoldQty + p.PurchasedQty).DefaultIfEmpty(10m).Max());

            for (int i = 0; i <= 4; i++)
            {
                int y = top + h - (int)(h * (i / 4.0));
                g.DrawLine(gridPen, left, y, left + w, y);
                decimal v = Math.Round(maxVal * i / 4m, 0);
                g.DrawString(v.ToString("0"), axisFont, Brushes.Gray, 6, y - 6);
            }

            Color[] palette =
            {
                Color.FromArgb(37, 99, 235), Color.FromArgb(22, 163, 74), Color.FromArgb(217, 119, 6),
                Color.FromArgb(220, 38, 38), Color.FromArgb(124, 58, 237), Color.FromArgb(14, 116, 144),
                Color.FromArgb(234, 88, 12), Color.FromArgb(190, 24, 93), Color.FromArgb(79, 70, 229),
                Color.FromArgb(5, 150, 105)
            };

            int days = 30;
            for (int d = 0; d < days; d += 5)
            {
                float x = left + (w * d / (float)(days - 1));
                string dtLbl = series[0].DailyPoints[d].Date.ToString("dd MMM");
                g.DrawString(dtLbl, axisFont, Brushes.DimGray, x - 14, top + h + 6);
            }

            for (int sIdx = 0; sIdx < series.Count; sIdx++)
            {
                var ser = series[sIdx];
                var col = palette[sIdx % palette.Length];
                using var pen = new Pen(col, 2f);
                var pts = new List<PointF>();

                for (int d = 0; d < ser.DailyPoints.Count; d++)
                {
                    float x = left + (w * d / (float)(ser.DailyPoints.Count - 1));
                    decimal qty = ser.DailyPoints[d].SoldQty + ser.DailyPoints[d].PurchasedQty;
                    float y = top + h - (float)((double)qty / (double)maxVal * h);
                    pts.Add(new PointF(x, y));
                }

                if (pts.Count > 1)
                    g.DrawLines(pen, pts.ToArray());

                // Legend on Right
                int legX = left + w + 16;
                int legY = top + sIdx * 20;
                using var b = new SolidBrush(col);
                g.FillRectangle(b, legX, legY + 3, 12, 12);
                string nm = ser.ItemName.Length > 22 ? ser.ItemName.Substring(0, 22) + ".." : ser.ItemName;
                g.DrawString($"{nm} ({ser.TotalSold30Days:0})", axisFont, Brushes.Black, legX + 16, legY + 1);
            }
        }

        // ====================================================================
        // 2. POS BILLING / PURCHASE / RETURN / ESTIMATE / CHALLAN ENGINE
        //    (WITH AUTOMATIC DRAFT PERSISTENCE, CAMERA BARCODE SCANNER & SIGNATURE)
        // ====================================================================
        private void ShowBillingScreen(string docType)
        {
            _contentPanel.Controls.Clear();
            _currentDocType = docType;
            var prof = AppStore.CurrentProfile;
            bool isGst = string.Equals(AppStore.Data.ActiveProfile, "GST", StringComparison.OrdinalIgnoreCase);

            // Restore draft only if it has line items
            var existingDraft = AppStore.LoadDraftBill(docType);
            if (existingDraft != null && existingDraft.Lines != null && existingDraft.Lines.Count > 0)
            {
                _currentLines = existingDraft.Lines.ToList();
                _currentBillAuthSignatureDataUrl = existingDraft.AuthorizedSignatureDataUrl ?? prof.Company.SignatureDataUrl;
                _currentBillCustomerSignatureDataUrl = existingDraft.CustomerSignatureDataUrl ?? "";
            }
            else
            {
                existingDraft = null;
                _currentLines = new List<InvoiceLine>();
                _currentBillAuthSignatureDataUrl = prof.Company.SignatureDataUrl ?? "";
                _currentBillCustomerSignatureDataUrl = "";
            }

            var mainLayout = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                ColumnCount = 1,
                RowCount = 4,
                BackColor = Color.FromArgb(241, 245, 249)
            };
            mainLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 134f));
            mainLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 76f));
            mainLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 100f));
            mainLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 214f));

            // ----------------------------------------------------------------
            // ROW 0: PARTY & DOCUMENT METADATA PANEL
            // ----------------------------------------------------------------
            var partyCard = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(10), Margin = new Padding(0, 0, 0, 6) };

            string screenTitle = docType switch
            {
                "SALE" => isGst ? "POS TAX INVOICE (GOODS OUT)" : "POS RETAIL BILL OF SUPPLY",
                "PURCHASE" => "SUPPLIER PURCHASE INVOICE (GOODS IN)",
                "STOCK_OUT" => "STOCK OUT / INTERNAL ISSUE ENTRY",
                "SALE_RETURN" => "SALES RETURN / CREDIT NOTE",
                "PURCHASE_RETURN" => "PURCHASE RETURN / DEBIT NOTE",
                "ESTIMATE" => "PROFORMA ESTIMATE / QUOTATION",
                "DELIVERY_CHALLAN" => "DELIVERY CHALLAN",
                _ => "POS BILLING"
            };

            var lblDocHeader = new Label
            {
                Text = $"{screenTitle}   [Draft Auto-Hold Active | {AppStore.Data.ActiveFinancialYear}]",
                Font = new Font("Segoe UI", 11f, FontStyle.Bold),
                ForeColor = Color.FromArgb(15, 23, 42),
                Location = new Point(12, 6),
                AutoSize = true
            };
            partyCard.Controls.Add(lblDocHeader);

            var txtInvNo = AddLabeledBox(partyCard, "Document No:", AppStore.GetNextDocumentNumber(docType), 12, 34, 125);
            var dtpDate = new DateTimePicker
            {
                Location = new Point(148, 52),
                Width = 125,
                Format = DateTimePickerFormat.Short,
                Value = DateTime.Now
            };
            partyCard.Controls.Add(new Label { Text = "Date:", Location = new Point(148, 34), AutoSize = true, Font = new Font("Segoe UI", 8.5f, FontStyle.Bold) });
            partyCard.Controls.Add(dtpDate);

            var cmbParty = new ComboBox
            {
                Location = new Point(284, 52),
                Width = 230,
                DropDownStyle = ComboBoxStyle.DropDown,
                AutoCompleteMode = AutoCompleteMode.SuggestAppend,
                AutoCompleteSource = AutoCompleteSource.ListItems,
                Font = new Font("Segoe UI", 9.5f)
            };
            partyCard.Controls.Add(new Label { Text = docType.StartsWith("PURCHASE") ? "Supplier Name:" : "Customer Name:", Location = new Point(284, 34), AutoSize = true, Font = new Font("Segoe UI", 8.5f, FontStyle.Bold) });
            if (docType.StartsWith("PURCHASE"))
            {
                foreach (var s in prof.Suppliers) cmbParty.Items.Add(s.Name);
            }
            else
            {
                foreach (var c in prof.Customers) cmbParty.Items.Add(c.Name);
            }
            // Start completely blank (do NOT pre-fill customer/supplier name)
            cmbParty.SelectedIndex = -1;
            cmbParty.Text = "";

            var txtPhone = AddLabeledBox(partyCard, "Mobile / WhatsApp:", "", 524, 34, 130);
            var txtGstin = AddLabeledBox(partyCard, "Party GSTIN:", "", 664, 34, 140);

            var cmbState = new ComboBox
            {
                Location = new Point(814, 52),
                Width = 165,
                DropDownStyle = ComboBoxStyle.DropDownList,
                Font = new Font("Segoe UI", 9.5f)
            };
            partyCard.Controls.Add(new Label { Text = "Place of Supply:", Location = new Point(814, 34), AutoSize = true, Font = new Font("Segoe UI", 8.5f, FontStyle.Bold) });
            string[] states = { "09-Uttar Pradesh", "07-Delhi", "27-Maharashtra", "24-Gujarat", "06-Haryana", "08-Rajasthan", "19-West Bengal", "29-Karnataka", "33-Tamil Nadu" };
            cmbState.Items.AddRange(states);
            cmbState.SelectedIndex = 0;

            var cmbPayMode = new ComboBox
            {
                Location = new Point(990, 52),
                Width = 135,
                DropDownStyle = ComboBoxStyle.DropDownList,
                Font = new Font("Segoe UI", 9.5f)
            };
            partyCard.Controls.Add(new Label { Text = "Payment Mode:", Location = new Point(990, 34), AutoSize = true, Font = new Font("Segoe UI", 8.5f, FontStyle.Bold) });
            cmbPayMode.Items.AddRange(new object[] { "CASH", "UPI / QR", "CARD", "NEFT / RTGS", "CHEQUE", "CREDIT (UDHAAR)" });
            cmbPayMode.SelectedIndex = 0;

            partyCard.Controls.AddRange(new Control[] { cmbParty, cmbState, cmbPayMode });

            var txtAddress = AddLabeledBox(partyCard, "Billing Address:", "", 12, 82, 300);
            var txtSalesperson = AddLabeledBox(partyCard, "Sales Rep:", "", 324, 82, 130);
            var txtPayRef = AddLabeledBox(partyCard, "UPI / Chq / Ref No:", "", 466, 82, 170);

            if (existingDraft != null)
            {
                _suppressDraftAutoSave = true;
                cmbParty.Text = string.Equals(existingDraft.CustomerName, "WALK-IN CUSTOMER", StringComparison.OrdinalIgnoreCase)
                    ? ""
                    : (existingDraft.CustomerName ?? "");
                txtPhone.Text = existingDraft.CustomerPhone;
                txtGstin.Text = existingDraft.CustomerGstin;
                txtAddress.Text = existingDraft.CustomerAddress;
                if (!string.IsNullOrWhiteSpace(existingDraft.PlaceOfSupply)) cmbState.Text = existingDraft.PlaceOfSupply;
                if (!string.IsNullOrWhiteSpace(existingDraft.PaymentMode)) cmbPayMode.Text = existingDraft.PaymentMode;
                txtPayRef.Text = existingDraft.PaymentReference;
                txtSalesperson.Text = existingDraft.Salesperson;
                _suppressDraftAutoSave = false;
            }

            mainLayout.Controls.Add(partyCard, 0, 0);

            // ----------------------------------------------------------------
            // ROW 1: BARCODE SCANNER & ITEM ENTRY BAR
            // (Barcode | Item with Substring Suggestions | Base Price | Stock Qty | Qty | Rate | GST % (C+S) | Disc 1 % | Disc 2 % | Unit | Add Item)
            // ----------------------------------------------------------------
            var entryCard = new Panel { Dock = DockStyle.Fill, BackColor = Color.FromArgb(239, 246, 255), Padding = new Padding(8), Margin = new Padding(0, 0, 0, 6) };

            var txtBarcode = AddLabeledBox(entryCard, "Barcode:", "", 10, 8, 92);

            var btnCameraScan = CreateActionButton("Scan", Color.FromArgb(124, 58, 237), 54);
            btnCameraScan.Location = new Point(106, 25);
            btnCameraScan.Height = 27;

            var cmbItem = new ComboBox
            {
                Location = new Point(166, 26),
                Width = isGst ? 225 : 290,
                DropDownStyle = ComboBoxStyle.DropDown,
                AutoCompleteMode = AutoCompleteMode.None,
                Font = new Font("Segoe UI", 9.5f)
            };
            entryCard.Controls.Add(new Label
            {
                Text = "Item (Type word e.g. 'dom'):",
                Location = new Point(166, 8),
                AutoSize = true,
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold)
            });

            // Floating Substring Suggestion ListBox (shows all items matching any typed substring like "dom")
            var lstItemSuggestions = new ListBox
            {
                Visible = false,
                Width = 380,
                Height = 180,
                Font = new Font("Segoe UI", 9.5f),
                BackColor = Color.FromArgb(255, 255, 240),
                ForeColor = Color.FromArgb(15, 23, 42),
                BorderStyle = BorderStyle.FixedSingle
            };
            var matchedSuggestionItems = new List<ItemRecord>();
            ItemRecord selectedItemRecord = null;
            bool suppressItemTextEvents = false;

            int curX = isGst ? 397 : 462;

            TextBox txtBasePrice = null;
            if (isGst)
            {
                txtBasePrice = AddLabeledBox(entryCard, "Base Price:", "0.00", curX, 8, 72);
                curX += 78;
            }

            var txtStockQty = AddLabeledBox(entryCard, "Stock Qty:", "0", curX, 8, 62);
            txtStockQty.ReadOnly = true;
            txtStockQty.BackColor = Color.FromArgb(241, 245, 249);
            curX += 68;

            var txtQty = AddLabeledBox(entryCard, "Qty:", "1", curX, 8, 48);
            curX += 54;

            var txtRate = AddLabeledBox(entryCard, "Rate:", "0", curX, 8, 72);
            curX += 78;

            TextBox txtGstPct = null;
            if (isGst)
            {
                txtGstPct = AddLabeledBox(entryCard, "GST % (C+S):", "18", curX, 8, 74);
                curX += 80;
            }

            var txtDisc = AddLabeledBox(entryCard, "Disc 1 %:", "0", curX, 8, 56);
            curX += 62;

            var txtDisc2 = AddLabeledBox(entryCard, "Disc 2 %:", "0", curX, 8, 56);
            curX += 62;

            var cmbUnit = new ComboBox
            {
                Location = new Point(curX, 26),
                Width = 66,
                DropDownStyle = ComboBoxStyle.DropDown,
                Font = new Font("Segoe UI", 9.5f)
            };
            entryCard.Controls.Add(new Label
            {
                Text = "Unit:",
                Location = new Point(curX, 8),
                AutoSize = true,
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold)
            });
            cmbUnit.Items.AddRange(new object[] { "PCS", "BOX", "PKT", "SET", "KG", "DOZ" });
            cmbUnit.Text = "PCS";
            curX += 72;

            var btnAddLine = CreateActionButton("Add Item", Color.FromArgb(37, 99, 235), 92);
            btnAddLine.Location = new Point(curX, 23);
            btnAddLine.Height = 30;
            curX += 98;

            var btnNewSku = CreateActionButton("+ SKU", Color.FromArgb(22, 163, 74), 64);
            btnNewSku.Location = new Point(curX, 23);
            btnNewSku.Height = 30;
            curX += 70;

            var btnRemoveLine = CreateActionButton("Del", Color.FromArgb(220, 38, 38), 52);
            btnRemoveLine.Location = new Point(curX, 23);
            btnRemoveLine.Height = 30;

            entryCard.Controls.AddRange(new Control[] { btnCameraScan, cmbItem, cmbUnit, btnAddLine, btnNewSku, btnRemoveLine });

            bool suppressBaseRateSync = false;
            void RecalculateBasePriceFromRateAndGst()
            {
                if (!isGst || txtBasePrice == null || txtGstPct == null || suppressBaseRateSync) return;
                suppressBaseRateSync = true;
                decimal.TryParse(txtRate.Text, out decimal r);
                decimal.TryParse(txtGstPct.Text, out decimal g);
                if (r > 0m && g >= 0m)
                {
                    // Remove GST % from Selling Price (Rate) to get Base Price (e.g., 240 with 18% -> Base Price)
                    decimal baseP = Math.Round(r - (r * g / 100m), 2, MidpointRounding.AwayFromZero);
                    txtBasePrice.Text = baseP.ToString("0.00");
                }
                else
                {
                    txtBasePrice.Text = "0.00";
                }
                suppressBaseRateSync = false;
            }

            txtRate.TextChanged += (s, e) => RecalculateBasePriceFromRateAndGst();
            if (txtGstPct != null)
            {
                txtGstPct.TextChanged += (s, e) => RecalculateBasePriceFromRateAndGst();
            }

            void ApplySelectedItemToInputs(ItemRecord sel)
            {
                if (sel == null) return;
                selectedItemRecord = sel;
                suppressItemTextEvents = true;
                cmbItem.Text = sel.Name;
                cmbItem.SelectionStart = cmbItem.Text.Length;
                suppressItemTextEvents = false;

                decimal r = docType.StartsWith("PURCHASE") ? sel.CostPrice : sel.Price;
                txtStockQty.Text = sel.Stock.ToString("0.##");
                txtRate.Text = r.ToString("0.00");
                txtDisc.Text = sel.DefaultDiscountPct.ToString("0.#");
                txtDisc2.Text = "0";
                cmbUnit.Text = string.IsNullOrWhiteSpace(sel.Uom) ? "PCS" : sel.Uom;
                if (isGst && txtGstPct != null)
                {
                    txtGstPct.Text = sel.GstPercent.ToString("0.#");
                }
                if (isGst && txtBasePrice != null)
                {
                    suppressBaseRateSync = true;
                    decimal bp = sel.BasePrice > 0m && sel.BasePrice <= r
                        ? sel.BasePrice
                        : Math.Round(r - (r * sel.GstPercent / 100m), 2, MidpointRounding.AwayFromZero);
                    txtBasePrice.Text = bp.ToString("0.00");
                    suppressBaseRateSync = false;
                }
                lstItemSuggestions.Visible = false;
            }

            void ReloadItemCombo(ItemRecord selectItem = null)
            {
                suppressItemTextEvents = true;
                cmbItem.Items.Clear();
                foreach (var it in prof.Items)
                {
                    cmbItem.Items.Add($"{it.Name} [{it.Code}] (Stk: {it.Stock:0.##} | Rs.{it.Price:0.##})");
                }
                if (selectItem != null)
                {
                    ApplySelectedItemToInputs(selectItem);
                }
                else
                {
                    // Start blank — do NOT pre-select any item on open
                    selectedItemRecord = null;
                    cmbItem.SelectedIndex = -1;
                    cmbItem.Text = "";
                }
                suppressItemTextEvents = false;
            }

            cmbItem.SelectedIndexChanged += (s, e) =>
            {
                if (suppressItemTextEvents) return;
                if (cmbItem.SelectedIndex >= 0 && cmbItem.SelectedIndex < prof.Items.Count)
                {
                    ApplySelectedItemToInputs(prof.Items[cmbItem.SelectedIndex]);
                }
            };

            cmbItem.TextUpdate += (s, e) =>
            {
                if (suppressItemTextEvents) return;
                selectedItemRecord = null;
                string q = (cmbItem.Text ?? "").Trim();
                if (string.IsNullOrEmpty(q))
                {
                    lstItemSuggestions.Visible = false;
                    return;
                }

                string[] tokens = q.ToLowerInvariant().Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                matchedSuggestionItems = prof.Items
                    .Where(it =>
                    {
                        string hay = $"{it.Name} {it.Code} {it.Barcode} {it.Category} {it.Brand}".ToLowerInvariant();
                        return tokens.All(tk => hay.Contains(tk));
                    })
                    .Take(25)
                    .ToList();

                lstItemSuggestions.Items.Clear();
                foreach (var mIt in matchedSuggestionItems)
                {
                    decimal p = docType.StartsWith("PURCHASE") ? mIt.CostPrice : mIt.Price;
                    lstItemSuggestions.Items.Add($"{mIt.Name}   |   Code: {mIt.Code}   |   Rate: Rs.{p:0.00}   |   Stock: {mIt.Stock:0.##} {mIt.Uom}");
                }

                if (matchedSuggestionItems.Count > 0)
                {
                    Point ptInContent = _contentPanel.PointToClient(cmbItem.Parent.PointToScreen(new Point(cmbItem.Left, cmbItem.Bottom + 2)));
                    lstItemSuggestions.Location = ptInContent;
                    lstItemSuggestions.Height = Math.Min(210, Math.Max(48, matchedSuggestionItems.Count * 22 + 8));
                    lstItemSuggestions.Visible = true;
                    lstItemSuggestions.BringToFront();
                }
                else
                {
                    lstItemSuggestions.Visible = false;
                }
            };

            lstItemSuggestions.Click += (s, e) =>
            {
                int idx = lstItemSuggestions.SelectedIndex;
                if (idx >= 0 && idx < matchedSuggestionItems.Count)
                {
                    ApplySelectedItemToInputs(matchedSuggestionItems[idx]);
                    txtQty.Focus();
                    txtQty.SelectAll();
                }
            };

            lstItemSuggestions.KeyDown += (s, e) =>
            {
                if (e.KeyCode == Keys.Enter)
                {
                    int idx = lstItemSuggestions.SelectedIndex;
                    if (idx >= 0 && idx < matchedSuggestionItems.Count)
                    {
                        e.SuppressKeyPress = true;
                        ApplySelectedItemToInputs(matchedSuggestionItems[idx]);
                        txtQty.Focus();
                        txtQty.SelectAll();
                    }
                }
                else if (e.KeyCode == Keys.Escape)
                {
                    lstItemSuggestions.Visible = false;
                    cmbItem.Focus();
                }
            };

            ReloadItemCombo(null);

            mainLayout.Controls.Add(entryCard, 0, 1);

            // ----------------------------------------------------------------
            // ROW 2: LINE ITEMS GRID
            // ----------------------------------------------------------------
            var gridPanel = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(6), Margin = new Padding(0, 0, 0, 6) };
            var lineGrid = CreateStandardGrid();
            lineGrid.Columns.Add("Sno", "#");
            lineGrid.Columns.Add("Code", "SKU Code");
            lineGrid.Columns.Add("Name", "Item Description");
            lineGrid.Columns.Add("Hsn", "HSN");
            lineGrid.Columns.Add("Qty", "Qty");
            lineGrid.Columns.Add("Uom", "Unit");
            if (isGst)
            {
                lineGrid.Columns.Add("BasePrice", "Base Price");
            }
            lineGrid.Columns.Add("Rate", "Rate");
            lineGrid.Columns.Add("Disc1", "Disc 1 %");
            lineGrid.Columns.Add("Disc2", "Disc 2 %");
            lineGrid.Columns.Add("DiscAmt", "Disc Amt");
            lineGrid.Columns.Add("Taxable", isGst ? "Base Total" : "Net Amount");
            if (isGst)
            {
                lineGrid.Columns.Add("GstPct", "GST %");
                lineGrid.Columns.Add("Cgst", "CGST");
                lineGrid.Columns.Add("Sgst", "SGST");
                lineGrid.Columns.Add("Igst", "IGST");
            }
            lineGrid.Columns.Add("Total", "Line Total (Rs.)");

            gridPanel.Controls.Add(lineGrid);
            mainLayout.Controls.Add(gridPanel, 0, 2);

            // ----------------------------------------------------------------
            // ROW 3: FOOTER SUMMARY (BILL DISCOUNT, PREVIOUS BALANCE, ADJUST CREDITED AMOUNT, LIVE UPI QR, SIGNATURE & ACTION BAR)
            // ----------------------------------------------------------------
            var footerCard = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(10) };

            var txtBillDiscount = AddLabeledBox(footerCard, "Bill Discount (Rs.):", existingDraft != null ? existingDraft.CashDiscount.ToString("0.00") : "0.00", 12, 6, 105);
            var txtPrevBalance = AddLabeledBox(footerCard, "Previous Balance:", existingDraft != null ? existingDraft.PreviousBalance.ToString("0.00") : "0.00", 125, 6, 105);
            var txtReceived = AddLabeledBox(footerCard, "Received (Rs.):", existingDraft != null ? existingDraft.AmountReceived.ToString("0.00") : "0.00", 238, 6, 102);

            var chkAdjustCredit = new CheckBox
            {
                Text = "Adjust Credited Amt:",
                Location = new Point(12, 56),
                AutoSize = true,
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(15, 118, 110),
                Checked = existingDraft != null && existingDraft.AdjustedCreditAmount > 0m
            };
            var txtAdjustCredit = new TextBox
            {
                Location = new Point(155, 54),
                Width = 75,
                Text = existingDraft != null ? existingDraft.AdjustedCreditAmount.ToString("0.00") : "0.00",
                Font = new Font("Segoe UI", 9.5f)
            };
            var txtFreight = AddLabeledBox(footerCard, "Freight:", existingDraft != null ? existingDraft.FreightCharges.ToString("0.00") : "0.00", 238, 44, 50);
            var txtPacking = AddLabeledBox(footerCard, "Packing:", existingDraft != null ? existingDraft.PackingCharges.ToString("0.00") : "0.00", 294, 44, 46);
            var txtNotes = AddLabeledBox(footerCard, "Remarks / Notes:", existingDraft?.Notes ?? "", 12, 84, 328);

            footerCard.Controls.Add(chkAdjustCredit);
            footerCard.Controls.Add(txtAdjustCredit);

            // Signature Integration in Bill Panel
            var sigGroup = new Panel
            {
                Location = new Point(12, 132),
                Size = new Size(328, 64),
                BackColor = Color.FromArgb(248, 250, 252),
                BorderStyle = BorderStyle.FixedSingle
            };
            var lblSigTitle = new Label
            {
                Text = "Authorized Signature (Company Master):",
                Location = new Point(6, 3),
                AutoSize = true,
                Font = new Font("Segoe UI", 7.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(71, 85, 105)
            };
            var picBillSig = new PictureBox
            {
                Location = new Point(6, 19),
                Size = new Size(145, 40),
                BackColor = Color.White,
                BorderStyle = BorderStyle.FixedSingle,
                SizeMode = PictureBoxSizeMode.Zoom
            };
            void RefreshBillSignaturePreview()
            {
                string src = !string.IsNullOrWhiteSpace(_currentBillAuthSignatureDataUrl)
                    ? _currentBillAuthSignatureDataUrl
                    : prof.Company.SignatureDataUrl;
                picBillSig.Image?.Dispose();
                picBillSig.Image = BillingEngine.TryDecodeImageFromDataUrlOrPath(src);
            }
            RefreshBillSignaturePreview();

            var btnUploadBillSig = CreateActionButton("Upload Signature", Color.FromArgb(30, 64, 175), 145);
            btnUploadBillSig.Location = new Point(166, 22);
            btnUploadBillSig.Height = 28;
            btnUploadBillSig.Click += (s, e) =>
            {
                using var ofd = new OpenFileDialog
                {
                    Title = "Select Authorized Signature Image",
                    Filter = "Image Files (*.png;*.jpg;*.jpeg;*.bmp)|*.png;*.jpg;*.jpeg;*.bmp"
                };
                if (ofd.ShowDialog(this) == DialogResult.OK)
                {
                    byte[] imgBytes = File.ReadAllBytes(ofd.FileName);
                    string ext = Path.GetExtension(ofd.FileName).TrimStart('.').ToLowerInvariant();
                    if (ext == "jpg") ext = "jpeg";
                    _currentBillAuthSignatureDataUrl = $"data:image/{ext};base64," + Convert.ToBase64String(imgBytes);
                    prof.Company.SignatureDataUrl = _currentBillAuthSignatureDataUrl;
                    AppStore.SaveAtomic();
                    RefreshBillSignaturePreview();
                }
            };
            sigGroup.Controls.AddRange(new Control[] { lblSigTitle, picBillSig, btnUploadBillSig });
            footerCard.Controls.Add(sigGroup);

            var lblTaxBreakdown = new Label
            {
                Location = new Point(350, 6),
                Size = new Size(346, 130),
                Font = new Font("Consolas", 9f, FontStyle.Bold),
                ForeColor = Color.FromArgb(30, 41, 59),
                Text = "Sub Total   : Rs. 0.00\nDiscount    : Rs. 0.00\nTaxable Val : Rs. 0.00\nGST Total   : Rs. 0.00"
            };
            footerCard.Controls.Add(lblTaxBreakdown);

            var lblGrandBanner = new Label
            {
                Location = new Point(350, 140),
                Size = new Size(346, 56),
                BackColor = Color.FromArgb(15, 23, 42),
                ForeColor = Color.FromArgb(74, 222, 128),
                Font = new Font("Segoe UI", 14.5f, FontStyle.Bold),
                TextAlign = ContentAlignment.MiddleCenter,
                Text = "TOTAL AMOUNT: Rs. 0.00"
            };
            footerCard.Controls.Add(lblGrandBanner);

            // Live UPI QR Box inside Billing Footer
            var qrPanel = new Panel
            {
                Location = new Point(705, 6),
                Size = new Size(165, 188),
                BackColor = Color.FromArgb(248, 250, 252),
                BorderStyle = BorderStyle.FixedSingle
            };
            var picQr = new PictureBox
            {
                Location = new Point(22, 6),
                Size = new Size(120, 120),
                SizeMode = PictureBoxSizeMode.Zoom,
                BackColor = Color.White
            };
            var lblQrCaption = new Label
            {
                Text = "SCAN TO PAY (LIVE UPI QR)",
                Location = new Point(4, 130),
                Size = new Size(156, 52),
                TextAlign = ContentAlignment.TopCenter,
                Font = new Font("Segoe UI", 7.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(30, 64, 175)
            };
            qrPanel.Controls.Add(picQr);
            qrPanel.Controls.Add(lblQrCaption);
            footerCard.Controls.Add(qrPanel);

            // Action Buttons on Right
            int bx = 882;
            var btnSaveAndPrint = CreateActionButton("Save & Print (F10)", Color.FromArgb(22, 163, 74), 170);
            btnSaveAndPrint.Location = new Point(bx, 10);
            btnSaveAndPrint.Height = 40;

            var btnPreviewA4 = CreateActionButton("A4 Print Preview", Color.FromArgb(37, 99, 235), 145);
            btnPreviewA4.Location = new Point(bx + 178, 10);
            btnPreviewA4.Height = 40;

            var btnPreviewA5 = CreateActionButton("A5 Landscape", Color.FromArgb(79, 70, 229), 130);
            btnPreviewA5.Location = new Point(bx, 58);
            btnPreviewA5.Height = 36;

            var btnThermal = CreateActionButton("Thermal 80mm", Color.FromArgb(14, 116, 144), 135);
            btnThermal.Location = new Point(bx + 138, 58);
            btnThermal.Height = 36;

            var btnExportPdf = CreateActionButton("Export PDF", Color.FromArgb(190, 24, 93), 140);
            btnExportPdf.Location = new Point(bx, 102);
            btnExportPdf.Height = 36;

            var btnShowUpiModal = CreateActionButton("Generate UPI QR", Color.FromArgb(217, 119, 6), 140);
            btnShowUpiModal.Location = new Point(bx + 148, 102);
            btnShowUpiModal.Height = 36;

            var btnClearBill = CreateActionButton("Clear Bill / Draft", Color.FromArgb(100, 116, 139), 140);
            btnClearBill.Location = new Point(bx, 144);
            btnClearBill.Height = 34;

            footerCard.Controls.AddRange(new Control[]
            {
                btnSaveAndPrint, btnPreviewA4, btnPreviewA5, btnThermal, btnExportPdf, btnShowUpiModal, btnClearBill
            });
            mainLayout.Controls.Add(footerCard, 0, 3);

            void PersistDraftNow()
            {
                if (_suppressDraftAutoSave) return;
                decimal.TryParse(txtBillDiscount.Text, out decimal cashDisc);
                decimal.TryParse(txtPrevBalance.Text, out decimal prevBal);
                decimal.TryParse(txtAdjustCredit.Text, out decimal adjCred);
                decimal.TryParse(txtFreight.Text, out decimal fr);
                decimal.TryParse(txtPacking.Text, out decimal pk);
                decimal.TryParse(txtReceived.Text, out decimal rcv);

                AppStore.SaveDraftBill(new DraftBillRecord
                {
                    DocType = docType,
                    Profile = AppStore.Data.ActiveProfile,
                    CustomerName = cmbParty.Text.Trim(),
                    CustomerPhone = txtPhone.Text.Trim(),
                    CustomerGstin = txtGstin.Text.Trim(),
                    CustomerAddress = txtAddress.Text.Trim(),
                    PlaceOfSupply = cmbState.Text,
                    PaymentMode = cmbPayMode.Text,
                    PaymentReference = txtPayRef.Text.Trim(),
                    Salesperson = txtSalesperson.Text.Trim(),
                    Notes = txtNotes.Text.Trim(),
                    CashDiscount = cashDisc,
                    PreviousBalance = prevBal,
                    AdjustedCreditAmount = chkAdjustCredit.Checked ? adjCred : 0m,
                    FreightCharges = fr,
                    PackingCharges = pk,
                    AmountReceived = rcv,
                    AuthorizedSignatureDataUrl = _currentBillAuthSignatureDataUrl,
                    CustomerSignatureDataUrl = _currentBillCustomerSignatureDataUrl,
                    Lines = _currentLines.ToList()
                });
            }

            InvoiceRecord BuildCurrentInvoiceObject()
            {
                decimal sub = _currentLines.Sum(x => x.GrossAmount);
                decimal lineDisc = _currentLines.Sum(x => x.DiscountAmount);
                decimal.TryParse(txtBillDiscount.Text, out decimal cashDisc);
                if (cashDisc < 0m) cashDisc = 0m;
                decimal totalDisc = lineDisc + cashDisc;

                decimal taxable = Math.Max(0m, _currentLines.Sum(x => x.TaxableValue) - cashDisc);
                decimal cgst = _currentLines.Sum(x => x.CgstAmount);
                decimal sgst = _currentLines.Sum(x => x.SgstAmount);
                decimal igst = _currentLines.Sum(x => x.IgstAmount);
                decimal cess = _currentLines.Sum(x => x.CessAmount);
                decimal gstTot = cgst + sgst + igst + cess;

                decimal.TryParse(txtFreight.Text, out decimal freight);
                decimal.TryParse(txtPacking.Text, out decimal packing);

                decimal rawBillAmount = Math.Max(0m, _currentLines.Sum(x => x.LineTotal) - cashDisc + freight + packing);
                decimal roundedBillAmount = Math.Round(rawBillAmount, 0, MidpointRounding.AwayFromZero);
                decimal roundOff = roundedBillAmount - rawBillAmount;

                decimal.TryParse(txtPrevBalance.Text, out decimal prevBalance);
                if (prevBalance < 0m) prevBalance = 0m;

                decimal.TryParse(txtAdjustCredit.Text, out decimal adjustCred);
                if (!chkAdjustCredit.Checked || adjustCred < 0m) adjustCred = 0m;

                // Total Amount = Bill Amount (e.g. 500) + Previous Balance (e.g. 500) - Adjusted Credit = 1000
                decimal netPayable = Math.Max(0m, roundedBillAmount + prevBalance - adjustCred);

                decimal.TryParse(txtReceived.Text, out decimal recAmt);
                if (recAmt == 0m && cmbPayMode.Text != "CREDIT (UDHAAR)")
                    recAmt = netPayable;

                return new InvoiceRecord
                {
                    InvoiceNo = txtInvNo.Text.Trim(),
                    Date = dtpDate.Value,
                    DocType = docType,
                    BillType = isGst ? "TAX INVOICE" : "BILL OF SUPPLY",
                    Profile = AppStore.Data.ActiveProfile,
                    FinancialYear = AppStore.Data.ActiveFinancialYear,
                    CustomerName = string.IsNullOrWhiteSpace(cmbParty.Text) ? "WALK-IN CUSTOMER" : cmbParty.Text.Trim(),
                    CustomerPhone = txtPhone.Text.Trim(),
                    CustomerGstin = txtGstin.Text.Trim(),
                    CustomerAddress = txtAddress.Text.Trim(),
                    PlaceOfSupply = cmbState.Text,
                    PaymentMode = cmbPayMode.Text,
                    PaymentReference = txtPayRef.Text.Trim(),
                    Salesperson = txtSalesperson.Text.Trim(),
                    Notes = txtNotes.Text.Trim(),
                    AuthorizedSignatureDataUrl = string.IsNullOrWhiteSpace(_currentBillAuthSignatureDataUrl)
                        ? prof.Company.SignatureDataUrl
                        : _currentBillAuthSignatureDataUrl,
                    CustomerSignatureDataUrl = _currentBillCustomerSignatureDataUrl,
                    SubTotal = sub,
                    DiscountTotal = totalDisc,
                    CashDiscount = cashDisc,
                    TaxableTotal = taxable,
                    CgstTotal = cgst,
                    SgstTotal = sgst,
                    IgstTotal = igst,
                    CessTotal = cess,
                    GstTotal = gstTot,
                    FreightCharges = freight,
                    PackingCharges = packing,
                    RoundOff = roundOff,
                    GrandTotal = roundedBillAmount,
                    PreviousBalance = prevBalance,
                    AdjustedCreditAmount = adjustCred,
                    NetPayableTotal = netPayable,
                    AmountReceived = recAmt,
                    BalanceDue = Math.Max(0m, netPayable - recAmt),
                    Lines = _currentLines.ToList()
                };
            }

            void RefreshGridAndTotals()
            {
                lineGrid.Rows.Clear();
                for (int i = 0; i < _currentLines.Count; i++)
                {
                    var ln = _currentLines[i];
                    ln.Sno = i + 1;
                    if (isGst)
                    {
                        lineGrid.Rows.Add(
                            ln.Sno, ln.ItemCode, ln.ItemName, ln.HsnCode, ln.Qty, ln.Uom,
                            ln.BasePrice.ToString("0.00"), ln.Rate.ToString("0.00"),
                            ln.DiscountPercent.ToString("0.#") + "%", ln.Discount2Percent.ToString("0.#") + "%",
                            ln.DiscountAmount.ToString("0.00"), ln.TaxableValue.ToString("0.00"),
                            ln.GstPercent.ToString("0.#") + "%", ln.CgstAmount.ToString("0.00"),
                            ln.SgstAmount.ToString("0.00"), ln.IgstAmount.ToString("0.00"),
                            ln.LineTotal.ToString("0.00"));
                    }
                    else
                    {
                        lineGrid.Rows.Add(
                            ln.Sno, ln.ItemCode, ln.ItemName, ln.HsnCode, ln.Qty, ln.Uom,
                            ln.Rate.ToString("0.00"),
                            ln.DiscountPercent.ToString("0.#") + "%", ln.Discount2Percent.ToString("0.#") + "%",
                            ln.DiscountAmount.ToString("0.00"), ln.TaxableValue.ToString("0.00"),
                            ln.LineTotal.ToString("0.00"));
                    }
                }

                var inv = BuildCurrentInvoiceObject();
                lblTaxBreakdown.Text =
                    $"Sub Total (Gross)  : Rs. {inv.SubTotal,10:N2}\n" +
                    $"Item+Bill Discount : Rs. {inv.DiscountTotal,10:N2} (Cash: {inv.CashDiscount:N2})\n" +
                    (isGst
                        ? $"Base Price Total   : Rs. {inv.TaxableTotal,10:N2}\nCGST: {inv.CgstTotal:N2} | SGST: {inv.SgstTotal:N2} | IGST: {inv.IgstTotal:N2}\n"
                        : $"Net Taxable Value  : Rs. {inv.TaxableTotal,10:N2} (Non-GST)\n") +
                    $"Bill Amount        : Rs. {inv.GrandTotal,10:N2}\n" +
                    $"Previous Balance   : +Rs.{inv.PreviousBalance,10:N2} | Adj Cred: -Rs.{inv.AdjustedCreditAmount:N2}\n" +
                    $"Total Payable Amt  : Rs. {inv.NetPayableTotal,10:N2}";

                lblGrandBanner.Text = inv.PreviousBalance > 0m || inv.AdjustedCreditAmount > 0m
                    ? $"BILL: Rs.{inv.GrandTotal:N0} | TOTAL: Rs. {inv.NetPayableTotal:N2}"
                    : $"TOTAL AMOUNT: Rs. {inv.NetPayableTotal:N2}";

                string upiPayload = BillingEngine.BuildUpiDeepLink(prof.Company, inv.NetPayableTotal, inv.InvoiceNo);
                picQr.Image?.Dispose();
                picQr.Image = BillingEngine.RenderQrBitmap(upiPayload, 140);
                lblQrCaption.Text = $"UPI: {prof.Company.UpiId}\nAmt: Rs. {inv.NetPayableTotal:N2}";

                PersistDraftNow();
            }

            // When Customer or Supplier is selected, auto-populate Phone, GSTIN, Address, Previous Balance, and Credit Adjustment
            void UpdatePartyDetailsFromSelection()
            {
                string partyText = (cmbParty.Text ?? "").Trim();
                if (string.IsNullOrEmpty(partyText)) return;

                if (docType.StartsWith("PURCHASE"))
                {
                    var sup = prof.Suppliers.FirstOrDefault(x => string.Equals(x.Name, partyText, StringComparison.OrdinalIgnoreCase));
                    if (sup != null)
                    {
                        txtPhone.Text = sup.Phone;
                        txtGstin.Text = sup.Gstin;
                        txtAddress.Text = sup.Address;
                        if (!string.IsNullOrWhiteSpace(sup.State)) cmbState.Text = sup.State;
                        decimal bal = sup.BalancePayable;
                        if (bal > 0m)
                        {
                            txtPrevBalance.Text = bal.ToString("0.00");
                            txtAdjustCredit.Text = "0.00";
                            chkAdjustCredit.Checked = false;
                        }
                        else if (bal < 0m)
                        {
                            txtPrevBalance.Text = "0.00";
                            txtAdjustCredit.Text = Math.Abs(bal).ToString("0.00");
                        }
                        RefreshGridAndTotals();
                    }
                }
                else
                {
                    var cust = prof.Customers.FirstOrDefault(x => string.Equals(x.Name, partyText, StringComparison.OrdinalIgnoreCase));
                    if (cust != null)
                    {
                        txtPhone.Text = cust.Phone;
                        txtGstin.Text = cust.Gstin;
                        txtAddress.Text = cust.Address;
                        if (!string.IsNullOrWhiteSpace(cust.State)) cmbState.Text = cust.State;
                        decimal due = cust.Outstanding;
                        if (due > 0m)
                        {
                            txtPrevBalance.Text = due.ToString("0.00");
                            txtAdjustCredit.Text = "0.00";
                            chkAdjustCredit.Checked = false;
                        }
                        else if (due < 0m)
                        {
                            txtPrevBalance.Text = "0.00";
                            txtAdjustCredit.Text = Math.Abs(due).ToString("0.00");
                        }
                        RefreshGridAndTotals();
                    }
                }
            }

            cmbParty.SelectedIndexChanged += (s, e) => UpdatePartyDetailsFromSelection();

            void AddLineFromInputs()
            {
                decimal.TryParse(txtQty.Text, out decimal qty);
                if (qty <= 0m) qty = 1m;
                decimal.TryParse(txtRate.Text, out decimal rate);
                decimal.TryParse(txtDisc.Text, out decimal discPct);
                decimal.TryParse(txtDisc2.Text, out decimal disc2Pct);
                decimal gstPct = 0m;
                decimal basePriceVal = 0m;
                if (isGst && txtGstPct != null) decimal.TryParse(txtGstPct.Text, out gstPct);
                if (isGst && txtBasePrice != null) decimal.TryParse(txtBasePrice.Text, out basePriceVal);
                string unitVal = string.IsNullOrWhiteSpace(cmbUnit.Text) ? "PCS" : cmbUnit.Text.Trim().ToUpperInvariant();

                ItemRecord matched = selectedItemRecord;
                if (matched == null && !string.IsNullOrWhiteSpace(txtBarcode.Text))
                {
                    string b = txtBarcode.Text.Trim();
                    matched = prof.Items.FirstOrDefault(x =>
                        string.Equals(x.Barcode, b, StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(x.Code, b, StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(x.Name, b, StringComparison.OrdinalIgnoreCase));
                }
                if (matched == null && cmbItem.SelectedIndex >= 0 && cmbItem.SelectedIndex < prof.Items.Count)
                {
                    matched = prof.Items[cmbItem.SelectedIndex];
                }
                if (matched == null && !string.IsNullOrWhiteSpace(cmbItem.Text))
                {
                    string rawText = cmbItem.Text.Trim();
                    matched = prof.Items.FirstOrDefault(x =>
                        string.Equals(x.Name, rawText, StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(x.Code, rawText, StringComparison.OrdinalIgnoreCase) ||
                        rawText.StartsWith(x.Name + " [", StringComparison.OrdinalIgnoreCase));

                    if (matched == null && matchedSuggestionItems.Count == 1)
                    {
                        matched = matchedSuggestionItems[0];
                    }

                    // If user typed a brand-new item name directly into cmbItem, auto-create it in Item Master!
                    if (matched == null)
                    {
                        string newCode = !string.IsNullOrWhiteSpace(txtBarcode.Text)
                            ? txtBarcode.Text.Trim().ToUpperInvariant()
                            : $"SKU-{prof.Items.Count + 1001}";
                        matched = new ItemRecord
                        {
                            Id = "ITM" + (prof.Items.Count + 1).ToString("D3"),
                            Code = newCode,
                            Barcode = !string.IsNullOrWhiteSpace(txtBarcode.Text) ? txtBarcode.Text.Trim() : newCode,
                            Name = rawText,
                            Category = "General",
                            HsnCode = "4820",
                            Uom = unitVal,
                            CostPrice = docType.StartsWith("PURCHASE") ? rate : Math.Round(rate * 0.8m, 2),
                            BasePrice = isGst ? basePriceVal : 0m,
                            Price = rate,
                            Mrp = rate,
                            DefaultDiscountPct = discPct,
                            GstPercent = isGst ? gstPct : 0m,
                            Stock = 0m,
                            ReorderLevel = 5m
                        };
                        prof.Items.Add(matched);
                        AppStore.SaveAtomic();
                    }
                }
                if (matched == null && !string.IsNullOrWhiteSpace(txtBarcode.Text))
                {
                    string newCode = txtBarcode.Text.Trim().ToUpperInvariant();
                    matched = new ItemRecord
                    {
                        Id = "ITM" + (prof.Items.Count + 1).ToString("D3"),
                        Code = newCode,
                        Barcode = newCode,
                        Name = newCode,
                        Category = "General",
                        HsnCode = "4820",
                        Uom = unitVal,
                        CostPrice = docType.StartsWith("PURCHASE") ? rate : Math.Round(rate * 0.8m, 2),
                        BasePrice = isGst ? basePriceVal : 0m,
                        Price = rate,
                        Mrp = rate,
                        DefaultDiscountPct = discPct,
                        GstPercent = isGst ? gstPct : 0m,
                        Stock = 0m,
                        ReorderLevel = 5m
                    };
                    prof.Items.Add(matched);
                    AppStore.SaveAtomic();
                }

                if (matched == null)
                {
                    MessageBox.Show(this,
                        "Please type or select an item name (e.g. type 'dom' to see matching items), scan a barcode, or click '+ SKU'.",
                        "Item Required",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Warning);
                    cmbItem.Focus();
                    return;
                }

                if (rate <= 0m)
                    rate = docType.StartsWith("PURCHASE") ? matched.CostPrice : matched.Price;

                if (isGst && gstPct >= 0m) matched.GstPercent = gstPct;
                if (isGst && basePriceVal > 0m) matched.BasePrice = basePriceVal;

                bool isInterState = !string.IsNullOrWhiteSpace(prof.Company.StateCode) &&
                                    !cmbState.Text.StartsWith(prof.Company.StateCode);
                var line = AppStore.CalculateLineItem(
                    matched,
                    qty,
                    0m,
                    rate,
                    discPct,
                    isGst,
                    isInterState,
                    txtSalesperson.Text.Trim(),
                    disc2Pct,
                    basePriceVal,
                    isGst ? gstPct : 0m,
                    unitVal);
                _currentLines.Add(line);

                // Clear item input after adding so next item can be typed immediately
                lstItemSuggestions.Visible = false;
                selectedItemRecord = null;
                suppressItemTextEvents = true;
                cmbItem.SelectedIndex = -1;
                cmbItem.Text = "";
                suppressItemTextEvents = false;
                txtBarcode.Clear();
                txtStockQty.Text = "0";
                txtQty.Text = "1";
                txtRate.Text = "0";
                txtDisc.Text = "0";
                txtDisc2.Text = "0";
                if (txtBasePrice != null) txtBasePrice.Text = "0.00";

                RefreshGridAndTotals();
                cmbItem.Focus();
            }

            btnAddLine.Click += (s, e) => AddLineFromInputs();

            cmbItem.KeyDown += (s, e) =>
            {
                if (e.KeyCode == Keys.Down && lstItemSuggestions.Visible && lstItemSuggestions.Items.Count > 0)
                {
                    e.Handled = true;
                    lstItemSuggestions.Focus();
                    lstItemSuggestions.SelectedIndex = 0;
                }
                else if (e.KeyCode == Keys.Enter)
                {
                    e.SuppressKeyPress = true;
                    if (lstItemSuggestions.Visible && lstItemSuggestions.SelectedIndex >= 0 && lstItemSuggestions.SelectedIndex < matchedSuggestionItems.Count)
                    {
                        ApplySelectedItemToInputs(matchedSuggestionItems[lstItemSuggestions.SelectedIndex]);
                        txtQty.Focus();
                        txtQty.SelectAll();
                    }
                    else if (lstItemSuggestions.Visible && matchedSuggestionItems.Count > 0 && selectedItemRecord == null)
                    {
                        ApplySelectedItemToInputs(matchedSuggestionItems[0]);
                        txtQty.Focus();
                        txtQty.SelectAll();
                    }
                    else
                    {
                        AddLineFromInputs();
                    }
                }
                else if (e.KeyCode == Keys.Escape && lstItemSuggestions.Visible)
                {
                    lstItemSuggestions.Visible = false;
                }
            };

            void BindEnterToAddLine(Control ctrl)
            {
                if (ctrl == null) return;
                ctrl.KeyDown += (s, e) =>
                {
                    if (e.KeyCode == Keys.Enter)
                    {
                        e.SuppressKeyPress = true;
                        AddLineFromInputs();
                    }
                };
            }
            BindEnterToAddLine(txtBarcode);
            BindEnterToAddLine(txtBasePrice);
            BindEnterToAddLine(txtQty);
            BindEnterToAddLine(txtRate);
            BindEnterToAddLine(txtGstPct);
            BindEnterToAddLine(txtDisc);
            BindEnterToAddLine(txtDisc2);
            BindEnterToAddLine(cmbUnit);

            btnNewSku.Click += (s, e) =>
            {
                using var dlg = new Form
                {
                    Text = "Quick Add New Item / SKU to Item Master",
                    Size = new Size(460, 420),
                    StartPosition = FormStartPosition.CenterParent,
                    FormBorderStyle = FormBorderStyle.FixedDialog,
                    MaximizeBox = false,
                    MinimizeBox = false,
                    BackColor = Color.White
                };
                var qCode = AddLabeledBox(dlg, "SKU Code:", $"SKU-{prof.Items.Count + 1001}", 20, 16, 190);
                var qBarcode = AddLabeledBox(dlg, "Barcode:", $"{8901000000000L + prof.Items.Count + 1}", 230, 16, 190);
                var qName = AddLabeledBox(dlg, "Item / Product Name:", "", 20, 72, 400);
                var qHsn = AddLabeledBox(dlg, "HSN Code:", "4820", 20, 128, 125);
                var qUom = AddLabeledBox(dlg, "UOM (PCS/BOX/PKT):", "PCS", 160, 128, 125);
                var qGst = AddLabeledBox(dlg, "GST %:", isGst ? "18" : "0", 300, 128, 120);
                var qCost = AddLabeledBox(dlg, "Purchase Cost (Rs.):", "0.00", 20, 184, 125);
                var qSale = AddLabeledBox(dlg, "Sale Price (Rs.):", "0.00", 160, 184, 125);
                var qMrp = AddLabeledBox(dlg, "MRP (Rs.):", "0.00", 300, 184, 120);
                var qStock = AddLabeledBox(dlg, "Opening Stock:", "0", 20, 240, 190);

                var btnSaveQuick = CreateActionButton("Save SKU & Select", Color.FromArgb(22, 163, 74), 210);
                btnSaveQuick.Location = new Point(20, 315);
                btnSaveQuick.Height = 38;
                ItemRecord newlyCreated = null;
                btnSaveQuick.Click += (s2, e2) =>
                {
                    if (string.IsNullOrWhiteSpace(qName.Text))
                    {
                        MessageBox.Show(dlg, "Please enter an Item / Product Name.", "Validation", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                        return;
                    }
                    decimal.TryParse(qCost.Text, out decimal cPrice);
                    decimal.TryParse(qSale.Text, out decimal sPrice);
                    decimal.TryParse(qMrp.Text, out decimal mPrice);
                    decimal.TryParse(qGst.Text, out decimal gPct);
                    decimal.TryParse(qStock.Text, out decimal stk);
                    if (mPrice <= 0m) mPrice = sPrice;

                    newlyCreated = new ItemRecord
                    {
                        Id = "ITM" + (prof.Items.Count + 1).ToString("D3"),
                        Code = string.IsNullOrWhiteSpace(qCode.Text) ? $"SKU-{prof.Items.Count + 1001}" : qCode.Text.Trim(),
                        Barcode = qBarcode.Text.Trim(),
                        Name = qName.Text.Trim(),
                        Category = "General",
                        HsnCode = qHsn.Text.Trim(),
                        Uom = string.IsNullOrWhiteSpace(qUom.Text) ? "PCS" : qUom.Text.Trim().ToUpperInvariant(),
                        CostPrice = cPrice,
                        BasePrice = isGst ? Math.Round(sPrice - (sPrice * gPct / 100m), 2, MidpointRounding.AwayFromZero) : 0m,
                        Price = sPrice,
                        Mrp = mPrice,
                        GstPercent = gPct,
                        Stock = stk,
                        ReorderLevel = 5m
                    };
                    prof.Items.Add(newlyCreated);
                    AppStore.SaveAtomic();
                    ReloadItemCombo(newlyCreated);
                    dlg.DialogResult = DialogResult.OK;
                    dlg.Close();
                };
                dlg.Controls.Add(btnSaveQuick);
                dlg.ShowDialog(this);
            };

            btnCameraScan.Click += (s, e) =>
            {
                ShowCameraBarcodeScannerDialog(prof, code =>
                {
                    txtBarcode.Text = code;
                    AddLineFromInputs();
                });
            };

            btnRemoveLine.Click += (s, e) =>
            {
                if (lineGrid.SelectedRows.Count > 0)
                {
                    int idx = lineGrid.SelectedRows[0].Index;
                    if (idx >= 0 && idx < _currentLines.Count)
                    {
                        _currentLines.RemoveAt(idx);
                        RefreshGridAndTotals();
                    }
                }
                else if (_currentLines.Count > 0)
                {
                    _currentLines.RemoveAt(_currentLines.Count - 1);
                    RefreshGridAndTotals();
                }
            };

            // Bind customer & bill-level discount/previous balance/credit adjustment inputs
            cmbParty.TextChanged += (s, e) => UpdatePartyDetailsFromSelection();
            txtPhone.TextChanged += (s, e) => PersistDraftNow();
            txtGstin.TextChanged += (s, e) => PersistDraftNow();
            txtAddress.TextChanged += (s, e) => PersistDraftNow();
            cmbState.SelectedIndexChanged += (s, e) => RefreshGridAndTotals();
            cmbPayMode.SelectedIndexChanged += (s, e) => RefreshGridAndTotals();
            txtPayRef.TextChanged += (s, e) => PersistDraftNow();
            txtSalesperson.TextChanged += (s, e) => PersistDraftNow();
            txtNotes.TextChanged += (s, e) => PersistDraftNow();
            txtBillDiscount.TextChanged += (s, e) => RefreshGridAndTotals();
            txtPrevBalance.TextChanged += (s, e) => RefreshGridAndTotals();
            chkAdjustCredit.CheckedChanged += (s, e) => RefreshGridAndTotals();
            txtAdjustCredit.TextChanged += (s, e) => RefreshGridAndTotals();
            txtFreight.TextChanged += (s, e) => RefreshGridAndTotals();
            txtPacking.TextChanged += (s, e) => RefreshGridAndTotals();
            txtReceived.TextChanged += (s, e) => RefreshGridAndTotals();

            btnSaveAndPrint.Click += (s, e) =>
            {
                if (!EnforceDeviceActiveGuard()) return;
                if (_currentLines.Count == 0)
                {
                    MessageBox.Show(this, "Cannot save an empty bill. Please add at least one line item.", "Validation", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    return;
                }
                var inv = BuildCurrentInvoiceObject();
                AppStore.SaveInvoiceWithStockAndLedgerUpdate(inv);
                AppStore.ClearDraftBill(docType);
                MessageBox.Show(this,
                    $"{inv.DocType} '{inv.InvoiceNo}' saved!\nBill Amount: Rs. {inv.GrandTotal:N2}\nPrevious Balance: Rs. {inv.PreviousBalance:N2}\nAdjusted Credit: Rs. {inv.AdjustedCreditAmount:N2}\nTotal Payable: Rs. {inv.NetPayableTotal:N2}",
                    "Saved Successfully",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);

                BillingEngine.ShowInvoicePrintPreview(this, inv, prof.Company, "A4");
                _currentLines.Clear();
                txtInvNo.Text = AppStore.GetNextDocumentNumber(docType);
                cmbParty.SelectedIndex = -1;
                cmbParty.Text = "";
                txtPhone.Clear();
                txtGstin.Clear();
                txtAddress.Clear();
                txtBillDiscount.Text = "0.00";
                txtPrevBalance.Text = "0.00";
                txtAdjustCredit.Text = "0.00";
                chkAdjustCredit.Checked = false;
                txtReceived.Text = "0.00";
                RefreshGridAndTotals();
            };

            btnPreviewA4.Click += (s, e) =>
            {
                var inv = BuildCurrentInvoiceObject();
                BillingEngine.ShowInvoicePrintPreview(this, inv, prof.Company, "A4");
            };

            btnPreviewA5.Click += (s, e) =>
            {
                var inv = BuildCurrentInvoiceObject();
                BillingEngine.ShowInvoicePrintPreview(this, inv, prof.Company, "A5");
            };

            btnThermal.Click += (s, e) =>
            {
                var inv = BuildCurrentInvoiceObject();
                BillingEngine.ShowInvoicePrintPreview(this, inv, prof.Company, "THERMAL");
            };

            btnExportPdf.Click += (s, e) =>
            {
                var inv = BuildCurrentInvoiceObject();
                using var sfd = new SaveFileDialog
                {
                    FileName = $"{inv.InvoiceNo}.pdf",
                    Filter = "PDF Document (*.pdf)|*.pdf"
                };
                if (sfd.ShowDialog(this) == DialogResult.OK)
                {
                    byte[] pdfBytes = BillingEngine.GenerateInvoicePdfBytes(inv, prof.Company, "A4");
                    File.WriteAllBytes(sfd.FileName, pdfBytes);
                    MessageBox.Show(this, "PDF Invoice saved to:\n" + sfd.FileName, "PDF Export Complete", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
            };

            btnShowUpiModal.Click += (s, e) =>
            {
                var inv = BuildCurrentInvoiceObject();
                ShowLargeUpiPopup(inv, prof.Company);
            };

            btnClearBill.Click += (s, e) =>
            {
                _currentLines.Clear();
                AppStore.ClearDraftBill(docType);
                cmbParty.SelectedIndex = -1;
                cmbParty.Text = "";
                txtPhone.Clear();
                txtGstin.Clear();
                txtAddress.Clear();
                txtBillDiscount.Text = "0.00";
                txtPrevBalance.Text = "0.00";
                txtAdjustCredit.Text = "0.00";
                chkAdjustCredit.Checked = false;
                txtReceived.Text = "0.00";
                RefreshGridAndTotals();
            };

            RefreshGridAndTotals();
            _contentPanel.Controls.Add(lstItemSuggestions);
            _contentPanel.Controls.Add(mainLayout);
            lstItemSuggestions.BringToFront();
        }

        private void ShowCameraBarcodeScannerDialog(ProfileData prof, Action<string> onBarcodeScanned)
        {
            using var dlg = new Form
            {
                Text = "Camera Barcode Scanner (Continuous Scan Mode)",
                Size = new Size(560, 440),
                StartPosition = FormStartPosition.CenterParent,
                FormBorderStyle = FormBorderStyle.FixedDialog,
                MaximizeBox = false,
                MinimizeBox = false,
                BackColor = Color.FromArgb(15, 23, 42)
            };

            var chkContinuous = new CheckBox
            {
                Text = "Continuous Scan Mode (Keep scanner open after adding each item)",
                Checked = true,
                ForeColor = Color.FromArgb(74, 222, 128),
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                Location = new Point(20, 14),
                AutoSize = true
            };

            var camBox = new Panel
            {
                Location = new Point(20, 44),
                Size = new Size(504, 210),
                BackColor = Color.Black,
                BorderStyle = BorderStyle.FixedSingle
            };
            camBox.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                using var pen = new Pen(Color.FromArgb(34, 197, 94), 2f);
                e.Graphics.DrawRectangle(pen, 80, 35, 344, 140);
                using var laserPen = new Pen(Color.FromArgb(239, 68, 68), 2f);
                e.Graphics.DrawLine(laserPen, 90, 105, 414, 105);
                using var f = new Font("Segoe UI", 10f, FontStyle.Bold);
                e.Graphics.DrawString("HD CAMERA STREAM ACTIVE — ALIGN BARCODE WITHIN FRAME", f, Brushes.LightGreen, 52, 180);
            };

            var lblPick = new Label
            {
                Text = "Select / Trigger Barcode from Camera Feed or USB Wedge:",
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                Location = new Point(20, 266),
                AutoSize = true
            };

            var cmbQuickScan = new ComboBox
            {
                Location = new Point(20, 290),
                Width = 360,
                DropDownStyle = ComboBoxStyle.DropDownList,
                Font = new Font("Segoe UI", 10f)
            };
            foreach (var it in prof.Items)
            {
                cmbQuickScan.Items.Add($"{it.Barcode} | {it.Code} — {it.Name}");
            }
            if (cmbQuickScan.Items.Count > 0) cmbQuickScan.SelectedIndex = 0;

            var lblStatus = new Label
            {
                Text = "Ready to scan...",
                ForeColor = Color.FromArgb(125, 211, 252),
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                Location = new Point(20, 330),
                Size = new Size(500, 24)
            };

            var btnScanNow = CreateActionButton("Scan & Add Item", Color.FromArgb(22, 163, 74), 134);
            btnScanNow.Location = new Point(390, 288);
            btnScanNow.Height = 30;
            btnScanNow.Click += (s, e) =>
            {
                if (cmbQuickScan.SelectedIndex >= 0 && cmbQuickScan.SelectedIndex < prof.Items.Count)
                {
                    var item = prof.Items[cmbQuickScan.SelectedIndex];
                    string code = !string.IsNullOrWhiteSpace(item.Barcode) ? item.Barcode : item.Code;
                    onBarcodeScanned?.Invoke(code);
                    lblStatus.Text = $"Scanned & Added: {item.Name} (Rs. {item.Price:N2})";
                    if (!chkContinuous.Checked)
                        dlg.Close();
                }
            };

            var btnDone = CreateActionButton("Done", Color.FromArgb(71, 85, 105), 110);
            btnDone.Location = new Point(414, 356);
            btnDone.Click += (s, e) => dlg.Close();

            dlg.Controls.AddRange(new Control[] { chkContinuous, camBox, lblPick, cmbQuickScan, btnScanNow, lblStatus, btnDone });
            dlg.ShowDialog(this);
        }

        private void ShowLargeUpiPopup(InvoiceRecord inv, CompanyInfo comp)
        {
            using var dlg = new Form
            {
                Text = $"UPI QR Payment — {inv.InvoiceNo}",
                Size = new Size(420, 500),
                StartPosition = FormStartPosition.CenterParent,
                FormBorderStyle = FormBorderStyle.FixedDialog,
                MaximizeBox = false,
                MinimizeBox = false,
                BackColor = Color.White
            };

            string link = BillingEngine.BuildUpiDeepLink(comp, inv.GrandTotal, inv.InvoiceNo);
            var pic = new PictureBox
            {
                Location = new Point(70, 20),
                Size = new Size(260, 260),
                SizeMode = PictureBoxSizeMode.Zoom,
                Image = BillingEngine.RenderQrBitmap(link, 260)
            };

            var lblInfo = new Label
            {
                Location = new Point(20, 295),
                Size = new Size(365, 110),
                TextAlign = ContentAlignment.TopCenter,
                Font = new Font("Segoe UI", 10.5f, FontStyle.Bold),
                Text = $"{comp.Name}\nUPI ID: {comp.UpiId}\nInvoice: {inv.InvoiceNo}\nAmount Payable: Rs. {inv.GrandTotal:N2}"
            };

            var btnClose = CreateActionButton("Done", Color.FromArgb(22, 163, 74), 140);
            btnClose.Location = new Point(130, 410);
            btnClose.Click += (s, e) => dlg.Close();

            dlg.Controls.AddRange(new Control[] { pic, lblInfo, btnClose });
            dlg.ShowDialog(this);
        }

        // ====================================================================
        // 3. MASTERS VIEWS (COMPANY, CUSTOMER, SUPPLIER, ITEM, HSN, BANK)
        // ====================================================================
        private void ShowCompanyMasterView()
        {
            _contentPanel.Controls.Clear();
            var comp = AppStore.CurrentProfile.Company;

            var card = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(18) };
            var lblTitle = new Label
            {
                Text = $"COMPANY MASTER CONFIGURATION ({AppStore.Data.ActiveProfile} PROFILE)",
                Font = new Font("Segoe UI", 13f, FontStyle.Bold),
                ForeColor = Color.FromArgb(15, 23, 42),
                Dock = DockStyle.Top,
                Height = 36
            };

            var tabs = new TabControl { Dock = DockStyle.Fill, Font = new Font("Segoe UI", 9.5f, FontStyle.Bold) };
            var tabIdentity = new TabPage("1. Identity, Tax & Shop Logo") { BackColor = Color.White, Padding = new Padding(16) };
            var tabContact = new TabPage("2. Contact & Address") { BackColor = Color.White, Padding = new Padding(16) };
            var tabInvoice = new TabPage("3. Invoice & Terms") { BackColor = Color.White, Padding = new Padding(16) };
            var tabBank = new TabPage("4. Banking, UPI, Logo & Signature") { BackColor = Color.White, Padding = new Padding(16) };

            // Tab 1: Identity & Shop Logo Upload
            var tName = AddLabeledBox(tabIdentity, "Company / Shop Name:", comp.Name, 20, 20, 360);
            var tTagline = AddLabeledBox(tabIdentity, "Tagline / Subtitle:", comp.Tagline, 400, 20, 360);
            var tGstin = AddLabeledBox(tabIdentity, "GSTIN Number:", comp.Gstin, 20, 80, 230);
            var tPan = AddLabeledBox(tabIdentity, "PAN Number:", comp.Pan, 270, 80, 230);
            var tCin = AddLabeledBox(tabIdentity, "CIN / Reg No:", comp.Cin, 520, 80, 240);

            // Shop Logo Upload & Preview Card on Tab 1
            var logoCardTab1 = new Panel
            {
                Location = new Point(20, 145),
                Size = new Size(740, 155),
                BackColor = Color.FromArgb(248, 250, 252),
                BorderStyle = BorderStyle.FixedSingle
            };
            var lblLogoHeader1 = new Label
            {
                Text = "Shop / Company Logo (Printed on Bill Performa, A4, A5 & Thermal Invoices):",
                Location = new Point(12, 10),
                AutoSize = true,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(15, 23, 42)
            };
            var picLogoPreview1 = new PictureBox
            {
                Location = new Point(12, 36),
                Size = new Size(200, 104),
                BackColor = Color.White,
                BorderStyle = BorderStyle.FixedSingle,
                SizeMode = PictureBoxSizeMode.Zoom
            };

            // Also keep a second preview box on Tab 4 so both stay synced
            var picLogoPreview4 = new PictureBox
            {
                Location = new Point(12, 36),
                Size = new Size(180, 96),
                BackColor = Color.White,
                BorderStyle = BorderStyle.FixedSingle,
                SizeMode = PictureBoxSizeMode.Zoom
            };

            void ReloadCompanyLogoPreview()
            {
                picLogoPreview1.Image?.Dispose();
                picLogoPreview1.Image = BillingEngine.TryDecodeImageFromDataUrlOrPath(comp.LogoDataUrl);
                picLogoPreview4.Image?.Dispose();
                picLogoPreview4.Image = BillingEngine.TryDecodeImageFromDataUrlOrPath(comp.LogoDataUrl);
            }

            void PromptUploadShopLogo()
            {
                using var ofd = new OpenFileDialog
                {
                    Title = "Select Shop / Company Logo Image",
                    Filter = "Image Files (*.png;*.jpg;*.jpeg;*.bmp)|*.png;*.jpg;*.jpeg;*.bmp"
                };
                if (ofd.ShowDialog(this) == DialogResult.OK)
                {
                    byte[] bytes = File.ReadAllBytes(ofd.FileName);
                    string ext = Path.GetExtension(ofd.FileName).TrimStart('.').ToLowerInvariant();
                    if (ext == "jpg") ext = "jpeg";
                    comp.LogoDataUrl = $"data:image/{ext};base64," + Convert.ToBase64String(bytes);
                    AppStore.SaveAtomic();
                    ReloadCompanyLogoPreview();
                }
            }

            void ClearShopLogo()
            {
                comp.LogoDataUrl = "";
                AppStore.SaveAtomic();
                ReloadCompanyLogoPreview();
            }

            var btnUploadLogo1 = CreateActionButton("Upload Shop Logo...", Color.FromArgb(13, 148, 136), 210);
            btnUploadLogo1.Location = new Point(230, 42);
            btnUploadLogo1.Height = 36;
            btnUploadLogo1.Click += (s, e) => PromptUploadShopLogo();

            var btnClearLogo1 = CreateActionButton("Remove Shop Logo", Color.FromArgb(220, 38, 38), 170);
            btnClearLogo1.Location = new Point(230, 88);
            btnClearLogo1.Height = 34;
            btnClearLogo1.Click += (s, e) => ClearShopLogo();

            logoCardTab1.Controls.AddRange(new Control[] { lblLogoHeader1, picLogoPreview1, btnUploadLogo1, btnClearLogo1 });
            tabIdentity.Controls.Add(logoCardTab1);

            // Tab 2: Contact & Address
            var tPhone = AddLabeledBox(tabContact, "Primary Phone:", comp.Phone, 20, 20, 230);
            var tAltPhone = AddLabeledBox(tabContact, "Alternate Phone:", comp.AltPhone, 270, 20, 230);
            var tEmail = AddLabeledBox(tabContact, "Email Address:", comp.Email, 520, 20, 240);
            var tAddr = AddLabeledBox(tabContact, "Street Address:", comp.Address, 20, 80, 480);
            var tCity = AddLabeledBox(tabContact, "City:", comp.City, 520, 80, 240);
            var tState = AddLabeledBox(tabContact, "State Name:", comp.State, 20, 140, 230);
            var tStateCode = AddLabeledBox(tabContact, "State Code (2-digit):", comp.StateCode, 270, 140, 160);
            var tPin = AddLabeledBox(tabContact, "Pincode:", comp.Pincode, 450, 140, 160);

            // Tab 3: Invoice & Terms
            var tPrefix = AddLabeledBox(tabInvoice, "Invoice Prefix:", comp.InvoicePrefix, 20, 20, 180);
            var tStartNo = AddLabeledBox(tabInvoice, "Starting Invoice Serial:", comp.InvoiceStartNo.ToString(), 220, 20, 180);
            var tSign = AddLabeledBox(tabInvoice, "Authorized Signatory Title:", comp.AuthSignatory, 420, 20, 280);
            var tFooter = AddLabeledBox(tabInvoice, "Receipt Footer Message:", comp.FooterNote, 20, 80, 680);
            var tTerms = AddLabeledBox(tabInvoice, "Terms & Conditions:", comp.Terms, 20, 140, 680);

            // Tab 4: Banking, UPI, Shop Logo & Responsive Signature Preview
            var tUpiId = AddLabeledBox(tabBank, "Merchant UPI ID (for Live QR):", comp.UpiId, 20, 20, 300);
            var tUpiName = AddLabeledBox(tabBank, "UPI Payee Display Name:", comp.UpiPayeeName, 340, 20, 300);
            var tBankName = AddLabeledBox(tabBank, "Bank Name:", comp.BankName, 20, 80, 300);
            var tBranch = AddLabeledBox(tabBank, "Branch Name:", comp.BankBranch, 340, 80, 300);
            var tAccNo = AddLabeledBox(tabBank, "Bank Account Number:", comp.BankAccountNo, 20, 140, 300);
            var tIfsc = AddLabeledBox(tabBank, "IFSC Code:", comp.BankIfsc, 340, 140, 300);

            // Shop Logo Card on Tab 4
            var logoCardTab4 = new Panel
            {
                Location = new Point(20, 200),
                Size = new Size(410, 150),
                BackColor = Color.FromArgb(248, 250, 252),
                BorderStyle = BorderStyle.FixedSingle
            };
            var lblLogoHeader4 = new Label
            {
                Text = "Shop Logo (Printed on Bill Header):",
                Location = new Point(12, 10),
                AutoSize = true,
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                ForeColor = Color.FromArgb(15, 23, 42)
            };
            var btnUploadLogo4 = CreateActionButton("Upload Shop Logo...", Color.FromArgb(13, 148, 136), 190);
            btnUploadLogo4.Location = new Point(204, 42);
            btnUploadLogo4.Click += (s, e) => PromptUploadShopLogo();

            var btnClearLogo4 = CreateActionButton("Remove Logo", Color.FromArgb(220, 38, 38), 150);
            btnClearLogo4.Location = new Point(204, 88);
            btnClearLogo4.Click += (s, e) => ClearShopLogo();

            logoCardTab4.Controls.AddRange(new Control[] { lblLogoHeader4, picLogoPreview4, btnUploadLogo4, btnClearLogo4 });
            tabBank.Controls.Add(logoCardTab4);

            // Responsive Aspect-Ratio-Preserving Signature Upload & Preview Component
            var sigCard = new Panel
            {
                Location = new Point(445, 200),
                Size = new Size(460, 150),
                BackColor = Color.FromArgb(248, 250, 252),
                BorderStyle = BorderStyle.FixedSingle
            };
            var lblSigHeader = new Label
            {
                Text = "Authorized Signature (Printed on Bill Footer):",
                Location = new Point(12, 10),
                AutoSize = true,
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                ForeColor = Color.FromArgb(15, 23, 42)
            };
            var picSigPreview = new PictureBox
            {
                Location = new Point(12, 36),
                Size = new Size(210, 96),
                BackColor = Color.White,
                BorderStyle = BorderStyle.FixedSingle,
                SizeMode = PictureBoxSizeMode.Zoom // Preserves aspect ratio
            };
            void ReloadCompanySigPreview()
            {
                picSigPreview.Image?.Dispose();
                picSigPreview.Image = BillingEngine.TryDecodeImageFromDataUrlOrPath(comp.SignatureDataUrl);
            }
            ReloadCompanyLogoPreview();
            ReloadCompanySigPreview();

            var btnUploadSig = CreateActionButton("Upload Signature...", Color.FromArgb(37, 99, 235), 210);
            btnUploadSig.Location = new Point(234, 42);
            btnUploadSig.Click += (s, e) =>
            {
                using var ofd = new OpenFileDialog
                {
                    Title = "Select Authorized Signature Image",
                    Filter = "Image Files (*.png;*.jpg;*.jpeg;*.bmp)|*.png;*.jpg;*.jpeg;*.bmp"
                };
                if (ofd.ShowDialog(this) == DialogResult.OK)
                {
                    byte[] bytes = File.ReadAllBytes(ofd.FileName);
                    string ext = Path.GetExtension(ofd.FileName).TrimStart('.').ToLowerInvariant();
                    if (ext == "jpg") ext = "jpeg";
                    comp.SignatureDataUrl = $"data:image/{ext};base64," + Convert.ToBase64String(bytes);
                    AppStore.SaveAtomic();
                    ReloadCompanySigPreview();
                }
            };

            var btnClearSig = CreateActionButton("Remove Signature", Color.FromArgb(220, 38, 38), 160);
            btnClearSig.Location = new Point(234, 88);
            btnClearSig.Click += (s, e) =>
            {
                comp.SignatureDataUrl = "";
                AppStore.SaveAtomic();
                ReloadCompanySigPreview();
            };

            sigCard.Controls.AddRange(new Control[] { lblSigHeader, picSigPreview, btnUploadSig, btnClearSig });
            tabBank.Controls.Add(sigCard);

            tabs.TabPages.AddRange(new[] { tabIdentity, tabContact, tabInvoice, tabBank });

            var bottomBar = new Panel { Dock = DockStyle.Bottom, Height = 54, BackColor = Color.White };
            var btnSave = CreateActionButton("Save Company Master Settings", Color.FromArgb(22, 163, 74), 250);
            btnSave.Location = new Point(16, 8);
            btnSave.Height = 38;
            btnSave.Click += (s, e) =>
            {
                comp.Name = tName.Text.Trim();
                comp.Tagline = tTagline.Text.Trim();
                comp.Gstin = tGstin.Text.Trim();
                comp.Pan = tPan.Text.Trim();
                comp.Cin = tCin.Text.Trim();
                comp.Phone = tPhone.Text.Trim();
                comp.AltPhone = tAltPhone.Text.Trim();
                comp.Email = tEmail.Text.Trim();
                comp.Address = tAddr.Text.Trim();
                comp.City = tCity.Text.Trim();
                comp.State = tState.Text.Trim();
                comp.StateCode = tStateCode.Text.Trim();
                comp.Pincode = tPin.Text.Trim();
                comp.InvoicePrefix = tPrefix.Text.Trim();
                if (int.TryParse(tStartNo.Text, out int stNo)) comp.InvoiceStartNo = stNo;
                comp.AuthSignatory = tSign.Text.Trim();
                comp.FooterNote = tFooter.Text.Trim();
                comp.Terms = tTerms.Text.Trim();
                comp.UpiId = tUpiId.Text.Trim();
                comp.UpiPayeeName = tUpiName.Text.Trim();
                comp.BankName = tBankName.Text.Trim();
                comp.BankBranch = tBranch.Text.Trim();
                comp.BankAccountNo = tAccNo.Text.Trim();
                comp.BankIfsc = tIfsc.Text.Trim();

                AppStore.SaveAtomic();
                RefreshStatusAndHeader();
                MessageBox.Show(this, "Company Master, Shop Logo & Signature saved for " + AppStore.Data.ActiveProfile + " profile.", "Saved", MessageBoxButtons.OK, MessageBoxIcon.Information);
            };
            bottomBar.Controls.Add(btnSave);

            card.Controls.Add(tabs);
            card.Controls.Add(bottomBar);
            card.Controls.Add(lblTitle);
            _contentPanel.Controls.Add(card);
        }

        private void ShowCustomerMasterView()
        {
            _contentPanel.Controls.Clear();
            var prof = AppStore.CurrentProfile;

            var split = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 2 };
            split.RowStyles.Add(new RowStyle(SizeType.Absolute, 145f));
            split.RowStyles.Add(new RowStyle(SizeType.Percent, 100f));

            var formCard = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(12), Margin = new Padding(0, 0, 0, 8) };
            formCard.Controls.Add(new Label { Text = "CUSTOMER MASTER & WHATSAPP / SMS PAYMENT REMINDERS", Font = new Font("Segoe UI", 11f, FontStyle.Bold), Location = new Point(12, 6), AutoSize = true });

            var tName = AddLabeledBox(formCard, "Customer Name:", "", 12, 34, 210);
            var tPhone = AddLabeledBox(formCard, "Mobile / WhatsApp:", "", 232, 34, 140);
            var tEmail = AddLabeledBox(formCard, "Email:", "", 382, 34, 170);
            var tGstin = AddLabeledBox(formCard, "GSTIN:", "", 562, 34, 150);
            var tState = AddLabeledBox(formCard, "State:", "09-Uttar Pradesh", 722, 34, 150);
            var tOpenBal = AddLabeledBox(formCard, "Opening Due (Rs.):", "0.00", 882, 34, 120);
            var tAddr = AddLabeledBox(formCard, "Address:", "", 12, 84, 420);
            var tLimit = AddLabeledBox(formCard, "Credit Limit (Rs.):", "50000", 442, 84, 130);

            var gridCard = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(10) };
            var grid = CreateStandardGrid();
            grid.Columns.Add("Id", "ID");
            grid.Columns.Add("Name", "Customer Name");
            grid.Columns.Add("Phone", "Mobile");
            grid.Columns.Add("Gstin", "GSTIN");
            grid.Columns.Add("State", "State");
            grid.Columns.Add("Billed", "Total Billed");
            grid.Columns.Add("Paid", "Total Paid");
            grid.Columns.Add("Due", "Balance Due (Rs.)");
            grid.Columns.Add("Loyalty", "Loyalty Pts");

            void RefreshCustomers()
            {
                grid.Rows.Clear();
                foreach (var c in prof.Customers)
                {
                    decimal due = c.OpeningBalance + c.TotalBilled - c.TotalPaid;
                    c.Outstanding = due;
                    grid.Rows.Add(c.Id, c.Name, c.Phone, c.Gstin, c.State, c.TotalBilled.ToString("N2"), c.TotalPaid.ToString("N2"), due.ToString("N2"), c.LoyaltyPoints);
                }
            }

            var btnAdd = CreateActionButton("+ Save Customer", Color.FromArgb(22, 163, 74), 145);
            btnAdd.Location = new Point(588, 98);
            btnAdd.Height = 32;
            btnAdd.Click += (s, e) =>
            {
                if (string.IsNullOrWhiteSpace(tName.Text)) return;
                decimal.TryParse(tOpenBal.Text, out decimal ob);
                decimal.TryParse(tLimit.Text, out decimal lim);
                prof.Customers.Add(new CustomerRecord
                {
                    Id = "CUST" + (prof.Customers.Count + 1).ToString("D3"),
                    Name = tName.Text.Trim(),
                    Phone = tPhone.Text.Trim(),
                    Email = tEmail.Text.Trim(),
                    Gstin = tGstin.Text.Trim(),
                    State = tState.Text.Trim(),
                    Address = tAddr.Text.Trim(),
                    OpeningBalance = ob,
                    Outstanding = ob,
                    CreditLimit = lim
                });
                AppStore.SaveAtomic();
                tName.Clear(); tPhone.Clear(); tGstin.Clear();
                RefreshCustomers();
            };

            var btnWhatsApp = CreateActionButton("Send WhatsApp Reminder", Color.FromArgb(16, 185, 129), 185);
            btnWhatsApp.Location = new Point(742, 98);
            btnWhatsApp.Height = 32;
            btnWhatsApp.Click += (s, e) =>
            {
                if (grid.SelectedRows.Count == 0) return;
                string id = grid.SelectedRows[0].Cells[0].Value?.ToString();
                var cust = prof.Customers.FirstOrDefault(x => x.Id == id);
                if (cust == null) return;
                string msg = AppStore.BuildCustomerPaymentMessage(cust);
                string digits = new string((cust.Phone ?? "").Where(char.IsDigit).ToArray());
                if (digits.Length == 10) digits = "91" + digits;
                try
                {
                    Process.Start(new ProcessStartInfo($"https://wa.me/{digits}?text={msg}") { UseShellExecute = true });
                }
                catch { }
            };

            var btnDelete = CreateActionButton("Delete Selected", Color.FromArgb(220, 38, 38), 130);
            btnDelete.Location = new Point(936, 98);
            btnDelete.Height = 32;
            btnDelete.Click += (s, e) =>
            {
                if (grid.SelectedRows.Count == 0) return;
                string id = grid.SelectedRows[0].Cells[0].Value?.ToString();
                prof.Customers.RemoveAll(x => x.Id == id);
                AppStore.SaveAtomic();
                RefreshCustomers();
            };

            formCard.Controls.AddRange(new Control[] { btnAdd, btnWhatsApp, btnDelete });
            gridCard.Controls.Add(grid);
            RefreshCustomers();

            split.Controls.Add(formCard, 0, 0);
            split.Controls.Add(gridCard, 0, 1);
            _contentPanel.Controls.Add(split);
        }

        private void ShowSupplierMasterView()
        {
            _contentPanel.Controls.Clear();
            var prof = AppStore.CurrentProfile;

            var split = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 2 };
            split.RowStyles.Add(new RowStyle(SizeType.Absolute, 140f));
            split.RowStyles.Add(new RowStyle(SizeType.Percent, 100f));

            var formCard = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(12), Margin = new Padding(0, 0, 0, 8) };
            formCard.Controls.Add(new Label { Text = "SUPPLIER / VENDOR MASTER", Font = new Font("Segoe UI", 11f, FontStyle.Bold), Location = new Point(12, 6), AutoSize = true });

            var tName = AddLabeledBox(formCard, "Supplier Name:", "", 12, 34, 220);
            var tContact = AddLabeledBox(formCard, "Contact Person:", "", 242, 34, 150);
            var tPhone = AddLabeledBox(formCard, "Phone:", "", 402, 34, 140);
            var tGstin = AddLabeledBox(formCard, "Supplier GSTIN:", "", 552, 34, 150);
            var tState = AddLabeledBox(formCard, "State:", "09-Uttar Pradesh", 712, 34, 150);
            var tOpenPay = AddLabeledBox(formCard, "Opening Payable:", "0.00", 872, 34, 120);
            var tAddr = AddLabeledBox(formCard, "Address:", "", 12, 84, 380);
            var tTerms = AddLabeledBox(formCard, "Payment Terms:", "Net 30 Days", 402, 84, 160);

            var gridCard = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(10) };
            var grid = CreateStandardGrid();
            grid.Columns.Add("Id", "ID");
            grid.Columns.Add("Name", "Supplier Name");
            grid.Columns.Add("Contact", "Contact Person");
            grid.Columns.Add("Phone", "Phone");
            grid.Columns.Add("Gstin", "GSTIN");
            grid.Columns.Add("State", "State");
            grid.Columns.Add("Terms", "Terms");
            grid.Columns.Add("Payable", "Balance Payable (Rs.)");

            void RefreshSuppliers()
            {
                grid.Rows.Clear();
                foreach (var s in prof.Suppliers)
                {
                    decimal pay = s.OpeningBalance + s.TotalPurchased - s.TotalPaid;
                    s.BalancePayable = pay;
                    grid.Rows.Add(s.Id, s.Name, s.ContactPerson, s.Phone, s.Gstin, s.State, s.PaymentTerms, pay.ToString("N2"));
                }
            }

            var btnSave = CreateActionButton("+ Save Supplier", Color.FromArgb(22, 163, 74), 150);
            btnSave.Location = new Point(580, 98);
            btnSave.Height = 32;
            btnSave.Click += (s, e) =>
            {
                if (string.IsNullOrWhiteSpace(tName.Text)) return;
                decimal.TryParse(tOpenPay.Text, out decimal op);
                prof.Suppliers.Add(new SupplierRecord
                {
                    Id = "SUP" + (prof.Suppliers.Count + 1).ToString("D3"),
                    Name = tName.Text.Trim(),
                    ContactPerson = tContact.Text.Trim(),
                    Phone = tPhone.Text.Trim(),
                    Gstin = tGstin.Text.Trim(),
                    State = tState.Text.Trim(),
                    Address = tAddr.Text.Trim(),
                    PaymentTerms = tTerms.Text.Trim(),
                    OpeningBalance = op,
                    BalancePayable = op
                });
                AppStore.SaveAtomic();
                tName.Clear(); tPhone.Clear(); tGstin.Clear();
                RefreshSuppliers();
            };

            var btnDel = CreateActionButton("Delete Supplier", Color.FromArgb(220, 38, 38), 140);
            btnDel.Location = new Point(740, 98);
            btnDel.Height = 32;
            btnDel.Click += (s, e) =>
            {
                if (grid.SelectedRows.Count == 0) return;
                string id = grid.SelectedRows[0].Cells[0].Value?.ToString();
                prof.Suppliers.RemoveAll(x => x.Id == id);
                AppStore.SaveAtomic();
                RefreshSuppliers();
            };

            formCard.Controls.AddRange(new Control[] { btnSave, btnDel });
            gridCard.Controls.Add(grid);
            RefreshSuppliers();

            split.Controls.Add(formCard, 0, 0);
            split.Controls.Add(gridCard, 0, 1);
            _contentPanel.Controls.Add(split);
        }

        private void ShowItemMasterView()
        {
            _contentPanel.Controls.Clear();
            var prof = AppStore.CurrentProfile;

            var split = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 2 };
            split.RowStyles.Add(new RowStyle(SizeType.Absolute, 155f));
            split.RowStyles.Add(new RowStyle(SizeType.Percent, 100f));

            var formCard = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(12), Margin = new Padding(0, 0, 0, 8) };
            formCard.Controls.Add(new Label
            {
                Text = "ITEM / INVENTORY SKU MASTER (MULTI-BATCH & 30-DAY EXPIRY TRACKING)",
                Font = new Font("Segoe UI", 11f, FontStyle.Bold),
                Location = new Point(12, 6),
                AutoSize = true
            });

            var tCode = AddLabeledBox(formCard, "SKU Code:", "SKU-" + (prof.Items.Count + 101), 12, 34, 95);
            var tBarcode = AddLabeledBox(formCard, "Barcode:", "890100" + (prof.Items.Count + 11), 115, 34, 115);
            var tName = AddLabeledBox(formCard, "Item Description:", "", 238, 34, 240);
            var tCat = AddLabeledBox(formCard, "Category:", "Stationery", 486, 34, 115);
            var tHsn = AddLabeledBox(formCard, "HSN Code:", "4820", 609, 34, 80);
            var tUom = AddLabeledBox(formCard, "UOM:", "PCS", 697, 34, 65);
            var tGst = AddLabeledBox(formCard, "GST %:", "18", 770, 34, 60);
            var tStock = AddLabeledBox(formCard, "Opening Stock:", "50", 838, 34, 95);
            var tReorder = AddLabeledBox(formCard, "Reorder Level:", "10", 941, 34, 95);

            var tCost = AddLabeledBox(formCard, "Cost Price (Rs.):", "0.00", 12, 86, 105);
            var tSale = AddLabeledBox(formCard, "Sale Price (Rs.):", "0.00", 125, 86, 105);
            var tMrp = AddLabeledBox(formCard, "MRP (Rs.):", "0.00", 238, 86, 95);
            var tBatch = AddLabeledBox(formCard, "Batch No:", "B-01", 342, 86, 85);
            var tExpiry = AddLabeledBox(formCard, "Expiry (YYYY-MM-DD):", DateTime.Today.AddMonths(12).ToString("yyyy-MM-dd"), 435, 86, 130);
            var tRack = AddLabeledBox(formCard, "Rack:", "R-1", 573, 86, 65);

            var gridCard = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(10) };
            var grid = CreateStandardGrid();
            grid.Columns.Add("Id", "ID");
            grid.Columns.Add("Code", "SKU Code");
            grid.Columns.Add("Barcode", "Barcode");
            grid.Columns.Add("Name", "Item Name");
            grid.Columns.Add("Category", "Category");
            grid.Columns.Add("Batch", "Batch / Expiry Status");
            grid.Columns.Add("Hsn", "HSN");
            grid.Columns.Add("Cost", "Cost (Rs.)");
            grid.Columns.Add("Price", "Sale Rate (Rs.)");
            grid.Columns.Add("Mrp", "MRP (Rs.)");
            grid.Columns.Add("Gst", "GST %");
            grid.Columns.Add("Stock", "Current Stock");

            void RefreshItems()
            {
                grid.Rows.Clear();
                foreach (var it in prof.Items)
                {
                    string expStatus = string.IsNullOrWhiteSpace(it.ExpiryDate) ? it.BatchNo : $"{it.BatchNo} (Exp: {it.ExpiryDate})";
                    bool expiringSoon = false;
                    if (DateTime.TryParse(it.ExpiryDate, out DateTime expDt))
                    {
                        double daysLeft = (expDt.Date - DateTime.Today).TotalDays;
                        if (daysLeft < 0) { expStatus += " [EXPIRED]"; expiringSoon = true; }
                        else if (daysLeft <= 30) { expStatus += $" [EXPIRING IN {(int)daysLeft}d]"; expiringSoon = true; }
                    }
                    int rIdx = grid.Rows.Add(it.Id, it.Code, it.Barcode, it.Name, it.Category, expStatus, it.HsnCode,
                        it.CostPrice.ToString("N2"), it.Price.ToString("N2"), it.Mrp.ToString("N2"),
                        it.GstPercent.ToString("0.#") + "%", $"{it.Stock:0.##} {it.Uom}");
                    if (expiringSoon || it.Stock <= it.ReorderLevel)
                    {
                        grid.Rows[rIdx].DefaultCellStyle.ForeColor = Color.FromArgb(185, 28, 28);
                    }
                }
            }

            var btnSave = CreateActionButton("+ Save Item SKU", Color.FromArgb(22, 163, 74), 145);
            btnSave.Location = new Point(648, 100);
            btnSave.Height = 32;
            btnSave.Click += (s, e) =>
            {
                if (string.IsNullOrWhiteSpace(tName.Text)) return;
                decimal.TryParse(tCost.Text, out decimal cost);
                decimal.TryParse(tSale.Text, out decimal sale);
                decimal.TryParse(tMrp.Text, out decimal mrp);
                decimal.TryParse(tGst.Text, out decimal gst);
                decimal.TryParse(tStock.Text, out decimal stk);
                decimal.TryParse(tReorder.Text, out decimal reord);

                var newItem = new ItemRecord
                {
                    Id = "ITM" + (prof.Items.Count + 1).ToString("D3"),
                    Code = tCode.Text.Trim(),
                    Barcode = tBarcode.Text.Trim(),
                    Name = tName.Text.Trim(),
                    Category = tCat.Text.Trim(),
                    HsnCode = tHsn.Text.Trim(),
                    Uom = tUom.Text.Trim(),
                    BatchNo = tBatch.Text.Trim(),
                    ExpiryDate = tExpiry.Text.Trim(),
                    RackLocation = tRack.Text.Trim(),
                    CostPrice = cost,
                    Price = sale,
                    WholesalePrice = sale,
                    Mrp = mrp > 0 ? mrp : sale,
                    GstPercent = gst,
                    Stock = stk,
                    ReorderLevel = reord,
                    Batches = new List<BatchRecord>
                    {
                        new BatchRecord
                        {
                            BatchNo = tBatch.Text.Trim(),
                            MfgDate = DateTime.Today.ToString("yyyy-MM-dd"),
                            ExpiryDate = tExpiry.Text.Trim(),
                            Stock = stk,
                            CostPrice = cost,
                            SalePrice = sale,
                            Mrp = mrp > 0 ? mrp : sale
                        }
                    }
                };
                prof.Items.Add(newItem);
                AppStore.SaveAtomic();
                tName.Clear();
                RefreshItems();
            };

            var btnManageBatches = CreateActionButton("Manage Batches", Color.FromArgb(37, 99, 235), 145);
            btnManageBatches.Location = new Point(800, 100);
            btnManageBatches.Height = 32;
            btnManageBatches.Click += (s, e) =>
            {
                if (grid.SelectedRows.Count == 0) return;
                string id = grid.SelectedRows[0].Cells[0].Value?.ToString();
                var item = prof.Items.FirstOrDefault(x => x.Id == id);
                if (item != null)
                {
                    ShowManageItemBatchesDialog(item);
                    RefreshItems();
                }
            };

            var btnDel = CreateActionButton("Delete Item", Color.FromArgb(220, 38, 38), 120);
            btnDel.Location = new Point(952, 100);
            btnDel.Height = 32;
            btnDel.Click += (s, e) =>
            {
                if (grid.SelectedRows.Count == 0) return;
                string id = grid.SelectedRows[0].Cells[0].Value?.ToString();
                prof.Items.RemoveAll(x => x.Id == id);
                AppStore.SaveAtomic();
                RefreshItems();
            };

            formCard.Controls.AddRange(new Control[] { btnSave, btnManageBatches, btnDel });
            gridCard.Controls.Add(grid);
            RefreshItems();

            split.Controls.Add(formCard, 0, 0);
            split.Controls.Add(gridCard, 0, 1);
            _contentPanel.Controls.Add(split);
        }

        private void ShowManageItemBatchesDialog(ItemRecord item)
        {
            item.Batches ??= new List<BatchRecord>();
            using var dlg = new Form
            {
                Text = $"Batch & Expiry Tracking — {item.Code} ({item.Name})",
                Size = new Size(760, 480),
                StartPosition = FormStartPosition.CenterParent,
                FormBorderStyle = FormBorderStyle.FixedDialog,
                MaximizeBox = false,
                MinimizeBox = false,
                BackColor = Color.White
            };

            var tBatchNo = AddLabeledBox(dlg, "Batch No:", "B-" + (item.Batches.Count + 1).ToString("D2"), 16, 14, 110);
            var tExpiry = AddLabeledBox(dlg, "Expiry (YYYY-MM-DD):", DateTime.Today.AddDays(25).ToString("yyyy-MM-dd"), 136, 14, 130);
            var tStock = AddLabeledBox(dlg, "Batch Qty:", "25", 276, 14, 90);
            var tCost = AddLabeledBox(dlg, "Cost Price:", item.CostPrice.ToString("0.00"), 376, 14, 95);
            var tSale = AddLabeledBox(dlg, "Sale Price:", item.Price.ToString("0.00"), 480, 14, 95);

            var grid = CreateStandardGrid();
            grid.Dock = DockStyle.None;
            grid.Location = new Point(16, 76);
            grid.Size = new Size(710, 340);
            grid.Columns.Add("BatchNo", "Batch No");
            grid.Columns.Add("Expiry", "Expiry Date");
            grid.Columns.Add("Qty", "Stock Qty");
            grid.Columns.Add("Cost", "Cost (Rs.)");
            grid.Columns.Add("Sale", "Sale (Rs.)");
            grid.Columns.Add("Status", "Expiry Alert");

            void ReloadBatches()
            {
                grid.Rows.Clear();
                foreach (var b in item.Batches)
                {
                    string status = "OK";
                    bool warn = false;
                    if (DateTime.TryParse(b.ExpiryDate, out DateTime dt))
                    {
                        double d = (dt.Date - DateTime.Today).TotalDays;
                        if (d < 0) { status = "EXPIRED"; warn = true; }
                        else if (d <= 30) { status = $"EXPIRING IN {(int)d} DAYS (<30d)"; warn = true; }
                    }
                    int idx = grid.Rows.Add(b.BatchNo, b.ExpiryDate, b.Stock, b.CostPrice.ToString("N2"), b.SalePrice.ToString("N2"), status);
                    if (warn) grid.Rows[idx].DefaultCellStyle.ForeColor = Color.FromArgb(185, 28, 28);
                }
            }

            var btnAddBatch = CreateActionButton("+ Link Batch", Color.FromArgb(22, 163, 74), 135);
            btnAddBatch.Location = new Point(590, 28);
            btnAddBatch.Height = 32;
            btnAddBatch.Click += (s, e) =>
            {
                decimal.TryParse(tStock.Text, out decimal q);
                decimal.TryParse(tCost.Text, out decimal c);
                decimal.TryParse(tSale.Text, out decimal sp);
                item.Batches.Add(new BatchRecord
                {
                    BatchNo = tBatchNo.Text.Trim(),
                    MfgDate = DateTime.Today.ToString("yyyy-MM-dd"),
                    ExpiryDate = tExpiry.Text.Trim(),
                    Stock = q,
                    CostPrice = c,
                    SalePrice = sp,
                    Mrp = item.Mrp
                });
                item.BatchNo = tBatchNo.Text.Trim();
                item.ExpiryDate = tExpiry.Text.Trim();
                item.Stock = item.Batches.Sum(x => x.Stock);
                AppStore.SaveAtomic();
                ReloadBatches();
            };

            ReloadBatches();
            dlg.Controls.AddRange(new Control[] { btnAddBatch, grid });
            dlg.ShowDialog(this);
        }

        private void ShowHsnMasterView()
        {
            _contentPanel.Controls.Clear();
            var prof = AppStore.CurrentProfile;

            var split = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 2 };
            split.RowStyles.Add(new RowStyle(SizeType.Absolute, 110f));
            split.RowStyles.Add(new RowStyle(SizeType.Percent, 100f));

            var formCard = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(12), Margin = new Padding(0, 0, 0, 8) };
            formCard.Controls.Add(new Label { Text = "HSN / SAC TAX CODE MASTER", Font = new Font("Segoe UI", 11f, FontStyle.Bold), Location = new Point(12, 6), AutoSize = true });

            var tCode = AddLabeledBox(formCard, "HSN / SAC Code:", "", 12, 34, 130);
            var tDesc = AddLabeledBox(formCard, "Description:", "", 152, 34, 340);
            var tGst = AddLabeledBox(formCard, "Total GST %:", "18", 502, 34, 100);
            var tUom = AddLabeledBox(formCard, "Default UOM:", "PCS", 612, 34, 100);

            var gridCard = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(10) };
            var grid = CreateStandardGrid();
            grid.Columns.Add("Code", "HSN Code");
            grid.Columns.Add("Desc", "Description");
            grid.Columns.Add("Gst", "Total GST %");
            grid.Columns.Add("Cgst", "CGST %");
            grid.Columns.Add("Sgst", "SGST %");
            grid.Columns.Add("Igst", "IGST %");
            grid.Columns.Add("Uom", "Default UOM");

            void RefreshHsn()
            {
                grid.Rows.Clear();
                foreach (var h in prof.HsnCodes)
                {
                    grid.Rows.Add(h.Code, h.Description, h.GstRate + "%", h.CgstRate + "%", h.SgstRate + "%", h.IgstRate + "%", h.DefaultUom);
                }
            }

            var btnSave = CreateActionButton("+ Save HSN Code", Color.FromArgb(22, 163, 74), 150);
            btnSave.Location = new Point(730, 48);
            btnSave.Height = 32;
            btnSave.Click += (s, e) =>
            {
                if (string.IsNullOrWhiteSpace(tCode.Text)) return;
                decimal.TryParse(tGst.Text, out decimal r);
                prof.HsnCodes.Add(new HsnRecord
                {
                    Code = tCode.Text.Trim(),
                    Description = tDesc.Text.Trim(),
                    GstRate = r,
                    CgstRate = r / 2m,
                    SgstRate = r / 2m,
                    IgstRate = r,
                    DefaultUom = tUom.Text.Trim()
                });
                AppStore.SaveAtomic();
                tCode.Clear(); tDesc.Clear();
                RefreshHsn();
            };

            formCard.Controls.Add(btnSave);
            gridCard.Controls.Add(grid);
            RefreshHsn();

            split.Controls.Add(formCard, 0, 0);
            split.Controls.Add(gridCard, 0, 1);
            _contentPanel.Controls.Add(split);
        }

        private void ShowBankMasterView()
        {
            _contentPanel.Controls.Clear();
            var prof = AppStore.CurrentProfile;

            var split = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 2 };
            split.RowStyles.Add(new RowStyle(SizeType.Absolute, 115f));
            split.RowStyles.Add(new RowStyle(SizeType.Percent, 100f));

            var formCard = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(12), Margin = new Padding(0, 0, 0, 8) };
            formCard.Controls.Add(new Label { Text = "COMPANY BANK ACCOUNTS & UPI MASTER", Font = new Font("Segoe UI", 11f, FontStyle.Bold), Location = new Point(12, 6), AutoSize = true });

            var tBank = AddLabeledBox(formCard, "Bank Name:", "", 12, 34, 200);
            var tBranch = AddLabeledBox(formCard, "Branch:", "", 222, 34, 160);
            var tAccNo = AddLabeledBox(formCard, "Account No:", "", 392, 34, 170);
            var tIfsc = AddLabeledBox(formCard, "IFSC Code:", "", 572, 34, 130);
            var tUpi = AddLabeledBox(formCard, "Linked UPI ID:", "", 712, 34, 160);
            var tBal = AddLabeledBox(formCard, "Opening Bal:", "0.00", 882, 34, 110);

            var gridCard = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(10) };
            var grid = CreateStandardGrid();
            grid.Columns.Add("Id", "ID");
            grid.Columns.Add("Bank", "Bank Name");
            grid.Columns.Add("Branch", "Branch");
            grid.Columns.Add("AccNo", "Account No");
            grid.Columns.Add("Ifsc", "IFSC");
            grid.Columns.Add("Upi", "UPI ID");
            grid.Columns.Add("Bal", "Current Balance (Rs.)");

            void RefreshBanks()
            {
                grid.Rows.Clear();
                foreach (var b in prof.Banks)
                {
                    grid.Rows.Add(b.Id, b.BankName, b.BranchName, b.AccountNumber, b.IfscCode, b.UpiId, b.CurrentBalance.ToString("N2"));
                }
            }

            var btnSave = CreateActionButton("+ Add Bank", Color.FromArgb(22, 163, 74), 130);
            btnSave.Location = new Point(1002, 48);
            btnSave.Height = 32;
            btnSave.Click += (s, e) =>
            {
                if (string.IsNullOrWhiteSpace(tBank.Text)) return;
                decimal.TryParse(tBal.Text, out decimal bal);
                prof.Banks.Add(new BankRecord
                {
                    Id = "BNK" + (prof.Banks.Count + 1).ToString("D3"),
                    BankName = tBank.Text.Trim(),
                    BranchName = tBranch.Text.Trim(),
                    AccountHolder = prof.Company.Name,
                    AccountNumber = tAccNo.Text.Trim(),
                    IfscCode = tIfsc.Text.Trim(),
                    UpiId = tUpi.Text.Trim(),
                    OpeningBalance = bal,
                    CurrentBalance = bal
                });
                AppStore.SaveAtomic();
                RefreshBanks();
            };

            formCard.Controls.Add(btnSave);
            gridCard.Controls.Add(grid);
            RefreshBanks();

            split.Controls.Add(formCard, 0, 0);
            split.Controls.Add(gridCard, 0, 1);
            _contentPanel.Controls.Add(split);
        }

        // ====================================================================
        // 4. REPORTS & GST RETURNS (ALL 20 REPORTS + FINANCIAL STATEMENTS)
        // ====================================================================
        private void ShowReportView(string reportType)
        {
            _contentPanel.Controls.Clear();
            var prof = AppStore.CurrentProfile;

            var card = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(12) };
            var topBar = new Panel { Dock = DockStyle.Top, Height = 82, BackColor = Color.FromArgb(248, 250, 252), Padding = new Padding(10) };

            var reportCatalog = new (string Code, string Title)[]
            {
                ("SALE_SUMMARY", "Sale Summary"),
                ("SALE_HISTORY", "Sale History"),
                ("ITEM_STATEMENT", "Item Account Statement"),
                ("CUSTOMER_LEDGER", "Customer Ledger"),
                ("CUSTOMER_STATEMENT", "Customer Account Statement"),
                ("SUPPLIER_LEDGER", "Supplier Ledger"),
                ("SUPPLIER_PURCHASE_HISTORY", "Supplier Purchase History"),
                ("PAYMENT_SEARCH", "Payment Search"),
                ("RECEIPT_SEARCH", "Receipt Search"),
                ("PURCHASE_REPORT", "Purchase Report"),
                ("GST_SALES_SUMMARY", "GST Sales Summary"),
                ("GST_PURCHASE_SUMMARY", "GST Purchase Summary"),
                ("RCM_REPORT", "RCM Report"),
                ("STOCK_REPORT", "Stock Report"),
                ("STOCK_OUT_REPORT", "Stock Out Report"),
                ("CREDIT_NOTE_REPORT", "Credit Note Report"),
                ("PURCHASE_RETURN_REPORT", "Purchase Return Report"),
                ("TODAYS_CASH_REPORT", "Today's Cash Report"),
                ("BANK_STATEMENT", "Bank Account Statement"),
                ("JOURNAL_REPORT", "Journal Voucher Report"),
                ("DAY_BOOK", "Day Book"),
                ("HSN_SUMMARY", "HSN-wise GST Summary"),
                ("GSTR_RETURN", "GSTR-1 & GSTR-3B Return"),
                ("PROFIT_LOSS", "Profit & Loss Statement"),
                ("BALANCE_SHEET", "Balance Sheet")
            };

            string currentReportCode = string.IsNullOrWhiteSpace(reportType) ? "SALE_SUMMARY" : reportType.ToUpperInvariant();
            string currentTitle = reportCatalog.FirstOrDefault(r => r.Code == currentReportCode).Title ?? currentReportCode.Replace("_", " ");

            var lblTitle = new Label
            {
                Text = $"REPORT: {currentTitle.ToUpperInvariant()}   [{AppStore.Data.ActiveProfile} | {AppStore.Data.ActiveFinancialYear}]",
                Font = new Font("Segoe UI", 11.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(15, 23, 42),
                Location = new Point(10, 6),
                AutoSize = true
            };
            topBar.Controls.Add(lblTitle);

            topBar.Controls.Add(new Label { Text = "Switch Report:", Location = new Point(10, 34), AutoSize = true, Font = new Font("Segoe UI", 8.5f, FontStyle.Bold) });
            var cmbReportSwitch = new ComboBox
            {
                Location = new Point(10, 52),
                Width = 220,
                DropDownStyle = ComboBoxStyle.DropDownList,
                Font = new Font("Segoe UI", 9.5f)
            };
            int selRepIdx = 0;
            for (int i = 0; i < reportCatalog.Length; i++)
            {
                cmbReportSwitch.Items.Add(reportCatalog[i].Title);
                if (reportCatalog[i].Code == currentReportCode) selRepIdx = i;
            }
            cmbReportSwitch.SelectedIndex = selRepIdx;

            topBar.Controls.Add(new Label { Text = "From Date:", Location = new Point(242, 34), AutoSize = true, Font = new Font("Segoe UI", 8.5f, FontStyle.Bold) });
            var dtpFrom = new DateTimePicker
            {
                Location = new Point(242, 52),
                Width = 118,
                Format = DateTimePickerFormat.Short,
                Value = currentReportCode == "TODAYS_CASH_REPORT" ? DateTime.Today : DateTime.Today.AddMonths(-6)
            };

            topBar.Controls.Add(new Label { Text = "To Date:", Location = new Point(368, 34), AutoSize = true, Font = new Font("Segoe UI", 8.5f, FontStyle.Bold) });
            var dtpTo = new DateTimePicker
            {
                Location = new Point(368, 52),
                Width = 118,
                Format = DateTimePickerFormat.Short,
                Value = DateTime.Today.AddDays(1)
            };

            var txtFilter = AddLabeledBox(topBar, "Search Party / Item / Doc No:", "", 496, 34, 240);

            var btnRefreshRep = CreateActionButton("Apply Filter", Color.FromArgb(37, 99, 235), 115);
            btnRefreshRep.Location = new Point(746, 49);
            btnRefreshRep.Height = 29;

            var grid = CreateStandardGrid();

            var btnExportCsv = CreateActionButton("Export CSV / Excel", Color.FromArgb(22, 163, 74), 165);
            btnExportCsv.Location = new Point(870, 49);
            btnExportCsv.Height = 29;
            btnExportCsv.Click += (s, e) => ExportGridToCsv(grid, currentReportCode);

            topBar.Controls.AddRange(new Control[] { cmbReportSwitch, dtpFrom, dtpTo, btnRefreshRep, btnExportCsv });

            var summaryBar = new Panel
            {
                Dock = DockStyle.Bottom,
                Height = 40,
                BackColor = Color.FromArgb(15, 23, 42),
                Padding = new Padding(14, 8, 14, 8)
            };
            var lblSummaryText = new Label
            {
                Text = "Total Rows: 0",
                ForeColor = Color.FromArgb(74, 222, 128),
                Font = new Font("Segoe UI", 10f, FontStyle.Bold),
                Dock = DockStyle.Fill,
                TextAlign = ContentAlignment.MiddleLeft
            };
            summaryBar.Controls.Add(lblSummaryText);

            void PopulateReportGrid()
            {
                grid.Columns.Clear();
                grid.Rows.Clear();

                DateTime fromDt = dtpFrom.Value.Date;
                DateTime toDt = dtpTo.Value.Date.AddDays(1).AddSeconds(-1);
                string q = (txtFilter.Text ?? "").Trim().ToLowerInvariant();

                bool MatchesText(params string[] fields)
                {
                    if (string.IsNullOrEmpty(q)) return true;
                    return fields.Any(f => !string.IsNullOrEmpty(f) && f.ToLowerInvariant().Contains(q));
                }

                var dateFilteredInvoices = prof.Invoices
                    .Where(inv => inv.Date >= fromDt && inv.Date <= toDt)
                    .OrderByDescending(inv => inv.Date)
                    .ToList();

                var dateFilteredVouchers = prof.Vouchers
                    .Where(v => v.Date >= fromDt && v.Date <= toDt)
                    .OrderByDescending(v => v.Date)
                    .ToList();

                if (currentReportCode == "SALE_SUMMARY" || currentReportCode == "SALES_REGISTER")
                {
                    grid.Columns.Add("InvNo", "Invoice No");
                    grid.Columns.Add("Date", "Date");
                    grid.Columns.Add("Customer", "Customer Name");
                    grid.Columns.Add("Gstin", "GSTIN");
                    grid.Columns.Add("PayMode", "Payment Mode");
                    grid.Columns.Add("Items", "Items");
                    grid.Columns.Add("BaseVal", "Base / Taxable (Rs.)");
                    grid.Columns.Add("Disc", "Discount (Rs.)");
                    grid.Columns.Add("Gst", "GST (Rs.)");
                    grid.Columns.Add("BillAmt", "Bill Amt (Rs.)");
                    grid.Columns.Add("PrevBal", "Prev Bal (Rs.)");
                    grid.Columns.Add("AdjCred", "Adj Credit (Rs.)");
                    grid.Columns.Add("NetTotal", "Total Amt (Rs.)");

                    var list = dateFilteredInvoices
                        .Where(x => x.DocType == "SALE" && MatchesText(x.InvoiceNo, x.CustomerName, x.CustomerPhone, x.PaymentMode))
                        .ToList();

                    foreach (var inv in list)
                    {
                        decimal net = inv.NetPayableTotal > 0m ? inv.NetPayableTotal : (inv.GrandTotal + inv.PreviousBalance - inv.AdjustedCreditAmount);
                        grid.Rows.Add(inv.InvoiceNo, inv.Date.ToString("dd-MMM-yyyy HH:mm"), inv.CustomerName, inv.CustomerGstin,
                            inv.PaymentMode, inv.Lines.Count, inv.TaxableTotal.ToString("N2"), inv.DiscountTotal.ToString("N2"),
                            inv.GstTotal.ToString("N2"), inv.GrandTotal.ToString("N2"), inv.PreviousBalance.ToString("N2"),
                            inv.AdjustedCreditAmount.ToString("N2"), net.ToString("N2"));
                    }
                    lblSummaryText.Text = $"Sale Bills: {list.Count}   |   Base/Taxable: Rs. {list.Sum(x => x.TaxableTotal):N2}   |   GST: Rs. {list.Sum(x => x.GstTotal):N2}   |   Total Bill Amount: Rs. {list.Sum(x => x.GrandTotal):N2}";
                }
                else if (currentReportCode == "SALE_HISTORY")
                {
                    grid.Columns.Add("Date", "Date");
                    grid.Columns.Add("InvNo", "Invoice No");
                    grid.Columns.Add("Customer", "Customer Name");
                    grid.Columns.Add("ItemCode", "Item Code");
                    grid.Columns.Add("ItemName", "Item Description");
                    grid.Columns.Add("Qty", "Qty");
                    grid.Columns.Add("Unit", "Unit");
                    grid.Columns.Add("BasePrice", "Base Price");
                    grid.Columns.Add("Rate", "Selling Rate");
                    grid.Columns.Add("Disc", "Disc 1+2 %");
                    grid.Columns.Add("Gst", "GST Amt (Rs.)");
                    grid.Columns.Add("Total", "Line Total (Rs.)");

                    decimal totQty = 0m, totAmt = 0m;
                    int rows = 0;
                    foreach (var inv in dateFilteredInvoices.Where(x => x.DocType == "SALE"))
                    {
                        foreach (var ln in inv.Lines)
                        {
                            if (!MatchesText(inv.InvoiceNo, inv.CustomerName, ln.ItemName, ln.ItemCode)) continue;
                            grid.Rows.Add(inv.Date.ToString("dd-MMM-yyyy"), inv.InvoiceNo, inv.CustomerName, ln.ItemCode, ln.ItemName,
                                ln.Qty.ToString("0.##"), ln.Uom, ln.BasePrice.ToString("N2"), ln.Rate.ToString("N2"),
                                $"{ln.DiscountPercent:0.#}+{ln.Discount2Percent:0.#}%", ln.TotalGst.ToString("N2"), ln.LineTotal.ToString("N2"));
                            totQty += ln.Qty;
                            totAmt += ln.LineTotal;
                            rows++;
                        }
                    }
                    lblSummaryText.Text = $"Line Entries: {rows}   |   Total Qty Sold: {totQty:0.##}   |   Total Line Value: Rs. {totAmt:N2}";
                }
                else if (currentReportCode == "ITEM_STATEMENT")
                {
                    grid.Columns.Add("Date", "Date");
                    grid.Columns.Add("DocNo", "Document No");
                    grid.Columns.Add("Type", "Movement Type");
                    grid.Columns.Add("Item", "Item Name");
                    grid.Columns.Add("Party", "Customer / Supplier");
                    grid.Columns.Add("QtyIn", "Qty In (+)");
                    grid.Columns.Add("QtyOut", "Qty Out (-)");
                    grid.Columns.Add("Rate", "Rate (Rs.)");
                    grid.Columns.Add("Amount", "Amount (Rs.)");

                    decimal totIn = 0m, totOut = 0m;
                    foreach (var inv in dateFilteredInvoices.OrderBy(x => x.Date))
                    {
                        bool isIn = inv.DocType == "PURCHASE" || inv.DocType == "SALE_RETURN";
                        foreach (var ln in inv.Lines)
                        {
                            if (!MatchesText(ln.ItemName, ln.ItemCode, inv.CustomerName, inv.InvoiceNo)) continue;
                            decimal qIn = isIn ? ln.Qty : 0m;
                            decimal qOut = !isIn ? ln.Qty : 0m;
                            totIn += qIn;
                            totOut += qOut;
                            grid.Rows.Add(inv.Date.ToString("dd-MMM-yyyy"), inv.InvoiceNo, inv.DocType, $"{ln.ItemName} [{ln.ItemCode}]",
                                inv.CustomerName, qIn.ToString("0.##"), qOut.ToString("0.##"), ln.Rate.ToString("N2"), ln.LineTotal.ToString("N2"));
                        }
                    }
                    lblSummaryText.Text = $"Total Qty In (Purchased/Returned): {totIn:0.##}   |   Total Qty Out (Sold/Issued): {totOut:0.##}   |   Net Movement: {(totIn - totOut):0.##}";
                }
                else if (currentReportCode == "CUSTOMER_LEDGER" || currentReportCode == "CUSTOMER_OUTSTANDING")
                {
                    grid.Columns.Add("Name", "Customer Name");
                    grid.Columns.Add("Phone", "Mobile");
                    grid.Columns.Add("Gstin", "GSTIN");
                    grid.Columns.Add("Opening", "Opening Bal (Rs.)");
                    grid.Columns.Add("Billed", "Total Billed (Rs.)");
                    grid.Columns.Add("Paid", "Total Received / Adjusted (Rs.)");
                    grid.Columns.Add("Due", "Closing Balance (Rs.)");

                    var list = prof.Customers.Where(c => MatchesText(c.Name, c.Phone, c.Gstin)).ToList();
                    foreach (var c in list)
                    {
                        decimal due = c.OpeningBalance + c.TotalBilled - c.TotalPaid;
                        grid.Rows.Add(c.Name, c.Phone, c.Gstin, c.OpeningBalance.ToString("N2"),
                            c.TotalBilled.ToString("N2"), c.TotalPaid.ToString("N2"), due.ToString("N2"));
                    }
                    lblSummaryText.Text = $"Customers: {list.Count}   |   Total Billed: Rs. {list.Sum(x => x.TotalBilled):N2}   |   Total Received: Rs. {list.Sum(x => x.TotalPaid):N2}   |   Net Receivable: Rs. {list.Sum(x => x.OpeningBalance + x.TotalBilled - x.TotalPaid):N2}";
                }
                else if (currentReportCode == "CUSTOMER_STATEMENT")
                {
                    grid.Columns.Add("Date", "Date");
                    grid.Columns.Add("RefNo", "Doc / Voucher No");
                    grid.Columns.Add("Customer", "Customer Name");
                    grid.Columns.Add("Particulars", "Transaction Particulars");
                    grid.Columns.Add("Debit", "Debit / Billed (Rs.)");
                    grid.Columns.Add("Credit", "Credit / Received (Rs.)");
                    grid.Columns.Add("Mode", "Payment Mode");

                    decimal totDr = 0m, totCr = 0m;
                    foreach (var inv in dateFilteredInvoices.Where(x => x.DocType == "SALE" || x.DocType == "SALE_RETURN"))
                    {
                        if (!MatchesText(inv.CustomerName, inv.InvoiceNo, inv.CustomerPhone)) continue;
                        decimal dr = inv.DocType == "SALE" ? inv.GrandTotal : 0m;
                        decimal cr = inv.DocType == "SALE_RETURN" ? inv.GrandTotal : (inv.AmountReceived + inv.AdjustedCreditAmount);
                        totDr += dr; totCr += cr;
                        grid.Rows.Add(inv.Date.ToString("dd-MMM-yyyy"), inv.InvoiceNo, inv.CustomerName,
                            $"{inv.DocType} ({inv.Lines.Count} items)", dr.ToString("N2"), cr.ToString("N2"), inv.PaymentMode);
                    }
                    foreach (var v in dateFilteredVouchers.Where(x => x.VoucherType == "RECEIPT"))
                    {
                        if (!MatchesText(v.PartyName, v.VoucherNo, v.Narration)) continue;
                        totCr += v.Amount;
                        grid.Rows.Add(v.Date.ToString("dd-MMM-yyyy"), v.VoucherNo, v.PartyName,
                            $"Receipt Voucher ({v.Narration})", "0.00", v.Amount.ToString("N2"), v.PaymentMode);
                    }
                    lblSummaryText.Text = $"Total Debit (Billed): Rs. {totDr:N2}   |   Total Credit (Received): Rs. {totCr:N2}   |   Net Balance: Rs. {(totDr - totCr):N2}";
                }
                else if (currentReportCode == "SUPPLIER_LEDGER" || currentReportCode == "SUPPLIER_PAYABLE")
                {
                    grid.Columns.Add("Name", "Supplier Name");
                    grid.Columns.Add("Phone", "Mobile");
                    grid.Columns.Add("Gstin", "GSTIN");
                    grid.Columns.Add("Opening", "Opening Bal (Rs.)");
                    grid.Columns.Add("Purchased", "Total Purchased (Rs.)");
                    grid.Columns.Add("Paid", "Total Paid / Adjusted (Rs.)");
                    grid.Columns.Add("Payable", "Closing Payable (Rs.)");

                    var list = prof.Suppliers.Where(s => MatchesText(s.Name, s.Phone, s.Gstin)).ToList();
                    foreach (var s in list)
                    {
                        decimal pay = s.OpeningBalance + s.TotalPurchased - s.TotalPaid;
                        grid.Rows.Add(s.Name, s.Phone, s.Gstin, s.OpeningBalance.ToString("N2"),
                            s.TotalPurchased.ToString("N2"), s.TotalPaid.ToString("N2"), pay.ToString("N2"));
                    }
                    lblSummaryText.Text = $"Suppliers: {list.Count}   |   Total Purchased: Rs. {list.Sum(x => x.TotalPurchased):N2}   |   Total Paid: Rs. {list.Sum(x => x.TotalPaid):N2}   |   Net Payable: Rs. {list.Sum(x => x.OpeningBalance + x.TotalPurchased - x.TotalPaid):N2}";
                }
                else if (currentReportCode == "SUPPLIER_PURCHASE_HISTORY")
                {
                    grid.Columns.Add("Date", "Date");
                    grid.Columns.Add("InvNo", "Purchase Bill No");
                    grid.Columns.Add("Supplier", "Supplier Name");
                    grid.Columns.Add("Item", "Item Name");
                    grid.Columns.Add("Qty", "Qty");
                    grid.Columns.Add("Unit", "Unit");
                    grid.Columns.Add("BasePrice", "Base Price");
                    grid.Columns.Add("Rate", "Purchase Rate");
                    grid.Columns.Add("Gst", "GST Amt (Rs.)");
                    grid.Columns.Add("Total", "Line Total (Rs.)");

                    decimal totQty = 0m, totVal = 0m;
                    foreach (var inv in dateFilteredInvoices.Where(x => x.DocType == "PURCHASE"))
                    {
                        foreach (var ln in inv.Lines)
                        {
                            if (!MatchesText(inv.CustomerName, inv.InvoiceNo, ln.ItemName, ln.ItemCode)) continue;
                            totQty += ln.Qty;
                            totVal += ln.LineTotal;
                            grid.Rows.Add(inv.Date.ToString("dd-MMM-yyyy"), inv.InvoiceNo, inv.CustomerName,
                                $"{ln.ItemName} [{ln.ItemCode}]", ln.Qty.ToString("0.##"), ln.Uom,
                                ln.BasePrice.ToString("N2"), ln.Rate.ToString("N2"), ln.TotalGst.ToString("N2"), ln.LineTotal.ToString("N2"));
                        }
                    }
                    lblSummaryText.Text = $"Total Qty Purchased: {totQty:0.##}   |   Total Purchase Value: Rs. {totVal:N2}";
                }
                else if (currentReportCode == "PAYMENT_SEARCH")
                {
                    grid.Columns.Add("Date", "Date & Time");
                    grid.Columns.Add("RefNo", "Voucher / Bill No");
                    grid.Columns.Add("Party", "Payee / Supplier");
                    grid.Columns.Add("Head", "Account Head");
                    grid.Columns.Add("Mode", "Payment Mode");
                    grid.Columns.Add("Amount", "Paid Amount (Rs.)");
                    grid.Columns.Add("Narration", "Remarks / Narration");

                    decimal totPaid = 0m;
                    foreach (var v in dateFilteredVouchers.Where(x => x.VoucherType == "PAYMENT" || x.VoucherType == "EXPENSE"))
                    {
                        if (!MatchesText(v.VoucherNo, v.PartyName, v.PaymentMode, v.Narration)) continue;
                        totPaid += v.Amount;
                        grid.Rows.Add(v.Date.ToString("dd-MMM-yyyy HH:mm"), v.VoucherNo, v.PartyName, v.AccountHead, v.PaymentMode, v.Amount.ToString("N2"), v.Narration);
                    }
                    foreach (var inv in dateFilteredInvoices.Where(x => x.DocType == "PURCHASE" && x.AmountReceived > 0m))
                    {
                        if (!MatchesText(inv.InvoiceNo, inv.CustomerName, inv.PaymentMode)) continue;
                        totPaid += inv.AmountReceived;
                        grid.Rows.Add(inv.Date.ToString("dd-MMM-yyyy HH:mm"), inv.InvoiceNo, inv.CustomerName, "Purchase Payment", inv.PaymentMode, inv.AmountReceived.ToString("N2"), inv.Notes);
                    }
                    lblSummaryText.Text = $"Total Outward Payments: Rs. {totPaid:N2}";
                }
                else if (currentReportCode == "RECEIPT_SEARCH")
                {
                    grid.Columns.Add("Date", "Date & Time");
                    grid.Columns.Add("RefNo", "Voucher / Invoice No");
                    grid.Columns.Add("Party", "Customer / Payer");
                    grid.Columns.Add("Mode", "Payment Mode");
                    grid.Columns.Add("Amount", "Received Amount (Rs.)");
                    grid.Columns.Add("Narration", "Remarks / Reference");

                    decimal totRec = 0m;
                    foreach (var v in dateFilteredVouchers.Where(x => x.VoucherType == "RECEIPT"))
                    {
                        if (!MatchesText(v.VoucherNo, v.PartyName, v.PaymentMode, v.Narration)) continue;
                        totRec += v.Amount;
                        grid.Rows.Add(v.Date.ToString("dd-MMM-yyyy HH:mm"), v.VoucherNo, v.PartyName, v.PaymentMode, v.Amount.ToString("N2"), v.Narration);
                    }
                    foreach (var inv in dateFilteredInvoices.Where(x => x.DocType == "SALE" && x.AmountReceived > 0m))
                    {
                        if (!MatchesText(inv.InvoiceNo, inv.CustomerName, inv.PaymentMode)) continue;
                        totRec += inv.AmountReceived;
                        grid.Rows.Add(inv.Date.ToString("dd-MMM-yyyy HH:mm"), inv.InvoiceNo, inv.CustomerName, inv.PaymentMode, inv.AmountReceived.ToString("N2"), "POS Bill Receipt");
                    }
                    lblSummaryText.Text = $"Total Inward Receipts: Rs. {totRec:N2}";
                }
                else if (currentReportCode == "PURCHASE_REPORT" || currentReportCode == "PURCHASE_REGISTER")
                {
                    grid.Columns.Add("InvNo", "Purchase No");
                    grid.Columns.Add("Date", "Date");
                    grid.Columns.Add("Supplier", "Supplier Name");
                    grid.Columns.Add("Gstin", "Supplier GSTIN");
                    grid.Columns.Add("PayMode", "Payment Mode");
                    grid.Columns.Add("BaseVal", "Base / Taxable (Rs.)");
                    grid.Columns.Add("Gst", "Input GST (Rs.)");
                    grid.Columns.Add("BillAmt", "Bill Total (Rs.)");
                    grid.Columns.Add("Paid", "Paid (Rs.)");
                    grid.Columns.Add("Balance", "Balance Due (Rs.)");

                    var list = dateFilteredInvoices
                        .Where(x => x.DocType == "PURCHASE" && MatchesText(x.InvoiceNo, x.CustomerName, x.CustomerGstin))
                        .ToList();
                    foreach (var inv in list)
                    {
                        grid.Rows.Add(inv.InvoiceNo, inv.Date.ToString("dd-MMM-yyyy"), inv.CustomerName, inv.CustomerGstin,
                            inv.PaymentMode, inv.TaxableTotal.ToString("N2"), inv.GstTotal.ToString("N2"),
                            inv.GrandTotal.ToString("N2"), inv.AmountReceived.ToString("N2"), inv.BalanceDue.ToString("N2"));
                    }
                    lblSummaryText.Text = $"Purchase Bills: {list.Count}   |   Taxable: Rs. {list.Sum(x => x.TaxableTotal):N2}   |   Input GST: Rs. {list.Sum(x => x.GstTotal):N2}   |   Total Purchases: Rs. {list.Sum(x => x.GrandTotal):N2}";
                }
                else if (currentReportCode == "GST_SALES_SUMMARY")
                {
                    grid.Columns.Add("InvNo", "Invoice No");
                    grid.Columns.Add("Date", "Date");
                    grid.Columns.Add("Customer", "Customer Name");
                    grid.Columns.Add("Gstin", "Party GSTIN");
                    grid.Columns.Add("State", "Place of Supply");
                    grid.Columns.Add("Taxable", "Base / Taxable (Rs.)");
                    grid.Columns.Add("Cgst", "CGST (Rs.)");
                    grid.Columns.Add("Sgst", "SGST (Rs.)");
                    grid.Columns.Add("Igst", "IGST (Rs.)");
                    grid.Columns.Add("TotalGst", "Total GST (Rs.)");
                    grid.Columns.Add("Grand", "Invoice Total (Rs.)");

                    var list = dateFilteredInvoices
                        .Where(x => x.DocType == "SALE" && MatchesText(x.InvoiceNo, x.CustomerName, x.CustomerGstin))
                        .ToList();
                    foreach (var inv in list)
                    {
                        grid.Rows.Add(inv.InvoiceNo, inv.Date.ToString("dd-MMM-yyyy"), inv.CustomerName,
                            string.IsNullOrWhiteSpace(inv.CustomerGstin) ? "Unregistered (B2C)" : inv.CustomerGstin,
                            inv.PlaceOfSupply, inv.TaxableTotal.ToString("N2"), inv.CgstTotal.ToString("N2"),
                            inv.SgstTotal.ToString("N2"), inv.IgstTotal.ToString("N2"), inv.GstTotal.ToString("N2"), inv.GrandTotal.ToString("N2"));
                    }
                    lblSummaryText.Text = $"GST Sales Invoices: {list.Count}   |   Taxable: Rs. {list.Sum(x => x.TaxableTotal):N2}   |   CGST: Rs. {list.Sum(x => x.CgstTotal):N2}   |   SGST: Rs. {list.Sum(x => x.SgstTotal):N2}   |   IGST: Rs. {list.Sum(x => x.IgstTotal):N2}";
                }
                else if (currentReportCode == "GST_PURCHASE_SUMMARY")
                {
                    grid.Columns.Add("InvNo", "Purchase No");
                    grid.Columns.Add("Date", "Date");
                    grid.Columns.Add("Supplier", "Supplier Name");
                    grid.Columns.Add("Gstin", "Supplier GSTIN");
                    grid.Columns.Add("State", "Place of Supply");
                    grid.Columns.Add("Taxable", "Base / Taxable (Rs.)");
                    grid.Columns.Add("Cgst", "Input CGST (Rs.)");
                    grid.Columns.Add("Sgst", "Input SGST (Rs.)");
                    grid.Columns.Add("Igst", "Input IGST (Rs.)");
                    grid.Columns.Add("TotalGst", "Total ITC (Rs.)");
                    grid.Columns.Add("Grand", "Bill Total (Rs.)");

                    var list = dateFilteredInvoices
                        .Where(x => x.DocType == "PURCHASE" && MatchesText(x.InvoiceNo, x.CustomerName, x.CustomerGstin))
                        .ToList();
                    foreach (var inv in list)
                    {
                        grid.Rows.Add(inv.InvoiceNo, inv.Date.ToString("dd-MMM-yyyy"), inv.CustomerName,
                            string.IsNullOrWhiteSpace(inv.CustomerGstin) ? "Unregistered" : inv.CustomerGstin,
                            inv.PlaceOfSupply, inv.TaxableTotal.ToString("N2"), inv.CgstTotal.ToString("N2"),
                            inv.SgstTotal.ToString("N2"), inv.IgstTotal.ToString("N2"), inv.GstTotal.ToString("N2"), inv.GrandTotal.ToString("N2"));
                    }
                    lblSummaryText.Text = $"GST Purchase Bills: {list.Count}   |   Taxable: Rs. {list.Sum(x => x.TaxableTotal):N2}   |   Total Input Tax Credit (ITC): Rs. {list.Sum(x => x.GstTotal):N2}";
                }
                else if (currentReportCode == "RCM_REPORT")
                {
                    grid.Columns.Add("InvNo", "Purchase Bill No");
                    grid.Columns.Add("Date", "Date");
                    grid.Columns.Add("Supplier", "Unregistered Supplier");
                    grid.Columns.Add("Status", "GST Status");
                    grid.Columns.Add("Taxable", "Taxable Value (Rs.)");
                    grid.Columns.Add("RcmTax", "RCM Liability (Rs.)");
                    grid.Columns.Add("Total", "Bill Amount (Rs.)");

                    var list = dateFilteredInvoices
                        .Where(x => x.DocType == "PURCHASE" && string.IsNullOrWhiteSpace(x.CustomerGstin) && MatchesText(x.InvoiceNo, x.CustomerName))
                        .ToList();
                    foreach (var inv in list)
                    {
                        grid.Rows.Add(inv.InvoiceNo, inv.Date.ToString("dd-MMM-yyyy"), inv.CustomerName, "Unregistered (RCM Applicable)",
                            inv.TaxableTotal.ToString("N2"), inv.GstTotal.ToString("N2"), inv.GrandTotal.ToString("N2"));
                    }
                    lblSummaryText.Text = $"Unregistered Purchases (RCM): {list.Count}   |   Taxable Base: Rs. {list.Sum(x => x.TaxableTotal):N2}   |   RCM Tax: Rs. {list.Sum(x => x.GstTotal):N2}";
                }
                else if (currentReportCode == "STOCK_REPORT" || currentReportCode == "STOCK_SUMMARY")
                {
                    grid.Columns.Add("Code", "SKU Code");
                    grid.Columns.Add("Barcode", "Barcode");
                    grid.Columns.Add("Name", "Item Name");
                    grid.Columns.Add("Category", "Category");
                    grid.Columns.Add("Hsn", "HSN");
                    grid.Columns.Add("Stock", "Available Stock");
                    grid.Columns.Add("Cost", "Cost Price");
                    grid.Columns.Add("BasePrice", "Base Price");
                    grid.Columns.Add("Sale", "Selling Rate");
                    grid.Columns.Add("GstPct", "GST %");
                    grid.Columns.Add("Valuation", "Stock Value (Cost)");

                    var list = prof.Items.Where(it => MatchesText(it.Name, it.Code, it.Barcode, it.Category, it.HsnCode)).ToList();
                    foreach (var it in list)
                    {
                        decimal bp = it.BasePrice > 0m ? it.BasePrice : Math.Round(it.Price - (it.Price * it.GstPercent / 100m), 2);
                        grid.Rows.Add(it.Code, it.Barcode, it.Name, it.Category, it.HsnCode, $"{it.Stock:0.##} {it.Uom}",
                            it.CostPrice.ToString("N2"), bp.ToString("N2"), it.Price.ToString("N2"),
                            it.GstPercent.ToString("0.#") + "%", (it.Stock * it.CostPrice).ToString("N2"));
                    }
                    lblSummaryText.Text = $"SKUs: {list.Count}   |   Total Units in Stock: {list.Sum(x => x.Stock):0.##}   |   Stock Valuation (at Cost): Rs. {list.Sum(x => x.Stock * x.CostPrice):N2}";
                }
                else if (currentReportCode == "STOCK_OUT_REPORT")
                {
                    grid.Columns.Add("Date", "Date");
                    grid.Columns.Add("DocNo", "Document No");
                    grid.Columns.Add("Type", "Outward Type");
                    grid.Columns.Add("Party", "Customer / Recipient");
                    grid.Columns.Add("Item", "Item Description");
                    grid.Columns.Add("QtyOut", "Qty Out");
                    grid.Columns.Add("Unit", "Unit");
                    grid.Columns.Add("Rate", "Rate (Rs.)");
                    grid.Columns.Add("Amount", "Amount (Rs.)");

                    decimal totOut = 0m, totVal = 0m;
                    foreach (var inv in dateFilteredInvoices.Where(x => x.DocType == "STOCK_OUT" || x.DocType == "SALE" || x.DocType == "DELIVERY_CHALLAN"))
                    {
                        foreach (var ln in inv.Lines)
                        {
                            if (!MatchesText(inv.InvoiceNo, inv.CustomerName, ln.ItemName, ln.ItemCode)) continue;
                            totOut += ln.Qty;
                            totVal += ln.LineTotal;
                            grid.Rows.Add(inv.Date.ToString("dd-MMM-yyyy"), inv.InvoiceNo, inv.DocType, inv.CustomerName,
                                $"{ln.ItemName} [{ln.ItemCode}]", ln.Qty.ToString("0.##"), ln.Uom, ln.Rate.ToString("N2"), ln.LineTotal.ToString("N2"));
                        }
                    }
                    lblSummaryText.Text = $"Total Stock Out Qty: {totOut:0.##}   |   Total Outward Value: Rs. {totVal:N2}";
                }
                else if (currentReportCode == "CREDIT_NOTE_REPORT")
                {
                    grid.Columns.Add("DocNo", "Credit Note No");
                    grid.Columns.Add("Date", "Date");
                    grid.Columns.Add("Customer", "Customer Name");
                    grid.Columns.Add("Gstin", "GSTIN");
                    grid.Columns.Add("Items", "Items Returned");
                    grid.Columns.Add("Taxable", "Taxable (Rs.)");
                    grid.Columns.Add("Gst", "GST (Rs.)");
                    grid.Columns.Add("Total", "Credit Note Amt (Rs.)");

                    var list = dateFilteredInvoices
                        .Where(x => x.DocType == "SALE_RETURN" && MatchesText(x.InvoiceNo, x.CustomerName))
                        .ToList();
                    foreach (var inv in list)
                    {
                        grid.Rows.Add(inv.InvoiceNo, inv.Date.ToString("dd-MMM-yyyy"), inv.CustomerName, inv.CustomerGstin,
                            inv.Lines.Count, inv.TaxableTotal.ToString("N2"), inv.GstTotal.ToString("N2"), inv.GrandTotal.ToString("N2"));
                    }
                    lblSummaryText.Text = $"Credit Notes (Sales Returns): {list.Count}   |   Total Credit Note Value: Rs. {list.Sum(x => x.GrandTotal):N2}";
                }
                else if (currentReportCode == "PURCHASE_RETURN_REPORT")
                {
                    grid.Columns.Add("DocNo", "Debit Note No");
                    grid.Columns.Add("Date", "Date");
                    grid.Columns.Add("Supplier", "Supplier Name");
                    grid.Columns.Add("Gstin", "GSTIN");
                    grid.Columns.Add("Items", "Items Returned");
                    grid.Columns.Add("Taxable", "Taxable (Rs.)");
                    grid.Columns.Add("Gst", "GST (Rs.)");
                    grid.Columns.Add("Total", "Return Amount (Rs.)");

                    var list = dateFilteredInvoices
                        .Where(x => x.DocType == "PURCHASE_RETURN" && MatchesText(x.InvoiceNo, x.CustomerName))
                        .ToList();
                    foreach (var inv in list)
                    {
                        grid.Rows.Add(inv.InvoiceNo, inv.Date.ToString("dd-MMM-yyyy"), inv.CustomerName, inv.CustomerGstin,
                            inv.Lines.Count, inv.TaxableTotal.ToString("N2"), inv.GstTotal.ToString("N2"), inv.GrandTotal.ToString("N2"));
                    }
                    lblSummaryText.Text = $"Purchase Returns (Debit Notes): {list.Count}   |   Total Purchase Return Value: Rs. {list.Sum(x => x.GrandTotal):N2}";
                }
                else if (currentReportCode == "TODAYS_CASH_REPORT")
                {
                    grid.Columns.Add("Time", "Date & Time");
                    grid.Columns.Add("RefNo", "Document / Voucher No");
                    grid.Columns.Add("Type", "Transaction Type");
                    grid.Columns.Add("Party", "Customer / Supplier");
                    grid.Columns.Add("CashIn", "Cash In (+) (Rs.)");
                    grid.Columns.Add("CashOut", "Cash Out (-) (Rs.)");
                    grid.Columns.Add("Remarks", "Narration");

                    decimal cashIn = 0m, cashOut = 0m;
                    foreach (var inv in dateFilteredInvoices.Where(x => string.Equals(x.PaymentMode, "CASH", StringComparison.OrdinalIgnoreCase)))
                    {
                        if (!MatchesText(inv.InvoiceNo, inv.CustomerName)) continue;
                        decimal cIn = (inv.DocType == "SALE") ? inv.AmountReceived : 0m;
                        decimal cOut = (inv.DocType == "PURCHASE" || inv.DocType == "SALE_RETURN") ? inv.AmountReceived : 0m;
                        cashIn += cIn; cashOut += cOut;
                        grid.Rows.Add(inv.Date.ToString("dd-MMM-yyyy HH:mm"), inv.InvoiceNo, inv.DocType, inv.CustomerName,
                            cIn.ToString("N2"), cOut.ToString("N2"), inv.Notes);
                    }
                    foreach (var v in dateFilteredVouchers.Where(x => string.Equals(x.PaymentMode, "CASH", StringComparison.OrdinalIgnoreCase)))
                    {
                        if (!MatchesText(v.VoucherNo, v.PartyName, v.Narration)) continue;
                        decimal cIn = v.VoucherType == "RECEIPT" ? v.Amount : 0m;
                        decimal cOut = (v.VoucherType == "PAYMENT" || v.VoucherType == "EXPENSE") ? v.Amount : 0m;
                        cashIn += cIn; cashOut += cOut;
                        grid.Rows.Add(v.Date.ToString("dd-MMM-yyyy HH:mm"), v.VoucherNo, v.VoucherType, v.PartyName,
                            cIn.ToString("N2"), cOut.ToString("N2"), v.Narration);
                    }
                    lblSummaryText.Text = $"Total Cash In: Rs. {cashIn:N2}   |   Total Cash Out: Rs. {cashOut:N2}   |   Net Cash in Hand: Rs. {(cashIn - cashOut):N2}";
                }
                else if (currentReportCode == "BANK_STATEMENT")
                {
                    grid.Columns.Add("Date", "Date & Time");
                    grid.Columns.Add("RefNo", "Doc / Voucher No");
                    grid.Columns.Add("Mode", "Channel (UPI/NEFT/Card/Chq)");
                    grid.Columns.Add("Party", "Party Name");
                    grid.Columns.Add("Deposit", "Deposit (+) (Rs.)");
                    grid.Columns.Add("Withdrawal", "Withdrawal (-) (Rs.)");
                    grid.Columns.Add("Reference", "UTR / Chq / Ref");

                    decimal dep = 0m, wdr = 0m;
                    foreach (var inv in dateFilteredInvoices.Where(x => !string.Equals(x.PaymentMode, "CASH", StringComparison.OrdinalIgnoreCase) && !x.PaymentMode.StartsWith("CREDIT")))
                    {
                        if (!MatchesText(inv.InvoiceNo, inv.CustomerName, inv.PaymentMode, inv.PaymentReference)) continue;
                        decimal d = inv.DocType == "SALE" ? inv.AmountReceived : 0m;
                        decimal w = inv.DocType == "PURCHASE" ? inv.AmountReceived : 0m;
                        dep += d; wdr += w;
                        grid.Rows.Add(inv.Date.ToString("dd-MMM-yyyy HH:mm"), inv.InvoiceNo, inv.PaymentMode, inv.CustomerName,
                            d.ToString("N2"), w.ToString("N2"), inv.PaymentReference);
                    }
                    foreach (var v in dateFilteredVouchers.Where(x => !string.Equals(x.PaymentMode, "CASH", StringComparison.OrdinalIgnoreCase)))
                    {
                        if (!MatchesText(v.VoucherNo, v.PartyName, v.PaymentMode, v.Narration)) continue;
                        decimal d = (v.VoucherType == "RECEIPT" || v.VoucherType == "CONTRA") ? v.Amount : 0m;
                        decimal w = (v.VoucherType == "PAYMENT" || v.VoucherType == "EXPENSE") ? v.Amount : 0m;
                        dep += d; wdr += w;
                        grid.Rows.Add(v.Date.ToString("dd-MMM-yyyy HH:mm"), v.VoucherNo, v.PaymentMode, v.PartyName,
                            d.ToString("N2"), w.ToString("N2"), v.Narration);
                    }
                    lblSummaryText.Text = $"Bank Deposits: Rs. {dep:N2}   |   Bank Withdrawals: Rs. {wdr:N2}   |   Net Bank Movement: Rs. {(dep - wdr):N2}";
                }
                else if (currentReportCode == "JOURNAL_REPORT")
                {
                    grid.Columns.Add("VoucherNo", "Voucher No");
                    grid.Columns.Add("Date", "Date & Time");
                    grid.Columns.Add("Type", "Voucher Type");
                    grid.Columns.Add("Party", "Party / Account");
                    grid.Columns.Add("Head", "Ledger Head");
                    grid.Columns.Add("Mode", "Mode");
                    grid.Columns.Add("Amount", "Amount (Rs.)");
                    grid.Columns.Add("Narration", "Narration");

                    var list = dateFilteredVouchers
                        .Where(v => (v.VoucherType == "JOURNAL" || v.VoucherType == "CONTRA" || v.VoucherType == "EXPENSE") && MatchesText(v.VoucherNo, v.PartyName, v.AccountHead, v.Narration))
                        .ToList();
                    foreach (var v in list)
                    {
                        grid.Rows.Add(v.VoucherNo, v.Date.ToString("dd-MMM-yyyy HH:mm"), v.VoucherType, v.PartyName,
                            v.AccountHead, v.PaymentMode, v.Amount.ToString("N2"), v.Narration);
                    }
                    lblSummaryText.Text = $"Journal / Contra / Expense Vouchers: {list.Count}   |   Total Amount: Rs. {list.Sum(x => x.Amount):N2}";
                }
                else if (currentReportCode == "HSN_SUMMARY" || currentReportCode == "GSTR_RETURN")
                {
                    grid.Columns.Add("Hsn", "HSN Code");
                    grid.Columns.Add("Qty", "Total Qty Sold");
                    grid.Columns.Add("Taxable", "Base / Taxable Value (Rs.)");
                    grid.Columns.Add("Cgst", "CGST (Rs.)");
                    grid.Columns.Add("Sgst", "SGST (Rs.)");
                    grid.Columns.Add("Igst", "IGST (Rs.)");
                    grid.Columns.Add("TotalTax", "Total GST (Rs.)");
                    grid.Columns.Add("TotalVal", "Total Invoice Value (Rs.)");

                    var hsnGroups = dateFilteredInvoices
                        .Where(x => x.DocType == "SALE")
                        .SelectMany(x => x.Lines)
                        .Where(l => MatchesText(l.HsnCode, l.ItemName))
                        .GroupBy(l => string.IsNullOrWhiteSpace(l.HsnCode) ? "4820" : l.HsnCode)
                        .ToList();

                    foreach (var grp in hsnGroups)
                    {
                        grid.Rows.Add(
                            grp.Key,
                            grp.Sum(x => x.Qty).ToString("0.##"),
                            grp.Sum(x => x.TaxableValue).ToString("N2"),
                            grp.Sum(x => x.CgstAmount).ToString("N2"),
                            grp.Sum(x => x.SgstAmount).ToString("N2"),
                            grp.Sum(x => x.IgstAmount).ToString("N2"),
                            grp.Sum(x => x.TotalGst).ToString("N2"),
                            grp.Sum(x => x.LineTotal).ToString("N2"));
                    }
                    lblSummaryText.Text = $"HSN Groups: {hsnGroups.Count}   |   Total Taxable: Rs. {hsnGroups.SelectMany(g => g).Sum(x => x.TaxableValue):N2}   |   Total GST: Rs. {hsnGroups.SelectMany(g => g).Sum(x => x.TotalGst):N2}";
                }
                else if (currentReportCode == "PROFIT_LOSS" || currentReportCode == "BALANCE_SHEET")
                {
                    grid.Columns.Add("Particulars", "Account Head / Particulars");
                    grid.Columns.Add("Amount", "Amount (Rs.)");

                    decimal sales = prof.Invoices.Where(x => x.DocType == "SALE").Sum(x => x.TaxableTotal);
                    decimal purchases = prof.Invoices.Where(x => x.DocType == "PURCHASE").Sum(x => x.TaxableTotal);
                    decimal expenses = prof.Vouchers.Where(x => x.VoucherType == "EXPENSE").Sum(x => x.Amount);
                    decimal closingStock = prof.Items.Sum(i => i.Stock * i.CostPrice);
                    decimal netProfit = sales + closingStock - purchases - expenses;

                    grid.Rows.Add("Total Sales Revenue (Net of Tax)", sales.ToString("N2"));
                    grid.Rows.Add("Closing Inventory Valuation (At Cost)", closingStock.ToString("N2"));
                    grid.Rows.Add("Less: Total Purchases", purchases.ToString("N2"));
                    grid.Rows.Add("Less: Operating Expenses (Vouchers)", expenses.ToString("N2"));
                    grid.Rows.Add("NET PROFIT / SURPLUS FOR PERIOD", netProfit.ToString("N2"));
                    grid.Rows.Add("Total Accounts Receivable (Sundry Debtors)", prof.Customers.Sum(c => c.Outstanding).ToString("N2"));
                    grid.Rows.Add("Total Accounts Payable (Sundry Creditors)", prof.Suppliers.Sum(s => s.BalancePayable).ToString("N2"));
                    grid.Rows.Add("Total Bank Balances", prof.Banks.Sum(b => b.CurrentBalance).ToString("N2"));
                    lblSummaryText.Text = $"Net Profit / Surplus: Rs. {netProfit:N2}   |   Closing Stock Value: Rs. {closingStock:N2}";
                }
                else
                {
                    // DAY_BOOK fallback
                    grid.Columns.Add("DocNo", "Document No");
                    grid.Columns.Add("Date", "Date & Time");
                    grid.Columns.Add("Type", "Doc Type");
                    grid.Columns.Add("Party", "Party Name");
                    grid.Columns.Add("PayMode", "Payment Mode");
                    grid.Columns.Add("Taxable", "Base / Taxable (Rs.)");
                    grid.Columns.Add("Gst", "GST (Rs.)");
                    grid.Columns.Add("Grand", "Bill Total (Rs.)");

                    var list = dateFilteredInvoices.Where(x => MatchesText(x.InvoiceNo, x.CustomerName, x.DocType)).ToList();
                    foreach (var inv in list)
                    {
                        grid.Rows.Add(inv.InvoiceNo, inv.Date.ToString("dd-MMM-yyyy HH:mm"), inv.DocType, inv.CustomerName,
                            inv.PaymentMode, inv.TaxableTotal.ToString("N2"), inv.GstTotal.ToString("N2"), inv.GrandTotal.ToString("N2"));
                    }
                    lblSummaryText.Text = $"Transactions: {list.Count}   |   Total Value: Rs. {list.Sum(x => x.GrandTotal):N2}";
                }
            }

            cmbReportSwitch.SelectedIndexChanged += (s, e) =>
            {
                if (cmbReportSwitch.SelectedIndex >= 0 && cmbReportSwitch.SelectedIndex < reportCatalog.Length)
                {
                    currentReportCode = reportCatalog[cmbReportSwitch.SelectedIndex].Code;
                    currentTitle = reportCatalog[cmbReportSwitch.SelectedIndex].Title;
                    lblTitle.Text = $"REPORT: {currentTitle.ToUpperInvariant()}   [{AppStore.Data.ActiveProfile} | {AppStore.Data.ActiveFinancialYear}]";
                    if (currentReportCode == "TODAYS_CASH_REPORT")
                        dtpFrom.Value = DateTime.Today;
                    PopulateReportGrid();
                }
            };

            btnRefreshRep.Click += (s, e) => PopulateReportGrid();
            txtFilter.TextChanged += (s, e) => PopulateReportGrid();
            dtpFrom.ValueChanged += (s, e) => PopulateReportGrid();
            dtpTo.ValueChanged += (s, e) => PopulateReportGrid();

            PopulateReportGrid();

            card.Controls.Add(grid);
            card.Controls.Add(summaryBar);
            card.Controls.Add(topBar);
            _contentPanel.Controls.Add(card);
        }

        private void ExportGridToCsv(DataGridView grid, string reportName)
        {
            using var sfd = new SaveFileDialog
            {
                FileName = $"{reportName}_{DateTime.Now:yyyyMMdd}.csv",
                Filter = "CSV File (*.csv)|*.csv"
            };
            if (sfd.ShowDialog(this) != DialogResult.OK) return;

            var sb = new StringBuilder();
            var headers = grid.Columns.Cast<DataGridViewColumn>().Select(c => $"\"{c.HeaderText}\"");
            sb.AppendLine(string.Join(",", headers));

            foreach (DataGridViewRow row in grid.Rows)
            {
                if (row.IsNewRow) continue;
                var cells = row.Cells.Cast<DataGridViewCell>().Select(c => $"\"{c.Value}\"");
                sb.AppendLine(string.Join(",", cells));
            }

            File.WriteAllText(sfd.FileName, sb.ToString(), Encoding.UTF8);
            MessageBox.Show(this, "Exported report to:\n" + sfd.FileName, "CSV Export Complete", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }

        // ====================================================================
        // 5. ACCOUNTING VOUCHERS & CASH/BANK LEDGER BOOKS
        // ====================================================================
        private void ShowVoucherView(string voucherType)
        {
            _contentPanel.Controls.Clear();
            var prof = AppStore.CurrentProfile;

            var split = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 2 };
            split.RowStyles.Add(new RowStyle(SizeType.Absolute, 130f));
            split.RowStyles.Add(new RowStyle(SizeType.Percent, 100f));

            var formCard = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(12), Margin = new Padding(0, 0, 0, 8) };
            formCard.Controls.Add(new Label
            {
                Text = $"ACCOUNTING VOUCHER ENTRY — {voucherType} VOUCHER",
                Font = new Font("Segoe UI", 11f, FontStyle.Bold),
                Location = new Point(12, 6),
                AutoSize = true
            });

            var tNo = AddLabeledBox(formCard, "Voucher No:", $"{voucherType.Substring(0, 3)}-{prof.Vouchers.Count + 101}", 12, 34, 120);
            var tParty = AddLabeledBox(formCard, "Party / Account Name:", "", 142, 34, 240);
            var tHead = AddLabeledBox(formCard, "Ledger Head:", voucherType == "EXPENSE" ? "Shop Expense" : "Party Ledger", 392, 34, 160);
            var tAmt = AddLabeledBox(formCard, "Amount (Rs.):", "0.00", 562, 34, 120);
            var tMode = AddLabeledBox(formCard, "Mode (CASH/BANK/UPI):", "CASH", 692, 34, 140);
            var tNarration = AddLabeledBox(formCard, "Narration / Remarks:", "", 12, 82, 540);

            var gridCard = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(10) };
            var grid = CreateStandardGrid();
            grid.Columns.Add("No", "Voucher No");
            grid.Columns.Add("Date", "Date");
            grid.Columns.Add("Type", "Voucher Type");
            grid.Columns.Add("Party", "Party / Account");
            grid.Columns.Add("Head", "Ledger Head");
            grid.Columns.Add("Mode", "Payment Mode");
            grid.Columns.Add("Amt", "Amount (Rs.)");
            grid.Columns.Add("Narration", "Narration");

            void RefreshVouchers()
            {
                grid.Rows.Clear();
                foreach (var v in prof.Vouchers.OrderByDescending(x => x.Date))
                {
                    grid.Rows.Add(v.VoucherNo, v.Date.ToString("dd-MMM-yyyy HH:mm"), v.VoucherType, v.PartyName, v.AccountHead, v.PaymentMode, v.Amount.ToString("N2"), v.Narration);
                }
            }

            var btnSave = CreateActionButton($"+ Post {voucherType}", Color.FromArgb(22, 163, 74), 170);
            btnSave.Location = new Point(570, 96);
            btnSave.Height = 30;
            btnSave.Click += (s, e) =>
            {
                decimal.TryParse(tAmt.Text, out decimal amt);
                if (amt <= 0m) return;
                prof.Vouchers.Add(new VoucherRecord
                {
                    Id = Guid.NewGuid().ToString("N").Substring(0, 8),
                    VoucherNo = tNo.Text.Trim(),
                    Date = DateTime.Now,
                    VoucherType = voucherType,
                    PartyName = tParty.Text.Trim(),
                    AccountHead = tHead.Text.Trim(),
                    Amount = amt,
                    PaymentMode = tMode.Text.Trim(),
                    Narration = tNarration.Text.Trim(),
                    CreatedBy = AppStore.Data.CurrentUser
                });
                AppStore.SaveAtomic();
                tParty.Clear(); tAmt.Text = "0.00"; tNarration.Clear();
                RefreshVouchers();
            };

            formCard.Controls.Add(btnSave);
            gridCard.Controls.Add(grid);
            RefreshVouchers();

            split.Controls.Add(formCard, 0, 0);
            split.Controls.Add(gridCard, 0, 1);
            _contentPanel.Controls.Add(split);
        }

        private void ShowLedgerBookView(string bookType)
        {
            _contentPanel.Controls.Clear();
            var prof = AppStore.CurrentProfile;

            var card = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(14) };
            var lbl = new Label
            {
                Text = bookType == "CASH_BOOK" ? "CASH BOOK REGISTER" : "BANK BOOK REGISTER",
                Font = new Font("Segoe UI", 12f, FontStyle.Bold),
                Dock = DockStyle.Top,
                Height = 34
            };

            var grid = CreateStandardGrid();
            grid.Columns.Add("Date", "Date");
            grid.Columns.Add("Ref", "Doc / Voucher No");
            grid.Columns.Add("Particulars", "Particulars");
            grid.Columns.Add("Mode", "Mode");
            grid.Columns.Add("DebitIn", "Inflow / Receipt (Rs.)");
            grid.Columns.Add("CreditOut", "Outflow / Payment (Rs.)");

            bool isCash = bookType == "CASH_BOOK";
            foreach (var inv in prof.Invoices)
            {
                bool invIsCash = string.Equals(inv.PaymentMode, "CASH", StringComparison.OrdinalIgnoreCase);
                if (isCash == invIsCash)
                {
                    decimal inflow = inv.DocType == "SALE" ? inv.AmountReceived : 0m;
                    decimal outflow = inv.DocType == "PURCHASE" ? inv.AmountReceived : 0m;
                    grid.Rows.Add(inv.Date.ToString("dd-MMM-yyyy"), inv.InvoiceNo, inv.CustomerName, inv.PaymentMode, inflow.ToString("N2"), outflow.ToString("N2"));
                }
            }

            foreach (var v in prof.Vouchers)
            {
                bool vIsCash = string.Equals(v.PaymentMode, "CASH", StringComparison.OrdinalIgnoreCase);
                if (isCash == vIsCash)
                {
                    decimal inflow = v.VoucherType == "RECEIPT" ? v.Amount : 0m;
                    decimal outflow = (v.VoucherType == "PAYMENT" || v.VoucherType == "EXPENSE") ? v.Amount : 0m;
                    grid.Rows.Add(v.Date.ToString("dd-MMM-yyyy"), v.VoucherNo, v.PartyName, v.PaymentMode, inflow.ToString("N2"), outflow.ToString("N2"));
                }
            }

            card.Controls.Add(grid);
            card.Controls.Add(lbl);
            _contentPanel.Controls.Add(card);
        }

        // ====================================================================
        // 6. ORDERS (PO / SO), CRM LEADS & LOYALTY POINTS
        // ====================================================================
        private void ShowOrdersView(string orderType)
        {
            _contentPanel.Controls.Clear();
            var prof = AppStore.CurrentProfile;

            var split = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 2 };
            split.RowStyles.Add(new RowStyle(SizeType.Absolute, 115f));
            split.RowStyles.Add(new RowStyle(SizeType.Percent, 100f));

            var formCard = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(12), Margin = new Padding(0, 0, 0, 8) };
            formCard.Controls.Add(new Label
            {
                Text = orderType == "PO" ? "PURCHASE ORDERS (PO) MANAGEMENT" : "SALES ORDERS (SO) MANAGEMENT",
                Font = new Font("Segoe UI", 11f, FontStyle.Bold),
                Location = new Point(12, 6),
                AutoSize = true
            });

            var tNo = AddLabeledBox(formCard, "Order No:", $"{orderType}-{prof.Orders.Count + 101}", 12, 34, 120);
            var tParty = AddLabeledBox(formCard, "Party Name:", "", 142, 34, 240);
            var tPhone = AddLabeledBox(formCard, "Phone:", "", 392, 34, 140);
            var tAmt = AddLabeledBox(formCard, "Order Value (Rs.):", "0.00", 542, 34, 130);
            var tNotes = AddLabeledBox(formCard, "Delivery Terms / Notes:", "", 682, 34, 220);

            var gridCard = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(10) };
            var grid = CreateStandardGrid();
            grid.Columns.Add("OrderNo", "Order No");
            grid.Columns.Add("Date", "Order Date");
            grid.Columns.Add("Type", "Type");
            grid.Columns.Add("Party", "Party Name");
            grid.Columns.Add("Phone", "Phone");
            grid.Columns.Add("Amt", "Order Amount (Rs.)");
            grid.Columns.Add("Status", "Status");
            grid.Columns.Add("Notes", "Notes");

            void RefreshOrders()
            {
                grid.Rows.Clear();
                foreach (var o in prof.Orders.Where(x => x.OrderType == orderType))
                {
                    grid.Rows.Add(o.OrderNo, o.Date.ToString("dd-MMM-yyyy"), o.OrderType, o.PartyName, o.PartyPhone, o.TotalAmount.ToString("N2"), o.Status, o.Notes);
                }
            }

            var btnSave = CreateActionButton($"+ Create {orderType}", Color.FromArgb(22, 163, 74), 140);
            btnSave.Location = new Point(915, 48);
            btnSave.Height = 32;
            btnSave.Click += (s, e) =>
            {
                if (string.IsNullOrWhiteSpace(tParty.Text)) return;
                decimal.TryParse(tAmt.Text, out decimal amt);
                prof.Orders.Add(new PurchaseOrderRecord
                {
                    Id = Guid.NewGuid().ToString("N").Substring(0, 8),
                    OrderNo = tNo.Text.Trim(),
                    Date = DateTime.Now,
                    OrderType = orderType,
                    PartyName = tParty.Text.Trim(),
                    PartyPhone = tPhone.Text.Trim(),
                    TotalAmount = amt,
                    Status = "OPEN",
                    Notes = tNotes.Text.Trim()
                });
                AppStore.SaveAtomic();
                RefreshOrders();
            };

            formCard.Controls.Add(btnSave);
            gridCard.Controls.Add(grid);
            RefreshOrders();

            split.Controls.Add(formCard, 0, 0);
            split.Controls.Add(gridCard, 0, 1);
            _contentPanel.Controls.Add(split);
        }

        private void ShowCrmLeadsView()
        {
            _contentPanel.Controls.Clear();
            var prof = AppStore.CurrentProfile;

            var split = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 2 };
            split.RowStyles.Add(new RowStyle(SizeType.Absolute, 115f));
            split.RowStyles.Add(new RowStyle(SizeType.Percent, 100f));

            var formCard = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(12), Margin = new Padding(0, 0, 0, 8) };
            formCard.Controls.Add(new Label { Text = "CRM LEADS, INQUIRIES & FOLLOW-UPS", Font = new Font("Segoe UI", 11f, FontStyle.Bold), Location = new Point(12, 6), AutoSize = true });

            var tName = AddLabeledBox(formCard, "Prospect Name:", "", 12, 34, 200);
            var tPhone = AddLabeledBox(formCard, "Phone:", "", 222, 34, 140);
            var tTopic = AddLabeledBox(formCard, "Inquiry / Requirement:", "", 372, 34, 260);
            var tVal = AddLabeledBox(formCard, "Est. Value (Rs.):", "5000", 642, 34, 120);
            var tFollow = AddLabeledBox(formCard, "Follow-up Date:", DateTime.Today.AddDays(2).ToString("dd-MMM-yyyy"), 772, 34, 130);

            var gridCard = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(10) };
            var grid = CreateStandardGrid();
            grid.Columns.Add("Name", "Prospect Name");
            grid.Columns.Add("Phone", "Phone");
            grid.Columns.Add("Topic", "Inquiry Topic");
            grid.Columns.Add("Val", "Est. Value (Rs.)");
            grid.Columns.Add("Follow", "Follow-up Date");
            grid.Columns.Add("Status", "Status");

            void RefreshLeads()
            {
                grid.Rows.Clear();
                foreach (var l in prof.CrmLeads)
                {
                    grid.Rows.Add(l.CustomerName, l.Phone, l.InquiryTopic, l.EstimatedValue.ToString("N2"), l.FollowUpDate, l.Status);
                }
            }

            var btnSave = CreateActionButton("+ Add Lead", Color.FromArgb(22, 163, 74), 130);
            btnSave.Location = new Point(912, 48);
            btnSave.Height = 32;
            btnSave.Click += (s, e) =>
            {
                if (string.IsNullOrWhiteSpace(tName.Text)) return;
                decimal.TryParse(tVal.Text, out decimal v);
                prof.CrmLeads.Add(new CrmLeadRecord
                {
                    Id = Guid.NewGuid().ToString("N").Substring(0, 8),
                    CustomerName = tName.Text.Trim(),
                    Phone = tPhone.Text.Trim(),
                    InquiryTopic = tTopic.Text.Trim(),
                    EstimatedValue = v,
                    FollowUpDate = tFollow.Text.Trim(),
                    Status = "FOLLOW-UP"
                });
                AppStore.SaveAtomic();
                RefreshLeads();
            };

            formCard.Controls.Add(btnSave);
            gridCard.Controls.Add(grid);
            RefreshLeads();

            split.Controls.Add(formCard, 0, 0);
            split.Controls.Add(gridCard, 0, 1);
            _contentPanel.Controls.Add(split);
        }

        private void ShowLoyaltyPointsView()
        {
            _contentPanel.Controls.Clear();
            var prof = AppStore.CurrentProfile;

            var card = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(14) };
            var lbl = new Label
            {
                Text = "CUSTOMER LOYALTY REWARD POINTS (1 POINT PER RS. 100 BILLED)",
                Font = new Font("Segoe UI", 12f, FontStyle.Bold),
                Dock = DockStyle.Top,
                Height = 34
            };

            var grid = CreateStandardGrid();
            grid.Columns.Add("Id", "Customer ID");
            grid.Columns.Add("Name", "Customer Name");
            grid.Columns.Add("Phone", "Mobile");
            grid.Columns.Add("TotalBilled", "Total Billed (Rs.)");
            grid.Columns.Add("Points", "Available Loyalty Points");
            grid.Columns.Add("Value", "Redeemable Value (Rs.)");

            foreach (var c in prof.Customers)
            {
                grid.Rows.Add(c.Id, c.Name, c.Phone, c.TotalBilled.ToString("N2"), c.LoyaltyPoints, c.LoyaltyPoints.ToString("N2"));
            }

            card.Controls.Add(grid);
            card.Controls.Add(lbl);
            _contentPanel.Controls.Add(card);
        }

        // ====================================================================
        // 7. DATABASE UTILITIES (EXPLICIT MIME/EXT VALIDATION + PRINTER SETTINGS)
        // ====================================================================
        private void ShowDatabaseUtilityView(string mode)
        {
            if (mode == "IMPORT_FILE")
            {
                using var ofd = new OpenFileDialog
                {
                    Title = "Select Kanha POS Data File (.kpd, .json, .zip, .xml, .bak, .db)",
                    Filter = "Kanha POS Supported Files (*.kpd;*.json;*.zip;*.xml;*.bak;*.db)|*.kpd;*.json;*.zip;*.xml;*.bak;*.db"
                };
                if (ofd.ShowDialog(this) == DialogResult.OK)
                {
                    if (!AppStore.ValidateSupportedImportFile(ofd.FileName, out string valErr))
                    {
                        MessageBox.Show(this, valErr, "Invalid File Type Selected", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                        return;
                    }
                    if (AppStore.ImportFromAnyKpdOrJsonFile(ofd.FileName, out string msg))
                    {
                        RefreshStatusAndHeader();
                        ShowDashboard();
                        MessageBox.Show(this, msg, "Import Successful", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    }
                    else
                    {
                        MessageBox.Show(this, msg, "Kanha Format Validation Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    }
                }
                return;
            }

            if (mode == "IMPORT_FOLDER")
            {
                using var fbd = new FolderBrowserDialog { Description = "Select Folder Containing .kpd / .json / .zip / .xml Backup Files" };
                if (fbd.ShowDialog(this) == DialogResult.OK)
                {
                    if (AppStore.ImportFromFolder(fbd.SelectedPath, out string msg))
                    {
                        RefreshStatusAndHeader();
                        ShowDashboard();
                        MessageBox.Show(this, msg, "Folder Import Complete", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    }
                    else
                    {
                        MessageBox.Show(this, msg, "Folder Import Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    }
                }
                return;
            }

            if (mode == "BACKUP")
            {
                using var sfd = new SaveFileDialog
                {
                    FileName = $"KanhaPOS_Backup_{DateTime.Now:yyyyMMdd_HHmm}.kpd",
                    Filter = "Kanha POS Database (*.kpd)|*.kpd|JSON File (*.json)|*.json"
                };
                if (sfd.ShowDialog(this) == DialogResult.OK)
                {
                    AppStore.ExportBackupKpd(sfd.FileName);
                    MessageBox.Show(this, "Database Backup saved to:\n" + sfd.FileName, "Backup Complete", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
                return;
            }

            if (mode == "REMOVE_ALL")
            {
                var confirm = MessageBox.Show(this,
                    "Are you sure you want to remove all transactions in the current profile (" + AppStore.Data.ActiveProfile + ")?",
                    "Confirm Reset",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Warning);
                if (confirm == DialogResult.Yes)
                {
                    AppStore.CurrentProfile.Invoices.Clear();
                    AppStore.CurrentProfile.Vouchers.Clear();
                    AppStore.CurrentProfile.Orders.Clear();
                    AppStore.SaveAtomic();
                    ShowDashboard();
                    MessageBox.Show(this, "All transactions cleared for active profile.", "Cleared", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
                return;
            }

            if (mode == "PRINTER_SETTINGS")
            {
                ShowPrinterSettingsView();
                return;
            }

            // Network Data Setup Screen
            _contentPanel.Controls.Clear();
            var card = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(20) };
            card.Controls.Add(new Label
            {
                Text = "NETWORK DATA SETUP & MULTI-TERMINAL LAN SYNCHRONIZATION",
                Font = new Font("Segoe UI", 13f, FontStyle.Bold),
                Location = new Point(20, 16),
                AutoSize = true
            });

            var tUrl = AddLabeledBox(card, "Primary Server Host URL (LAN IP or Localhost):", AppStore.Data.ServerUrl, 20, 64, 380);
            var chkSync = new CheckBox
            {
                Text = "Enable Real-Time Multi-Branch / Multi-Terminal LAN Sync",
                Checked = AppStore.Data.NetworkSyncEnabled,
                Location = new Point(20, 124),
                AutoSize = true,
                Font = new Font("Segoe UI", 10f, FontStyle.Bold)
            };

            var btnSave = CreateActionButton("Save Network Configuration", Color.FromArgb(22, 163, 74), 240);
            btnSave.Location = new Point(20, 164);
            btnSave.Height = 38;
            btnSave.Click += (s, e) =>
            {
                AppStore.Data.ServerUrl = tUrl.Text.Trim();
                AppStore.Data.NetworkSyncEnabled = chkSync.Checked;
                AppStore.SaveAtomic();
                MessageBox.Show(this, "Network configuration saved.", "Saved", MessageBoxButtons.OK, MessageBoxIcon.Information);
            };

            var btnOpenPrinterTab = CreateActionButton("Open Thermal Printer Settings", Color.FromArgb(37, 99, 235), 240);
            btnOpenPrinterTab.Location = new Point(272, 164);
            btnOpenPrinterTab.Height = 38;
            btnOpenPrinterTab.Click += (s, e) => ShowPrinterSettingsView();

            var lblVaultPath = new Label
            {
                Text = $"Local Database Vault Path: {AppStore.VaultFilePath}",
                Location = new Point(20, 224),
                AutoSize = true,
                Font = new Font("Consolas", 9.5f),
                ForeColor = Color.DimGray
            };

            card.Controls.AddRange(new Control[] { chkSync, btnSave, btnOpenPrinterTab, lblVaultPath });
            _contentPanel.Controls.Add(card);
        }

        private void ShowPrinterSettingsView()
        {
            _contentPanel.Controls.Clear();
            var comp = AppStore.CurrentProfile.Company;

            var card = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(20) };
            card.Controls.Add(new Label
            {
                Text = "PRINTER SETTINGS — CONNECTED THERMAL & LASER PRINTERS",
                Font = new Font("Segoe UI", 13f, FontStyle.Bold),
                Location = new Point(20, 16),
                AutoSize = true
            });

            card.Controls.Add(new Label
            {
                Text = "Select Connected Thermal / POS Printer:",
                Location = new Point(20, 62),
                AutoSize = true,
                Font = new Font("Segoe UI", 9f, FontStyle.Bold)
            });

            var cmbPrinters = new ComboBox
            {
                Location = new Point(20, 84),
                Width = 380,
                DropDownStyle = ComboBoxStyle.DropDown,
                Font = new Font("Segoe UI", 10f)
            };
            try
            {
                foreach (string pName in PrinterSettings.InstalledPrinters)
                    cmbPrinters.Items.Add(pName);
            }
            catch { }
            if (!cmbPrinters.Items.Contains("Default System Thermal Printer (80mm)"))
                cmbPrinters.Items.Add("Default System Thermal Printer (80mm)");
            cmbPrinters.Text = comp.DefaultThermalPrinter;

            card.Controls.Add(new Label
            {
                Text = "Default Receipt Paper Size:",
                Location = new Point(420, 62),
                AutoSize = true,
                Font = new Font("Segoe UI", 9f, FontStyle.Bold)
            });
            var cmbPaper = new ComboBox
            {
                Location = new Point(420, 84),
                Width = 220,
                DropDownStyle = ComboBoxStyle.DropDownList,
                Font = new Font("Segoe UI", 10f)
            };
            cmbPaper.Items.AddRange(new object[] { "Thermal 80mm", "Thermal 58mm", "A4 Full Page", "A5 Landscape" });
            cmbPaper.Text = string.IsNullOrWhiteSpace(comp.DefaultPaperSize) ? "Thermal 80mm" : comp.DefaultPaperSize;

            var tTop = AddLabeledBox(card, "Top Margin (mm):", comp.MarginTopMm.ToString(), 20, 132, 130);
            var tBot = AddLabeledBox(card, "Bottom Margin (mm):", comp.MarginBottomMm.ToString(), 165, 132, 130);
            var tLeft = AddLabeledBox(card, "Left Margin (mm):", comp.MarginLeftMm.ToString(), 310, 132, 130);
            var tRight = AddLabeledBox(card, "Right Margin (mm):", comp.MarginRightMm.ToString(), 455, 132, 130);

            var chkAutoCut = new CheckBox
            {
                Text = "Send ESC/POS Auto-Cut Command After Printing Receipt",
                Checked = comp.AutoCutReceipt,
                Location = new Point(20, 195),
                AutoSize = true,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold)
            };

            var btnSavePrinter = CreateActionButton("Save Printer Configuration", Color.FromArgb(22, 163, 74), 240);
            btnSavePrinter.Location = new Point(20, 235);
            btnSavePrinter.Height = 38;
            btnSavePrinter.Click += (s, e) =>
            {
                comp.DefaultThermalPrinter = cmbPrinters.Text.Trim();
                comp.DefaultPaperSize = cmbPaper.Text;
                if (int.TryParse(tTop.Text, out int mt)) comp.MarginTopMm = mt;
                if (int.TryParse(tBot.Text, out int mb)) comp.MarginBottomMm = mb;
                if (int.TryParse(tLeft.Text, out int ml)) comp.MarginLeftMm = ml;
                if (int.TryParse(tRight.Text, out int mr)) comp.MarginRightMm = mr;
                comp.AutoCutReceipt = chkAutoCut.Checked;
                AppStore.SaveAtomic();
                MessageBox.Show(this, "Thermal printer & receipt margin settings saved.", "Printer Settings Saved", MessageBoxButtons.OK, MessageBoxIcon.Information);
            };

            card.Controls.AddRange(new Control[] { cmbPrinters, cmbPaper, chkAutoCut, btnSavePrinter });
            _contentPanel.Controls.Add(card);
        }

        // ====================================================================
        // 8. DEVELOPER / SERVER CONTROL PANEL (WITH DEVICE REVOKE / SUSPEND)
        // ====================================================================
        private void ShowDeveloperPanelWithPassword()
        {
            using var pwdDlg = new Form
            {
                Text = "Developer / Server Authentication",
                Size = new Size(380, 200),
                StartPosition = FormStartPosition.CenterParent,
                FormBorderStyle = FormBorderStyle.FixedDialog,
                MaximizeBox = false,
                MinimizeBox = false,
                BackColor = Color.White
            };

            var lbl = new Label { Text = "Enter Developer Password:", Location = new Point(20, 20), AutoSize = true, Font = new Font("Segoe UI", 9.5f, FontStyle.Bold) };
            var txt = new TextBox { Location = new Point(20, 48), Width = 320, UseSystemPasswordChar = true, Font = new Font("Segoe UI", 11f) };
            var btn = CreateActionButton("Unlock Developer Panel", Color.FromArgb(15, 23, 42), 320);
            btn.Location = new Point(20, 92);
            btn.Height = 38;
            btn.Click += (s, e) =>
            {
                if (AppStore.VerifyDeveloperPassword(txt.Text))
                {
                    pwdDlg.DialogResult = DialogResult.OK;
                    pwdDlg.Close();
                }
                else
                {
                    MessageBox.Show(pwdDlg, "Invalid developer password.", "Access Denied", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            };

            pwdDlg.Controls.AddRange(new Control[] { lbl, txt, btn });
            pwdDlg.AcceptButton = btn;
            if (pwdDlg.ShowDialog(this) != DialogResult.OK) return;

            _contentPanel.Controls.Clear();
            var split = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 2 };
            split.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50f));
            split.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50f));
            split.RowStyles.Add(new RowStyle(SizeType.Percent, 55f));
            split.RowStyles.Add(new RowStyle(SizeType.Percent, 45f));

            // Panel 1: Paired Devices & Revoke / Suspend Enforcement
            var devCard = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(10), Margin = new Padding(4) };
            var devTopBar = new Panel { Dock = DockStyle.Top, Height = 34 };
            devTopBar.Controls.Add(new Label
            {
                Text = "PAIRED POS / ANDROID TERMINALS (REVOKE / SUSPEND)",
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                Location = new Point(2, 6),
                AutoSize = true
            });

            var devGrid = CreateStandardGrid();
            devGrid.Columns.Add("Id", "Device ID");
            devGrid.Columns.Add("Name", "Device Name");
            devGrid.Columns.Add("Platform", "Platform");
            devGrid.Columns.Add("Ip", "IP Address");
            devGrid.Columns.Add("Status", "Status");

            void ReloadDevicesGrid()
            {
                devGrid.Rows.Clear();
                foreach (var d in AppStore.Data.PairedDevices)
                {
                    int idx = devGrid.Rows.Add(d.DeviceId, d.DeviceName, d.Platform, d.IpAddress, d.Status);
                    if (d.Status == "REVOKED" || d.Status == "SUSPENDED")
                        devGrid.Rows[idx].DefaultCellStyle.ForeColor = Color.FromArgb(220, 38, 38);
                }
            }
            ReloadDevicesGrid();

            void ChangeSelectedDeviceStatus(string newStatus)
            {
                if (devGrid.SelectedRows.Count == 0) return;
                string devId = devGrid.SelectedRows[0].Cells[0].Value?.ToString();
                if (string.IsNullOrEmpty(devId)) return;
                AppStore.SetDeviceStatus(devId, newStatus);
                ReloadDevicesGrid();

                // If the current terminal was suspended or revoked, immediately enforce lockout!
                EnforceDeviceActiveGuard();
            }

            var btnSuspend = CreateActionButton("Suspend", Color.FromArgb(217, 119, 6), 85);
            btnSuspend.Location = new Point(320, 2);
            btnSuspend.Height = 28;
            btnSuspend.Click += (s, e) => ChangeSelectedDeviceStatus("SUSPENDED");

            var btnRevoke = CreateActionButton("Revoke", Color.FromArgb(220, 38, 38), 85);
            btnRevoke.Location = new Point(410, 2);
            btnRevoke.Height = 28;
            btnRevoke.Click += (s, e) => ChangeSelectedDeviceStatus("REVOKED");

            var btnActivate = CreateActionButton("Activate", Color.FromArgb(22, 163, 74), 85);
            btnActivate.Location = new Point(500, 2);
            btnActivate.Height = 28;
            btnActivate.Click += (s, e) => ChangeSelectedDeviceStatus("ONLINE");

            devTopBar.Controls.AddRange(new Control[] { btnSuspend, btnRevoke, btnActivate });
            devCard.Controls.Add(devGrid);
            devCard.Controls.Add(devTopBar);

            // Panel 2: User Credentials Manager
            var usrCard = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(10), Margin = new Padding(4) };
            usrCard.Controls.Add(new Label { Text = "OPERATOR CREDENTIALS & PROFILE ACCESS", Font = new Font("Segoe UI", 10f, FontStyle.Bold), Dock = DockStyle.Top, Height = 26 });
            var usrGrid = CreateStandardGrid();
            usrGrid.Columns.Add("User", "Username");
            usrGrid.Columns.Add("Pass", "Password");
            usrGrid.Columns.Add("Role", "Role");
            usrGrid.Columns.Add("Profile", "Default Profile");
            foreach (var u in AppStore.Data.Users)
                usrGrid.Rows.Add(u.Username, u.Password, u.Role, u.DefaultProfile);
            usrCard.Controls.Add(usrGrid);

            // Panel 3: Offline Sync Queue
            var syncCard = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(10), Margin = new Padding(4) };
            syncCard.Controls.Add(new Label { Text = "OFFLINE SYNC & REPLICATION QUEUE", Font = new Font("Segoe UI", 10f, FontStyle.Bold), Dock = DockStyle.Top, Height = 26 });
            var syncGrid = CreateStandardGrid();
            syncGrid.Columns.Add("Id", "Queue ID");
            syncGrid.Columns.Add("Device", "Device");
            syncGrid.Columns.Add("Op", "Operation");
            syncGrid.Columns.Add("Doc", "Document No");
            syncGrid.Columns.Add("Status", "Sync Status");
            foreach (var q in AppStore.Data.OfflineSyncQueue)
                syncGrid.Rows.Add(q.QueueId, q.DeviceId, q.Operation, q.DocumentNo, q.SyncStatus);
            syncCard.Controls.Add(syncGrid);

            // Panel 4: System Audit Trail
            var logCard = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(10), Margin = new Padding(4) };
            logCard.Controls.Add(new Label { Text = "SECURITY & TRANSACTION AUDIT LOGS", Font = new Font("Segoe UI", 10f, FontStyle.Bold), Dock = DockStyle.Top, Height = 26 });
            var logGrid = CreateStandardGrid();
            logGrid.Columns.Add("Time", "Timestamp");
            logGrid.Columns.Add("User", "User");
            logGrid.Columns.Add("Profile", "Profile");
            logGrid.Columns.Add("Action", "Action");
            logGrid.Columns.Add("Details", "Details");
            foreach (var l in AppStore.Data.AuditLogs.OrderByDescending(x => x.Timestamp).Take(50))
                logGrid.Rows.Add(l.Timestamp.ToString("dd-MMM HH:mm:ss"), l.User, l.Profile, l.Action, l.Details);
            logCard.Controls.Add(logGrid);

            split.Controls.Add(devCard, 0, 0);
            split.Controls.Add(usrCard, 1, 0);
            split.Controls.Add(syncCard, 0, 1);
            split.Controls.Add(logCard, 1, 1);
            _contentPanel.Controls.Add(split);
        }

        // ====================================================================
        // SHARED UI HELPERS
        // ====================================================================
        private static TextBox AddLabeledBox(Control parent, string labelText, string defaultVal, int x, int y, int width)
        {
            var lbl = new Label
            {
                Text = labelText,
                Location = new Point(x, y),
                AutoSize = true,
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(51, 65, 85)
            };
            var txt = new TextBox
            {
                Text = defaultVal ?? "",
                Location = new Point(x, y + 18),
                Width = width,
                Font = new Font("Segoe UI", 9.5f)
            };
            parent.Controls.Add(lbl);
            parent.Controls.Add(txt);
            return txt;
        }

        private static Button CreateActionButton(string text, Color backColor, int width)
        {
            var btn = new Button
            {
                Text = text,
                Width = width,
                Height = 34,
                BackColor = backColor,
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btn.FlatAppearance.BorderSize = 0;
            return btn;
        }

        private static DataGridView CreateStandardGrid()
        {
            var grid = new DataGridView
            {
                Dock = DockStyle.Fill,
                BackgroundColor = Color.White,
                BorderStyle = BorderStyle.None,
                AllowUserToAddRows = false,
                AllowUserToDeleteRows = false,
                ReadOnly = true,
                SelectionMode = DataGridViewSelectionMode.FullRowSelect,
                MultiSelect = false,
                AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
                RowHeadersVisible = false,
                EnableHeadersVisualStyles = false,
                Font = new Font("Segoe UI", 9f)
            };
            grid.ColumnHeadersDefaultCellStyle.BackColor = Color.FromArgb(241, 245, 249);
            grid.ColumnHeadersDefaultCellStyle.ForeColor = Color.FromArgb(15, 23, 42);
            grid.ColumnHeadersDefaultCellStyle.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
            grid.ColumnHeadersHeight = 32;
            grid.RowTemplate.Height = 28;
            grid.AlternatingRowsDefaultCellStyle.BackColor = Color.FromArgb(248, 250, 252);
            return grid;
        }
    }
}
