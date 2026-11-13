using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Printing;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Windows.Forms;
using KanhaPosServer;

namespace POSApp
{
    public static class BillingEngine
    {
        // ====================================================================
        // 1. AMOUNT IN WORDS (INDIAN NUMBERING SYSTEM)
        // ====================================================================
        private static readonly string[] UnitsMap =
        {
            "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
            "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
        };

        private static readonly string[] TensMap =
        {
            "Zero", "Ten", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
        };

        public static string NumberToIndianWords(decimal amount)
        {
            long rupees = (long)Math.Floor(Math.Abs(amount));
            int paise = (int)Math.Round((Math.Abs(amount) - rupees) * 100m);

            string words = ConvertWholeNumber(rupees).Trim();
            if (string.IsNullOrEmpty(words)) words = "Zero";

            var sb = new StringBuilder();
            sb.Append("Rupees ").Append(words);
            if (paise > 0)
            {
                sb.Append(" and ").Append(ConvertWholeNumber(paise).Trim()).Append(" Paise");
            }
            sb.Append(" Only");
            return sb.ToString();
        }

        private static string ConvertWholeNumber(long n)
        {
            if (n == 0) return "";
            if (n < 0) return "Minus " + ConvertWholeNumber(Math.Abs(n));

            var sb = new StringBuilder();

            if ((n / 10000000) > 0)
            {
                sb.Append(ConvertWholeNumber(n / 10000000)).Append(" Crore ");
                n %= 10000000;
            }
            if ((n / 100000) > 0)
            {
                sb.Append(ConvertWholeNumber(n / 100000)).Append(" Lakh ");
                n %= 100000;
            }
            if ((n / 1000) > 0)
            {
                sb.Append(ConvertWholeNumber(n / 1000)).Append(" Thousand ");
                n %= 1000;
            }
            if ((n / 100) > 0)
            {
                sb.Append(ConvertWholeNumber(n / 100)).Append(" Hundred ");
                n %= 100;
            }
            if (n > 0)
            {
                if (sb.Length > 0) sb.Append("and ");
                if (n < 20)
                    sb.Append(UnitsMap[n]);
                else
                {
                    sb.Append(TensMap[n / 10]);
                    if ((n % 10) > 0)
                        sb.Append("-").Append(UnitsMap[n % 10]);
                }
            }

            return sb.ToString().Trim();
        }

        // ====================================================================
        // 2. UPI PAYLOAD & QR BITMAP RENDERER (ISO/IEC 18004 MATRIX)
        // ====================================================================
        public static string BuildUpiDeepLink(CompanyInfo comp, decimal amount, string invoiceNo)
        {
            string upi = string.IsNullOrWhiteSpace(comp.UpiId) ? "kanha.pos@upi" : comp.UpiId.Trim();
            string payee = Uri.EscapeDataString(string.IsNullOrWhiteSpace(comp.UpiPayeeName) ? comp.Name : comp.UpiPayeeName.Trim());
            string note = Uri.EscapeDataString($"Inv {invoiceNo}");
            string amt = Math.Max(0m, amount).ToString("0.00", CultureInfo.InvariantCulture);
            return $"upi://pay?pa={upi}&pn={payee}&am={amt}&cu=INR&tn={note}";
        }

        public static Bitmap RenderQrBitmap(string payload, int pixelSize = 220)
        {
            bool[,] matrix = QrCodeEncoder.EncodeByteMode(payload ?? "upi://pay");
            int modules = matrix.GetLength(0);
            int quietZone = 4;
            int totalModules = modules + quietZone * 2;
            int scale = Math.Max(2, pixelSize / totalModules);
            int imgSize = totalModules * scale;

            var bmp = new Bitmap(imgSize, imgSize);
            using (var g = Graphics.FromImage(bmp))
            {
                g.SmoothingMode = SmoothingMode.None;
                g.InterpolationMode = InterpolationMode.NearestNeighbor;
                g.PixelOffsetMode = PixelOffsetMode.Half;
                g.Clear(Color.White);

                using var blackBrush = new SolidBrush(Color.Black);
                for (int r = 0; r < modules; r++)
                {
                    for (int c = 0; c < modules; c++)
                    {
                        if (matrix[r, c])
                        {
                            g.FillRectangle(blackBrush, (c + quietZone) * scale, (r + quietZone) * scale, scale, scale);
                        }
                    }
                }
            }
            return bmp;
        }

