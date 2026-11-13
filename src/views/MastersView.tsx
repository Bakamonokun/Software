import React, { useEffect, useRef, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Eraser,
  FolderOpen,
  ImagePlus,
  Layers,
  PenTool,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { usePos } from '../context/PosContext';
import {
  BankMaster,
  CustomerMaster,
  HsnMaster,
  ItemMaster,
  ItemStockBatch,
  SupplierMaster,
} from '../types/pos';
import {
  formatNumber,
  getBatchExpiryStatus,
  getCategorizedItemSuggestions,
  getItemBatchExpirySummary,
  round2,
} from '../utils/accounting';

export type MasterTabType = 'ITEM' | 'CUSTOMER' | 'SUPPLIER' | 'HSN' | 'BANK' | 'COMPANY';

interface MastersViewProps {
  activeTab: MasterTabType;
  setActiveTab: (t: MasterTabType) => void;
  onExit: () => void;
}

const DEFAULT_CATEGORIES = [
  'Writing Instruments',
  'Paper & Notebooks',
  'Office Files & Folders',
  'Adhesives & Tapes',
  'Art & Craft Supplies',
  'Desk Accessories',
  'Printer & IT Consumables',
  'General Items',
];

export const MastersView: React.FC<MastersViewProps> = ({
  activeTab,
  setActiveTab,
  onExit,
}) => {
  const { state, activeProfile, saveMaster, notify } = usePos();

  // Item Form State
  const [itemEditId, setItemEditId] = useState<string>('');
  const [itemCode, setItemCode] = useState('');
  const [itemBarcode, setItemBarcode] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState('Writing Instruments');
  const [itemUnit, setItemUnit] = useState('PCS');
  const [itemHsn, setItemHsn] = useState('');
  const [itemGstPercent, setItemGstPercent] = useState('5');
  const [itemBasePrice, setItemBasePrice] = useState('');
  const [itemSellingPrice, setItemSellingPrice] = useState('');
  const [itemPurchasePrice, setItemPurchasePrice] = useState('');
  const [itemStockQty, setItemStockQty] = useState('0');
  const [itemMinStock, setItemMinStock] = useState('5');
  const [itemBatches, setItemBatches] = useState<ItemStockBatch[]>([]);
  const [newBatchNo, setNewBatchNo] = useState('');
  const [newBatchMfgDate, setNewBatchMfgDate] = useState('');
  const [newBatchExpiryDate, setNewBatchExpiryDate] = useState('');
  const [newBatchQty, setNewBatchQty] = useState('');
  const [itemSearchWord, setItemSearchWord] = useState('');
  const [onlyExpiringItems, setOnlyExpiringItems] = useState(false);

  // Customer Form State & Search + Signature
  const [custEditId, setCustEditId] = useState('');
  const [custCode, setCustCode] = useState('');
  const [custName, setCustName] = useState('');
  const [custMobile, setCustMobile] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custGstin, setCustGstin] = useState('');
  const [custState, setCustState] = useState('');
  const [custOpenGst, setCustOpenGst] = useState('0');
  const [custOpenNonGst, setCustOpenNonGst] = useState('0');
  const [custSignatureDataUrl, setCustSignatureDataUrl] = useState<string>('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawingSig, setIsDrawingSig] = useState(false);

  // Supplier Form State & Search
  const [supEditId, setSupEditId] = useState('');
  const [supCode, setSupCode] = useState('');
  const [supName, setSupName] = useState('');
  const [supMobile, setSupMobile] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [supGstin, setSupGstin] = useState('');
  const [supState, setSupState] = useState('');
  const [supOpenGst, setSupOpenGst] = useState('0');
  const [supOpenNonGst, setSupOpenNonGst] = useState('0');
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');

  // HSN Form State & Search
  const [hsnEditId, setHsnEditId] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [hsnDesc, setHsnDesc] = useState('');
  const [hsnGst, setHsnGst] = useState('5');
  const [hsnSearchQuery, setHsnSearchQuery] = useState('');

  // Bank Form State
  const [bankName, setBankName] = useState('');
  const [bankAcc, setBankAcc] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [bankOpenGst, setBankOpenGst] = useState('0');
  const [bankOpenNonGst, setBankOpenNonGst] = useState('0');

  // Company Form State - only initialize when entering COMPANY tab so typing is never interrupted by background state sync
  const [companyForm, setCompanyForm] = useState(state.company);

  useEffect(() => {
    if (activeTab === 'COMPANY') {
      setCompanyForm(state.company);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const resetItemForm = () => {
    setItemEditId('');
    setItemCode('');
    setItemBarcode('');
    setItemName('');
    setItemHsn('');
    setItemGstPercent('5');
    setItemBasePrice('');
    setItemSellingPrice('');
    setItemPurchasePrice('');
    setItemStockQty('0');
    setItemMinStock('5');
    setItemBatches([]);
    setNewBatchNo('');
    setNewBatchMfgDate('');
    setNewBatchExpiryDate('');
    setNewBatchQty('');
  };

  const handleAddStockBatch = () => {
    const batchCode = newBatchNo.trim() || `B-${String(itemBatches.length + 1).padStart(3, '0')}`;
    const expIso = newBatchExpiryDate.trim();
    const qtyNum = round2(Number(newBatchQty) || 0);
    if (!expIso) {
      notify('Select an Expiry Date for the stock batch.', 'error');
      return;
    }
    if (qtyNum <= 0) {
      notify('Enter a valid Batch Quantity greater than 0.', 'error');
      return;
    }
    const batchRecord: ItemStockBatch = {
      id: `bch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      batchNo: batchCode,
      mfgDate: newBatchMfgDate.trim() || undefined,
      expiryDate: expIso,
      qty: qtyNum,
    };
    const nextBatches = [...itemBatches, batchRecord];
    setItemBatches(nextBatches);
    const totalBatchStock = round2(nextBatches.reduce((sum, b) => sum + b.qty, 0));
    setItemStockQty(String(totalBatchStock));
    setNewBatchNo('');
    setNewBatchMfgDate('');
    setNewBatchExpiryDate('');
    setNewBatchQty('');
  };

  const handleRemoveStockBatch = (batchId: string) => {
    const nextBatches = itemBatches.filter((b) => b.id !== batchId);
    setItemBatches(nextBatches);
    const totalBatchStock = round2(nextBatches.reduce((sum, b) => sum + b.qty, 0));
    setItemStockQty(String(totalBatchStock));
  };

  const resetCustomerForm = () => {
    setCustEditId('');
    setCustCode('');
    setCustName('');
    setCustMobile('');
    setCustEmail('');
    setCustAddress('');
    setCustGstin('');
    setCustState('');
    setCustOpenGst('0');
    setCustOpenNonGst('0');
    setCustSignatureDataUrl('');
    setShowSignaturePad(false);
  };

  const resetSupplierForm = () => {
    setSupEditId('');
    setSupCode('');
    setSupName('');
    setSupMobile('');
    setSupEmail('');
    setSupAddress('');
    setSupGstin('');
    setSupState('');
    setSupOpenGst('0');
    setSupOpenNonGst('0');
  };

  const resetHsnForm = () => {
    setHsnEditId('');
    setHsnCode('');
    setHsnDesc('');
    setHsnGst('5');
  };

  // Signature Canvas Helpers
  const clearSignatureCanvas = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const getCanvasPoint = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    const mouseEvt = e as React.MouseEvent<HTMLCanvasElement>;
    return {
      x: mouseEvt.clientX - rect.left,
      y: mouseEvt.clientY - rect.top,
    };
  };

  const startSigDraw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pt = getCanvasPoint(e);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    setIsDrawingSig(true);
  };

  const moveSigDraw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawingSig) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pt = getCanvasPoint(e);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  };

  const endSigDraw = () => {
    if (!isDrawingSig) return;
    setIsDrawingSig(false);
    const canvas = sigCanvasRef.current;
    if (canvas) {
      setCustSignatureDataUrl(canvas.toDataURL('image/png'));
    }
  };

  const handleImageFileToDataUrl = (
    file: File | undefined,
    onLoaded: (dataUrl: string) => void
  ) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onLoaded(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) {
      notify('Enter an Item Name.', 'error');
      return;
    }
    const selling = round2(Number(itemSellingPrice) || 0);
    const gstPct = activeProfile === 'GST' ? round2(Number(itemGstPercent) || 0) : 0;
    let base = activeProfile === 'GST' ? round2(Number(itemBasePrice) || 0) : 0;

    if (activeProfile === 'GST') {
      if (base <= 0 && selling > 0) {
        base = round2(selling - (selling * gstPct) / 100);
      }
    }

    const totalGstAmt = activeProfile === 'GST' ? round2(Math.max(0, selling - base)) : 0;
    const cgstAmt = round2(totalGstAmt / 2);
    const sgstAmt = round2(totalGstAmt - cgstAmt);

    const nextCode =
      itemCode.trim() || `ITM${String(state.items.length + 1).padStart(4, '0')}`;

    const record: ItemMaster = {
      id: itemEditId || `itm-${Date.now()}`,
      code: nextCode,
      barcode: itemBarcode.trim() || nextCode,
      name: itemName.trim(),
      category: itemCategory.trim() || 'General Items',
      unit: itemUnit || 'PCS',
      hsnCode: activeProfile === 'GST' ? itemHsn.trim() : '',
      gstPercent: gstPct,
      basePrice: base,
      cgstAmount: cgstAmt,
      sgstAmount: sgstAmt,
      sellingPrice: selling,
      purchasePrice: round2(Number(itemPurchasePrice) || 0),
      stockQty: round2(Number(itemStockQty) || 0),
      minStockLevel: round2(Number(itemMinStock) || 0),
      batches: itemBatches.length > 0 ? itemBatches : undefined,
      storeLocation: 'STORE-MAIN',
      updatedAt: new Date().toISOString(),
    };

    await saveMaster('ITEM', record);
    notify(`Item "${record.name}" saved to Common Item Master.`, 'success');
    resetItemForm();
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim()) {
      notify('Enter Customer Name.', 'error');
      return;
    }
    const record: CustomerMaster = {
      id: custEditId || `cst-${Date.now()}`,
      code: custCode.trim() || `CUS${String(state.customers.length + 1).padStart(4, '0')}`,
      name: custName.trim(),
      mobile: custMobile.trim(),
      email: custEmail.trim(),
      address: custAddress.trim(),
      gstin: custGstin.trim(),
      state: custState.trim(),
      openingBalanceGst: round2(Number(custOpenGst) || 0),
      openingBalanceNonGst: round2(Number(custOpenNonGst) || 0),
      signatureDataUrl: custSignatureDataUrl || undefined,
    };
    await saveMaster('CUSTOMER', record);
    notify(`Customer "${record.name}" saved to Common Customer Master.`, 'success');
    resetCustomerForm();
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim()) {
      notify('Enter Supplier Name.', 'error');
      return;
    }
    const record: SupplierMaster = {
      id: supEditId || `sup-${Date.now()}`,
      code: supCode.trim() || `SUP${String(state.suppliers.length + 1).padStart(4, '0')}`,
      name: supName.trim(),
      mobile: supMobile.trim(),
      email: supEmail.trim(),
      address: supAddress.trim(),
      gstin: supGstin.trim(),
      state: supState.trim(),
      openingBalanceGst: round2(Number(supOpenGst) || 0),
      openingBalanceNonGst: round2(Number(supOpenNonGst) || 0),
    };
    await saveMaster('SUPPLIER', record);
    notify(`Supplier "${record.name}" saved to Common Supplier Master.`, 'success');
    resetSupplierForm();
  };

  const categorizedItemGroups = getCategorizedItemSuggestions(state.items, itemSearchWord);

  const filteredCustomers = state.customers.filter((c) => {
    const q = customerSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      (c.mobile && c.mobile.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.gstin && c.gstin.toLowerCase().includes(q)) ||
      (c.address && c.address.toLowerCase().includes(q)) ||
      (c.state && c.state.toLowerCase().includes(q))
    );
  });

  const filteredSuppliers = state.suppliers.filter((s) => {
    const q = supplierSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      s.code.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      (s.mobile && s.mobile.toLowerCase().includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q)) ||
      (s.gstin && s.gstin.toLowerCase().includes(q)) ||
      (s.address && s.address.toLowerCase().includes(q)) ||
      (s.state && s.state.toLowerCase().includes(q))
    );
  });

  const filteredHsnCodes = state.hsnCodes.filter((h) => {
    const q = hsnSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      h.code.toLowerCase().includes(q) ||
      (h.description && h.description.toLowerCase().includes(q)) ||
      String(h.gstPercent).includes(q)
    );
  });

  return (
    <div className="flex flex-col min-h-[calc(100vh-84px)] bg-white">
      <div className="bg-[#0d6e6e] text-white px-4 py-2 flex flex-wrap items-center justify-between gap-3">
        <div className="font-bold text-sm tracking-wide">
          Common Master Management ({activeProfile} Profile View)
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {(
            [
              ['ITEM', 'Item Master'],
              ['CUSTOMER', 'Customer Master'],
              ['SUPPLIER', 'Supplier Master'],
              ['HSN', 'HSN Master'],
              ['BANK', 'Bank Master'],
              ['COMPANY', 'Company Master'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === id
                  ? 'bg-white text-[#0d6e6e]'
                  : 'bg-[#094e4e] text-slate-100 hover:bg-teal-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 flex-1 max-w-7xl mx-auto w-full">
        {/* 1. ITEM MASTER */}
        {activeTab === 'ITEM' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <form
              onSubmit={handleSaveItem}
              className="lg:col-span-5 border border-slate-300 rounded p-4 bg-white space-y-3 h-fit"
            >
              <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  {itemEditId ? 'Edit Common Item' : 'Add Common Item'} ({activeProfile} Mode)
                </h3>
                <span className="text-[11px] text-slate-500">Shared in GST &amp; Non-GST</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Item Code</label>
                  <input
                    type="text"
                    value={itemCode}
                    onChange={(e) => setItemCode(e.target.value)}
                    placeholder="Auto / ITM0001"
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono focus:border-[#0d6e6e] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Barcode</label>
                  <input
                    type="text"
                    value={itemBarcode}
                    onChange={(e) => setItemBarcode(e.target.value)}
                    placeholder="Scan or enter barcode"
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono focus:border-[#0d6e6e] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Item Name *</label>
                  <input
                    type="text"
                    required
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="e.g., Ball Pen Blue"
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 focus:border-[#0d6e6e] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Unit</label>
                  <select
                    value={itemUnit}
                    onChange={(e) => setItemUnit(e.target.value)}
                    className="w-full rounded border border-slate-300 bg-slate-50 px-2.5 py-1.5"
                  >
                    <option value="PCS">PCS</option>
                    <option value="BOX">BOX</option>
                    <option value="PKT">PKT</option>
                    <option value="SET">SET</option>
                    <option value="DOZ">DOZ</option>
                    <option value="KG">KG</option>
                  </select>
                </div>
              </div>

              <div className="text-xs">
                <label className="block font-bold text-slate-700 mb-1">
                  Category (for Categorized Word Search)
                </label>
                <input
                  list="item-categories-datalist"
                  type="text"
                  value={itemCategory}
                  onChange={(e) => setItemCategory(e.target.value)}
                  placeholder="Select or enter category"
                  className="w-full rounded border border-slate-300 px-2.5 py-1.5 focus:border-[#0d6e6e] focus:outline-none"
                />
                <datalist id="item-categories-datalist">
                  {DEFAULT_CATEGORIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              {activeProfile === 'GST' ? (
                <div className="p-3 rounded border border-teal-200 bg-teal-50/40 space-y-3 text-xs">
                  <div className="font-bold text-[#0d6e6e]">
                    GST Profile Fields (Base Price + CGST + SGST = Selling Price)
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">HSN Code</label>
                      <input
                        type="text"
                        value={itemHsn}
                        onChange={(e) => setItemHsn(e.target.value)}
                        placeholder="e.g., 9608"
                        className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        GST % (Split CGST/SGST)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={itemGstPercent}
                        onChange={(e) => {
                          const g = e.target.value;
                          setItemGstPercent(g);
                          const sp = Number(itemSellingPrice);
                          if (sp > 0) {
                            setItemBasePrice(String(round2(sp - (sp * (Number(g) || 0)) / 100)));
                          }
                        }}
                        className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Base Price (₹)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={itemBasePrice}
                        onChange={(e) => setItemBasePrice(e.target.value)}
                        placeholder="e.g., 4.50"
                        className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Selling Price / Rate (₹) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={itemSellingPrice}
                        onChange={(e) => {
                          const sp = e.target.value;
                          setItemSellingPrice(sp);
                          const spNum = Number(sp);
                          const gNum = Number(itemGstPercent) || 5;
                          if (spNum > 0 && !itemBasePrice) {
                            setItemBasePrice(String(round2(spNum - (spNum * gNum) / 100)));
                          }
                        }}
                        placeholder="e.g., 5.00"
                        className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 font-mono"
                      />
                    </div>
                  </div>

                  <div className="text-[11px] font-mono text-slate-700 bg-white p-2 rounded border border-slate-200">
                    CGST ({round2((Number(itemGstPercent) || 0) / 2)}%): ₹
                    {formatNumber(
                      Math.max(0, (Number(itemSellingPrice) || 0) - (Number(itemBasePrice) || 0)) /
                        2
                    )}{' '}
                    | SGST ({round2((Number(itemGstPercent) || 0) / 2)}%): ₹
                    {formatNumber(
                      Math.max(0, (Number(itemSellingPrice) || 0) - (Number(itemBasePrice) || 0)) /
                        2
                    )}{' '}
                    | Total Selling = ₹{formatNumber(Number(itemSellingPrice) || 0)}
                  </div>
                </div>
              ) : (
                <div className="text-xs">
                  <label className="block font-bold text-slate-700 mb-1">
                    Direct Selling Price / Rate (₹) * (Non-GST Direct Rate)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={itemSellingPrice}
                    onChange={(e) => setItemSellingPrice(e.target.value)}
                    placeholder="e.g., 5.00"
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono"
                  />
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Purchase Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    value={itemPurchasePrice}
                    onChange={(e) => setItemPurchasePrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Opening Stock</label>
                  <input
                    type="number"
                    step="0.01"
                    value={itemStockQty}
                    onChange={(e) => setItemStockQty(e.target.value)}
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Low Stock Alert</label>
                  <input
                    type="number"
                    step="1"
                    value={itemMinStock}
                    onChange={(e) => setItemMinStock(e.target.value)}
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono"
                  />
                </div>
              </div>

              {/* MULTI-BATCH & EXPIRY TRACKING MODULE */}
              <div className="p-3 rounded border border-slate-300 bg-slate-50 space-y-2.5 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    <Layers className="w-3.5 h-3.5 text-[#0d6e6e]" />
                    <span>Stock Batch &amp; Expiry Tracking (Link Multiple Batches to SKU)</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-600">
                    {itemBatches.length} Batch(es)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                      Batch / Lot No *
                    </label>
                    <input
                      type="text"
                      value={newBatchNo}
                      onChange={(e) => setNewBatchNo(e.target.value)}
                      placeholder="e.g. LOT-2026A"
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                      Mfg Date
                    </label>
                    <input
                      type="date"
                      value={newBatchMfgDate}
                      onChange={(e) => setNewBatchMfgDate(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                      Expiry Date *
                    </label>
                    <input
                      type="date"
                      value={newBatchExpiryDate}
                      onChange={(e) => setNewBatchExpiryDate(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                      Batch Qty *
                    </label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        step="0.01"
                        value={newBatchQty}
                        onChange={(e) => setNewBatchQty(e.target.value)}
                        placeholder="Qty"
                        className="w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-[11px]"
                      />
                      <button
                        type="button"
                        onClick={handleAddStockBatch}
                        title="Add Batch to SKU"
                        className="rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold px-2.5 py-1 text-[11px] shrink-0 cursor-pointer"
                      >
                        +Add
                      </button>
                    </div>
                  </div>
                </div>

                {itemBatches.length > 0 ? (
                  <div className="border border-slate-200 rounded bg-white overflow-hidden">
                    <table className="w-full border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-left">
                          <th className="py-1 px-2">Batch No</th>
                          <th className="py-1 px-2">Expiry Date</th>
                          <th className="py-1 px-2">Status (30d Check)</th>
                          <th className="py-1 px-2 text-right">Qty</th>
                          <th className="py-1 px-2 text-right">Del</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {itemBatches.map((b) => {
                          const expInfo = getBatchExpiryStatus(b.expiryDate);
                          return (
                            <tr
                              key={b.id}
                              className={
                                expInfo.status === 'EXPIRED'
                                  ? 'bg-red-50/80'
                                  : expInfo.status === 'EXPIRING_SOON'
                                  ? 'bg-amber-50/80'
                                  : ''
                              }
                            >
                              <td className="py-1 px-2 font-bold text-slate-900">{b.batchNo}</td>
                              <td className="py-1 px-2">{b.expiryDate}</td>
                              <td className="py-1 px-2 font-sans">
                                {expInfo.status === 'EXPIRED' ? (
                                  <span className="inline-flex items-center gap-1 rounded bg-red-600 text-white px-1.5 py-0.5 text-[10px] font-bold">
                                    <AlertOctagon className="w-2.5 h-2.5" />
                                    EXPIRED ({Math.abs(expInfo.daysRemaining)}d ago)
                                  </span>
                                ) : expInfo.status === 'EXPIRING_SOON' ? (
                                  <span className="inline-flex items-center gap-1 rounded bg-amber-600 text-white px-1.5 py-0.5 text-[10px] font-bold">
                                    <AlertTriangle className="w-2.5 h-2.5" />
                                    EXPIRING IN {expInfo.daysRemaining}d (&le;30d)
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-semibold">
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                    Valid ({expInfo.daysRemaining}d)
                                  </span>
                                )}
                              </td>
                              <td className="py-1 px-2 text-right font-bold">
                                {b.qty} {itemUnit}
                              </td>
                              <td className="py-1 px-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveStockBatch(b.id)}
                                  className="text-red-600 hover:text-red-800 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3 inline" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    Optional: Add batch numbers and expiry dates above to track multiple stock lots
                    for this SKU. Batches expiring within 30 days trigger automatic visual alerts.
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-1.5 rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold text-xs py-2 px-4 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{itemEditId ? 'Update Item' : 'Save Item'}</span>
                </button>
                <button
                  type="button"
                  onClick={resetItemForm}
                  className="rounded border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={onExit}
                  className="rounded bg-slate-700 text-white px-4 py-2 text-xs font-semibold hover:bg-slate-800 cursor-pointer"
                >
                  Exit
                </button>
              </div>
            </form>

            {/* Categorized Word/Letter Suggestion List View */}
            <div className="lg:col-span-7 border border-slate-300 rounded p-4 bg-white flex flex-col space-y-3">
              {/* 30-Day Batch Expiry Warning Summary Banner */}
              {(() => {
                const itemsWithExpiryRisk = state.items.filter((it) => {
                  const summary = getItemBatchExpirySummary(it);
                  return summary.expiredCount > 0 || summary.expiringSoonCount > 0;
                });
                if (itemsWithExpiryRisk.length === 0) return null;
                return (
                  <div className="p-2.5 rounded border border-amber-300 bg-amber-50 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-amber-900">
                      <CalendarClock className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>
                        <strong>Batch Expiry Alert:</strong> {itemsWithExpiryRisk.length} SKU(s)
                        have batches expiring within 30 days or already expired.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOnlyExpiringItems((prev) => !prev)}
                      className={`px-2.5 py-1 rounded font-bold text-[11px] cursor-pointer ${
                        onlyExpiringItems
                          ? 'bg-amber-800 text-white'
                          : 'bg-amber-600 hover:bg-amber-700 text-white'
                      }`}
                    >
                      {onlyExpiringItems ? 'Show All Items' : 'Filter Expiring (<= 30 Days)'}
                    </button>
                  </div>
                );
              })()}

              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Categorized Item Master Directory ({state.items.length})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Click any item row to edit SKU details or manage linked stock batches &amp;
                    expiry dates.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOnlyExpiringItems((v) => !v)}
                    className={`px-2.5 py-1.5 rounded border text-[11px] font-bold cursor-pointer ${
                      onlyExpiringItems
                        ? 'border-amber-600 bg-amber-600 text-white'
                        : 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    &le;30d Expiry Filter
                  </button>
                  <div className="relative w-56">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      value={itemSearchWord}
                      onChange={(e) => setItemSearchWord(e.target.value)}
                      placeholder="Search item, code, batch..."
                      className="w-full rounded border border-slate-300 pl-8 pr-3 py-1.5 text-xs focus:border-[#0d6e6e] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto max-h-[540px] space-y-3">
                {state.items.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded">
                    Item Master is empty (no sample data loaded). Use the form on the left to add
                    your first item.
                  </div>
                ) : categorizedItemGroups.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    No items found matching &ldquo;{itemSearchWord}&rdquo;.
                  </div>
                ) : (
                  categorizedItemGroups.map((group) => {
                    const visibleItems = onlyExpiringItems
                      ? group.items.filter((it) => {
                          const s = getItemBatchExpirySummary(it);
                          return s.expiredCount > 0 || s.expiringSoonCount > 0;
                        })
                      : group.items;
                    if (visibleItems.length === 0) return null;

                    return (
                      <div
                        key={group.category}
                        className="border border-slate-200 rounded overflow-hidden"
                      >
                        <div className="bg-slate-100 px-3 py-1.5 text-xs font-bold text-[#0d6e6e] flex items-center justify-between border-b border-slate-200">
                          <span className="flex items-center gap-1.5">
                            <FolderOpen className="w-3.5 h-3.5" />
                            {group.category}
                          </span>
                          <span className="font-mono text-[11px] text-slate-600">
                            {visibleItems.length} item(s)
                          </span>
                        </div>
                        <table className="w-full border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 text-left">
                              <th className="py-1.5 px-2.5">Code</th>
                              <th className="py-1.5 px-2.5">Name</th>
                              <th className="py-1.5 px-2.5">Batches / Expiry</th>
                              {activeProfile === 'GST' && (
                                <>
                                  <th className="py-1.5 px-2.5">HSN</th>
                                  <th className="py-1.5 px-2.5 text-right">Base</th>
                                  <th className="py-1.5 px-2.5 text-right">CGST+SGST</th>
                                </>
                              )}
                              <th className="py-1.5 px-2.5 text-right">Selling Price</th>
                              <th className="py-1.5 px-2.5 text-right">Stock</th>
                              <th className="py-1.5 px-2.5 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-mono">
                            {visibleItems.map((it) => {
                              const batchSummary = getItemBatchExpirySummary(it);
                              return (
                                <tr
                                  key={it.id}
                                  onClick={() => {
                                    setItemEditId(it.id);
                                    setItemCode(it.code);
                                    setItemBarcode(it.barcode);
                                    setItemName(it.name);
                                    setItemCategory(it.category);
                                    setItemUnit(it.unit);
                                    setItemHsn(it.hsnCode);
                                    setItemGstPercent(String(it.gstPercent));
                                    setItemBasePrice(String(it.basePrice));
                                    setItemSellingPrice(String(it.sellingPrice));
                                    setItemPurchasePrice(String(it.purchasePrice));
                                    setItemStockQty(String(it.stockQty));
                                    setItemMinStock(String(it.minStockLevel));
                                    setItemBatches(it.batches || []);
                                  }}
                                  className={`hover:bg-teal-50/40 cursor-pointer ${
                                    batchSummary.expiredCount > 0
                                      ? 'bg-red-50/40'
                                      : batchSummary.expiringSoonCount > 0
                                      ? 'bg-amber-50/40'
                                      : ''
                                  }`}
                                >
                                  <td className="py-1.5 px-2.5">{it.code}</td>
                                  <td className="py-1.5 px-2.5 font-sans font-semibold text-slate-900">
                                    {it.name}
                                  </td>
                                  <td className="py-1.5 px-2.5 font-sans">
                                    {batchSummary.totalBatches === 0 ? (
                                      <span className="text-[10px] text-slate-400">No batches</span>
                                    ) : batchSummary.expiredCount > 0 ? (
                                      <span className="inline-flex items-center gap-1 rounded bg-red-600 text-white px-1.5 py-0.5 text-[10px] font-bold">
                                        <AlertOctagon className="w-2.5 h-2.5" />
                                        {batchSummary.expiredCount} Expired
                                      </span>
                                    ) : batchSummary.expiringSoonCount > 0 ? (
                                      <span className="inline-flex items-center gap-1 rounded bg-amber-600 text-white px-1.5 py-0.5 text-[10px] font-bold">
                                        <AlertTriangle className="w-2.5 h-2.5" />
                                        Exp in {batchSummary.nearestBatch?.daysRemaining}d (&le;30d)
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-semibold">
                                        {batchSummary.totalBatches} Batch(es) OK
                                      </span>
                                    )}
                                  </td>
                                  {activeProfile === 'GST' && (
                                    <>
                                      <td className="py-1.5 px-2.5">{it.hsnCode || '-'}</td>
                                      <td className="py-1.5 px-2.5 text-right">
                                        ₹{formatNumber(it.basePrice)}
                                      </td>
                                      <td className="py-1.5 px-2.5 text-right text-[11px]">
                                        ₹{formatNumber(it.cgstAmount)}+₹{formatNumber(it.sgstAmount)}
                                      </td>
                                    </>
                                  )}
                                  <td className="py-1.5 px-2.5 text-right font-bold text-[#0d6e6e]">
                                    ₹{formatNumber(it.sellingPrice)}
                                  </td>
                                  <td
                                    className={`py-1.5 px-2.5 text-right ${
                                      it.stockQty <= it.minStockLevel
                                        ? 'text-red-600 font-bold'
                                        : 'text-slate-700'
                                    }`}
                                  >
                                    {it.stockQty} {it.unit}
                                  </td>
                                  <td className="py-1.5 px-2.5 text-right">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        saveMaster('ITEM', undefined, it.id);
                                        notify(`Deleted item ${it.name}`, 'info');
                                      }}
                                      className="text-red-600 hover:text-red-800 p-1 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 inline" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2. CUSTOMER MASTER (with Search & Customer Signature Printed on Bills) */}
        {activeTab === 'CUSTOMER' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <form
              onSubmit={handleSaveCustomer}
              className="lg:col-span-5 border border-slate-300 rounded p-4 bg-white space-y-3 h-fit text-xs"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-sm font-bold text-slate-900">
                  {custEditId ? 'Edit Customer' : 'Common Customer Master'}
                </h3>
                <span className="text-[11px] text-slate-500">Shared in GST &amp; Non-GST</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Customer Code</label>
                  <input
                    type="text"
                    value={custCode}
                    onChange={(e) => setCustCode(e.target.value)}
                    placeholder="Auto / CUS0001"
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Customer Name *</label>
                  <input
                    type="text"
                    required
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    placeholder="Enter Full Name"
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Mobile No</label>
                  <input
                    type="text"
                    value={custMobile}
                    onChange={(e) => setCustMobile(e.target.value)}
                    placeholder="10-digit mobile"
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Email (for Auto Receipts)</label>
                  <input
                    type="email"
                    value={custEmail}
                    onChange={(e) => setCustEmail(e.target.value)}
                    placeholder="customer@domain.com"
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">Address</label>
                <input
                  type="text"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  placeholder="Street, City"
                  className="w-full rounded border border-slate-300 px-2.5 py-1.5"
                />
              </div>
              {activeProfile === 'GST' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold mb-1">GSTIN</label>
                    <input
                      type="text"
                      value={custGstin}
                      onChange={(e) => setCustGstin(e.target.value)}
                      placeholder="Customer GSTIN"
                      className="w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">State</label>
                    <input
                      type="text"
                      value={custState}
                      onChange={(e) => setCustState(e.target.value)}
                      placeholder="State"
                      className="w-full rounded border border-slate-300 px-2.5 py-1.5"
                    />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Opening Balance (GST)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={custOpenGst}
                    onChange={(e) => setCustOpenGst(e.target.value)}
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Opening Balance (Non-GST)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={custOpenNonGst}
                    onChange={(e) => setCustOpenNonGst(e.target.value)}
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono"
                  />
                </div>
              </div>

              {/* Customer Signature Upload / Draw Pad (Printed on Bills) */}
              <div className="p-3 rounded border border-slate-200 bg-slate-50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <PenTool className="w-3.5 h-3.5 text-[#0d6e6e]" />
                    <span>Customer Signature (Printed on Bill)</span>
                  </label>
                  {custSignatureDataUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustSignatureDataUrl('');
                        clearSignatureCanvas();
                      }}
                      className="text-[11px] font-semibold text-red-600 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Eraser className="w-3 h-3" />
                      Remove
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <label className="flex items-center gap-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 px-2.5 py-1.5 font-semibold text-slate-700 cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-[#0d6e6e]" />
                    <span>Upload Signature Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        handleImageFileToDataUrl(e.target.files?.[0], (url) =>
                          setCustSignatureDataUrl(url)
                        )
                      }
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSignaturePad((prev) => !prev)}
                    className="flex items-center gap-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 px-2.5 py-1.5 font-semibold text-slate-700 cursor-pointer"
                  >
                    <PenTool className="w-3.5 h-3.5 text-[#0d6e6e]" />
                    <span>{showSignaturePad ? 'Hide Signature Pad' : 'Draw Signature'}</span>
                  </button>
                </div>

                {showSignaturePad && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] text-slate-500 flex items-center justify-between">
                      <span>Draw customer signature inside the box below:</span>
                      <button
                        type="button"
                        onClick={clearSignatureCanvas}
                        className="text-slate-600 hover:text-slate-900 underline cursor-pointer"
                      >
                        Clear Pad
                      </button>
                    </div>
                    <canvas
                      ref={sigCanvasRef}
                      width={320}
                      height={100}
                      onMouseDown={startSigDraw}
                      onMouseMove={moveSigDraw}
                      onMouseUp={endSigDraw}
                      onMouseLeave={endSigDraw}
                      onTouchStart={startSigDraw}
                      onTouchMove={moveSigDraw}
                      onTouchEnd={endSigDraw}
                      className="w-full h-24 bg-white border border-slate-300 rounded cursor-crosshair touch-none"
                    />
                  </div>
                )}

                {custSignatureDataUrl && (
                  <div className="p-2 rounded bg-white border border-slate-200 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">Saved Signature Preview:</span>
                    <img
                      src={custSignatureDataUrl}
                      alt="Customer Signature"
                      className="h-10 max-w-[160px] object-contain border border-slate-100 bg-white px-1"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold py-2 cursor-pointer"
                >
                  {custEditId ? 'Update Customer' : 'Save Customer'}
                </button>
                <button
                  type="button"
                  onClick={resetCustomerForm}
                  className="rounded border border-slate-300 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </form>

            <div className="lg:col-span-7 border border-slate-300 rounded p-4 bg-white flex flex-col space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Registered Customers ({filteredCustomers.length} / {state.customers.length})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Click any customer row to edit details or update bill signature.
                  </p>
                </div>
                <div className="relative w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    value={customerSearchQuery}
                    onChange={(e) => setCustomerSearchQuery(e.target.value)}
                    placeholder="Search customer name, mobile, code..."
                    className="w-full rounded border border-slate-300 pl-8 pr-3 py-1.5 text-xs focus:border-[#0d6e6e] focus:outline-none"
                  />
                </div>
              </div>

              <div className="overflow-x-auto flex-1">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-left">
                      <th className="py-2 px-2.5">Code</th>
                      <th className="py-2 px-2.5">Name</th>
                      <th className="py-2 px-2.5">Mobile</th>
                      <th className="py-2 px-2.5">Signature</th>
                      <th className="py-2 px-2.5 text-right">Opening ({activeProfile})</th>
                      <th className="py-2 px-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    {filteredCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center font-sans text-slate-500">
                          {state.customers.length === 0
                            ? 'No customers registered yet.'
                            : `No customers matching "${customerSearchQuery}".`}
                        </td>
                      </tr>
                    ) : (
                      filteredCustomers.map((c) => (
                        <tr
                          key={c.id}
                          onClick={() => {
                            setCustEditId(c.id);
                            setCustCode(c.code);
                            setCustName(c.name);
                            setCustMobile(c.mobile);
                            setCustEmail(c.email);
                            setCustAddress(c.address);
                            setCustGstin(c.gstin);
                            setCustState(c.state);
                            setCustOpenGst(String(c.openingBalanceGst));
                            setCustOpenNonGst(String(c.openingBalanceNonGst));
                            setCustSignatureDataUrl(c.signatureDataUrl || '');
                          }}
                          className="hover:bg-teal-50/40 cursor-pointer"
                        >
                          <td className="py-1.5 px-2.5">{c.code}</td>
                          <td className="py-1.5 px-2.5 font-sans font-semibold">{c.name}</td>
                          <td className="py-1.5 px-2.5">{c.mobile || '-'}</td>
                          <td className="py-1.5 px-2.5 font-sans">
                            {c.signatureDataUrl ? (
                              <img
                                src={c.signatureDataUrl}
                                alt="Sig"
                                className="h-6 max-w-[80px] object-contain border border-slate-200 bg-white px-1"
                              />
                            ) : (
                              <span className="text-[11px] text-slate-400">None</span>
                            )}
                          </td>
                          <td className="py-1.5 px-2.5 text-right">
                            {formatNumber(
                              activeProfile === 'GST' ? c.openingBalanceGst : c.openingBalanceNonGst
                            )}
                          </td>
                          <td className="py-1.5 px-2.5 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                saveMaster('CUSTOMER', undefined, c.id);
                              }}
                              className="text-red-600 hover:text-red-800 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 inline" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 3. SUPPLIER MASTER (with Search Option) */}
        {activeTab === 'SUPPLIER' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <form
              onSubmit={handleSaveSupplier}
              className="lg:col-span-5 border border-slate-300 rounded p-4 bg-white space-y-3 h-fit text-xs"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-sm font-bold text-slate-900">
                  {supEditId ? 'Edit Supplier' : 'Common Supplier Master'}
                </h3>
                <span className="text-[11px] text-slate-500">Shared in GST &amp; Non-GST</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Supplier Code</label>
                  <input
                    type="text"
                    value={supCode}
                    onChange={(e) => setSupCode(e.target.value)}
                    placeholder="Auto / SUP0001"
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Supplier Name *</label>
                  <input
                    type="text"
                    required
                    value={supName}
                    onChange={(e) => setSupName(e.target.value)}
                    placeholder="Supplier Firm Name"
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Mobile (for WhatsApp PO)</label>
                  <input
                    type="text"
                    value={supMobile}
                    onChange={(e) => setSupMobile(e.target.value)}
                    placeholder="10-digit WhatsApp No"
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Email</label>
                  <input
                    type="email"
                    value={supEmail}
                    onChange={(e) => setSupEmail(e.target.value)}
                    placeholder="supplier@domain.com"
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">Address</label>
                <input
                  type="text"
                  value={supAddress}
                  onChange={(e) => setSupAddress(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2.5 py-1.5"
                />
              </div>
              {activeProfile === 'GST' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold mb-1">GSTIN</label>
                    <input
                      type="text"
                      value={supGstin}
                      onChange={(e) => setSupGstin(e.target.value)}
                      className="w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">State</label>
                    <input
                      type="text"
                      value={supState}
                      onChange={(e) => setSupState(e.target.value)}
                      className="w-full rounded border border-slate-300 px-2.5 py-1.5"
                    />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Opening Payable (GST)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={supOpenGst}
                    onChange={(e) => setSupOpenGst(e.target.value)}
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Opening Payable (Non-GST)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={supOpenNonGst}
                    onChange={(e) => setSupOpenNonGst(e.target.value)}
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold py-2 cursor-pointer"
                >
                  {supEditId ? 'Update Supplier' : 'Save Supplier'}
                </button>
                <button
                  type="button"
                  onClick={resetSupplierForm}
                  className="rounded border border-slate-300 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </form>

            <div className="lg:col-span-7 border border-slate-300 rounded p-4 bg-white flex flex-col space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Registered Suppliers ({filteredSuppliers.length} / {state.suppliers.length})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Click any supplier row to edit or view contact details.
                  </p>
                </div>
                <div className="relative w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    value={supplierSearchQuery}
                    onChange={(e) => setSupplierSearchQuery(e.target.value)}
                    placeholder="Search supplier name, mobile, code..."
                    className="w-full rounded border border-slate-300 pl-8 pr-3 py-1.5 text-xs focus:border-[#0d6e6e] focus:outline-none"
                  />
                </div>
              </div>

              <div className="overflow-x-auto flex-1">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-left">
                      <th className="py-2 px-2.5">Code</th>
                      <th className="py-2 px-2.5">Name</th>
                      <th className="py-2 px-2.5">WhatsApp Mobile</th>
                      <th className="py-2 px-2.5 text-right">Opening ({activeProfile})</th>
                      <th className="py-2 px-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    {filteredSuppliers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center font-sans text-slate-500">
                          {state.suppliers.length === 0
                            ? 'No suppliers registered yet.'
                            : `No suppliers matching "${supplierSearchQuery}".`}
                        </td>
                      </tr>
                    ) : (
                      filteredSuppliers.map((s) => (
                        <tr
                          key={s.id}
                          onClick={() => {
                            setSupEditId(s.id);
                            setSupCode(s.code);
                            setSupName(s.name);
                            setSupMobile(s.mobile);
                            setSupEmail(s.email);
                            setSupAddress(s.address);
                            setSupGstin(s.gstin);
                            setSupState(s.state);
                            setSupOpenGst(String(s.openingBalanceGst));
                            setSupOpenNonGst(String(s.openingBalanceNonGst));
                          }}
                          className="hover:bg-teal-50/40 cursor-pointer"
                        >
                          <td className="py-1.5 px-2.5">{s.code}</td>
                          <td className="py-1.5 px-2.5 font-sans font-semibold">{s.name}</td>
                          <td className="py-1.5 px-2.5">{s.mobile || '-'}</td>
                          <td className="py-1.5 px-2.5 text-right">
                            {formatNumber(
                              activeProfile === 'GST' ? s.openingBalanceGst : s.openingBalanceNonGst
                            )}
                          </td>
                          <td className="py-1.5 px-2.5 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                saveMaster('SUPPLIER', undefined, s.id);
                              }}
                              className="text-red-600 hover:text-red-800 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 inline" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 4. HSN MASTER (with Search Option) */}
        {activeTab === 'HSN' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 text-xs">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!hsnCode.trim()) return;
                const g = round2(Number(hsnGst) || 0);
                const record: HsnMaster = {
                  id: hsnEditId || `hsn-${Date.now()}`,
                  code: hsnCode.trim(),
                  description: hsnDesc.trim(),
                  gstPercent: g,
                  cgstPercent: round2(g / 2),
                  sgstPercent: round2(g / 2),
                };
                saveMaster('HSN', record);
                resetHsnForm();
                notify(`HSN ${record.code} saved.`, 'success');
              }}
              className="md:col-span-5 border border-slate-300 rounded p-4 bg-white space-y-3 h-fit"
            >
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
                {hsnEditId ? 'Edit HSN / SAC Code' : 'HSN / SAC Tax Master'}
              </h3>
              <div>
                <label className="block font-bold mb-1">HSN Code *</label>
                <input
                  type="text"
                  required
                  value={hsnCode}
                  onChange={(e) => setHsnCode(e.target.value)}
                  placeholder="e.g., 9608"
                  className="w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Description</label>
                <input
                  type="text"
                  value={hsnDesc}
                  onChange={(e) => setHsnDesc(e.target.value)}
                  placeholder="Pens, markers, stationery"
                  className="w-full rounded border border-slate-300 px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Total GST %</label>
                <input
                  type="number"
                  step="0.1"
                  value={hsnGst}
                  onChange={(e) => setHsnGst(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold py-2 cursor-pointer"
                >
                  {hsnEditId ? 'Update HSN Code' : 'Save HSN Code'}
                </button>
                <button
                  type="button"
                  onClick={resetHsnForm}
                  className="rounded border border-slate-300 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </form>

            <div className="md:col-span-7 border border-slate-300 rounded p-4 bg-white flex flex-col space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Registered HSN Codes ({filteredHsnCodes.length} / {state.hsnCodes.length})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Search by HSN code, item description, or GST percentage.
                  </p>
                </div>
                <div className="relative w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    value={hsnSearchQuery}
                    onChange={(e) => setHsnSearchQuery(e.target.value)}
                    placeholder="Search HSN code or description..."
                    className="w-full rounded border border-slate-300 pl-8 pr-3 py-1.5 text-xs focus:border-[#0d6e6e] focus:outline-none"
                  />
                </div>
              </div>

              <div className="overflow-x-auto flex-1">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-left">
                      <th className="py-2 px-2.5">HSN</th>
                      <th className="py-2 px-2.5">Description</th>
                      <th className="py-2 px-2.5 text-right">CGST %</th>
                      <th className="py-2 px-2.5 text-right">SGST %</th>
                      <th className="py-2 px-2.5 text-right">Total GST %</th>
                      <th className="py-2 px-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    {filteredHsnCodes.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center font-sans text-slate-500">
                          {state.hsnCodes.length === 0
                            ? 'No HSN codes registered yet.'
                            : `No HSN codes matching "${hsnSearchQuery}".`}
                        </td>
                      </tr>
                    ) : (
                      filteredHsnCodes.map((h) => (
                        <tr
                          key={h.id}
                          onClick={() => {
                            setHsnEditId(h.id);
                            setHsnCode(h.code);
                            setHsnDesc(h.description);
                            setHsnGst(String(h.gstPercent));
                          }}
                          className="hover:bg-teal-50/40 cursor-pointer"
                        >
                          <td className="py-1.5 px-2.5 font-bold">{h.code}</td>
                          <td className="py-1.5 px-2.5 font-sans">{h.description}</td>
                          <td className="py-1.5 px-2.5 text-right">
                            {formatNumber(h.cgstPercent)}%
                          </td>
                          <td className="py-1.5 px-2.5 text-right">
                            {formatNumber(h.sgstPercent)}%
                          </td>
                          <td className="py-1.5 px-2.5 text-right font-bold">
                            {formatNumber(h.gstPercent)}%
                          </td>
                          <td className="py-1.5 px-2.5 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                saveMaster('HSN', undefined, h.id);
                              }}
                              className="text-red-600 hover:text-red-800 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 inline" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 5. BANK MASTER */}
        {activeTab === 'BANK' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 text-xs">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!bankName.trim()) return;
                const record: BankMaster = {
                  id: `bnk-${Date.now()}`,
                  bankName: bankName.trim(),
                  accountNo: bankAcc.trim(),
                  ifsc: bankIfsc.trim(),
                  branch: bankBranch.trim(),
                  openingBalanceGst: round2(Number(bankOpenGst) || 0),
                  openingBalanceNonGst: round2(Number(bankOpenNonGst) || 0),
                };
                saveMaster('BANK', record);
                setBankName('');
                setBankAcc('');
                setBankIfsc('');
                setBankBranch('');
                notify(`Bank "${record.bankName}" saved.`, 'success');
              }}
              className="md:col-span-5 border border-slate-300 rounded p-4 bg-white space-y-3 h-fit"
            >
              <h3 className="text-sm font-bold text-slate-900">Bank Account Master</h3>
              <div>
                <label className="block font-bold mb-1">Bank Name *</label>
                <input
                  type="text"
                  required
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Account Number</label>
                <input
                  type="text"
                  value={bankAcc}
                  onChange={(e) => setBankAcc(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">IFSC Code</label>
                  <input
                    type="text"
                    value={bankIfsc}
                    onChange={(e) => setBankIfsc(e.target.value)}
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Branch</label>
                  <input
                    type="text"
                    value={bankBranch}
                    onChange={(e) => setBankBranch(e.target.value)}
                    className="w-full rounded border border-slate-300 px-2.5 py-1.5"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full rounded bg-[#0d6e6e] text-white font-bold py-2 cursor-pointer"
              >
                Save Bank Account
              </button>
            </form>

            <div className="md:col-span-7 border border-slate-300 rounded p-4 bg-white">
              <h3 className="text-sm font-bold text-slate-900 mb-3">
                Registered Banks ({state.banks.length})
              </h3>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-left">
                    <th className="py-2 px-2.5">Bank Name</th>
                    <th className="py-2 px-2.5">Account No</th>
                    <th className="py-2 px-2.5">IFSC</th>
                    <th className="py-2 px-2.5">Branch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {state.banks.map((b) => (
                    <tr key={b.id}>
                      <td className="py-1.5 px-2.5 font-sans font-semibold">{b.bankName}</td>
                      <td className="py-1.5 px-2.5">{b.accountNo}</td>
                      <td className="py-1.5 px-2.5">{b.ifsc}</td>
                      <td className="py-1.5 px-2.5 font-sans">{b.branch}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 6. COMPANY MASTER (with Company Logo Printed on Bills) */}
        {activeTab === 'COMPANY' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMaster('COMPANY', companyForm);
              notify('Company Master, Firm Logo & Invoice Header Configuration saved.', 'success');
            }}
            className="max-w-3xl mx-auto border border-slate-300 rounded p-5 bg-white space-y-4 text-xs"
          >
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
              Company / Firm Master &amp; Bill Logo Configuration
            </h3>

            {/* Company Logo Upload & Bill Header Preview */}
            <div className="p-4 rounded border border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <ImagePlus className="w-4 h-4 text-[#0d6e6e]" />
                  <span>Company Logo (Printed on A4, A5 &amp; Thermal Bills)</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Upload your firm or brand logo (PNG, JPG, SVG, WebP). It will automatically appear
                  at the top of all printed GST and Non-GST bills.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <label className="inline-flex items-center gap-1.5 rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold px-3 py-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Company Logo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        handleImageFileToDataUrl(e.target.files?.[0], (url) =>
                          setCompanyForm((prev) => ({ ...prev, logoDataUrl: url }))
                        )
                      }
                      className="hidden"
                    />
                  </label>
                  {companyForm.logoDataUrl && (
                    <button
                      type="button"
                      onClick={() => setCompanyForm((prev) => ({ ...prev, logoDataUrl: '' }))}
                      className="inline-flex items-center gap-1 rounded border border-red-300 bg-white hover:bg-red-50 text-red-600 font-semibold px-2.5 py-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove Logo</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="w-32 h-24 rounded border border-slate-300 bg-white flex items-center justify-center p-2 shrink-0">
                {companyForm.logoDataUrl ? (
                  <img
                    src={companyForm.logoDataUrl}
                    alt="Company Bill Logo"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-[11px] text-slate-400 text-center">No Logo Uploaded</span>
                )}
              </div>
            </div>

            {/* Authorized Company Signature Upload & Responsive Bill Print Preview */}
            <div className="p-4 rounded border border-slate-200 bg-slate-50 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <PenTool className="w-4 h-4 text-[#0d6e6e]" />
                    <span>Authorized Signature (Printed on POS Bills &amp; Invoices)</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Upload your Authorized Signatory image (PNG, JPG, WebP). The signature rendering
                    is responsive and retains its natural aspect ratio when injected into A4/A5 PDF
                    invoices and 80mm/58mm thermal print layouts.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <label className="inline-flex items-center gap-1.5 rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold px-3 py-1.5 cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Signature</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          handleImageFileToDataUrl(e.target.files?.[0], (url) =>
                            setCompanyForm((prev) => ({ ...prev, signatureDataUrl: url }))
                          )
                        }
                        className="hidden"
                      />
                    </label>
                    {companyForm.signatureDataUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setCompanyForm((prev) => ({ ...prev, signatureDataUrl: '' }))
                        }
                        className="inline-flex items-center gap-1 rounded border border-red-300 bg-white hover:bg-red-50 text-red-600 font-semibold px-2.5 py-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove Signature</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="w-44 h-24 rounded border border-slate-300 bg-white flex flex-col items-center justify-center p-2 shrink-0">
                  {companyForm.signatureDataUrl ? (
                    <img
                      src={companyForm.signatureDataUrl}
                      alt="Company Authorized Signature"
                      className="w-auto h-auto max-h-16 max-w-full object-contain aspect-auto"
                    />
                  ) : (
                    <span className="text-[11px] text-slate-400 text-center">
                      No Signature Uploaded
                    </span>
                  )}
                </div>
              </div>

              {/* Responsive Aspect-Ratio Live Print Layout Previews (A4/A5 PDF vs Thermal Receipt) */}
              {companyForm.signatureDataUrl && (
                <div className="pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded border border-slate-300 bg-white p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 border-b border-slate-100 pb-1 mb-2">
                      <span className="font-bold text-slate-700">
                        A4 / A5 PDF Invoice Signatory Preview
                      </span>
                      <span className="font-mono text-emerald-700">Aspect Ratio Locked</span>
                    </div>
                    <div className="flex flex-col items-end text-right">
                      <div className="w-full flex justify-end items-center min-h-[48px]">
                        <img
                          src={companyForm.signatureDataUrl}
                          alt="A4 PDF Signatory Preview"
                          className="w-auto h-auto max-h-14 max-w-[170px] object-contain aspect-auto mb-1"
                        />
                      </div>
                      <span className="text-[10px] font-semibold text-slate-800 border-t border-slate-400 pt-1">
                        Authorised Signatory
                      </span>
                    </div>
                  </div>

                  <div className="rounded border border-slate-300 bg-white p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 border-b border-slate-100 pb-1 mb-2">
                      <span className="font-bold text-slate-700">
                        80mm / 58mm Thermal Roll Preview
                      </span>
                      <span className="font-mono text-emerald-700">Responsive Scale</span>
                    </div>
                    <div className="mx-auto w-full max-w-[210px] border border-dashed border-slate-300 rounded px-2.5 py-2 flex flex-col items-end text-right bg-slate-50/50">
                      <img
                        src={companyForm.signatureDataUrl}
                        alt="Thermal Print Signatory Preview"
                        className="w-auto h-auto max-h-10 max-w-[125px] object-contain aspect-auto mb-1"
                      />
                      <span className="text-[9px] font-semibold text-slate-800 border-t border-slate-400 pt-0.5">
                        Authorised Signatory
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold mb-1">Firm / Business Name</label>
                <input
                  type="text"
                  value={companyForm.firmName}
                  onChange={(e) => setCompanyForm({ ...companyForm, firmName: e.target.value })}
                  placeholder="Enter Firm Name"
                  className="w-full rounded border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">GSTIN (Printed on GST Bills)</label>
                <input
                  type="text"
                  value={companyForm.gstin}
                  onChange={(e) => setCompanyForm({ ...companyForm, gstin: e.target.value })}
                  placeholder="22AAAAA0000A1Z5"
                  className="w-full rounded border border-slate-300 px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Phone / Contact</label>
                <input
                  type="text"
                  value={companyForm.phone}
                  onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                  className="w-full rounded border border-slate-300 px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">UPI ID (for Bill QR Code Payment)</label>
                <input
                  type="text"
                  value={companyForm.upiId}
                  onChange={(e) => setCompanyForm({ ...companyForm, upiId: e.target.value })}
                  placeholder="8077784917@axl"
                  className="w-full rounded border border-slate-300 px-3 py-2 font-mono"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-bold mb-1">Shop / Office Address</label>
                <input
                  type="text"
                  value={companyForm.address}
                  onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                  className="w-full rounded border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Multi-Currency Processing</label>
                <select
                  value={companyForm.currency}
                  onChange={(e) =>
                    setCompanyForm({ ...companyForm, currency: e.target.value as any })
                  }
                  className="w-full rounded border border-slate-300 bg-slate-50 px-3 py-2"
                >
                  <option value="INR">INR (₹ - Indian Rupee)</option>
                  <option value="USD">USD ($ - US Dollar)</option>
                  <option value="EUR">EUR (€ - Euro)</option>
                  <option value="GBP">GBP (£ - British Pound)</option>
                  <option value="AED">AED (UAE Dirham)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1">
                  Financial Year / Session (Carries Forward All Records)
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={companyForm.financialYear}
                    onChange={(e) =>
                      setCompanyForm({ ...companyForm, financialYear: e.target.value })
                    }
                    className="flex-1 rounded border border-slate-300 px-3 py-2 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const m = (companyForm.financialYear || 'FY2026-27').match(
                        /^(.*?)(\d{4})\s*-\s*(\d{2,4})(.*)$/
                      );
                      const nextFy = m
                        ? `${m[1] || 'FY'}${Number(m[2]) + 1}-${
                            m[3].length === 2
                              ? String((Number(m[2]) + 2) % 100).padStart(2, '0')
                              : String(Number(m[2]) + 2)
                          }${m[4] || ''}`
                        : 'FY2027-28';
                      setCompanyForm({ ...companyForm, financialYear: nextFy });
                    }}
                    className="rounded border border-teal-300 bg-teal-50 hover:bg-teal-100 text-[#0d6e6e] font-bold px-2.5 py-2 text-[11px] cursor-pointer whitespace-nowrap"
                    title="Auto-increment to next Financial Year"
                  >
                    Next FY
                  </button>
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block font-bold mb-1">Bill Terms &amp; Conditions</label>
                <textarea
                  rows={2}
                  value={companyForm.termsAndConditions}
                  onChange={(e) =>
                    setCompanyForm({ ...companyForm, termsAndConditions: e.target.value })
                  }
                  className="w-full rounded border border-slate-300 px-3 py-2"
                />
              </div>
            </div>

            <button
              type="submit"
              className="rounded bg-[#0d6e6e] hover:bg-[#094e4e] text-white font-bold py-2.5 px-6 cursor-pointer"
            >
              Save Company Configuration
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
