import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Users,
  QrCode,
  Search,
  Plus,
  Printer,
  Download,
  Edit2,
  CheckCircle2,
  Clock,
  RefreshCw,
  Calendar,
  Phone,
  Mail,
  Building,
  Shield,
  X,
  UserCheck,
  UserX,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function AdminStaff() {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedDept, setSelectedDept] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Active staff data for modals
  const [activeStaff, setActiveStaff] = useState(null);
  const [activeQrData, setActiveQrData] = useState(null);
  const [activeHistory, setActiveHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingQr, setLoadingQr] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    full_name: '',
    role: 'Store Associate',
    department: 'Grocery Operations',
    phone: '',
    email: '',
    date_of_joining: new Intl.DateTimeFormat('en-CA').format(new Date()),
    is_active: true,
  });

  const printCardRef = useRef(null);

  // Fetch staff list
  const fetchStaff = async () => {
    try {
      setLoading(true);
      const res = await api.get('/staff', {
        params: {
          search: searchQuery || undefined,
          role: selectedRole !== 'all' ? selectedRole : undefined,
          department: selectedDept !== 'all' ? selectedDept : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
        },
      });
      if (res.data?.success && Array.isArray(res.data.data)) {
        setStaffList(res.data.data);
      }
    } catch (err) {
      toast.error(err.userMessage || 'Failed to load staff list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStaff();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedRole, selectedDept, statusFilter]);

  // Handle Add Staff submission
  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!formData.full_name.trim()) {
      return toast.error('Full name is required');
    }
    if (!formData.role.trim()) {
      return toast.error('Role is required');
    }

    try {
      setIsSubmitting(true);
      const res = await api.post('/staff', formData);
      if (res.data?.success && res.data.data) {
        toast.success(`Staff ${res.data.data.staff_code} created successfully!`);
        setIsAddModalOpen(false);
        // Reset form
        setFormData({
          full_name: '',
          role: 'Store Associate',
          department: 'Grocery Operations',
          phone: '',
          email: '',
          date_of_joining: new Intl.DateTimeFormat('en-CA').format(new Date()),
          is_active: true,
        });

        // Immediately show the generated QR ID Card
        setActiveStaff(res.data.data);
        setActiveQrData({
          staff_id: res.data.data.id,
          staff_code: res.data.data.staff_code,
          full_name: res.data.data.full_name,
          role: res.data.data.role,
          department: res.data.data.department,
          qr_data_url: res.data.data.qr_data_url,
          qr_payload: res.data.data.qr_payload,
        });
        setIsQrModalOpen(true);

        fetchStaff();
      }
    } catch (err) {
      toast.error(err.userMessage || 'Failed to create staff member');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Edit Staff submission
  const handleEditStaff = async (e) => {
    e.preventDefault();
    if (!activeStaff) return;

    try {
      setIsSubmitting(true);
      const res = await api.patch(`/staff/${activeStaff.id}`, formData);
      if (res.data?.success) {
        toast.success('Staff details updated successfully');
        setIsEditModalOpen(false);
        setActiveStaff(null);
        fetchStaff();
      }
    } catch (err) {
      toast.error(err.userMessage || 'Failed to update staff');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Staff Active/Inactive status
  const handleToggleStatus = async (staff) => {
    const newStatus = !staff.is_active;
    try {
      const res = await api.patch(`/staff/${staff.id}`, { is_active: newStatus });
      if (res.data?.success) {
        toast.success(
          `${staff.full_name} is now ${newStatus ? 'Active' : 'Deactivated'}`
        );
        fetchStaff();
      }
    } catch (err) {
      toast.error(err.userMessage || 'Failed to change staff status');
    }
  };

  // Open QR modal & fetch QR Data URL
  const handleOpenQrModal = async (staff) => {
    setActiveStaff(staff);
    setIsQrModalOpen(true);
    setLoadingQr(true);
    try {
      const res = await api.get(`/staff/${staff.id}/qr`);
      if (res.data?.success && res.data.data) {
        setActiveQrData(res.data.data);
      }
    } catch (err) {
      toast.error(err.userMessage || 'Failed to generate QR code');
    } finally {
      setLoadingQr(false);
    }
  };

  // Regenerate QR Code
  const handleRegenerateQr = async () => {
    if (!activeStaff) return;
    if (
      !window.confirm(
        'Are you sure you want to regenerate this QR code? The previous QR code will immediately be invalidated.'
      )
    ) {
      return;
    }

    try {
      setLoadingQr(true);
      const res = await api.post(`/staff/${activeStaff.id}/regenerate-qr`);
      if (res.data?.success && res.data.data) {
        setActiveQrData(res.data.data);
        toast.success('New QR code generated successfully!');
        fetchStaff();
      }
    } catch (err) {
      toast.error(err.userMessage || 'Failed to regenerate QR code');
    } finally {
      setLoadingQr(false);
    }
  };

  // Open Staff Attendance History Modal
  const handleOpenHistoryModal = async (staff) => {
    setActiveStaff(staff);
    setIsHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const res = await api.get(`/staff/${staff.id}`);
      if (res.data?.success && res.data.data) {
        setActiveHistory(res.data.data.attendance_history || []);
      }
    } catch (err) {
      toast.error(err.userMessage || 'Failed to load attendance history');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Download QR Code as PNG
  const handleDownloadQrPng = () => {
    if (!activeQrData?.qr_data_url) return;
    const link = document.createElement('a');
    link.href = activeQrData.qr_data_url;
    link.download = `${activeQrData.staff_code || 'STAFF'}-${(activeQrData.full_name || 'qr').replace(/\s+/g, '_')}-qr.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('QR Code downloaded!');
  };

  // Print Staff ID Card
  const handlePrintCard = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      return toast.error('Please allow popups to print the ID Card');
    }

    const cardHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>VRK Supermarket — Staff ID Card: ${activeQrData?.staff_code}</title>
          <style>
            @page {
              size: 85.6mm 54mm; /* Standard CR80 ID Card dimensions */
              margin: 0;
            }
            body {
              font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              margin: 0;
              padding: 0;
              background-color: #f8fafc;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .id-card {
              width: 340px;
              height: 215px;
              background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
              border-radius: 12px;
              color: #ffffff;
              padding: 14px 16px;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
              border: 1px solid #334155;
              position: relative;
              overflow: hidden;
            }
            .card-accent {
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              height: 4px;
              background: linear-gradient(90deg, #10b981, #06b6d4, #3b82f6);
            }
            .card-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .store-name {
              font-size: 15px;
              font-weight: 900;
              letter-spacing: 0.5px;
              color: #10b981;
            }
            .badge {
              background: rgba(16, 185, 129, 0.15);
              border: 1px solid rgba(16, 185, 129, 0.4);
              color: #34d399;
              font-size: 9px;
              font-weight: 700;
              padding: 2px 7px;
              border-radius: 999px;
              text-transform: uppercase;
            }
            .card-body {
              display: flex;
              align-items: center;
              gap: 14px;
            }
            .qr-wrapper {
              background: #ffffff;
              padding: 4px;
              border-radius: 8px;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .qr-wrapper img {
              width: 82px;
              height: 82px;
              display: block;
            }
            .info-wrapper {
              flex: 1;
              min-width: 0;
            }
            .staff-name {
              font-size: 15px;
              font-weight: 700;
              color: #ffffff;
              margin: 0 0 2px 0;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .staff-code {
              font-size: 12px;
              font-family: monospace;
              font-weight: 700;
              color: #38bdf8;
              margin: 0 0 6px 0;
            }
            .meta-item {
              font-size: 10px;
              color: #94a3b8;
              margin: 2px 0;
              line-height: 1.2;
            }
            .meta-item strong {
              color: #cbd5e1;
            }
            .card-footer {
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 8px;
              color: #64748b;
              border-top: 1px solid #334155;
              padding-top: 4px;
            }
          </style>
        </head>
        <body>
          <div class="id-card">
            <div class="card-accent"></div>
            <div class="card-header">
              <span class="store-name">VRK SUPERMARKET</span>
              <span class="badge">Staff Pass</span>
            </div>
            <div class="card-body">
              <div class="qr-wrapper">
                <img src="${activeQrData?.qr_data_url}" alt="Staff QR" />
              </div>
              <div class="info-wrapper">
                <h3 class="staff-name">${activeQrData?.full_name}</h3>
                <div class="staff-code">${activeQrData?.staff_code}</div>
                <div class="meta-item">Role: <strong>${activeQrData?.role}</strong></div>
                <div class="meta-item">Dept: <strong>${activeQrData?.department || 'Operations'}</strong></div>
              </div>
            </div>
            <div class="card-footer">
              <span>SCAN DAILY FOR ATTENDANCE</span>
              <span>SECURE QR IDENTIFIER</span>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(cardHtml);
    printWindow.document.close();
  };

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = staffList.length;
    const active = staffList.filter((s) => s.is_active).length;
    const inactive = total - active;
    const presentToday = staffList.filter((s) => s.present_today).length;
    return { total, active, inactive, presentToday };
  }, [staffList]);

  const departmentList = [
    'All',
    'Grocery Operations',
    'Checkout & Billing',
    'Inventory & Warehouse',
    'Customer Service',
    'Logistics & Delivery',
    'Store Management',
    'Security & Maintenance',
  ];

  const roleList = [
    'All',
    'Cashier',
    'Store Associate',
    'Inventory Specialist',
    'Department Manager',
    'Supervisor',
    'Floor Associate',
    'Stock Keeper',
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
            <Users className="w-7 h-7 text-primary-600" />
            Staff Management
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage supermarket employees, generate secure QR attendance cards, and track daily shifts.
          </p>
        </div>

        <button
          onClick={() => {
            setFormData({
              full_name: '',
              role: 'Store Associate',
              department: 'Grocery Operations',
              phone: '',
              email: '',
              date_of_joining: new Intl.DateTimeFormat('en-CA').format(new Date()),
              is_active: true,
            });
            setIsAddModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white font-semibold rounded-xl text-sm shadow-sm hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Staff Member
        </button>
      </div>

      {/* ── KPI Stat Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Staff
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{metrics.total}</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
              Active Employees
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-2">{metrics.active}</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              Present Today
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-blue-700 mt-2">{metrics.presentToday}</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-600">
              Inactive / On Leave
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-rose-700 mt-2">{metrics.inactive}</p>
        </div>
      </div>

      {/* ── Search & Filter Controls ────────────────────────────────────────── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by staff name, ID (e.g. VRK-STF-0001), phone, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all placeholder:text-slate-400"
          />
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          {/* Department filter */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-primary-500"
          >
            {departmentList.map((dept) => (
              <option key={dept} value={dept === 'All' ? 'all' : dept}>
                {dept === 'All' ? 'All Departments' : dept}
              </option>
            ))}
          </select>

          {/* Role filter */}
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-primary-500"
          >
            {roleList.map((r) => (
              <option key={r} value={r === 'All' ? 'all' : r}>
                {r === 'All' ? 'All Roles' : r}
              </option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-primary-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>

          <button
            onClick={fetchStaff}
            title="Refresh list"
            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Staff Table (Desktop) & Cards (Mobile) ─────────────────────────── */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 flex justify-center items-center">
          <LoadingSpinner />
        </div>
      ) : staffList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No staff members found</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? `No staff members matched "${searchQuery}". Try adjusting your search or filters.`
              : 'Get started by registering your supermarket employees to enable automated QR code attendance.'}
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-semibold rounded-xl text-sm shadow-xs hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add First Staff Member
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Staff ID & Name</th>
                  <th className="py-3 px-4">Designation</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Joining Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Today</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {staffList.map((staff) => (
                  <tr key={staff.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Staff ID & Name */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-emerald-600 text-white font-bold flex items-center justify-center shrink-0 shadow-xs">
                          {staff.full_name?.charAt(0) || 'S'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 leading-tight">
                            {staff.full_name}
                          </p>
                          <span className="font-mono text-xs font-semibold text-primary-600">
                            {staff.staff_code}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Role & Department */}
                    <td className="py-3.5 px-4">
                      <p className="font-medium text-slate-800">{staff.role}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Building className="w-3 h-3 text-slate-400" />
                        {staff.department || 'Operations'}
                      </p>
                    </td>

                    {/* Contact */}
                    <td className="py-3.5 px-4">
                      {staff.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-700">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{staff.phone}</span>
                        </div>
                      )}
                      {staff.email && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span className="truncate max-w-[160px]">{staff.email}</span>
                        </div>
                      )}
                    </td>

                    {/* Joining Date */}
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      {staff.date_of_joining ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{staff.date_of_joining}</span>
                        </div>
                      ) : (
                        '--'
                      )}
                    </td>

                    {/* Active Status */}
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => handleToggleStatus(staff)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                          staff.is_active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 hover:bg-emerald-100'
                            : 'bg-rose-50 text-rose-700 border border-rose-200/80 hover:bg-rose-100'
                        }`}
                        title="Click to toggle status"
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            staff.is_active ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />
                        {staff.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>

                    {/* Today's Attendance */}
                    <td className="py-3.5 px-4">
                      {staff.present_today ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
                          <CheckCircle2 className="w-3 h-3 text-blue-600" />
                          Present
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-500">
                          Not marked
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenQrModal(staff)}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                          title="View & Download QR / Print ID Card"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenHistoryModal(staff)}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="View Attendance History"
                        >
                          <Clock className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setActiveStaff(staff);
                            setFormData({
                              full_name: staff.full_name || '',
                              role: staff.role || '',
                              department: staff.department || 'Grocery Operations',
                              phone: staff.phone || '',
                              email: staff.email || '',
                              date_of_joining:
                                staff.date_of_joining ||
                                new Intl.DateTimeFormat('en-CA').format(new Date()),
                              is_active: staff.is_active,
                            });
                            setIsEditModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          title="Edit Staff Member"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View (screens < 768px) */}
          <div className="md:hidden divide-y divide-slate-100">
            {staffList.map((staff) => (
              <div key={staff.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-emerald-600 text-white font-bold flex items-center justify-center shrink-0 shadow-xs">
                      {staff.full_name?.charAt(0) || 'S'}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 leading-tight">
                        {staff.full_name}
                      </h4>
                      <span className="font-mono text-xs font-semibold text-primary-600">
                        {staff.staff_code}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleStatus(staff)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                      staff.is_active
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        staff.is_active ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                    />
                    {staff.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Role</span>
                    <span className="font-medium text-slate-800">{staff.role}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Department</span>
                    <span className="font-medium text-slate-800 truncate block">
                      {staff.department || 'Operations'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Phone</span>
                    <span>{staff.phone || '--'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Today</span>
                    <span
                      className={
                        staff.present_today
                          ? 'font-bold text-blue-600'
                          : 'text-slate-400'
                      }
                    >
                      {staff.present_today ? '✓ Present' : 'Not marked'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-slate-400">
                    Joined: {staff.date_of_joining || '--'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenQrModal(staff)}
                      className="px-2.5 py-1 bg-primary-50 text-primary-700 rounded-lg text-xs font-semibold flex items-center gap-1"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      ID Card
                    </button>
                    <button
                      onClick={() => handleOpenHistoryModal(staff)}
                      className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      History
                    </button>
                    <button
                      onClick={() => {
                        setActiveStaff(staff);
                        setFormData({
                          full_name: staff.full_name || '',
                          role: staff.role || '',
                          department: staff.department || 'Grocery Operations',
                          phone: staff.phone || '',
                          email: staff.email || '',
                          date_of_joining:
                            staff.date_of_joining ||
                            new Intl.DateTimeFormat('en-CA').format(new Date()),
                          is_active: staff.is_active,
                        });
                        setIsEditModalOpen(true);
                      }}
                      className="p-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 1: ADD STAFF MEMBER                                             */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add Staff Member</h3>
                  <p className="text-xs text-slate-500">
                    A unique QR code and staff ID will be generated automatically.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddStaff} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Arun Kumar"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Role / Designation <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-primary-500"
                  >
                    {roleList
                      .filter((r) => r !== 'All')
                      .map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Department
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-primary-500"
                  >
                    {departmentList
                      .filter((d) => d !== 'All')
                      .map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +91 98765 43210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. arun@vrk.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-primary-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Date of Joining
                  </label>
                  <input
                    type="date"
                    value={formData.date_of_joining}
                    onChange={(e) => setFormData({ ...formData, date_of_joining: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Status
                  </label>
                  <div className="flex items-center gap-3 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="w-4 h-4 text-primary-600 rounded-md focus:ring-primary-500"
                      />
                      <span>Active Staff Member</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-sm font-semibold bg-primary-600 text-white rounded-xl shadow-xs hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {isSubmitting ? <LoadingSpinner size="sm" /> : <Plus className="w-4 h-4" />}
                  <span>Save & Generate QR</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 2: EDIT STAFF MEMBER                                            */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Edit Staff — {activeStaff?.staff_code}
                  </h3>
                  <p className="text-xs text-slate-500">Update employee details or status.</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditStaff} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-primary-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Role / Designation
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-primary-500"
                  >
                    {roleList
                      .filter((r) => r !== 'All')
                      .map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Department
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-primary-500"
                  >
                    {departmentList
                      .filter((d) => d !== 'All')
                      .map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-primary-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Date of Joining
                  </label>
                  <input
                    type="date"
                    value={formData.date_of_joining}
                    onChange={(e) => setFormData({ ...formData, date_of_joining: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Status
                  </label>
                  <div className="flex items-center gap-3 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="w-4 h-4 text-primary-600 rounded-md focus:ring-primary-500"
                      />
                      <span>Active</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-sm font-semibold bg-primary-600 text-white rounded-xl shadow-xs hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {isSubmitting ? <LoadingSpinner size="sm" /> : <Edit2 className="w-4 h-4" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 3: QR CODE & PRINTABLE ID CARD                                  */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Staff Pass & Attendance QR Code
                  </h3>
                  <p className="text-xs text-slate-500">
                    {activeQrData?.staff_code} — {activeQrData?.full_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsQrModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {loadingQr ? (
                <div className="py-12 flex justify-center">
                  <LoadingSpinner />
                </div>
              ) : (
                <>
                  {/* ID Card Graphical Preview */}
                  <div
                    ref={printCardRef}
                    className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 text-white p-5 shadow-lg border border-slate-800"
                  >
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-400 via-emerald-400 to-sky-400" />
                    
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black tracking-wider text-emerald-400">
                          VRK SUPERMARKET
                        </span>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Staff Pass
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* High-res QR image */}
                      <div className="bg-white p-2 rounded-xl shrink-0 shadow-md">
                        {activeQrData?.qr_data_url ? (
                          <img
                            src={activeQrData.qr_data_url}
                            alt="Staff QR Code"
                            className="w-24 h-24 object-contain"
                          />
                        ) : (
                          <div className="w-24 h-24 flex items-center justify-center text-slate-400">
                            <QrCode className="w-8 h-8" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="text-lg font-bold text-white truncate">
                          {activeQrData?.full_name}
                        </h4>
                        <p className="font-mono text-xs font-bold text-sky-400 mt-0.5">
                          {activeQrData?.staff_code}
                        </p>
                        <div className="mt-2 space-y-0.5 text-xs text-slate-300">
                          <p>
                            Role: <strong className="text-white">{activeQrData?.role}</strong>
                          </p>
                          <p>
                            Dept:{' '}
                            <strong className="text-white">
                              {activeQrData?.department || 'Operations'}
                            </strong>
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                      <span>SCAN AT /scan TERMINAL</span>
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Shield className="w-3 h-3" />
                        CRYPTO SECURED
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleDownloadQrPng}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl text-sm transition-colors"
                    >
                      <Download className="w-4 h-4 text-slate-600" />
                      Download QR PNG
                    </button>
                    <button
                      onClick={handlePrintCard}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl text-sm shadow-xs transition-colors"
                    >
                      <Printer className="w-4 h-4" />
                      Print Staff ID Card
                    </button>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Lost or compromised card?
                    </span>
                    <button
                      onClick={handleRegenerateQr}
                      disabled={loadingQr}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline inline-flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Revoke & Generate New QR
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 4: STAFF ATTENDANCE HISTORY                                     */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Attendance History — {activeStaff?.full_name}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {activeStaff?.staff_code} ({activeStaff?.role})
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
              ) : activeHistory.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold">No attendance records yet</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Records will appear once this staff member checks in via QR code or manual entry.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Check-In Time</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Method / Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {activeHistory.map((rec) => (
                        <tr key={rec.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-medium text-slate-800">
                            {rec.attendance_date}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">
                            {rec.check_in_at
                              ? new Date(rec.check_in_at).toLocaleTimeString('en-IN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: true,
                                })
                              : '--'}
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