        // ====================================================================
        // 3. SIGNATURE & IMAGE DATA URL HELPER (ASPECT-RATIO PRESERVING)
        // ====================================================================
        public static Image TryDecodeImageFromDataUrlOrPath(string dataUrlOrPath)
        {
            if (string.IsNullOrWhiteSpace(dataUrlOrPath)) return null;
            try
            {
                string trimmed = dataUrlOrPath.Trim();
                if (trimmed.StartsWith("data:image", StringComparison.OrdinalIgnoreCase))
                {
                    int commaIdx = trimmed.IndexOf(',');
                    if (commaIdx > 0 && commaIdx + 1 < trimmed.Length)
                    {
                        string base64 = trimmed.Substring(commaIdx + 1);
                        byte[] bytes = Convert.FromBase64String(base64);
                        using var ms = new MemoryStream(bytes);
                        using var temp = Image.FromStream(ms);
                        return new Bitmap(temp);
                    }
                }
                else if (File.Exists(trimmed))
                {
                    using var fs = new FileStream(trimmed, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
                    using var temp = Image.FromStream(fs);
                    return new Bitmap(temp);
                }
            }
            catch { }
            return null;
        }

        public static void DrawImagePreservingAspectRatio(Graphics g, Image img, RectangleF targetBounds)
        {
            if (g == null || img == null || img.Width <= 0 || img.Height <= 0) return;
            float ratioX = targetBounds.Width / img.Width;
            float ratioY = targetBounds.Height / img.Height;
            float ratio = Math.Min(ratioX, ratioY);

            float drawW = img.Width * ratio;
            float drawH = img.Height * ratio;
            float drawX = targetBounds.X + (targetBounds.Width - drawW) / 2f;
            float drawY = targetBounds.Y + (targetBounds.Height - drawH) / 2f;

            var prevInterp = g.InterpolationMode;
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.DrawImage(img, new RectangleF(drawX, drawY, drawW, drawH));
            g.InterpolationMode = prevInterp;
        }

        // ====================================================================
        // 4. STANDALONE NATIVE PDF 1.4 WRITER (ZERO EXTERNAL DEPENDENCIES)
        // ====================================================================
        public static byte[] GenerateInvoicePdfBytes(InvoiceRecord inv, CompanyInfo comp, string paperFormat = "A4")
        {
            bool isGst = string.Equals(inv.Profile, "GST", StringComparison.OrdinalIgnoreCase);
            bool isInterState = inv.IgstTotal > 0m;

            float pageW = 595f;
            float pageH = 842f;
            if (string.Equals(paperFormat, "A5", StringComparison.OrdinalIgnoreCase))
            {
                pageW = 595f;
                pageH = 420f;
            }
            else if (string.Equals(paperFormat, "THERMAL", StringComparison.OrdinalIgnoreCase))
            {
                pageW = 226f;
                pageH = Math.Max(520f, 320f + inv.Lines.Count * 22f);
            }

            var s = new StringBuilder();
            float margin = 24f;
            float contentW = pageW - margin * 2f;
            float topY = pageH - margin;

            void Rect(float x, float yTop, float w, float h, float lineW = 0.7f)
            {
                float pdfY = pageH - yTop - h;
                s.AppendFormat(CultureInfo.InvariantCulture, "{0:0.##} w {1:0.##} {2:0.##} {3:0.##} {4:0.##} re S\n", lineW, x, pdfY, w, h);
            }

            void FillRect(float x, float yTop, float w, float h, float r, float gCol, float bCol)
            {
                float pdfY = pageH - yTop - h;
                s.AppendFormat(CultureInfo.InvariantCulture, "{0:0.##} {1:0.##} {2:0.##} rg {3:0.##} {4:0.##} {5:0.##} {6:0.##} re f 0 0 0 rg\n",
                    r, gCol, bCol, x, pdfY, w, h);
            }

            void Line(float x1, float y1Top, float x2, float y2Top, float lineW = 0.5f)
            {
                s.AppendFormat(CultureInfo.InvariantCulture, "{0:0.##} w {1:0.##} {2:0.##} m {3:0.##} {4:0.##} l S\n",
                    lineW, x1, pageH - y1Top, x2, pageH - y2Top);
            }

            void Text(string txt, float x, float yTop, float fontSize = 9f, bool bold = false)
            {
                if (string.IsNullOrEmpty(txt)) return;
                string font = bold ? "/F2" : "/F1";
                string escaped = EscapePdfText(txt);
                float pdfY = pageH - yTop - fontSize;
                s.AppendFormat(CultureInfo.InvariantCulture, "BT {0} {1:0.##} Tf {2:0.##} {3:0.##} Td ({4}) Tj ET\n",
                    font, fontSize, x, pdfY, escaped);
            }

            string firmDisplayName = string.IsNullOrWhiteSpace(comp.Name) ? "ENTERPRISE POS & BILLING" : comp.Name.ToUpperInvariant();
            string docTitle = ResolveDocumentTitle(inv, isGst);

            // Outer border
            Rect(margin, margin, contentW, pageH - margin * 2f, 1.0f);

            // Header Banner
            FillRect(margin, margin, contentW, 58f, 0.06f, 0.14f, 0.26f);
            s.Append("1 1 1 rg\n");
            Text(firmDisplayName, margin + 10f, margin + 8f, 13.5f, true);
            if (!string.IsNullOrWhiteSpace(comp.Tagline))
                Text(comp.Tagline, margin + 10f, margin + 25f, 8.5f, false);
            string addrParts = string.Join(", ", new[] { comp.Address, comp.City, comp.State }.Where(x => !string.IsNullOrWhiteSpace(x)));
            if (!string.IsNullOrWhiteSpace(comp.Pincode)) addrParts += " - " + comp.Pincode;
            if (!string.IsNullOrWhiteSpace(comp.Phone)) addrParts += (string.IsNullOrEmpty(addrParts) ? "" : " | ") + "Ph: " + comp.Phone;
            if (!string.IsNullOrWhiteSpace(addrParts))
                Text(addrParts, margin + 10f, margin + 39f, 8f, false);

            Text(docTitle, pageW - margin - 185f, margin + 10f, 10.5f, true);
            if (isGst && !string.IsNullOrWhiteSpace(comp.Gstin))
                Text("GSTIN: " + comp.Gstin, pageW - margin - 185f, margin + 26f, 8.5f, true);
            Text("Doc No: " + inv.InvoiceNo, pageW - margin - 185f, margin + 40f, 8.5f, true);
            s.Append("0 0 0 rg\n");

            float y = margin + 58f;
            Line(margin, y, pageW - margin, y, 0.8f);

            // Buyer & Invoice Meta Section
            float metaH = 64f;
            float midX = margin + contentW * 0.54f;
            Line(midX, y, midX, y + metaH, 0.6f);

            string partyHeading = inv.DocType != null && inv.DocType.StartsWith("PURCHASE", StringComparison.OrdinalIgnoreCase)
                ? "SUPPLIER / VENDOR DETAILS:"
                : "BILL TO / PARTY DETAILS:";
            Text(partyHeading, margin + 8f, y + 5f, 8f, true);
            Text(string.IsNullOrWhiteSpace(inv.CustomerName) ? "WALK-IN CUSTOMER" : inv.CustomerName, margin + 8f, y + 17f, 10f, true);
            if (!string.IsNullOrWhiteSpace(inv.CustomerAddress))
                Text("Address: " + inv.CustomerAddress, margin + 8f, y + 31f, 8f, false);
            Text($"Phone: {(string.IsNullOrWhiteSpace(inv.CustomerPhone) ? "-" : inv.CustomerPhone)}   |   Place of Supply: {inv.PlaceOfSupply}", margin + 8f, y + 43f, 8f, false);
            if (isGst)
                Text("Party GSTIN: " + (string.IsNullOrWhiteSpace(inv.CustomerGstin) ? "Unregistered" : inv.CustomerGstin), margin + 8f, y + 54f, 8f, true);

            Text($"Document No : {inv.InvoiceNo}", midX + 8f, y + 6f, 9f, true);
            Text($"Date        : {inv.Date:dd-MMM-yyyy hh:mm tt}", midX + 8f, y + 20f, 8.5f, false);
            Text($"Pay Mode    : {inv.PaymentMode} {(string.IsNullOrWhiteSpace(inv.PaymentReference) ? "" : "(" + inv.PaymentReference + ")")}", midX + 8f, y + 34f, 8f, false);
            Text($"Sales Rep   : {(string.IsNullOrWhiteSpace(inv.Salesperson) ? "Counter-1" : inv.Salesperson)}", midX + 8f, y + 48f, 8f, false);

            y += metaH;
            Line(margin, y, pageW - margin, y, 0.8f);

            // Table Header
            FillRect(margin, y, contentW, 20f, 0.91f, 0.94f, 0.98f);
            Text("#", margin + 5f, y + 5f, 8f, true);
            Text("Item / Product Description", margin + 24f, y + 5f, 8f, true);
            Text("HSN", margin + 210f, y + 5f, 8f, true);
            Text("Qty", margin + 250f, y + 5f, 8f, true);
            Text("Rate (Rs.)", margin + 290f, y + 5f, 8f, true);
            Text("Disc%", margin + 345f, y + 5f, 8f, true);
            Text("Taxable (Rs.)", margin + 382f, y + 5f, 8f, true);
            if (isGst)
            {
                Text("GST%", margin + 442f, y + 5f, 8f, true);
                Text("GST Amt", margin + 472f, y + 5f, 8f, true);
            }
            Text("Amount (Rs.)", margin + 506f, y + 5f, 8f, true);

            y += 20f;
            Line(margin, y, pageW - margin, y, 0.7f);

            int sno = 1;
            foreach (var ln in inv.Lines)
            {
                if (y > pageH - 190f) break;
                Text(sno.ToString(), margin + 5f, y + 3f, 8f, false);
                string desc = ln.ItemName.Length > 35 ? ln.ItemName.Substring(0, 35) : ln.ItemName;
                Text(desc, margin + 24f, y + 3f, 8f, false);
                Text(ln.HsnCode, margin + 210f, y + 3f, 7.5f, false);
                Text($"{ln.Qty:0.##} {ln.Uom}", margin + 248f, y + 3f, 7.5f, false);
                Text($"{ln.Rate:N2}", margin + 292f, y + 3f, 8f, false);
                Text($"{ln.DiscountPercent:0.#}%", margin + 346f, y + 3f, 7.5f, false);
                Text($"{ln.TaxableValue:N2}", margin + 384f, y + 3f, 8f, false);
                if (isGst)
                {
                    Text($"{ln.GstPercent:0.#}%", margin + 444f, y + 3f, 7.5f, false);
                    Text($"{ln.TotalGst:N2}", margin + 474f, y + 3f, 8f, false);
                }
                Text($"{ln.LineTotal:N2}", margin + 504f, y + 3f, 8.5f, true);

                y += 16f;
                Line(margin, y, pageW - margin, y, 0.25f);
                sno++;
            }

            // HSN Summary & Totals Block at bottom
            float footerTop = Math.Max(y + 10f, pageH - 205f);
            Line(margin, footerTop, pageW - margin, footerTop, 0.9f);

            float totalsX = margin + contentW * 0.54f;
            Line(totalsX, footerTop, totalsX, pageH - margin, 0.8f);

            decimal netPayable = inv.NetPayableTotal > 0m
                ? inv.NetPayableTotal
                : Math.Max(0m, inv.GrandTotal + inv.PreviousBalance - inv.AdjustedCreditAmount);

            Text("AMOUNT IN WORDS:", margin + 8f, footerTop + 6f, 8f, true);
            string words = NumberToIndianWords(netPayable);
            if (words.Length > 58)
            {
                Text(words.Substring(0, 58), margin + 8f, footerTop + 18f, 8.5f, true);
                Text(words.Substring(58), margin + 8f, footerTop + 30f, 8.5f, true);
            }
            else
            {
                Text(words, margin + 8f, footerTop + 18f, 8.5f, true);
            }

            if (!string.IsNullOrWhiteSpace(comp.BankName) || !string.IsNullOrWhiteSpace(comp.BankAccountNo) || !string.IsNullOrWhiteSpace(comp.UpiId))
            {
                Text($"Bank: {comp.BankName} {(string.IsNullOrWhiteSpace(comp.BankBranch) ? "" : "(" + comp.BankBranch + ")")}", margin + 8f, footerTop + 44f, 8f, true);
                Text($"A/C No: {comp.BankAccountNo}   |   IFSC: {comp.BankIfsc}   |   UPI: {comp.UpiId}", margin + 8f, footerTop + 56f, 8f, false);
            }

            // Embedded Vector QR in PDF
            if (!string.IsNullOrWhiteSpace(comp.UpiId))
            {
                string upiLink = BuildUpiDeepLink(comp, netPayable, inv.InvoiceNo);
                bool[,] qr = QrCodeEncoder.EncodeByteMode(upiLink);
                int qDim = qr.GetLength(0);
                float cell = 1.65f;
                float qStartX = margin + 8f;
                float qStartY = footerTop + 72f;
                for (int r = 0; r < qDim; r++)
                {
                    for (int c = 0; c < qDim; c++)
                    {
                        if (qr[r, c])
                        {
                            FillRect(qStartX + c * cell, qStartY + r * cell, cell, cell, 0f, 0f, 0f);
                        }
                    }
                }
                Text("Scan to Pay via UPI", qStartX + qDim * cell + 8f, qStartY + 12f, 8f, true);
                Text("UPI ID: " + comp.UpiId, qStartX + qDim * cell + 8f, qStartY + 24f, 7.5f, false);
            }

            // Right Totals Column with clear alignment & prominent Grand Total box
            float ty = footerTop + 6f;
            float valX = pageW - margin - 92f;
            Text("Sub Total (Gross)", totalsX + 10f, ty, 8f, false);
            Text($"Rs. {inv.SubTotal:N2}", valX, ty, 8f, true); ty += 13f;

            Text("Less: Item + Bill Discount", totalsX + 10f, ty, 8f, false);
            Text($"Rs. {inv.DiscountTotal:N2}", valX, ty, 8f, false); ty += 13f;

            Text("Taxable / Base Value", totalsX + 10f, ty, 8.5f, true);
            Text($"Rs. {inv.TaxableTotal:N2}", valX, ty, 8.5f, true); ty += 13f;

            if (isGst)
            {
                if (isInterState)
                {
                    Text("Add: IGST Amount", totalsX + 10f, ty, 8f, false);
                    Text($"Rs. {inv.IgstTotal:N2}", valX, ty, 8f, false); ty += 13f;
                }
                else
                {
                    Text("Add: CGST + SGST", totalsX + 10f, ty, 8f, false);
                    Text($"Rs. {(inv.CgstTotal + inv.SgstTotal):N2}", valX, ty, 8f, false); ty += 13f;
                }
            }

            Text($"Bill Amount (Round: {inv.RoundOff:+0.00;-0.00;0.00})", totalsX + 10f, ty, 8.5f, true);
            Text($"Rs. {inv.GrandTotal:N2}", valX, ty, 8.5f, true); ty += 13f;

            if (inv.PreviousBalance > 0m)
            {
                Text("Add: Previous Balance", totalsX + 10f, ty, 8f, false);
                Text($"+ Rs. {inv.PreviousBalance:N2}", valX, ty, 8f, true); ty += 13f;
            }
            if (inv.AdjustedCreditAmount > 0m)
            {
                Text("Less: Adjusted Credit", totalsX + 10f, ty, 8f, false);
                Text($"- Rs. {inv.AdjustedCreditAmount:N2}", valX, ty, 8f, true); ty += 13f;
            }

            // Prominent TOTAL AMOUNT Box
            FillRect(totalsX + 6f, ty - 1f, pageW - margin - totalsX - 12f, 24f, 0.06f, 0.14f, 0.26f);
            s.Append("1 1 1 rg\n");
            Text("TOTAL AMOUNT", totalsX + 12f, ty + 4f, 10.5f, true);
            Text($"Rs. {netPayable:N2}", pageW - margin - 108f, ty + 4f, 11f, true);
            s.Append("0 0 0 rg\n");
            ty += 27f;

            Text($"Received: Rs. {inv.AmountReceived:N2}   |   Balance Due: Rs. {inv.BalanceDue:N2}", totalsX + 10f, ty, 8f, true);

            return AssembleSinglePagePdf(s.ToString(), pageW, pageH);
        }

        private static string ResolveDocumentTitle(InvoiceRecord inv, bool isGst)
        {
            string dt = (inv?.DocType ?? "SALE").ToUpperInvariant();
            if (dt == "ESTIMATE") return "PROFORMA INVOICE / QUOTATION";
            if (dt == "PURCHASE") return "PURCHASE INVOICE";
            if (dt == "STOCK_OUT") return "STOCK OUT / ISSUE VOUCHER";
            if (dt == "SALE_RETURN") return "CREDIT NOTE / SALES RETURN";
            if (dt == "PURCHASE_RETURN") return "DEBIT NOTE / PURCHASE RETURN";
            if (dt == "DELIVERY_CHALLAN") return "DELIVERY CHALLAN";
            return isGst ? "TAX INVOICE" : "BILL OF SUPPLY";
        }

        private static string EscapePdfText(string input)
        {
            if (string.IsNullOrEmpty(input)) return "";
            var sb = new StringBuilder(input.Length);
            foreach (char ch in input)
            {
                if (ch == '(' || ch == ')' || ch == '\\')
                    sb.Append('\\').Append(ch);
                else if (ch >= 32 && ch <= 126)
                    sb.Append(ch);
                else
                    sb.Append(' ');
            }
            return sb.ToString();
        }

        private static byte[] AssembleSinglePagePdf(string contentStream, float width, float height)
        {
            byte[] streamBytes = Encoding.ASCII.GetBytes(contentStream);
            var objects = new List<string>
            {
                "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
                "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
                string.Format(CultureInfo.InvariantCulture,
                    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {0:0.##} {1:0.##}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n",
                    width, height),
                "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
                "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n",
                $"6 0 obj\n<< /Length {streamBytes.Length} >>\nstream\n{contentStream}endstream\nendobj\n"
            };

            using var ms = new MemoryStream();
            void WriteAscii(string str)
            {
                byte[] b = Encoding.ASCII.GetBytes(str);
                ms.Write(b, 0, b.Length);
            }

            WriteAscii("%PDF-1.4\n");
            var offsets = new List<long>();
            foreach (var obj in objects)
            {
                offsets.Add(ms.Position);
                WriteAscii(obj);
            }

            long xrefPos = ms.Position;
            WriteAscii($"xref\n0 {objects.Count + 1}\n");
            WriteAscii("0000000000 65535 f \n");
            foreach (long off in offsets)
            {
                WriteAscii($"{off:D10} 00000 n \n");
            }

            WriteAscii($"trailer\n<< /Size {objects.Count + 1} /Root 1 0 R >>\nstartxref\n{xrefPos}\n%%EOF");
            return ms.ToArray();
        }

        // ====================================================================
        // 5. GDI+ PRINT DOCUMENT RENDERER (A4, A5 LANDSCAPE, 80MM THERMAL)
        // ====================================================================
        public static void ShowInvoicePrintPreview(Form owner, InvoiceRecord inv, CompanyInfo comp, string paperFormat = "A4")
        {
            using var pd = CreateInvoicePrintDocument(inv, comp, paperFormat);
            using var dlg = new PrintPreviewDialog
            {
                Document = pd,
                Width = 1120,
                Height = 860,
                StartPosition = FormStartPosition.CenterParent,
                Text = $"Bill Performa & Print Preview ({paperFormat}) — {inv.InvoiceNo}"
            };
            try
            {
                foreach (Control c in dlg.Controls)
                {
                    if (c is PrintPreviewControl ppc)
                        ppc.Zoom = 1.0;
                }
            }
            catch { }
            dlg.ShowDialog(owner);
        }

        public static PrintDocument CreateInvoicePrintDocument(InvoiceRecord inv, CompanyInfo comp, string paperFormat)
        {
            var pd = new PrintDocument { DocumentName = inv.InvoiceNo };

            // Apply configured thermal printer if available
            if (!string.IsNullOrWhiteSpace(comp?.DefaultThermalPrinter))
            {
                foreach (string installed in PrinterSettings.InstalledPrinters)
                {
                    if (string.Equals(installed, comp.DefaultThermalPrinter, StringComparison.OrdinalIgnoreCase))
                    {
                        pd.PrinterSettings.PrinterName = installed;
                        break;
                    }
                }
            }

            if (string.Equals(paperFormat, "A5", StringComparison.OrdinalIgnoreCase))
            {
                pd.DefaultPageSettings.Landscape = true;
            }
            else if (string.Equals(paperFormat, "THERMAL", StringComparison.OrdinalIgnoreCase))
            {
                pd.DefaultPageSettings.PaperSize = new PaperSize("Thermal80mm", 315, 1100);
                pd.DefaultPageSettings.Margins = new Margins(10, 10, 10, 10);
            }

            pd.PrintPage += (s, e) => RenderInvoiceGraphics(e.Graphics, e.PageBounds, inv, comp, paperFormat);
            return pd;
        }

        public static void RenderInvoiceGraphics(Graphics g, Rectangle bounds, InvoiceRecord inv, CompanyInfo comp, string paperFormat)
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;
            g.Clear(Color.White);

            bool isGst = string.Equals(inv.Profile, "GST", StringComparison.OrdinalIgnoreCase);
            string authSigSource = !string.IsNullOrWhiteSpace(inv.AuthorizedSignatureDataUrl)
                ? inv.AuthorizedSignatureDataUrl
                : comp.SignatureDataUrl;
            string logoSource = comp?.LogoDataUrl ?? "";
            string firmName = string.IsNullOrWhiteSpace(comp?.Name) ? "ENTERPRISE POS & BILLING" : comp.Name;
            string docTitle = ResolveDocumentTitle(inv, isGst);

            var rightAlign = new StringFormat { Alignment = StringAlignment.Far, LineAlignment = StringAlignment.Center };
            var centerAlign = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
            var leftAlign = new StringFormat { Alignment = StringAlignment.Near, LineAlignment = StringAlignment.Center };

            if (string.Equals(paperFormat, "THERMAL", StringComparison.OrdinalIgnoreCase))
            {
                using var thTitle = new Font("Segoe UI", 11f, FontStyle.Bold);
                using var thSub = new Font("Segoe UI", 8f, FontStyle.Regular);
                using var thBold = new Font("Segoe UI", 8.5f, FontStyle.Bold);
                using var thMono = new Font("Consolas", 8f, FontStyle.Regular);
                using var thTotal = new Font("Segoe UI", 11.5f, FontStyle.Bold);

                float y = 10f;
                float w = Math.Min(bounds.Width - 20f, 290f);
                var centerFmt = new StringFormat { Alignment = StringAlignment.Center };

                // Render Shop Logo on Thermal Receipt if uploaded
                using (var logoImg = TryDecodeImageFromDataUrlOrPath(logoSource))
                {
                    if (logoImg != null)
                    {
                        DrawImagePreservingAspectRatio(g, logoImg, new RectangleF(10f + (w - 90f) / 2f, y, 90f, 44f));
                        y += 48f;
                    }
                }

                g.DrawString(docTitle, thBold, Brushes.Black, new RectangleF(10, y, w, 16), centerFmt); y += 16;
                g.DrawString(firmName, thTitle, Brushes.Black, new RectangleF(10, y, w, 22), centerFmt); y += 22;
                if (!string.IsNullOrWhiteSpace(comp.Address) || !string.IsNullOrWhiteSpace(comp.City))
                {
                    g.DrawString($"{comp.Address} {comp.City}".Trim(), thSub, Brushes.Black, new RectangleF(10, y, w, 16), centerFmt);
                    y += 15;
                }
                if (!string.IsNullOrWhiteSpace(comp.Phone))
                {
                    g.DrawString($"Ph: {comp.Phone}", thSub, Brushes.Black, new RectangleF(10, y, w, 16), centerFmt);
                    y += 15;
                }
                if (isGst && !string.IsNullOrWhiteSpace(comp.Gstin))
                {
                    g.DrawString($"GSTIN: {comp.Gstin}", thBold, Brushes.Black, new RectangleF(10, y, w, 16), centerFmt);
                    y += 16;
                }

                g.DrawLine(Pens.Black, 10, y, 10 + w, y); y += 5;
                g.DrawString($"No: {inv.InvoiceNo}   Date: {inv.Date:dd/MM/yy HH:mm}", thSub, Brushes.Black, 10, y); y += 14;
                g.DrawString($"Party: {inv.CustomerName}", thBold, Brushes.Black, 10, y); y += 16;
                g.DrawLine(Pens.Black, 10, y, 10 + w, y); y += 4;

                g.DrawString("ITEM                  QTY    RATE     AMT", thBold, Brushes.Black, 10, y); y += 15;
                g.DrawLine(Pens.Black, 10, y, 10 + w, y); y += 4;

                foreach (var ln in inv.Lines)
                {
                    string nm = ln.ItemName.Length > 18 ? ln.ItemName.Substring(0, 18) : ln.ItemName.PadRight(18);
                    string row = $"{nm} {ln.Qty,5:0.#} {ln.Rate,7:0.00} {ln.LineTotal,8:0.00}";
                    g.DrawString(row, thMono, Brushes.Black, 10, y);
                    y += 14;
                }

                decimal thNetPayable = inv.NetPayableTotal > 0m
                    ? inv.NetPayableTotal
                    : Math.Max(0m, inv.GrandTotal + inv.PreviousBalance - inv.AdjustedCreditAmount);

                g.DrawLine(Pens.Black, 10, y, 10 + w, y); y += 6;
                g.DrawString("Taxable / Base Value:", thSub, Brushes.Black, 10, y);
                g.DrawString($"Rs. {inv.TaxableTotal:N2}", thBold, Brushes.Black, new RectangleF(10, y, w, 15), rightAlign); y += 15;
                if (isGst)
                {
                    g.DrawString("Total GST:", thSub, Brushes.Black, 10, y);
                    g.DrawString($"Rs. {inv.GstTotal:N2}", thBold, Brushes.Black, new RectangleF(10, y, w, 15), rightAlign); y += 15;
                }
                g.DrawString("Bill Amount:", thBold, Brushes.Black, 10, y);
                g.DrawString($"Rs. {inv.GrandTotal:N2}", thBold, Brushes.Black, new RectangleF(10, y, w, 15), rightAlign); y += 15;
                if (inv.PreviousBalance > 0m)
                {
                    g.DrawString("Add: Previous Balance:", thSub, Brushes.Black, 10, y);
                    g.DrawString($"+ Rs. {inv.PreviousBalance:N2}", thBold, Brushes.Black, new RectangleF(10, y, w, 15), rightAlign); y += 15;
                }
                if (inv.AdjustedCreditAmount > 0m)
                {
                    g.DrawString("Less: Adjusted Credit:", thSub, Brushes.Black, 10, y);
                    g.DrawString($"- Rs. {inv.AdjustedCreditAmount:N2}", thBold, Brushes.Black, new RectangleF(10, y, w, 15), rightAlign); y += 15;
                }
                g.DrawLine(Pens.Black, 10, y, 10 + w, y); y += 4;
                g.DrawString("TOTAL AMOUNT:", thTotal, Brushes.Black, 10, y);
                g.DrawString($"Rs. {thNetPayable:N2}", thTotal, Brushes.Black, new RectangleF(10, y, w, 20), rightAlign); y += 24;

                if (!string.IsNullOrWhiteSpace(comp.UpiId))
                {
                    using var qr = RenderQrBitmap(BuildUpiDeepLink(comp, thNetPayable, inv.InvoiceNo), 125);
                    g.DrawImage(qr, 10 + (w - 125) / 2, y, 125, 125);
                    y += 128;
                    g.DrawString("Scan & Pay via UPI: " + comp.UpiId, thSub, Brushes.Black, new RectangleF(10, y, w, 16), centerFmt);
                    y += 18;
                }

                // Responsive aspect-ratio-locked Authorized Signature on Thermal Receipt
                using (var sigImg = TryDecodeImageFromDataUrlOrPath(authSigSource))
                {
                    if (sigImg != null)
                    {
                        var sigBox = new RectangleF(10 + (w - 120f) / 2f, y, 120f, 42f);
                        DrawImagePreservingAspectRatio(g, sigImg, sigBox);
                        y += 44f;
                        g.DrawString(comp.AuthSignatory, thSub, Brushes.Black, new RectangleF(10, y, w, 15), centerFmt);
                    }
                }
                return;
            }

            // ================================================================
            // PROFESSIONAL A4 / A5 PERFORMA INVOICE LAYOUT
            // ================================================================
            int m = 26;
            int pw = bounds.Width - m * 2;
            int ph = bounds.Height - m * 2;

            using var outerPen = new Pen(Color.FromArgb(15, 23, 42), 1.6f);
            using var linePen = new Pen(Color.FromArgb(148, 163, 184), 0.9f);
            using var lightGridPen = new Pen(Color.FromArgb(226, 232, 240), 0.8f);
            using var headerBrush = new SolidBrush(Color.FromArgb(15, 35, 66));
            using var subHeaderBrush = new SolidBrush(Color.FromArgb(241, 245, 249));
            using var tableHeaderBrush = new SolidBrush(Color.FromArgb(226, 232, 240));
            using var zebraBrush = new SolidBrush(Color.FromArgb(248, 250, 252));
            using var grandTotalBg = new SolidBrush(Color.FromArgb(15, 35, 66));
            using var grandTotalAccent = new SolidBrush(Color.FromArgb(74, 222, 128));
            using var goldBrush = new SolidBrush(Color.FromArgb(250, 204, 21));

            using var fH1 = new Font("Segoe UI", 15f, FontStyle.Bold);
            using var fDocBadge = new Font("Segoe UI", 11f, FontStyle.Bold);
            using var fSection = new Font("Segoe UI", 8f, FontStyle.Bold);
            using var fPartyName = new Font("Segoe UI", 10.5f, FontStyle.Bold);
            using var fReg = new Font("Segoe UI", 8.5f, FontStyle.Regular);
            using var fBold = new Font("Segoe UI", 8.5f, FontStyle.Bold);
            using var fAmtRow = new Font("Segoe UI", 9.5f, FontStyle.Regular);
            using var fAmtBold = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            using var fGrandLabel = new Font("Segoe UI", 11.5f, FontStyle.Bold);
            using var fGrandValue = new Font("Segoe UI", 14f, FontStyle.Bold);

            // 1. Top Header Banner (with Shop Logo if uploaded)
            int headerH = 76;
            g.FillRectangle(headerBrush, m, m, pw, headerH);

            int textLeftX = m + 14;
            using (var logoImg = TryDecodeImageFromDataUrlOrPath(logoSource))
            {
                if (logoImg != null)
                {
                    var logoBox = new RectangleF(m + 12, m + 9, 64, 58);
                    g.FillRectangle(Brushes.White, logoBox);
                    DrawImagePreservingAspectRatio(g, logoImg, new RectangleF(logoBox.X + 3, logoBox.Y + 3, logoBox.Width - 6, logoBox.Height - 6));
                    textLeftX = m + 86;
                }
            }

            g.DrawString(firmName, fH1, Brushes.White, textLeftX, m + 8);
            if (!string.IsNullOrWhiteSpace(comp?.Tagline))
                g.DrawString(comp.Tagline, fReg, Brushes.WhiteSmoke, textLeftX, m + 34);

            string companyAddrLine = string.Join(", ", new[] { comp?.Address, comp?.City, comp?.State }.Where(x => !string.IsNullOrWhiteSpace(x)));
            if (!string.IsNullOrWhiteSpace(comp?.Pincode)) companyAddrLine += " - " + comp.Pincode;
            if (!string.IsNullOrWhiteSpace(comp?.Phone)) companyAddrLine += (string.IsNullOrEmpty(companyAddrLine) ? "" : " | ") + "Ph: " + comp.Phone;
            if (!string.IsNullOrWhiteSpace(comp?.Email)) companyAddrLine += (string.IsNullOrEmpty(companyAddrLine) ? "" : " | ") + comp.Email;
            if (!string.IsNullOrWhiteSpace(companyAddrLine))
                g.DrawString(companyAddrLine, fReg, Brushes.LightGray, textLeftX, m + 52);

            // Top-Right Document Title & GSTIN
            var badgeRect = new RectangleF(m + pw - 270, m + 8, 256, 22);
            g.DrawString(docTitle, fDocBadge, goldBrush, badgeRect, rightAlign);
            if (isGst && !string.IsNullOrWhiteSpace(comp?.Gstin))
                g.DrawString("GSTIN: " + comp.Gstin, fBold, Brushes.White, new RectangleF(m + pw - 270, m + 32, 256, 18), rightAlign);
            g.DrawString("Document No: " + inv.InvoiceNo, fBold, Brushes.White, new RectangleF(m + pw - 270, m + 50, 256, 18), rightAlign);

            // 2. Two-Column Buyer & Document Metadata Box
            int metaTop = m + headerH;
            int metaH = 74;
            int midSplitX = m + (int)(pw * 0.56f);
            g.FillRectangle(subHeaderBrush, m, metaTop, pw, metaH);
            g.DrawLine(outerPen, m, metaTop, m + pw, metaTop);
            g.DrawLine(linePen, midSplitX, metaTop, midSplitX, metaTop + metaH);
            g.DrawLine(outerPen, m, metaTop + metaH, m + pw, metaTop + metaH);

            string partyTitle = (inv.DocType != null && inv.DocType.StartsWith("PURCHASE", StringComparison.OrdinalIgnoreCase))
                ? "SUPPLIER / VENDOR DETAILS:"
                : "BILL TO / BUYER DETAILS:";
            g.DrawString(partyTitle, fSection, Brushes.DarkSlateGray, m + 10, metaTop + 6);
            g.DrawString(string.IsNullOrWhiteSpace(inv.CustomerName) ? "WALK-IN CUSTOMER" : inv.CustomerName, fPartyName, Brushes.Black, m + 10, metaTop + 20);
            string buyerAddr = string.IsNullOrWhiteSpace(inv.CustomerAddress) ? "Counter Sale" : inv.CustomerAddress;
            g.DrawString($"Address: {buyerAddr}", fReg, Brushes.DimGray, m + 10, metaTop + 40);
            string buyerMeta = $"Mobile: {(string.IsNullOrWhiteSpace(inv.CustomerPhone) ? "-" : inv.CustomerPhone)}   |   GSTIN: {(string.IsNullOrWhiteSpace(inv.CustomerGstin) ? "Unregistered" : inv.CustomerGstin)}";
            g.DrawString(buyerMeta, fBold, Brushes.Black, m + 10, metaTop + 55);

            g.DrawString("INVOICE / PERFORMA METADATA:", fSection, Brushes.DarkSlateGray, midSplitX + 10, metaTop + 6);
            g.DrawString($"Date & Time     : {inv.Date:dd-MMM-yyyy hh:mm tt}", fBold, Brushes.Black, midSplitX + 10, metaTop + 22);
            g.DrawString($"Place of Supply : {inv.PlaceOfSupply}", fReg, Brushes.Black, midSplitX + 10, metaTop + 39);
            g.DrawString($"Payment Mode    : {inv.PaymentMode} {(string.IsNullOrWhiteSpace(inv.PaymentReference) ? "" : "(" + inv.PaymentReference + ")")}", fBold, Brushes.Black, midSplitX + 10, metaTop + 55);

            // 3. Full-Width Bordered Line Items Table
            int tableTop = metaTop + metaH;
            int thH = 26;
            int footerH = 212;
            int summaryRowH = 24;
            int botY = m + ph - footerH;
            int tableBottom = botY - summaryRowH;

            // Define responsive column widths spanning 100% of pw
            int cSno = 34;
            int cHsn = 64;
            int cQty = 62;
            int cRate = 78;
            int cDisc = 56;
            int cTaxable = 88;
            int cGstPct = isGst ? 50 : 0;
            int cGstAmt = isGst ? 74 : 0;
            int cTotal = 98;
            int cDesc = pw - (cSno + cHsn + cQty + cRate + cDisc + cTaxable + cGstPct + cGstAmt + cTotal);

            int[] colWidths = isGst
                ? new[] { cSno, cDesc, cHsn, cQty, cRate, cDisc, cTaxable, cGstPct, cGstAmt, cTotal }
                : new[] { cSno, cDesc, cHsn, cQty, cRate, cDisc, cTaxable, cTotal };
            string[] colTitles = isGst
                ? new[] { "#", "Item / Product Description", "HSN", "Qty", "Rate (Rs.)", "Disc%", "Base/Taxable", "GST%", "GST Amt", "Amount (Rs.)" }
                : new[] { "#", "Item / Product Description", "HSN", "Qty", "Rate (Rs.)", "Disc%", "Taxable (Rs.)", "Amount (Rs.)" };

            g.FillRectangle(tableHeaderBrush, m, tableTop, pw, thH);
            g.DrawLine(linePen, m, tableTop + thH, m + pw, tableTop + thH);

            int curX = m;
            for (int c = 0; c < colWidths.Length; c++)
            {
                var cellRect = new RectangleF(curX + 4, tableTop, colWidths[c] - 8, thH);
                var fmt = (c == 0 || c == 2) ? centerAlign : (c == 1 ? leftAlign : rightAlign);
                g.DrawString(colTitles[c], fBold, Brushes.Black, cellRect, fmt);
                curX += colWidths[c];
                if (c < colWidths.Length - 1)
                {
                    g.DrawLine(linePen, curX, tableTop, curX, botY);
                }
            }

            // Render item rows
            int rowY = tableTop + thH;
            int rowH = 22;
            decimal totalQtySum = 0m;
            for (int i = 0; i < inv.Lines.Count; i++)
            {
                if (rowY + rowH > tableBottom) break;
                var ln = inv.Lines[i];
                totalQtySum += ln.Qty;

                if (i % 2 == 1)
                    g.FillRectangle(zebraBrush, m + 1, rowY, pw - 2, rowH);

                string discLabel = ln.Discount2Percent > 0m
                    ? $"{ln.DiscountPercent:0.#}+{ln.Discount2Percent:0.#}%"
                    : $"{ln.DiscountPercent:0.#}%";

                string[] vals = isGst
                    ? new[]
                    {
                        (i + 1).ToString(),
                        ln.ItemName,
                        ln.HsnCode,
                        $"{ln.Qty:0.##} {ln.Uom}",
                        $"{ln.Rate:N2}",
                        discLabel,
                        $"{ln.TaxableValue:N2}",
                        $"{ln.GstPercent:0.#}%",
                        $"{ln.TotalGst:N2}",
                        $"{ln.LineTotal:N2}"
                    }
                    : new[]
                    {
                        (i + 1).ToString(),
                        ln.ItemName,
                        ln.HsnCode,
                        $"{ln.Qty:0.##} {ln.Uom}",
                        $"{ln.Rate:N2}",
                        discLabel,
                        $"{ln.TaxableValue:N2}",
                        $"{ln.LineTotal:N2}"
                    };

                int rxCol = m;
                for (int c = 0; c < colWidths.Length; c++)
                {
                    var rRect = new RectangleF(rxCol + 4, rowY, colWidths[c] - 8, rowH);
                    var fmt = (c == 0 || c == 2) ? centerAlign : (c == 1 ? leftAlign : rightAlign);
                    var rowFont = (c == colWidths.Length - 1) ? fBold : fReg;
                    g.DrawString(vals[c], rowFont, Brushes.Black, rRect, fmt);
                    rxCol += colWidths[c];
                }

                rowY += rowH;
                g.DrawLine(lightGridPen, m, rowY, m + pw, rowY);
            }

            decimal netPayableAmt = inv.NetPayableTotal > 0m
                ? inv.NetPayableTotal
                : Math.Max(0m, inv.GrandTotal + inv.PreviousBalance - inv.AdjustedCreditAmount);

            // Table Totals Strip right above footer
            g.FillRectangle(subHeaderBrush, m, tableBottom, pw, summaryRowH);
            g.DrawLine(linePen, m, tableBottom, m + pw, tableBottom);
            g.DrawString($"Total Items: {inv.Lines.Count}   |   Total Qty: {totalQtySum:0.##}", fBold, Brushes.Black, new RectangleF(m + 8, tableBottom, 260, summaryRowH), leftAlign);
            g.DrawString($"Bill Amt: Rs. {inv.GrandTotal:N2}", fAmtBold, Brushes.Black, new RectangleF(m + pw - 180 - 4, tableBottom, 180, summaryRowH), rightAlign);

            // 4. Bottom Footer Section: Left (Words + Bank + QR + Signature) | Right (Structured Amount Summary Box)
            g.DrawLine(outerPen, m, botY, m + pw, botY);
            int totalsSplitX = m + (int)(pw * 0.54f);
            g.DrawLine(outerPen, totalsSplitX, botY, totalsSplitX, m + ph);

            // Left Footer: Amount in Words
            g.FillRectangle(subHeaderBrush, m + 1, botY + 1, totalsSplitX - m - 2, 42);
            g.DrawLine(linePen, m, botY + 43, totalsSplitX, botY + 43);
            g.DrawString("AMOUNT IN WORDS:", fSection, Brushes.DarkSlateGray, m + 10, botY + 5);
            g.DrawString(NumberToIndianWords(netPayableAmt), fBold, Brushes.Black, new RectangleF(m + 10, botY + 19, totalsSplitX - m - 18, 22));

            // Left Footer: Bank Details + QR + Authorized Signature Box
            int leftInfoY = botY + 48;
            if (!string.IsNullOrWhiteSpace(comp?.BankName) || !string.IsNullOrWhiteSpace(comp?.BankAccountNo) || !string.IsNullOrWhiteSpace(comp?.UpiId))
            {
                g.DrawString($"Bank: {comp.BankName}   |   A/C: {comp.BankAccountNo}   |   IFSC: {comp.BankIfsc}", fBold, Brushes.Black, m + 10, leftInfoY);
                leftInfoY += 16;
                if (!string.IsNullOrWhiteSpace(comp.UpiId))
                {
                    g.DrawString($"UPI ID: {comp.UpiId}", fReg, Brushes.DimGray, m + 10, leftInfoY);
                    leftInfoY += 16;
                }
            }

            if (!string.IsNullOrWhiteSpace(comp?.UpiId))
            {
                using var qr = RenderQrBitmap(BuildUpiDeepLink(comp, netPayableAmt, inv.InvoiceNo), 96);
                g.DrawImage(qr, m + 12, botY + 86, 92, 92);
                g.DrawString("Scan to Pay\nvia UPI QR", fBold, Brushes.DarkSlateBlue, m + 110, botY + 116);
            }

            // Authorized Signature Box (inside Left Footer — clean, no trailing bottom text line)
            using (var sigImg = TryDecodeImageFromDataUrlOrPath(authSigSource))
            {
                var sigBox = new RectangleF(totalsSplitX - 165, botY + 86, 152, 68);
                g.DrawRectangle(Pens.LightSlateGray, sigBox.X, sigBox.Y, sigBox.Width, sigBox.Height);
                if (sigImg != null)
                {
                    DrawImagePreservingAspectRatio(g, sigImg, new RectangleF(sigBox.X + 4, sigBox.Y + 4, sigBox.Width - 8, sigBox.Height - 22));
                }
                g.DrawString(string.IsNullOrWhiteSpace(comp?.AuthSignatory) ? "Authorized Signatory" : comp.AuthSignatory,
                    fSection, Brushes.DarkSlateGray, new RectangleF(sigBox.X, sigBox.Bottom - 18, sigBox.Width, 16), centerAlign);
            }

            // Right Footer: Prominent Structured Amount Summary Table
            int rxLeft = totalsSplitX + 12;
            int rxWidth = (m + pw) - totalsSplitX - 24;
            int ry = botY + 4;
            int rRowH = 18;

            void DrawAmountRow(string label, string value, bool bold = false)
            {
                var f = bold ? fAmtBold : fAmtRow;
                g.DrawString(label, f, Brushes.Black, new RectangleF(rxLeft, ry, rxWidth * 0.58f, rRowH), leftAlign);
                g.DrawString(value, f, Brushes.Black, new RectangleF(rxLeft, ry, rxWidth, rRowH), rightAlign);
                ry += rRowH;
                g.DrawLine(lightGridPen, totalsSplitX, ry, m + pw, ry);
            }

            DrawAmountRow("Sub Total (Gross Amount)", $"Rs. {inv.SubTotal:N2}");
            DrawAmountRow("Less: Item + Cash Discount", $"- Rs. {inv.DiscountTotal:N2}");
            DrawAmountRow(isGst ? "Base / Taxable Value" : "Net Taxable Value", $"Rs. {inv.TaxableTotal:N2}", true);
            if (isGst)
            {
                if (inv.IgstTotal > 0m)
                {
                    DrawAmountRow("Add: IGST Amount", $"Rs. {inv.IgstTotal:N2}");
                }
                else
                {
                    DrawAmountRow("Add: CGST + SGST", $"Rs. {(inv.CgstTotal + inv.SgstTotal):N2}");
                }
            }
            DrawAmountRow("Bill Amount (Current)", $"Rs. {inv.GrandTotal:N2}", true);
            DrawAmountRow("Add: Previous Balance", $"+ Rs. {inv.PreviousBalance:N2}", inv.PreviousBalance > 0m);
            if (inv.AdjustedCreditAmount > 0m)
            {
                DrawAmountRow("Less: Adjusted Credit", $"- Rs. {inv.AdjustedCreditAmount:N2}", true);
            }

            // High-Contrast TOTAL AMOUNT Box
            ry += 3;
            var gtBox = new Rectangle(totalsSplitX + 8, ry, (m + pw) - totalsSplitX - 16, 36);
            g.FillRectangle(grandTotalBg, gtBox);
            g.DrawString("TOTAL AMOUNT", fGrandLabel, Brushes.White, new RectangleF(gtBox.X + 12, gtBox.Y, gtBox.Width * 0.48f, gtBox.Height), leftAlign);
            g.DrawString($"Rs. {netPayableAmt:N2}", fGrandValue, grandTotalAccent, new RectangleF(gtBox.X + 12, gtBox.Y, gtBox.Width - 24, gtBox.Height), rightAlign);
            ry += 39;

            // Amount Received & Balance Due Row
            g.DrawString($"Received: Rs. {inv.AmountReceived:N2}", fBold, Brushes.DarkSlateGray, new RectangleF(rxLeft, ry, rxWidth * 0.5f, 20), leftAlign);
            g.DrawString($"Balance Due: Rs. {inv.BalanceDue:N2}", fBold, inv.BalanceDue > 0 ? Brushes.Firebrick : Brushes.SeaGreen, new RectangleF(rxLeft, ry, rxWidth, 20), rightAlign);

            // Outer frame
            g.DrawRectangle(outerPen, m, m, pw, ph);
        }
    }

