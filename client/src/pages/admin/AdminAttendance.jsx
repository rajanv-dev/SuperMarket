import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardCheck,
  Users,
  CheckCircle2,
  Clock,
  Search,
  Calendar,
  Download,
  Camera,
  RefreshCw,
  UserCheck,
  UserX,
  Building,
  History,
  X,
  TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function AdminAttendance() {
  const [selectedDate, setSelectedDate] = useState(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [summary, setSummary] = useState({
    total_active_staff: 0,
    present_today: 0,
    not_marked_present: 0,
    attendance_percentage: 0,
  });
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  // History modal
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [staffHistory, setStaffHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Fetch attendance data from backend
  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const res = await api.get('/attendance', {
        params: {
          date: selectedDate,
          search: searchQuery || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
        },
      });

      if (res.data?.success) {
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
        setRecords(res.data.data || []);
      }
    } catch (err) {
      toast.error(err.userMessage || 'Failed to load attendance records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAttendance();
    }, 200);
    return () => clearTimeout(timer);
  }, [selectedDate, searchQuery, statusFilter]);

  // CSV Export handler
  const handleExportCsv = async () => {
    try {
      toast.loading('Generating attendance CSV...', { id: 'csv-export' });
      const res = await api.get('/attendance/export', {
        params: { date: selectedDate },
        responseType: 'blob',
      });

      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vrk-supermarket-attendance-${selectedDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Attendance CSV exported successfully', { id: 'csv-export' });
    } catch (err) {
      toast.error('Failed to export attendance CSV', { id: 'csv-export' });
    }
  };

  // Open individual staff attendance history
  const handleViewHistory = async (staff) => {
    setSelectedStaff(staff);
    setIsHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const res = await api.get(`/attendance/staff/${staff.id}`);
      if (res.data?.success) {
        setStaffHistory(res.data.data || []);
      }
    } catch (err) {
      toast.error(err.userMessage || 'Failed to load staff history');
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
            <ClipboardCheck className="w-7 h-7 text-primary-600" />
            Attendance Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Monitor real-time staff check-ins, turnout statistics, and attendance logs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/scan"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm shadow-xs transition-colors"
          >
            <Camera className="w-4 h-4" />
            Launch Camera Scanner (/scan)
          </Link>

          <button
            onClick={handleExportCsv}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-sm shadow-2xs transition-colors"
          >
            <Download className="w-4 h-4 text-slate-500" />
            Export CSV
          </button>
        </div>
      </div>

      {/* ── KPI Stat Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Active Staff */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Active Staff
            </span>
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">
            {summary.total_active_staff}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Registered active employees
          </span>
        </div>

        {/* Staff Present Today */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
              Staff Present Today
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-emerald-700 mt-2">
            {summary.present_today}
          </p>
          <span className="text-[11px] text-emerald-600/80 mt-1 block font-medium">
            Checked in for {selectedDate}
          </span>
        </div>

        {/* Staff Not Yet Marked Present */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-600">
              Not Yet Marked Present
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-rose-700 mt-2">
            {summary.not_marked_present}
          </p>
          <span className="text-[11px] text-rose-600/80 mt-1 block font-medium">
            Pending scan or absent
          </span>
        </div>

        {/* Turnout Percentage */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-sky-600">
              Attendance Turnout
            </span>
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <p className="text-3xl font-black text-sky-700">
              {summary.attendance_percentage}%
            </p>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-sky-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, summary.attendance_percentage)}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Filters & Controls Bar ───────────────────────────────────────────── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search attendance by staff name, ID (e.g. VRK-STF-0001), phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all placeholder:text-slate-400"
          />
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          {/* Date Picker */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-semibold bg-transparent border-0 focus:outline-none text-slate-800"
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-primary-500"
          >
            <option value="all">All Statuses</option>
            <option value="present">Present</option>
            <option value="late">Late</option>
            <option value="half_day">Half Day</option>
          </select>

          {/* Quick today shortcut */}
          <button
            onClick={() =>
              setSelectedDate(
                new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
              )
            }
            className="px-2.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
          >
            Today
          </button>

          {/* Refresh button */}
          <button
            onClick={fetchAttendance}
            title="Refresh records"
            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Attendance Records Table & Mobile Cards ─────────────────────────── */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 flex justify-center items-center">
          <LoadingSpinner />
        </div>
      ) : records.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">
            No attendance records found for {selectedDate}
          </h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            Staff members who scan their QR code on the /scan terminal or enter their ID will appear here in real time.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <Link
              to="/scan"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-semibold rounded-xl text-sm shadow-xs hover:bg-emerald-700 transition-colors"
            >
              <Camera className="w-4 h-4" />
              Open Camera Scanner
            </Link>
            <Link
              to="/admin/staff"
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-xl text-sm hover:bg-slate-200 transition-colors"
            >
              <Users className="w-4 h-4" />
              Manage Staff
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Staff Code</th>
                  <th className="py-3 px-4">Department & Role</th>
                  <th className="py-3 px-4">Check-In Time</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Verification Method</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {records.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-emerald-600 text-white font-bold flex items-center justify-center shrink-0 shadow-xs">
                          {record.staff?.full_name?.charAt(0) || 'S'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 leading-tight">
                            {record.staff?.full_name || 'Staff Member'}
                          </p>
                          <span className="text-xs text-slate-500">
                            {record.staff?.phone || '--'}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                        {record.staff?.staff_code || '--'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <p className="font-medium text-slate-800">
                        {record.staff?.role || 'Staff'}
                      </p>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Building className="w-3 h-3 text-slate-400" />
                        {record.staff?.department || 'Operations'}
                      </p>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-900">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{record.formatted_time}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        {record.status === 'present' ? 'Present' : record.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-xs text-slate-500">
                      <span className="bg-slate-100 px-2 py-0.5 rounded-md text-[11px] font-medium text-slate-600">
                        {record.notes || 'QR Code Scan'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => record.staff && handleViewHistory(record.staff)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                      >
                        <History className="w-3.5 h-3.5" />
                        History
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View (screens < 768px) */}
          <div className="md:hidden divide-y divide-slate-100">
            {records.map((record) => (
              <div key={record.id} className="p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-emerald-600 text-white font-bold flex items-center justify-center shrink-0">
                      {record.staff?.full_name?.charAt(0) || 'S'}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm leading-tight">
                        {record.staff?.full_name}
                      </h4>
                      <span className="font-mono text-xs font-semibold text-primary-600">
                        {record.staff?.staff_code}
                      </span>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    Present
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded-xl text-slate-600">
                  <div className="flex items-center gap-1 font-mono font-medium">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Time: {record.formatted_time}</span>
                  </div>
                  <span className="text-slate-500">
                    {record.staff?.role || 'Staff'}
                  </span>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => record.staff && handleViewHistory(record.staff)}
                    className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
                  >
                    <History className="w-3.5 h-3.5" />
                    View Attendance History
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: STAFF ATTENDANCE HISTORY                                       */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Attendance History — {selectedStaff?.full_name}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {selectedStaff?.staff_code} ({selectedStaff?.role})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {loadingHistory ? (
                <div className="py-12 flex justify-center">
                  <LoadingSpinner />
                </div>
              ) : staffHistory.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold">No attendance records found</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Check-In Time</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Verification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {staffHistory.map((rec) => (
                        <tr key={rec.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-medium text-slate-800">
                            {rec.attendance_date}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">
                            {rec.formatted_time ||
                              (rec.check_in_at
                                ? new Date(rec.check_in_at).toLocaleTimeString('en-IN', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: true,
                                  })
                                : '--')}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {rec.status || 'Present'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">
                            {rec.notes || 'QR Scan'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
