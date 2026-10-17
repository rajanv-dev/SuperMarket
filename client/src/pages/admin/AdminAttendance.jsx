import { useEffect, useState, useRef } from 'react';
import {
  ClipboardCheck,
  QrCode,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Calendar,
  Search,
  RefreshCw,
  CreditCard,
  History,
  Edit3,
  Camera,
  CameraOff,
  UserCheck,
  Building,
  KeyRound,
  ShieldAlert,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { adminService } from '../../services/adminSupabaseService';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

export default function AdminAttendance() {
  const [activeTab, setActiveTab] = useState('scanner'); // 'scanner' | 'records' | 'staff_cards'
  const [summary, setSummary] = useState(null);
  const [records, setRecords] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Scanner State
  const [scanInput, setScanInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanResult, setLastScanResult] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef(null);
  const scanInputRef = useRef(null);

  // Filters for Records Tab
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [statusFilter, setStatusFilter] = useState('all');
  const [staffFilter, setStaffFilter] = useState('all');

  // Manual Clock In/Out Modal
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    staffProfileId: '',
    action: 'clock_in', // 'clock_in' | 'clock_out'
    time: '',
    notes: '',
  });

  // Card Assignment Modal
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [cardForm, setCardForm] = useState({
    staffProfileId: '',
    barcode: '',
    cardUid: '',
    notes: '',
  });

  // History Modal
  const [historyStaff, setHistoryStaff] = useState(null);
  const [staffHistory, setStaffHistory] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // Correction Modal
  const [editingRecord, setEditingRecord] = useState(null);
  const [correctionForm, setCorrectionForm] = useState({
    clock_in: '',
    clock_out: '',
    status: 'present',
    reason: '',
  });

  const loadSummaryAndRecords = async () => {
    try {
      setIsLoading(true);
      const [sum, recs, staff] = await Promise.all([
        adminService.getAttendanceSummary(selectedDate),
        adminService.getAttendanceRecords({
          date: selectedDate,
          status: statusFilter,
          staffId: staffFilter,
        }),
        adminService.getAttendanceStaffList(),
      ]);

      setSummary(sum);
      setRecords(recs);
      setStaffList(staff);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load attendance data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSummaryAndRecords();
  }, [selectedDate, statusFilter, staffFilter]);

  // Keep scanner input focused when in scanner tab
  useEffect(() => {
    if (activeTab === 'scanner' && scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, [activeTab]);

  // Handle USB Barcode Scanner (Keyboard simulation ending with Enter)
  const handleScanSubmit = async (e) => {
    e.preventDefault();
    if (!scanInput.trim() || isScanning) return;

    const identifier = scanInput.trim();
    setScanInput('');
    setIsScanning(true);

    try {
      const res = await adminService.scanStaffIdCard({
        identifier,
        method: isCameraActive ? 'camera' : 'card_scan',
      });

      if (res.success) {
        setLastScanResult({
          type: 'success',
          action: res.data.action,
          staff: res.data.staff,
          message: res.message,
          time: res.data.time,
          durationText: res.data.durationText,
          isLate: res.data.isLate,
        });

        // Prepend to recent scans feed
        setRecentScans((prev) => [
          {
            id: Date.now(),
            staffName: res.data.staff.full_name,
            employeeId: res.data.staff.employee_id,
            action: res.data.action,
            time: res.data.time,
            isLate: res.data.isLate,
            durationText: res.data.durationText,
          },
          ...prev.slice(0, 7),
        ]);

        toast.success(res.message);
        loadSummaryAndRecords();
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Scan failed';
      setLastScanResult({
        type: 'error',
        message: msg,
      });
      toast.error(msg);
    } finally {
      setIsScanning(false);
      if (scanInputRef.current) {
        scanInputRef.current.focus();
      }
    }
  };

  // Camera toggle handler
  const toggleCamera = async () => {
    if (isCameraActive) {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
      setIsCameraActive(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsCameraActive(true);
        toast.success('Scanner camera initialized');
      } catch (err) {
        toast.error('Unable to access webcam or camera for barcode scanning');
      }
    }
  };

  // Manual Clock In/Out submit
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualForm.staffProfileId) {
      toast.error('Please select a staff member');
      return;
    }

    try {
      if (manualForm.action === 'clock_in') {
        await adminService.manualClockIn({
          staffProfileId: manualForm.staffProfileId,
          date: selectedDate,
          time: manualForm.time || undefined,
          notes: manualForm.notes,
        });
        toast.success('Staff clocked in successfully');
      } else {
        await adminService.manualClockOut({
          staffProfileId: manualForm.staffProfileId,
          time: manualForm.time || undefined,
          notes: manualForm.notes,
        });
        toast.success('Staff clocked out successfully');
      }
      setIsManualModalOpen(false);
      setManualForm({ staffProfileId: '', action: 'clock_in', time: '', notes: '' });
      loadSummaryAndRecords();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Action failed');
    }
  };

  // Card Assignment Submit
  const handleAssignCard = async (e) => {
    e.preventDefault();
    if (!cardForm.staffProfileId || !cardForm.barcode.trim()) {
      toast.error('Staff member and barcode are required');
      return;
    }

    try {
      await adminService.assignStaffCard(cardForm);
      toast.success('Staff ID card assigned successfully');
      setIsCardModalOpen(false);
      setCardForm({ staffProfileId: '', barcode: '', cardUid: '', notes: '' });
      loadSummaryAndRecords();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Card assignment failed');
    }
  };

  // Revoke Card
  const handleRevokeCard = async (card) => {
    if (!confirm(`Are you sure you want to deactivate Card ${card.barcode}? The staff member will not be able to scan until a new card is issued.`)) {
      return;
    }

    try {
      await adminService.revokeStaffCard({ cardId: card.id, reason: 'Deactivated by administrator' });
      toast.success('Card deactivated');
      loadSummaryAndRecords();
    } catch (err) {
      toast.error('Failed to deactivate card');
    }
  };

  // Open history modal for employee
  const handleViewHistory = async (staff) => {
    setHistoryStaff(staff);
    setIsHistoryLoading(true);
    try {
      const history = await adminService.getStaffAttendanceHistory(staff.id, 30);
      setStaffHistory(history);
    } catch (err) {
      toast.error('Failed to load attendance history');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  // Correction Submit
  const handleCorrectionSubmit = async (e) => {
    e.preventDefault();
    if (!correctionForm.reason.trim()) {
      toast.error('Audit correction reason is mandatory');
      return;
    }

    try {
      await adminService.correctAttendance(editingRecord.id, correctionForm);
      toast.success('Attendance record corrected and audited');
      setEditingRecord(null);
      loadSummaryAndRecords();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Correction failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <ClipboardCheck className="w-7 h-7 text-primary-600" />
            <span>Staff Attendance Management</span>
          </h1>
          <p className="text-sm text-slate-500">
            Real-time clock-in/out, USB barcode scanner verification, and shift duration tracking
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadSummaryAndRecords}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-xs transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setIsManualModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-sm transition-all"
          >
            <Clock className="w-4 h-4" />
            <span>Manual Entry</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Present Today */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Present Today</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-display font-extrabold text-slate-900 leading-tight">
            {summary?.presentToday ?? 0} / {summary?.totalStaff ?? 0}
          </p>
          <p className="text-[11px] font-medium text-emerald-600 mt-1">
            {summary?.totalStaff ? Math.round(((summary.presentToday || 0) / summary.totalStaff) * 100) : 0}% turn-out rate
          </p>
        </div>

        {/* Currently Working */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Currently Working</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Clock className="w-4 h-4 animate-spin text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-display font-extrabold text-blue-600 leading-tight">
            {summary?.currentlyWorking ?? 0}
          </p>
          <p className="text-[11px] font-medium text-slate-500 mt-1">Active open shift sessions</p>
        </div>

        {/* Late Arrivals */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Late Arrivals</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-display font-extrabold text-amber-600 leading-tight">
            {summary?.lateArrivals ?? 0}
          </p>
          <p className="text-[11px] font-medium text-amber-700 mt-1">Clocked in after shift grace period</p>
        </div>

        {/* Absent Count */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Not Recorded / Absent</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-display font-extrabold text-rose-600 leading-tight">
            {summary?.absentCount ?? 0}
          </p>
          <p className="text-[11px] font-medium text-slate-500 mt-1">No attendance punch today</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto scrollbar-none whitespace-nowrap">
        <button
          onClick={() => setActiveTab('scanner')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === 'scanner'
              ? 'bg-primary-600 text-white shadow-sm shadow-primary-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>ID Card Scanner & Punch</span>
        </button>

        <button
          onClick={() => setActiveTab('records')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === 'records'
              ? 'bg-primary-600 text-white shadow-sm shadow-primary-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Daily Attendance Log</span>
        </button>

        <button
          onClick={() => setActiveTab('staff_cards')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === 'staff_cards'
              ? 'bg-primary-600 text-white shadow-sm shadow-primary-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Staff ID Cards</span>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: ID CARD SCANNER */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'scanner' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Scanning Station */}
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary-600" />
                    <span>Attendance Terminal</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Scan staff ID card barcode or swipe employee badge to toggle clock-in / clock-out
                  </p>
                </div>

                <button
                  type="button"
                  onClick={toggleCamera}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    isCameraActive
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {isCameraActive ? <CameraOff className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
                  <span>{isCameraActive ? 'Stop Camera' : 'Camera Scan'}</span>
                </button>
              </div>

              {/* Camera Scanner Viewport if active */}
              {isCameraActive && (
                <div className="mb-6 relative rounded-2xl overflow-hidden border-2 border-primary-500 bg-slate-950 aspect-video max-w-md mx-auto flex items-center justify-center">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  <div className="absolute inset-0 border-2 border-primary-400/50 m-6 rounded-xl animate-pulse pointer-events-none" />
                  <span className="absolute bottom-3 bg-black/60 text-white text-[10px] font-mono px-3 py-1 rounded-full">
                    Point barcode/QR code at camera
                  </span>
                </div>
              )}

              {/* USB Scanner Input Form */}
              <form onSubmit={handleScanSubmit} className="space-y-4">
                <div className="relative">
                  <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-primary-600" />
                  <input
                    ref={scanInputRef}
                    type="text"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    placeholder="Scan card barcode (e.g. SUPER-EMP-1001) or enter Staff ID..."
                    autoFocus
                    className="w-full pl-13 pr-28 py-4 bg-slate-50 border-2 border-primary-500/40 focus:border-primary-600 rounded-2xl text-base font-mono font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-primary-500/10 transition-all shadow-inner"
                  />
                  <button
                    type="submit"
                    disabled={isScanning || !scanInput.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm disabled:opacity-50"
                  >
                    {isScanning ? <LoadingSpinner size="sm" /> : 'Punch'}
                  </button>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                  <span>✦ Compatible with USB keyboard barcode guns & manual input</span>
                  <span>Auto-detects Clock-In or Clock-Out based on active session</span>
                </div>
              </form>

              {/* Live Scan Result Banner */}
              {lastScanResult && (
                <div
                  className={`mt-6 p-5 rounded-2xl border transition-all animate-scale-in ${
                    lastScanResult.type === 'success'
                      ? lastScanResult.action === 'clock_in'
                        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                        : 'bg-blue-50/80 border-blue-200 text-blue-900'
                      : 'bg-rose-50/80 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                        lastScanResult.type === 'success'
                          ? lastScanResult.action === 'clock_in'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-blue-600 text-white'
                          : 'bg-rose-600 text-white'
                      }`}
                    >
                      {lastScanResult.type === 'success' ? (
                        <CheckCircle2 className="w-6 h-6" />
                      ) : (
                        <ShieldAlert className="w-6 h-6" />
                      )}
                    </div>

                    <div className="flex-1">
                      {lastScanResult.type === 'success' ? (
                        <>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                                lastScanResult.action === 'clock_in'
                                  ? 'bg-emerald-200 text-emerald-800'
                                  : 'bg-blue-200 text-blue-800'
                              }`}
                            >
                              {lastScanResult.action === 'clock_in' ? 'Clock In Recorded' : 'Clock Out Recorded'}
                            </span>
                            {lastScanResult.isLate && (
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">
                                Late Arrival
                              </span>
                            )}
                          </div>

                          <h3 className="text-base font-bold mt-1 text-slate-900">
                            {lastScanResult.staff.full_name}
                          </h3>
                          <p className="text-xs text-slate-600 mt-0.5 font-medium">
                            {lastScanResult.message}
                          </p>
                          <div className="mt-2 flex items-center gap-4 text-xs font-mono text-slate-500">
                            <span>ID: {lastScanResult.staff.employee_id}</span>
                            <span>Dept: {lastScanResult.staff.department}</span>
                            <span>Time: {lastScanResult.time}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <h4 className="font-bold text-sm text-rose-900">Scan Rejected</h4>
                          <p className="text-xs text-rose-700 mt-1">{lastScanResult.message}</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Helper Badges */}
            <div className="mt-8 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-400">Available Test Barcodes:</span>
              {staffList.slice(0, 4).map((s) => (
                <button
                  key={s.id}
                  onClick={() => setScanInput(s.active_card?.barcode || s.employee_id)}
                  className="px-2.5 py-1 text-[11px] font-mono font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                >
                  {s.active_card?.barcode || s.employee_id} ({s.user_profiles?.full_name?.split(' ')[0]})
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Live Recent Scans Feed */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-400" />
                  <span>Recent Scan Activity</span>
                </h3>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>

              {recentScans.length > 0 ? (
                <div className="space-y-3">
                  {recentScans.map((scan) => (
                    <div
                      key={scan.id}
                      className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-900">{scan.staffName}</p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {scan.employeeId} • {scan.time}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                          scan.action === 'clock_in'
                            ? scan.isLate
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {scan.action === 'clock_in' ? (scan.isLate ? 'Late In' : 'Clock In') : 'Clock Out'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs font-semibold">No punches recorded yet this session</p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 text-center">
              <span className="text-[11px] text-slate-400">
                Punches automatically calculate duration & update payroll hours
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: DAILY ATTENDANCE LOG */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'records' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Date Selector */}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700">
                <Calendar className="w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent outline-none cursor-pointer"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="working">Currently Working</option>
                <option value="present">Present (Completed)</option>
                <option value="late">Late Arrival</option>
                <option value="half_day">Half Day (&lt; 4 hrs)</option>
              </select>

              {/* Staff Member Filter */}
              <select
                value={staffFilter}
                onChange={(e) => setStaffFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="all">All Staff Members</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.employee_id} - {s.user_profiles?.full_name}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-xs font-semibold text-slate-500">
              {records.length} Record(s) Found
            </span>
          </div>

          {/* Records Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {isLoading ? (
              <div className="py-20 flex justify-center">
                <LoadingSpinner size="lg" />
              </div>
            ) : records.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200/60">
                    <tr>
                      <th className="py-3 px-4">Staff Member</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Clock In</th>
                      <th className="py-3 px-4">Clock Out</th>
                      <th className="py-3 px-4">Duration</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Punch Method</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {records.map((r) => {
                      const staff = r.staff_profiles;
                      const user = staff?.user_profiles;
                      const inTime = new Date(r.clock_in).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const outTime = r.clock_out
                        ? new Date(r.clock_out).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—';

                      const hours = Math.floor(r.duration_minutes / 60);
                      const mins = r.duration_minutes % 60;
                      const durationStr = r.clock_out ? `${hours}h ${mins}m` : 'In Progress';

                      return (
                        <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-primary-100 text-primary-700 font-bold flex items-center justify-center text-xs">
                                {user?.full_name?.charAt(0) || 'S'}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 leading-tight">
                                  {user?.full_name || 'Staff Member'}
                                </p>
                                <p className="text-[11px] text-slate-400 font-mono">
                                  {staff?.employee_id} • {user?.role}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-mono">{r.attendance_date}</td>
                          <td className="py-3.5 px-4 font-mono font-semibold text-emerald-700">
                            {inTime}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-semibold text-slate-700">
                            {outTime}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                            {durationStr}
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                r.status === 'present'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : r.status === 'working'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : r.status === 'late'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-slate-500 capitalize">
                            {r.clock_in_method?.replace('_', ' ')}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => {
                                setEditingRecord(r);
                                setCorrectionForm({
                                  clock_in: r.clock_in ? r.clock_in.slice(11, 16) : '',
                                  clock_out: r.clock_out ? r.clock_out.slice(11, 16) : '',
                                  status: r.status,
                                  reason: '',
                                });
                              }}
                              className="p-1.5 text-slate-400 hover:text-primary-600 rounded-lg hover:bg-slate-100 transition-colors"
                              title="Audit Correction"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-16 text-center text-slate-400">
                <Calendar className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-semibold text-slate-700">No attendance records for this query</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 3: STAFF ID CARDS */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'staff_cards' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Registered Employee ID Cards</h3>
              <p className="text-xs text-slate-500">
                Issue, track, and revoke official supermarket barcodes and NFC/RFID card identifiers
              </p>
            </div>

            <button
              onClick={() => setIsCardModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-sm transition-all"
            >
              <CreditCard className="w-4 h-4" />
              <span>Issue New ID Card</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200/60">
                  <tr>
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Staff ID</th>
                    <th className="py-3 px-4">Role & Dept</th>
                    <th className="py-3 px-4">Assigned Card UID</th>
                    <th className="py-3 px-4">Barcode Identifier</th>
                    <th className="py-3 px-4 text-center">Card Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {staffList.map((s) => {
                    const card = s.active_card;
                    const user = s.user_profiles;

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-900">{user?.full_name}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{user?.email}</p>
                        </td>

                        <td className="py-3.5 px-4 font-mono font-bold text-primary-700">
                          {s.employee_id}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="capitalize font-semibold text-slate-800">{user?.role}</span>
                          <span className="text-slate-400 block text-[11px]">{s.department}</span>
                        </td>

                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-700">
                          {card?.card_uid || '—'}
                        </td>

                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          {card?.barcode ? (
                            <span className="bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                              {card.barcode}
                            </span>
                          ) : (
                            <span className="text-slate-400">No card issued</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                              card?.is_active
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {card?.is_active ? 'Active Card' : 'Unassigned'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right space-x-2">
                          <button
                            onClick={() => handleViewHistory(s)}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                          >
                            History
                          </button>

                          {card?.is_active ? (
                            <button
                              onClick={() => handleRevokeCard(card)}
                              className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors"
                            >
                              Revoke
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setCardForm({
                                  staffProfileId: s.id,
                                  barcode: `SUPER-${s.employee_id}`,
                                  cardUid: `CARD-${s.employee_id}`,
                                  notes: 'Issued by administrator',
                                });
                                setIsCardModalOpen(true);
                              }}
                              className="px-2.5 py-1 text-xs font-semibold text-primary-600 hover:bg-primary-50 rounded-lg border border-primary-200 transition-colors"
                            >
                              Issue Card
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 1: MANUAL CLOCK IN / OUT */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md p-6 animate-scale-in">
            <h3 className="font-bold text-base text-slate-900 mb-1">Manual Attendance Punch</h3>
            <p className="text-xs text-slate-500 mb-4">
              Authorized administrator override to manually record clock-in or clock-out
            </p>

            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="label">Staff Member *</label>
                <select
                  required
                  value={manualForm.staffProfileId}
                  onChange={(e) => setManualForm({ ...manualForm, staffProfileId: e.target.value })}
                  className="input"
                >
                  <option value="">Select Employee...</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.employee_id} - {s.user_profiles?.full_name} ({s.user_profiles?.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Punch Action *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setManualForm({ ...manualForm, action: 'clock_in' })}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                      manualForm.action === 'clock_in'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    Clock In
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualForm({ ...manualForm, action: 'clock_out' })}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                      manualForm.action === 'clock_out'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    Clock Out
                  </button>
                </div>
              </div>

              <div>
                <label className="label">Specific Time (Optional — leave blank for current time)</label>
                <input
                  type="time"
                  value={manualForm.time}
                  onChange={(e) => setManualForm({ ...manualForm, time: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="label">Reason / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Card forgotten at home"
                  value={manualForm.notes}
                  onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                  className="input"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-md btn-primary">
                  Confirm Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 2: ASSIGN ID CARD */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {isCardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md p-6 animate-scale-in">
            <h3 className="font-bold text-base text-slate-900 mb-1">Issue Staff ID Card</h3>
            <p className="text-xs text-slate-500 mb-4">
              Assign or replace an official barcode identifier for scanner verification
            </p>

            <form onSubmit={handleAssignCard} className="space-y-4">
              <div>
                <label className="label">Staff Member *</label>
                <select
                  required
                  value={cardForm.staffProfileId}
                  onChange={(e) => {
                    const sel = staffList.find((s) => s.id === e.target.value);
                    setCardForm({
                      ...cardForm,
                      staffProfileId: e.target.value,
                      barcode: sel ? `SUPER-${sel.employee_id}` : cardForm.barcode,
                      cardUid: sel ? `CARD-${sel.employee_id}` : cardForm.cardUid,
                    });
                  }}
                  className="input"
                >
                  <option value="">Select Employee...</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.employee_id} - {s.user_profiles?.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Card Barcode Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SUPER-EMP-1001"
                  value={cardForm.barcode}
                  onChange={(e) => setCardForm({ ...cardForm, barcode: e.target.value })}
                  className="input font-mono font-bold"
                />
              </div>

              <div>
                <label className="label">Card UID / RFID Token (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. CARD-EMP-1001"
                  value={cardForm.cardUid}
                  onChange={(e) => setCardForm({ ...cardForm, cardUid: e.target.value })}
                  className="input font-mono"
                />
              </div>

              <div>
                <label className="label">Notes / Issue Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Initial issue"
                  value={cardForm.notes}
                  onChange={(e) => setCardForm({ ...cardForm, notes: e.target.value })}
                  className="input"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCardModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-md btn-primary">
                  Activate Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 3: EMPLOYEE ATTENDANCE HISTORY */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {historyStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-2xl p-6 animate-scale-in max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Attendance History: {historyStaff.user_profiles?.full_name}
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Employee ID: {historyStaff.employee_id} • Dept: {historyStaff.department}
                </p>
              </div>
              <button
                onClick={() => setHistoryStaff(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isHistoryLoading ? (
                <div className="py-12 flex justify-center">
                  <LoadingSpinner size="md" />
                </div>
              ) : staffHistory.length > 0 ? (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Clock In</th>
                      <th className="py-2.5 px-3">Clock Out</th>
                      <th className="py-2.5 px-3">Duration</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {staffHistory.map((h) => (
                      <tr key={h.id}>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{h.attendance_date}</td>
                        <td className="py-2.5 px-3 text-emerald-700">
                          {new Date(h.clock_in).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {h.clock_out
                            ? new Date(h.clock_out).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-800">
                          {Math.floor(h.duration_minutes / 60)}h {h.duration_minutes % 60}m
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                              h.status === 'present'
                                ? 'bg-emerald-50 text-emerald-700'
                                : h.status === 'late'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {h.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-center text-slate-400 py-10 text-xs font-semibold">
                  No attendance history found for this employee
                </p>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setHistoryStaff(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 4: AUDIT CORRECTION MODAL */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md p-6 animate-scale-in">
            <h3 className="font-bold text-base text-slate-900 mb-1">Correct Attendance Record</h3>
            <p className="text-xs text-slate-500 mb-4">
              All adjustments are recorded with your administrator identity in the audit trail
            </p>

            <form onSubmit={handleCorrectionSubmit} className="space-y-4">
              <div>
                <label className="label">Status</label>
                <select
                  value={correctionForm.status}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, status: e.target.value })}
                  className="input"
                >
                  <option value="present">Present (Full Day)</option>
                  <option value="late">Late Arrival</option>
                  <option value="half_day">Half Day</option>
                  <option value="absent">Absent</option>
                </select>
              </div>

              <div>
                <label className="label">Audit Reason * (Mandatory for record integrity)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Correction verified via store CCTV log"
                  value={correctionForm.reason}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
                  className="input"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-md btn-primary">
                  Save Correction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