    // ========================================================================
    // COMPACT ISO/IEC 18004 QR CODE ENCODER (VERSIONS 1..6, ECC LEVEL L)
    // ========================================================================
    internal static class QrCodeEncoder
    {
        private static readonly int[] DataCodewordsLevelL = { 0, 19, 34, 55, 80, 108, 136 };
        private static readonly int[] EccCodewordsLevelL = { 0, 7, 10, 15, 20, 26, 18 };
        private static readonly int[] NumBlocksLevelL = { 0, 1, 1, 1, 1, 1, 2 };

        public static bool[,] EncodeByteMode(string text)
        {
            byte[] data = Encoding.UTF8.GetBytes(text ?? "");
            int version = 1;
            while (version < 6 && data.Length + 3 > DataCodewordsLevelL[version])
                version++;

            if (data.Length + 3 > DataCodewordsLevelL[version])
            {
                data = data.Take(DataCodewordsLevelL[version] - 3).ToArray();
            }

            int totalDataBytes = DataCodewordsLevelL[version];
            var bits = new List<bool>();
            void AppendBits(int val, int len)
            {
                for (int i = len - 1; i >= 0; i--)
                    bits.Add(((val >> i) & 1) != 0);
            }

            // Byte mode indicator (0100) + length (8 bits for v1..9)
            AppendBits(0b0100, 4);
            AppendBits(data.Length, 8);
            foreach (byte b in data) AppendBits(b, 8);

            // Terminator
            int maxBits = totalDataBytes * 8;
            for (int i = 0; i < 4 && bits.Count < maxBits; i++) bits.Add(false);
            while (bits.Count % 8 != 0) bits.Add(false);

            byte[] padBytes = { 0xEC, 0x11 };
            int padIdx = 0;
            while (bits.Count < maxBits)
            {
                AppendBits(padBytes[padIdx % 2], 8);
                padIdx++;
            }

            byte[] dataCw = new byte[totalDataBytes];
            for (int i = 0; i < totalDataBytes; i++)
            {
                int v = 0;
                for (int b = 0; b < 8; b++)
                    v = (v << 1) | (bits[i * 8 + b] ? 1 : 0);
                dataCw[i] = (byte)v;
            }

            byte[] allCodewords = BuildFinalCodewords(dataCw, version);
            int size = 17 + version * 4;
            bool[,] modules = new bool[size, size];
            bool[,] isFunction = new bool[size, size];

            DrawFunctionPatterns(modules, isFunction, version, size);
            DrawCodewords(modules, isFunction, allCodewords, size);
            ApplyMask0AndFormatBits(modules, isFunction, size);

            return modules;
        }

