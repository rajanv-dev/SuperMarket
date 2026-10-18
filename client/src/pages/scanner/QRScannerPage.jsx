import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Camera,
  CameraOff,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  Shield,
  RefreshCw,
  Keyboard,
  ArrowLeft,
  Volume2,
  VolumeX,
  FlipHorizontal,
  Info,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

export default function QRScannerPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [cameraState, setCameraState] = useState('idle'); // 'idle' | 'starting' | 'scanning' | 'permission_denied' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' (back) | 'user' (front)
  const [audioFeedback, setAudioFeedback] = useState(true);

  // Scan states
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanResult, setScanResult] = useState(null); // { success: true, data: { staff_name, staff_code, date, time, status }, message, already_marked }
  const [manualCode, setManualCode] = useState('');
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  // Debounce refs
  const html5QrCodeRef = useRef(null);
  const lastScanRef = useRef({ token: null, time: 0 });
  const scannerContainerId = 'vrk-qr-scanner-box';

  // Sound feedback using Web Audio API synthesis (no external assets needed)
  const playBeep = (type = 'success') => {
    if (!audioFeedback) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
        osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15); // E6
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
      } else if (type === 'duplicate') {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime); // Low buzz
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch {
      // Audio autoplay policy might suppress
    }
  };

  // Submit token to backend
  const handleProcessScan = async (scannedText, isManual = false) => {
    if (!scannedText || !scannedText.trim()) return;
    const cleanToken = scannedText.trim();

    // Prevent duplicate processing within 3.5 seconds for the exact same token
    const now = Date.now();
    if (
      !isManual &&
      lastScanRef.current.token === cleanToken &&
      now - lastScanRef.current.time < 3500
    ) {
      return;
    }

    lastScanRef.current = { token: cleanToken, time: now };
    setIsProcessing(true);

    try {
      const payload = isManual
        ? { manual: true, staff_code: cleanToken }
        : { qr_token: cleanToken };

      const res = await api.post('/attendance/scan', payload);

      if (res.data?.success) {
        if (res.data.already_marked) {
          playBeep('duplicate');
          setScanResult({
            success: true,
            already_marked: true,
            message: res.data.message || 'Attendance already recorded today',
            data: res.data.data,
          });
          toast(res.data.message, {
            icon: '⚠️',
            style: { borderRadius: '12px', background: '#fffbeb', color: '#b45309' },
          });
        } else {
          playBeep('success');
          setScanResult({
            success: true,
            already_marked: false,
            message: res.data.message || 'Attendance marked successfully',
            data: res.data.data,
          });
          toast.success(
            `Present: ${res.data.data?.staff_name} (${res.data.data?.staff_code})`
          );
        }
      }
    } catch (err) {
      playBeep('error');
      const msg = err.userMessage || 'QR Verification failed';
      setScanResult({
        success: false,
        already_marked: false,
        message: msg,
        data: null,
      });
      toast.error(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  // Initialize camera scanner
  const startScanner = async () => {
    try {
      setCameraState('starting');
      setErrorMessage('');

      // Cleanup existing scanner if any
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            await html5QrCodeRef.current.stop();
          }
          await html5QrCodeRef.current.clear();
        } catch {
          // ignore cleanup errors
        }
      }

      const html5QrCode = new Html5Qrcode(scannerContainerId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 12,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const edge = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.75);
          return { width: edge, height: edge };
        },
        aspectRatio: 1.0,
      };

      await html5QrCode.start(
        { facingMode },
        config,
        (decodedText) => {
          handleProcessScan(decodedText, false);
        },
        () => {
          // Frame read callback (no QR detected in current frame)
        }
      );

      setCameraState('scanning');
    } catch (err) {
      console.warn('Camera start error:', err);
      if (
        err.name === 'NotAllowedError' ||
        String(err).includes('Permission') ||
        String(err).includes('permission')
      ) {
        setCameraState('permission_denied');
        setErrorMessage(
          'Camera access was denied. Please grant camera permission in your browser address bar or device settings.'
        );
      } else if (err.name === 'NotFoundError' || String(err).includes('NotFoundError')) {
        setCameraState('error');
        setErrorMessage(
          'No camera was found on this device. You can mark attendance using the Manual Staff ID entry below.'
        );
      } else {
        setCameraState('error');
        setErrorMessage(
          err.message || 'Unable to access the device camera. Please verify permissions or use manual entry.'
        );
      }
    }
  };

  // Stop camera
  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      }
    }
    setCameraState('idle');
  };

  // Lifecycle
  useEffect(() => {
    startScanner();

    return () => {
      stopScanner();
    };
  }, [facingMode]);

  // Flip camera between front and back
  const handleToggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Handle manual code submit
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualCode.trim()) {
      return toast.error('Please enter a staff code (e.g. VRK-STF-0001)');
    }
    setIsSubmittingManual(true);
    await handleProcessScan(manualCode.trim().toUpperCase(), true);
    setIsSubmittingManual(false);
    setManualCode('');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* ── Top App Bar ──────────────────────────────────────────────────────── */}
      <header className="px-4 py-3 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/attendance"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Back to Attendance Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black tracking-wider text-emerald-400">
                VRK
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 uppercase tracking-wider">
                Live Attendance Scanner
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Authorized Terminal: {user?.name || user?.email || 'Admin'} ({user?.role || 'Staff'})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Audio toggle */}
          <button
            onClick={() => setAudioFeedback((prev) => !prev)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title={audioFeedback ? 'Mute scan beeps' : 'Enable scan sound'}
          >
            {audioFeedback ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {/* Camera switcher */}
          <button
            onClick={handleToggleFacingMode}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Switch Camera (Front/Rear)"
          >
            <FlipHorizontal className="w-4 h-4 text-sky-400" />
          </button>
        </div>
      </header>

      {/* ── Main Scanner Area ────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-xl w-full mx-auto p-4 flex flex-col justify-center space-y-4">
        {/* Scanner Viewport Container */}
        <div className="relative rounded-3xl overflow-hidden bg-slate-900 border-2 border-slate-800 shadow-2xl flex flex-col items-center justify-center min-h-[340px]">
          {/* Target Scanning Element for Html5Qrcode */}
          <div
            id={scannerContainerId}
            className={`w-full max-w-sm aspect-square overflow-hidden rounded-2xl ${
              cameraState === 'scanning' ? 'block' : 'hidden'
            }`}
          />

          {/* Scanner Overlay Sight Guide when camera is active */}
          {cameraState === 'scanning' && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-6">
              <div className="bg-slate-900/80 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-medium text-slate-200 border border-slate-700/60 shadow-md">
                Align staff QR code within the frame
              </div>

              {/* Scanning visual pulse line */}
              <div className="w-64 h-64 border-2 border-emerald-400/80 rounded-2xl relative shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-400 -mt-1 -ml-1 rounded-tl" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-400 -mt-1 -mr-1 rounded-tr" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-400 -mb-1 -ml-1 rounded-bl" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-400 -mb-1 -mr-1 rounded-br" />
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse absolute top-1/2" />
              </div>

              <div className="text-[11px] text-slate-400 bg-slate-900/70 px-3 py-1 rounded-full">
                Real-time scanning active
              </div>
            </div>
          )}

          {/* Starting / Loading State */}
          {cameraState === 'starting' && (
            <div className="p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto animate-pulse">
                <Camera className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Opening Camera...</h3>
              <p className="text-xs text-slate-400 max-w-xs">
                Requesting hardware camera access. Please grant permission when prompted.
              </p>
            </div>
          )}

          {/* Permission Denied State */}
          {cameraState === 'permission_denied' && (
            <div className="p-8 text-center space-y-4 max-w-sm">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
                <CameraOff className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-rose-400">Camera Permission Denied</h3>
                <p className="text-xs text-slate-400 mt-1">{errorMessage}</p>
              </div>
              <div className="bg-slate-800/80 p-3 rounded-xl text-left text-xs text-slate-300 space-y-1">
                <p className="font-semibold text-slate-200">How to grant permission:</p>
                <ol className="list-decimal list-inside space-y-0.5 text-slate-400">
                  <li>Click the lock/camera icon in your address bar</li>
                  <li>Toggle Camera permission to "Allow"</li>
                  <li>Click Retry below or use Manual ID Entry</li>
                </ol>
              </div>
              <button
                onClick={startScanner}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition-colors"
              >
                Retry Camera Access
              </button>
            </div>
          )}

          {/* Error / No Camera State */}
          {cameraState === 'error' && (
            <div className="p-8 text-center space-y-4 max-w-sm">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-amber-400">Camera Unavailable</h3>
                <p className="text-xs text-slate-400 mt-1">{errorMessage}</p>
              </div>
              <button
                onClick={startScanner}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Retry Detection
              </button>
            </div>
          )}
        </div>

        {/* ── Scan Notification Card (Success / Duplicate / Inactive) ───────── */}
        {scanResult && (
          <div
            className={`p-4 rounded-2xl border transition-all animate-in fade-in slide-in-from-bottom-3 duration-200 shadow-xl ${
              scanResult.success
                ? scanResult.already_marked
                  ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                  : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  scanResult.success
                    ? scanResult.already_marked
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-rose-500/20 text-rose-400'
                }`}
              >
                {scanResult.success ? (
                  scanResult.already_marked ? (
                    <Clock className="w-6 h-6" />
                  ) : (
                    <CheckCircle2 className="w-6 h-6" />
                  )
                ) : (
                  <AlertCircle className="w-6 h-6" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold uppercase tracking-wider">
                  {scanResult.success
                    ? scanResult.already_marked
                      ? 'Attendance Already Marked'
                      : 'Attendance Marked Successfully'
                    : 'Attendance Rejected'}
                </h4>

                {scanResult.data ? (
                  <div className="mt-2 space-y-1 text-xs">
                    <div className="flex justify-between items-center bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800">
                      <span className="text-slate-400">Staff:</span>
                      <strong className="text-white font-semibold">
                        {scanResult.data.staff_name}
                      </strong>
                    </div>

                    <div className="flex justify-between items-center bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800">
                      <span className="text-slate-400">Staff ID:</span>
                      <strong className="font-mono text-sky-400 font-bold">
                        {scanResult.data.staff_code}
                      </strong>
                    </div>

                    <div className="flex justify-between items-center bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800">
                      <span className="text-slate-400">Time:</span>
                      <strong className="text-white font-medium">
                        {scanResult.data.time || scanResult.data.formatted_time}
                      </strong>
                    </div>

                    <div className="flex justify-between items-center bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800">
                      <span className="text-slate-400">Status:</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {scanResult.data.status || 'Present'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-rose-300 mt-1">{scanResult.message}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Manual Staff ID Entry Fallback ─────────────────────────────────── */}
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            <Keyboard className="w-4 h-4 text-emerald-400" />
            <span>Manual Staff ID Fallback</span>
          </div>

          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. VRK-STF-0001"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="flex-1 px-3.5 py-2 text-sm bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500 font-mono placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={isSubmittingManual || !manualCode.trim()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-semibold rounded-xl text-xs transition-colors shrink-0"
            >
              {isSubmittingManual ? 'Checking...' : 'Mark Present'}
            </button>
          </form>
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="px-4 py-3 bg-slate-900/80 border-t border-slate-800 text-center text-xs text-slate-500">
        VRK Supermarket Attendance Terminal • HTTPS Secure Camera Protocol
      </footer>
    </div>
  );
}
