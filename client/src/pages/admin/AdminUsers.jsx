import { useEffect, useState } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  CheckCircle,
  XCircle,
  Search,
  RefreshCw,
  X,
  Mail,
  Phone,
  AlertTriangle,
  BadgeCheck,
} from 'lucide-react';
import { adminService } from '../../services/adminSupabaseService';
import useAuthStore from '../../store/authStore';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { ROLES } from '../../utils/constants';

export default function AdminUsers() {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState([]);
  const [staffProfiles, setStaffProfiles] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState('staff_only'); // 'staff_only' | 'all'
  const [selectedRole, setSelectedRole] = useState('all');

  // Add staff modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    role: 'cashier',
    phone: '',
  });

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [usersData, staffData] = await Promise.all([
        adminService.getUsersAndStaff(),
        adminService.getAttendanceStaffList().catch(() => []),
      ]);

      setUsers(usersData || []);

      const profileMap = {};
      (staffData || []).forEach((s) => {
        if (s.user_profile_id) {
          profileMap[s.user_profile_id] = s;
        }
      });
      setStaffProfiles(profileMap);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load staff accounts');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRoleChange = async (targetUser, newRole) => {
    if (targetUser.id === currentUser?.id && newRole !== ROLES.ADMIN) {
      toast.error('You cannot demote your own administrator account');
      return;
    }

    try {
      await adminService.updateUserRole(targetUser.id, newRole);
      setUsers(users.map((u) => (u.id === targetUser.id ? { ...u, role: newRole } : u)));
      toast.success(`Role for ${targetUser.full_name || targetUser.email} updated to ${newRole}`);
    } catch (err) {
      toast.error('Failed to update role');
    }
  };

  const handleToggleStatus = async (targetUser) => {
    if (targetUser.id === currentUser?.id) {
      toast.error('You cannot deactivate your own active administrator account');
      return;
    }

    try {
      const nextStatus = !targetUser.is_active;
      await adminService.toggleUserActive(targetUser.id, nextStatus);
      setUsers(users.map((u) => (u.id === targetUser.id ? { ...u, is_active: nextStatus } : u)));
      toast.success(`User ${nextStatus ? 'activated' : 'deactivated'}`);
    } catch (err) {
      toast.error('Failed to change user status');
    }
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.email.trim()) {
      toast.error('Name and email are required');
      return;
    }

    try {
      setIsSubmitting(true);
      await adminService.addStaffMember(formData);
      toast.success('Staff member profile created successfully');
      setIsModalOpen(false);
      setFormData({ fullName: '', email: '', role: 'cashier', phone: '' });
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to add staff member');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter logic: clean separation of staff vs all accounts
  const filteredUsers = users.filter((u) => {
    const term = search.toLowerCase();
    const matchSearch =
      !term ||
      (u.full_name && u.full_name.toLowerCase().includes(term)) ||
      (u.email && u.email.toLowerCase().includes(term));

    const isStaff = u.role === 'admin' || u.role === 'manager' || u.role === 'cashier';
    const matchMode = filterMode === 'all' || isStaff;
    const matchRole = selectedRole === 'all' || u.role === selectedRole;

    return matchSearch && matchMode && matchRole;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-slate-900 tracking-tight">
            Staff & Roles
          </h1>
          <p className="text-sm text-slate-500">
            Manage supermarket staff profiles, permission levels, and access credentials
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-xs transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-sm transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Staff Account</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Field */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by staff name or email..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Staff Filter Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setFilterMode('staff_only')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterMode === 'staff_only'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Staff Only
            </button>
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterMode === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All Accounts
            </button>
          </div>

          {/* Role Filter */}
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
          >
            <option value="all">All Roles</option>
            <option value="admin">Administrators</option>
            <option value="manager">Inventory Managers</option>
            <option value="cashier">Cashiers</option>
            {filterMode === 'all' && <option value="customer">Customers</option>}
          </select>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : filteredUsers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200/60">
                <tr>
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Employee ID</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Role Permission</th>
                  <th className="py-3 px-4 text-center">Account Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredUsers.map((u) => {
                  const staff = staffProfiles[u.id];
                  const isCurrentAdmin = u.id === currentUser?.id;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Name & Email */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500/20 to-emerald-500/20 text-primary-700 flex items-center justify-center font-bold text-sm shrink-0">
                            {u.full_name?.charAt(0) || u.email?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-slate-900 text-sm leading-tight">
                                {u.full_name || 'Staff Member'}
                              </p>
                              {isCurrentAdmin && (
                                <span className="text-[10px] bg-primary-50 text-primary-700 font-bold px-1.5 py-0.5 rounded border border-primary-200">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 font-mono">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Employee ID */}
                      <td className="py-3.5 px-4">
                        {staff?.employee_id ? (
                          <span className="inline-flex items-center gap-1 font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                            <BadgeCheck className="w-3 h-3 text-primary-600" />
                            {staff.employee_id}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Contact Phone */}
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {u.phone || '—'}
                      </td>

                      {/* Role Selector */}
                      <td className="py-3.5 px-4">
                        <select
                          value={u.role || 'customer'}
                          disabled={isCurrentAdmin}
                          onChange={(e) => handleRoleChange(u, e.target.value)}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-lg border bg-white outline-none cursor-pointer ${
                            isCurrentAdmin
                              ? 'border-slate-200 text-slate-400 cursor-not-allowed bg-slate-50'
                              : 'border-slate-200 text-slate-800 hover:border-slate-300'
                          }`}
                        >
                          <option value="admin">Admin</option>
                          <option value="manager">Manager</option>
                          <option value="cashier">Cashier</option>
                          <option value="customer">Customer</option>
                        </select>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold text-[11px] ${
                            u.is_active !== false
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {u.is_active !== false ? (
                            <>
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              <span>Active</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-rose-600" />
                              <span>Deactivated</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Action Button */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleToggleStatus(u)}
                          disabled={isCurrentAdmin}
                          title={isCurrentAdmin ? 'You cannot deactivate your own account' : ''}
                          className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all ${
                            isCurrentAdmin
                              ? 'opacity-40 cursor-not-allowed text-slate-400 border-slate-200'
                              : u.is_active !== false
                              ? 'text-rose-600 border-rose-200 hover:bg-rose-50'
                              : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'
                          }`}
                        >
                          {u.is_active !== false ? 'Deactivate' : 'Activate'}
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
            <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold text-slate-700">No staff accounts found</p>
          </div>
        )}
      </div>

      {/* Add Staff Account Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden animate-slide-up">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900">Add Staff Account</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddStaff} className="p-6 space-y-4">
              <div>
                <label className="label">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="e.g. Ramesh Kumar"
                  className="input"
                />
              </div>

              <div>
                <label className="label">Email Address *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="ramesh@super.local"
                  className="input"
                />
              </div>

              <div>
                <label className="label">Role Permission *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="input"
                >
                  <option value="cashier">Cashier (POS billing)</option>
                  <option value="manager">Inventory Manager (Stock & Batches)</option>
                  <option value="admin">Administrator (Full Access)</option>
                </select>
              </div>

              <div>
                <label className="label">Phone Number</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="input"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-sm disabled:opacity-60 flex items-center gap-2"
                >
                  {isSubmitting ? <LoadingSpinner size="sm" /> : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