        private static byte[] BuildFinalCodewords(byte[] dataCw, int version)
        {
            int numBlocks = NumBlocksLevelL[version];
            int eccLen = EccCodewordsLevelL[version];
            if (numBlocks == 1)
            {
                byte[] ecc = ReedSolomonCompute(dataCw, eccLen);
                return dataCw.Concat(ecc).ToArray();
            }

            int blockLen = dataCw.Length / 2;
            byte[] b1 = dataCw.Take(blockLen).ToArray();
            byte[] b2 = dataCw.Skip(blockLen).ToArray();
            byte[] e1 = ReedSolomonCompute(b1, eccLen);
            byte[] e2 = ReedSolomonCompute(b2, eccLen);

            var result = new List<byte>();
            for (int i = 0; i < blockLen; i++) { result.Add(b1[i]); result.Add(b2[i]); }
            for (int i = 0; i < eccLen; i++) { result.Add(e1[i]); result.Add(e2[i]); }
            return result.ToArray();
        }

        private static byte[] ReedSolomonCompute(byte[] data, int degree)
        {
            byte[] gen = new byte[degree];
            gen[degree - 1] = 1;
            int root = 1;
            for (int i = 0; i < degree; i++)
            {
                for (int j = 0; j < degree; j++)
                {
                    gen[j] = GfMultiply(gen[j], (byte)root);
                    if (j + 1 < degree) gen[j] ^= gen[j + 1];
                }
                root = GfMultiply((byte)root, 0x02);
            }

            byte[] res = new byte[degree];
            foreach (byte b in data)
            {
                byte factor = (byte)(b ^ res[0]);
                Array.Copy(res, 1, res, 0, degree - 1);
                res[degree - 1] = 0;
                for (int j = 0; j < degree; j++)
                    res[j] ^= GfMultiply(gen[j], factor);
            }
            return res;
        }

