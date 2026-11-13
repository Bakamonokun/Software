import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  QrCode,
  RefreshCw,
  Repeat,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { ItemMaster } from '../types/pos';
import { formatNumber, getItemBatchExpirySummary } from '../utils/accounting';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: ItemMaster[];
  onDetected: (barcodeOrCode: string, isContinuous?: boolean) => void;
  defaultContinuousMode?: boolean;
}

interface ScannedSessionEntry {
  barcode: string;
  itemName: string;
  itemCode: string;
  sellingPrice: number;
  count: number;
  lastScannedAt: string;
  expiryWarning?: string;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  items,
  onDetected,
  defaultContinuousMode = true,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastScanRef = useRef<{ code: string; timestamp: number }>({ code: '', timestamp: 0 });

  const [manualBarcode, setManualBarcode] = useState<string>('');
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [continuousMode, setContinuousMode] = useState<boolean>(defaultContinuousMode);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [detectorSupported, setDetectorSupported] = useState<boolean>(false);
  const [sessionScans, setSessionScans] = useState<ScannedSessionEntry[]>([]);
  const [lastFlashCode, setLastFlashCode] = useState<string>('');

  const playScanBeep = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {
      // Ignore audio context restrictions
    }
  }, [soundEnabled]);

  const handleTriggerScan = useCallback(
    (rawCode: string) => {
      const clean = rawCode.trim();
      if (!clean) return;

      const matched = items.find(
        (i) =>
          i.barcode.toLowerCase() === clean.toLowerCase() ||
          i.code.toLowerCase() === clean.toLowerCase()
      );

      playScanBeep();
      setLastFlashCode(clean);
      setTimeout(() => {
        setLastFlashCode((prev) => (prev === clean ? '' : prev));
      }, 650);

      let expiryWarn: string | undefined;
      if (matched) {
        const summary = getItemBatchExpirySummary(matched);
        if (summary.expiredCount > 0) {
          expiryWarn = `${summary.expiredCount} batch(es) EXPIRED`;
        } else if (summary.expiringSoonCount > 0 && summary.nearestBatch) {
          expiryWarn = `Batch ${summary.nearestBatch.batchNo} expires in ${summary.nearestBatch.daysRemaining}d`;
        }
      }

      setSessionScans((prev) => {
        const existingIdx = prev.findIndex(
          (e) => e.barcode.toLowerCase() === clean.toLowerCase()
        );
        const nowTime = new Date().toLocaleTimeString();
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            count: updated[existingIdx].count + 1,
            lastScannedAt: nowTime,
            expiryWarning: expiryWarn ?? updated[existingIdx].expiryWarning,
          };
          return updated;
        }
        return [
          {
            barcode: clean,
            itemName: matched ? matched.name : `Unmapped Code (${clean})`,
            itemCode: matched ? matched.code : clean,
            sellingPrice: matched ? matched.sellingPrice : 0,
            count: 1,
            lastScannedAt: nowTime,
            expiryWarning: expiryWarn,
          },
          ...prev,
        ];
      });

      onDetected(clean, continuousMode);
      if (!continuousMode) {
        onClose();
      }
    },
    [continuousMode, items, onClose, onDetected, playScanBeep]
  );

  // Start / Stop Device Camera Stream when Barcode Scanner Modal opens
  useEffect(() => {
    if (!isOpen) return;
    let stream: MediaStream | null = null;
    let cancelled = false;

    setDetectorSupported(typeof (window as any).BarcodeDetector !== 'undefined');
    setCameraError('');

    const attachStream = async (s: MediaStream) => {
      if (cancelled) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      stream = s;
      setCameraActive(true);
      setCameraError('');
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        try {
          await videoRef.current.play();
        } catch {
          // autoPlay handles playback
        }
      }
    };

    const startCamera = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraActive(false);
        setCameraError('MediaDevices camera API not available in this browser context.');
        return;
      }

      try {
        // First try preferred facingMode with HD resolution
        const preferredStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        await attachStream(preferredStream);
      } catch {
        try {
          // Fallback to any connected webcam / USB camera (Windows / Desktop / Android)
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          await attachStream(fallbackStream);
        } catch {
          if (!cancelled) {
            setCameraActive(false);
            setCameraError(
              'Camera stream unavailable or permission denied. Allow camera access in browser or use USB/Bluetooth scanner / Quick-Tap SKU below.'
            );
          }
        }
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setCameraActive(false);
    };
  }, [isOpen, facingMode]);

  // Optical Frame Barcode Detection Loop (Web BarcodeDetector API)
  useEffect(() => {
    if (!isOpen || !cameraActive) return;
    const BarcodeDetectorCtor = (window as any).BarcodeDetector;
    if (!BarcodeDetectorCtor) return;

    let detector: any = null;
    try {
      detector = new BarcodeDetectorCtor({
        formats: [
          'ean_13',
          'ean_8',
          'code_128',
          'code_39',
          'upc_a',
          'upc_e',
          'qr_code',
          'itf',
        ],
      });
    } catch {
      try {
        detector = new BarcodeDetectorCtor();
      } catch {
        return;
      }
    }

    let active = true;
    const intervalId = window.setInterval(async () => {
      if (!active || !videoRef.current || videoRef.current.readyState < 2) return;
      try {
        const barcodes = await detector.detect(videoRef.current);
        if (Array.isArray(barcodes) && barcodes.length > 0) {
          const rawValue = String(barcodes[0]?.rawValue || '').trim();
          if (rawValue) {
            const now = Date.now();
            // 1.25s cooldown for identical barcode in continuous mode to prevent duplicate frame reads
            if (
              rawValue === lastScanRef.current.code &&
              now - lastScanRef.current.timestamp < 1250
            ) {
              return;
            }
            lastScanRef.current = { code: rawValue, timestamp: now };
            handleTriggerScan(rawValue);
          }
        }
      } catch {
        // Ignore transient frame detection errors
      }
    }, 280);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [isOpen, cameraActive, handleTriggerScan]);

  if (!isOpen) return null;

  const totalItemsScannedCount = sessionScans.reduce((acc, s) => acc + s.count, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white border border-slate-300 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0d6e6e] px-4 py-2.5 text-white">
          <div className="flex items-center gap-2 text-sm font-bold">
            <QrCode className="w-4 h-4" />
            <span>POS Camera Barcode &amp; QR Scanner</span>
            {continuousMode && (
              <span className="rounded bg-emerald-500/30 border border-emerald-300/50 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider">
                Continuous Scan Active
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled((v) => !v)}
              title={soundEnabled ? 'Mute scan beep' : 'Enable scan beep'}
              className="rounded bg-[#094e4e] hover:bg-teal-900 p-1.5 text-teal-100 cursor-pointer"
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={() =>
                setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
              }
              title="Switch Front / Rear Camera"
              className="flex items-center gap-1 rounded bg-[#094e4e] hover:bg-teal-900 px-2 py-1 text-[11px] font-semibold text-teal-100 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Flip Cam</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 hover:bg-white/15 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Continuous Mode Control Strip */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <label className="inline-flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={continuousMode}
              onChange={(e) => setContinuousMode(e.target.checked)}
              className="rounded border-slate-300"
            />
            <Repeat className="w-3.5 h-3.5 text-[#0d6e6e]" />
            <span>
              Continuous Scan Mode (Keep camera open &amp; auto-append items to bill)
            </span>
          </label>
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="text-slate-600">
              Session Scans: <strong className="text-[#0d6e6e]">{totalItemsScannedCount}</strong>
            </span>
            {sessionScans.length > 0 && (
              <button
                type="button"
                onClick={() => setSessionScans([])}
                className="text-slate-500 hover:text-slate-800 underline cursor-pointer"
              >
                Reset Log
              </button>
            )}
          </div>
        </div>

        <div className="p-4 overflow-y-auto space-y-3 text-xs flex-1">
          {/* Camera Viewport — video element is always mounted so videoRef.current attaches immediately when camera opens */}
          <div className="relative h-56 w-full rounded bg-slate-950 overflow-hidden flex items-center justify-center border border-slate-800">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`h-full w-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
            />

            {cameraActive ? (
              <>
                {/* Laser targeting reticle */}
                <div className="pointer-events-none absolute inset-x-12 top-1/2 -translate-y-1/2 h-20 border-2 border-teal-400/80 rounded flex items-center justify-center">
                  <div className="w-full h-0.5 bg-red-500/90 shadow-[0_0_8px_#ef4444]" />
                </div>
                <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-[10px] font-mono text-white bg-slate-900/75 px-2.5 py-1 rounded">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>
                      {detectorSupported
                        ? 'Live Camera & Optical BarcodeDetector Active'
                        : 'Live Camera Stream Active · Point barcode at reticle'}
                    </span>
                  </span>
                  <span>Cam: {facingMode === 'environment' ? 'Rear / Primary' : 'Front'}</span>
                </div>
              </>
            ) : (
              <div className="text-center text-slate-300 px-4 space-y-1.5">
                <Camera className="w-7 h-7 mx-auto opacity-60 text-teal-400" />
                <div className="font-semibold text-xs">
                  {cameraError || 'Starting live camera stream...'}
                </div>
                <div className="text-[11px] text-slate-400">
                  Hardware USB / Bluetooth laser scanners and Quick-Tap SKU buttons below work
                  seamlessly with Continuous Scan Mode.
                </div>
              </div>
            )}

            {lastFlashCode && (
              <div className="absolute top-2.5 right-2.5 rounded bg-emerald-600 text-white px-3 py-1 font-mono text-xs font-bold shadow-lg flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>SCANNED: {lastFlashCode}</span>
              </div>
            )}
          </div>

          {/* Manual / USB Wedge Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (manualBarcode.trim()) {
                handleTriggerScan(manualBarcode.trim());
                setManualBarcode('');
              }
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              autoFocus
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value)}
              placeholder="Scan with USB/Bluetooth gun or type Barcode / Item Code + Enter..."
              className="flex-1 rounded border border-slate-300 px-3 py-2 text-xs font-mono focus:border-[#0d6e6e] focus:outline-none"
            />
            <button
              type="submit"
              className="rounded bg-[#0d6e6e] hover:bg-[#094e4e] px-4 py-2 text-xs font-bold text-white cursor-pointer flex items-center gap-1"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{continuousMode ? 'Scan & Add (+1)' : 'Apply'}</span>
            </button>
          </form>

          {/* Rapid Continuous Item Tap Grid + Live Session Log */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Quick-Tap Camera Simulation for Rapid Item Selection */}
            <div className="md:col-span-7 border border-slate-200 rounded p-2.5 bg-slate-50 flex flex-col">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-slate-700">
                  Rapid Camera Scan Trigger ({items.length} Common SKUs)
                </span>
                <span className="text-[10px] text-slate-500">
                  Click any SKU to trigger instant scan
                </span>
              </div>
              <div className="max-h-40 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {items.length === 0 ? (
                  <div className="col-span-2 p-3 text-center text-slate-500">
                    No items in Item Master yet.
                  </div>
                ) : (
                  items.map((item) => {
                    const expSummary = getItemBatchExpirySummary(item);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleTriggerScan(item.barcode || item.code)}
                        className="text-left p-2 rounded border border-slate-200 bg-white hover:border-[#0d6e6e] hover:bg-teal-50/40 transition-colors cursor-pointer flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono font-bold text-[11px] text-[#0d6e6e]">
                            {item.barcode || item.code}
                          </span>
                          <span className="font-mono font-bold text-[11px] text-slate-800">
                            ₹{formatNumber(item.sellingPrice)}
                          </span>
                        </div>
                        <div className="truncate font-semibold text-slate-900 text-[11px] mt-0.5">
                          {item.name}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5 font-mono">
                          <span>
                            Stk: {item.stockQty} {item.unit}
                          </span>
                          {(expSummary.expiredCount > 0 || expSummary.expiringSoonCount > 0) && (
                            <span className="text-amber-700 font-bold flex items-center gap-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              &le;30d Exp
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Live Continuous Scan Session Log */}
            <div className="md:col-span-5 border border-slate-200 rounded p-2.5 bg-white flex flex-col">
              <div className="flex items-center justify-between mb-1.5 border-b border-slate-100 pb-1">
                <span className="text-[11px] font-bold text-slate-800">
                  Continuous Scan Session Log
                </span>
                <span className="font-mono text-[10px] text-[#0d6e6e] font-bold">
                  {sessionScans.length} SKU(s)
                </span>
              </div>
              <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 font-mono text-[11px]">
                {sessionScans.length === 0 ? (
                  <div className="py-6 text-center font-sans text-slate-400 text-[11px]">
                    No barcodes scanned in this session yet. Scan or tap an item to add directly to
                    the bill.
                  </div>
                ) : (
                  sessionScans.map((entry) => (
                    <div key={entry.barcode} className="py-1.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-sans font-bold text-slate-900 truncate">
                          {entry.itemName}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {entry.barcode} · {entry.lastScannedAt}
                        </div>
                        {entry.expiryWarning && (
                          <div className="text-[10px] font-sans font-bold text-amber-700">
                            ⚠ {entry.expiryWarning}
                          </div>
                        )}
                      </div>
                      <span className="rounded bg-[#0d6e6e] text-white px-2 py-0.5 font-bold text-xs shrink-0">
                        &times;{entry.count}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-2.5 flex items-center justify-between text-xs">
          <span className="text-slate-600">
            {continuousMode
              ? 'Each scan immediately increments or adds the item line to your active POS bill.'
              : 'Single scan mode: Scanner will close automatically after 1 barcode.'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-1.5 cursor-pointer"
          >
            Done Scanning ({totalItemsScannedCount} Added)
          </button>
        </div>
      </div>
    </div>
  );
};
