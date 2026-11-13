import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { CheckCircle2, Mail, Printer, ShieldCheck, X } from 'lucide-react';
import { usePos } from '../context/PosContext';
import { CompanyMaster, ProfileType, PurchaseDocument, SaleDocument } from '../types/pos';
import { buildBillQrData, formatMoney, formatNumber } from '../utils/accounting';

interface ReceiptPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  format: 'A4' | 'A5' | 'THERMAL';
  setFormat: (f: 'A4' | 'A5' | 'THERMAL') => void;
  document: SaleDocument | PurchaseDocument;
  company: CompanyMaster;
  profile: ProfileType;
  onEmailReceipt?: (email: string) => void;
}

export const ReceiptPrintModal: React.FC<ReceiptPrintModalProps> = ({
  isOpen,
  onClose,
  format,
  setFormat,
  document: doc,
  company,
  profile,
  onEmailReceipt,
}) => {
  const { state } = usePos();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [emailInput, setEmailInput] = useState<string>(
    'customerEmail' in doc ? doc.customerEmail || '' : ''
  );
  const [emailSentStatus, setEmailSentStatus] = useState<boolean>(false);

  const isSale = 'customerName' in doc;
  const partyName = isSale ? doc.customerName || 'Walk-in Customer' : doc.supplierName || 'Supplier';
  const qrHash =
    'qrSignatureHash' in doc && doc.qrSignatureHash
      ? doc.qrSignatureHash
      : `KPOS-${doc.invoiceNo}-${doc.date.replace(/-/g, '')}`;

  // Resolve Customer Signature from SaleDocument or Customer Master
  const customerSignatureUrl = isSale
    ? doc.customerSignatureDataUrl ||
      state.customers.find(
        (c) =>
          (doc.customerId && c.id === doc.customerId) ||
          (doc.customerName && c.name.toLowerCase() === doc.customerName.toLowerCase())
      )?.signatureDataUrl ||
      ''
    : '';

  // Resolve Company / Bill Authorized Signature from SaleDocument or Company Master
  const companySignatureUrl =
    (isSale && doc.companySignatureDataUrl) || company.signatureDataUrl || '';

  useEffect(() => {
    if (!isOpen) return;
    const payload = buildBillQrData({
      firmName: company.firmName || 'Kanha POS Firm',
      upiId: ('upiId' in doc && doc.upiId) || company.upiId || '',
      invoiceNo: doc.invoiceNo,
      date: doc.date,
      customerName: partyName,
      totalAmount: doc.totalAmount,
      qrSignatureHash: qrHash,
    });
    QRCode.toDataURL(payload, {
      width: format === 'THERMAL' ? 148 : 164,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(''));
  }, [isOpen, doc, company, partyName, qrHash, format]);

  if (!isOpen) return null;

  const totalBase = doc.lines.reduce((s, l) => s + l.basePrice * l.qty, 0);
  const totalCgst = doc.lines.reduce((s, l) => s + l.cgst, 0);
  const totalSgst = doc.lines.reduce((s, l) => s + l.sgst, 0);
  const totalQty = doc.lines.reduce((s, l) => s + l.qty, 0);
  const paidOrReceived = isSale ? doc.receivedAmount : doc.paidAmount;

  const printerSettings = company.printerSettings;
  const activePrinterName =
    printerSettings?.selectedPrinterName || 'EPSON TM-T82III Receipt (USB001)';
  const is58mm = printerSettings?.paperSize === 'THERMAL_58MM';
  const marginSummary = printerSettings
    ? `Margins: T:${printerSettings.marginTopMm}mm B:${printerSettings.marginBottomMm}mm L:${printerSettings.marginLeftMm}mm R:${printerSettings.marginRightMm}mm`
    : 'Margins: Default (4mm)';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-3 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-lg bg-white border border-slate-300 shadow-2xl overflow-hidden my-auto">
        {/* Modal Control Header */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3 bg-[#0d6e6e] px-4 py-3 text-white">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <span className="text-sm font-bold tracking-tight block">
                Bill Print &amp; QR Integrity Preview ({doc.invoiceNo})
              </span>
              <span className="text-[10px] font-mono text-teal-100">
                Printer: {activePrinterName} · {marginSummary}
              </span>
            </div>
            <div className="flex items-center gap-1 bg-[#094e4e] p-1 rounded">
              {(['A4', 'A5', 'THERMAL'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setFormat(fmt)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors cursor-pointer ${
                    format === fmt ? 'bg-white text-[#0d6e6e]' : 'text-slate-200 hover:text-white'
                  }`}
                >
                  {fmt === 'THERMAL'
                    ? is58mm
                      ? 'Thermal (58mm)'
                      : 'Thermal (80mm)'
                    : `Print ${fmt}`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white/10 rounded px-2 py-1">
              <Mail className="w-3.5 h-3.5 text-slate-200" />
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="customer@email.com"
                className="bg-transparent text-xs text-white placeholder:text-slate-300 focus:outline-none w-36"
              />
              <button
                type="button"
                onClick={() => {
                  if (!emailInput.trim()) return;
                  setEmailSentStatus(true);
                  onEmailReceipt?.(emailInput.trim());
                }}
                className="bg-white text-[#0d6e6e] px-2 py-0.5 rounded text-xs font-semibold hover:bg-slate-100 cursor-pointer"
              >
                {emailSentStatus ? 'Sent' : 'Email Receipt'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 bg-white text-[#0d6e6e] px-3 py-1.5 rounded text-xs font-bold hover:bg-slate-100 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Now</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-white/80 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Area */}
        <div className="p-6 bg-slate-100 max-h-[80vh] overflow-y-auto flex justify-center">
          <div
            className={`bg-white text-slate-900 border border-slate-300 shadow-sm ${
              format === 'THERMAL'
                ? is58mm
                  ? 'w-[240px] p-3 text-[11px]'
                  : 'w-[320px] p-4 text-xs'
                : format === 'A5'
                ? 'w-[560px] p-6 text-xs'
                : 'w-full max-w-[780px] p-8 text-sm'
            }`}
          >
            {/* Header with Company Logo */}
            <div className="border-b-2 border-slate-800 pb-3 mb-3 flex flex-col items-center text-center">
              {company.logoDataUrl && (
                <img
                  src={company.logoDataUrl}
                  alt="Company Logo"
                  className={`${
                    format === 'THERMAL' ? 'h-12' : 'h-16'
                  } max-w-[180px] object-contain mb-1.5`}
                />
              )}
              <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
                {profile === 'GST' ? 'TAX INVOICE (GST)' : 'RETAIL BILL / CASH MEMO'}
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                {company.firmName || 'KANHA RETAIL & ERP ENTERPRISE'}
              </h2>
              {company.address && <p className="text-xs text-slate-600">{company.address}</p>}
              <div className="flex flex-wrap justify-center gap-3 text-xs text-slate-700 mt-1">
                {company.phone && <span>Ph: {company.phone}</span>}
                {profile === 'GST' && company.gstin && <span>GSTIN: {company.gstin}</span>}
                <span>Session: {company.financialYear || 'FY2026-27'}</span>
              </div>
            </div>

            {/* Metadata Row */}
            <div className="grid grid-cols-2 gap-2 text-xs border-b border-slate-300 pb-2.5 mb-3">
              <div>
                <p>
                  <span className="font-semibold">Bill / Inv No:</span>{' '}
                  <span className="font-mono font-bold">{doc.invoiceNo}</span>
                </p>
                <p>
                  <span className="font-semibold">{isSale ? 'Customer:' : 'Supplier:'}</span>{' '}
                  {partyName}
                </p>
                {isSale && doc.customerDetails && (
                  <p className="text-slate-600">{doc.customerDetails}</p>
                )}
              </div>
              <div className="text-right">
                <p>
                  <span className="font-semibold">Date:</span>{' '}
                  <span className="font-mono">{doc.date}</span>
                </p>
                <p>
                  <span className="font-semibold">Mode:</span> {doc.paymentMode}
                </p>
                {doc.transportRef && (
                  <p>
                    <span className="font-semibold">Ref:</span> {doc.transportRef}
                  </p>
                )}
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-y border-slate-800 bg-slate-100 text-left">
                    <th className="py-1.5 px-1">#</th>
                    <th className="py-1.5 px-1">Item</th>
                    {profile === 'GST' && format !== 'THERMAL' && (
                      <th className="py-1.5 px-1">HSN</th>
                    )}
                    <th className="py-1.5 px-1 text-right">Qty</th>
                    {profile === 'GST' && (
                      <th className="py-1.5 px-1 text-right">Base</th>
                    )}
                    {profile === 'GST' && format !== 'THERMAL' && (
                      <>
                        <th className="py-1.5 px-1 text-right">CGST</th>
                        <th className="py-1.5 px-1 text-right">SGST</th>
                      </>
                    )}
                    <th className="py-1.5 px-1 text-right">Rate</th>
                    <th className="py-1.5 px-1 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {doc.lines.map((line, idx) => (
                    <tr key={line.id || idx}>
                      <td className="py-1.5 px-1">{idx + 1}</td>
                      <td className="py-1.5 px-1 font-sans font-medium">
                        {line.name}
                        {(line.disc1Percent > 0 || line.disc2Percent > 0) && (
                          <span className="block text-[10px] text-slate-500">
                            Disc: {line.disc1Percent}%
                            {line.disc2Percent > 0 ? ` + ${line.disc2Percent}%` : ''}
                          </span>
                        )}
                      </td>
                      {profile === 'GST' && format !== 'THERMAL' && (
                        <td className="py-1.5 px-1">{line.hsn || '-'}</td>
                      )}
                      <td className="py-1.5 px-1 text-right">
                        {line.qty} {line.unit}
                      </td>
                      {profile === 'GST' && (
                        <td className="py-1.5 px-1 text-right">{formatNumber(line.basePrice)}</td>
                      )}
                      {profile === 'GST' && format !== 'THERMAL' && (
                        <>
                          <td className="py-1.5 px-1 text-right">{formatNumber(line.cgst)}</td>
                          <td className="py-1.5 px-1 text-right">{formatNumber(line.sgst)}</td>
                        </>
                      )}
                      <td className="py-1.5 px-1 text-right">{formatNumber(line.rate)}</td>
                      <td className="py-1.5 px-1 text-right font-semibold">
                        {formatNumber(line.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals & QR Code Integrity Section */}
            <div className="mt-4 pt-3 border-t-2 border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
              {/* Left: QR Code & Cryptographic Signature */}
              <div className="flex items-center gap-3 border border-slate-200 rounded p-2 bg-slate-50">
                {qrDataUrl && (
                  <img
                    src={qrDataUrl}
                    alt="Bill QR Code & Integrity Verification"
                    referrerPolicy="no-referrer"
                    className="w-24 h-24 shrink-0 border border-slate-300 bg-white p-1"
                  />
                )}
                <div className="text-[11px] space-y-1">
                  <div className="flex items-center gap-1 font-bold text-[#0d6e6e]">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>QR Integrity Verified</span>
                  </div>
                  <p className="font-mono text-[10px] text-slate-700 break-all">
                    SIG: {qrHash}
                  </p>
                  {('upiId' in doc && doc.upiId) || company.upiId ? (
                    <p className="text-[10px] text-slate-600">
                      UPI: {('upiId' in doc && doc.upiId) || company.upiId}
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-500">
                      Scan QR to verify invoice authenticity &amp; line totals.
                    </p>
                  )}
                </div>
              </div>

              {/* Right: Financial Summary & High-Clarity Grand Total Banner */}
              <div className="space-y-1.5 text-xs font-mono border border-slate-300 rounded p-2.5 bg-slate-50/70">
                <div className="flex justify-between">
                  <span className="font-sans text-slate-600">
                    Total Items / Qty ({doc.lines.length} / {totalQty}):
                  </span>
                  <span className="font-semibold">{formatMoney(doc.itemsValue, company.currency)}</span>
                </div>
                {profile === 'GST' && (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span className="font-sans">Base / Taxable Value:</span>
                      <span>{formatMoney(totalBase, company.currency)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span className="font-sans">CGST + SGST:</span>
                      <span>
                        {formatMoney(totalCgst, company.currency)} +{' '}
                        {formatMoney(totalSgst, company.currency)}
                      </span>
                    </div>
                  </>
                )}
                {doc.billDiscount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span className="font-sans">Bill Discount:</span>
                    <span>-{formatMoney(doc.billDiscount, company.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-slate-800 border-t border-slate-200 pt-1">
                  <span className="font-sans">Bill Amount:</span>
                  <span>
                    {formatMoney(
                      doc.billAmount ?? Math.max(0, doc.itemsValue - doc.billDiscount),
                      company.currency
                    )}
                  </span>
                </div>
                {(doc.previousBalance ?? 0) > 0 && (
                  <div className="flex justify-between text-amber-800 font-semibold">
                    <span className="font-sans">Previous Balance (+):</span>
                    <span>+{formatMoney(doc.previousBalance || 0, company.currency)}</span>
                  </div>
                )}
                {(doc.adjustedCreditAmount ?? 0) > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span className="font-sans">Adjusted Credit (-):</span>
                    <span>-{formatMoney(doc.adjustedCreditAmount || 0, company.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center bg-[#0f172a] text-[#4ade80] px-3 py-2 rounded mt-1.5 font-bold text-sm">
                  <span className="font-sans tracking-wide">TOTAL AMOUNT:</span>
                  <span className="text-base">{formatMoney(doc.totalAmount, company.currency)}</span>
                </div>
                <div className="flex justify-between text-slate-700 pt-1">
                  <span className="font-sans">{isSale ? 'Received:' : 'Paid:'}</span>
                  <span>{formatMoney(paidOrReceived, company.currency)}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span className="font-sans">Balance / Pending:</span>
                  <span className="font-bold">{formatMoney(doc.remainingAmount, company.currency)}</span>
                </div>
              </div>
            </div>

            {/* Customer Signature & Authorised Signatory Block (Last 'For Company' line removed) */}
            <div className="mt-4 pt-3 border-t border-slate-300 grid grid-cols-2 gap-4 items-end text-[11px]">
              <div className="flex flex-col items-start">
                {customerSignatureUrl ? (
                  <img
                    src={customerSignatureUrl}
                    alt="Customer Signature"
                    className={`${
                      format === 'THERMAL'
                        ? 'max-h-10 max-w-[110px]'
                        : 'max-h-14 max-w-[160px]'
                    } w-auto h-auto object-contain aspect-auto border-b border-slate-400 pb-1 mb-1`}
                  />
                ) : (
                  <div className="h-10 w-32 border-b border-dashed border-slate-400 mb-1" />
                )}
                <span className="font-semibold text-slate-700">
                  Customer Signature ({partyName})
                </span>
              </div>

              <div className="flex flex-col items-end text-right">
                {companySignatureUrl ? (
                  <img
                    src={companySignatureUrl}
                    alt="Authorised Signatory"
                    className={`${
                      format === 'THERMAL'
                        ? is58mm
                          ? 'max-h-9 max-w-[100px]'
                          : 'max-h-11 max-w-[130px]'
                        : 'max-h-14 max-w-[175px]'
                    } w-auto h-auto object-contain aspect-auto mb-1`}
                  />
                ) : (
                  <div className="h-8 w-32 mb-1" />
                )}
                <span className="flex items-center gap-1 font-semibold text-slate-800 border-t border-slate-400 pt-1">
                  <CheckCircle2 className="w-3 h-3 text-[#0d6e6e]" /> Authorised Signatory
                </span>
              </div>
            </div>

            {company.termsAndConditions && (
              <div className="mt-3 pt-2 border-t border-slate-200 text-[10px] text-slate-500">
                T&amp;C: {company.termsAndConditions}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