        private static byte GfMultiply(byte x, byte y)
        {
            int z = 0;
            for (int i = 7; i >= 0; i--)
            {
                z = (z << 1) ^ ((z >> 7) * 0x11D);
                z ^= ((y >> i) & 1) * x;
            }
            return (byte)z;
        }

        private static void DrawFunctionPatterns(bool[,] mod, bool[,] fn, int ver, int size)
        {
            for (int i = 0; i < size; i++)
            {
                mod[6, i] = (i % 2 == 0); fn[6, i] = true;
                mod[i, 6] = (i % 2 == 0); fn[i, 6] = true;
            }

            DrawFinder(mod, fn, 3, 3, size);
            DrawFinder(mod, fn, size - 4, 3, size);
            DrawFinder(mod, fn, 3, size - 4, size);

            if (ver >= 2)
            {
                int alignPos = size - 7;
                for (int dy = -2; dy <= 2; dy++)
                {
                    for (int dx = -2; dx <= 2; dx++)
                    {
                        mod[alignPos + dy, alignPos + dx] = Math.Max(Math.Abs(dx), Math.Abs(dy)) != 1;
                        fn[alignPos + dy, alignPos + dx] = true;
                    }
                }
            }

            // Reserve format info areas
            for (int i = 0; i <= 8; i++)
            {
                if (i != 6) { fn[8, i] = true; fn[i, 8] = true; }
            }
            for (int i = 0; i < 8; i++)
            {
                fn[8, size - 1 - i] = true;
                fn[size - 1 - i, 8] = true;
            }
            mod[size - 8, 8] = true;
            fn[size - 8, 8] = true;
        }

        private static void DrawFinder(bool[,] mod, bool[,] fn, int cx, int cy, int size)
        {
            for (int dy = -4; dy <= 4; dy++)
            {
                for (int dx = -4; dx <= 4; dx++)
                {
                    int xx = cx + dx, yy = cy + dy;
                    if (xx >= 0 && xx < size && yy >= 0 && yy < size)
                    {
                        int dist = Math.Max(Math.Abs(dx), Math.Abs(dy));
                        mod[yy, xx] = (dist != 2 && dist != 4);
                        fn[yy, xx] = true;
                    }
                }
            }
        }

        private static void DrawCodewords(bool[,] mod, bool[,] fn, byte[] data, int size)
        {
            int bitIdx = 0;
            int totalBits = data.Length * 8;
            for (int right = size - 1; right >= 1; right -= 2)
            {
                if (right == 6) right = 5;
                for (int vert = 0; vert < size; vert++)
                {
                    for (int j = 0; j < 2; j++)
                    {
                        int x = right - j;
                        bool upward = ((right + 1) & 2) == 0;
                        int y = upward ? size - 1 - vert : vert;
                        if (!fn[y, x] && bitIdx < totalBits)
                        {
                            mod[y, x] = ((data[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1) != 0;
                            bitIdx++;
                        }
                    }
                }
            }
        }

        private static void ApplyMask0AndFormatBits(bool[,] mod, bool[,] fn, int size)
        {
            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    if (!fn[y, x] && ((x + y) % 2 == 0))
                        mod[y, x] = !mod[y, x];
                }
            }

            // Precomputed BCH format bits for ECC Level L (01) + Mask 0 (000) = 0x77C4
            int bits = 0x77C4;
            bool Bit(int i) => ((bits >> i) & 1) != 0;

            for (int i = 0; i <= 5; i++) mod[8, i] = Bit(i);
            mod[8, 7] = Bit(6);
            mod[8, 8] = Bit(7);
            mod[7, 8] = Bit(8);
            for (int i = 9; i < 15; i++) mod[14 - i, 8] = Bit(i);

            for (int i = 0; i < 8; i++) mod[size - 1 - i, 8] = Bit(i);
            for (int i = 8; i < 15; i++) mod[8, size - 15 + i] = Bit(i);
            mod[size - 8, 8] = true;
        }
    }
}
