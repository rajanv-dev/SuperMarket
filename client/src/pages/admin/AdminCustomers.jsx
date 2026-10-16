import { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  ShoppingBag,
  IndianRupee,
  Calendar,
  Phone,
  Mail,
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  X,
  CreditCard,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminService } from '../../services/adminSupabaseService';

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await adminService.getCustomers();
      setCustomers(data);
    } catch (err) {
      toast.error('Failed to load customers: ' + (err.message || 'Database error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customers;
    const s = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.full_name?.toLowerCase().includes(s) ||
        c.email?.toLowerCase().includes(s) ||
        c.phone?.toLowerCase().includes(s)
    );
  }, [customers, search]);

  // Aggregate metrics
  const totalCustomers = customers.length;
  const activeCustomers = customers.filter((c) => c.is_active !== false).length;
  const totalCustomerSpend = customers.reduce((sum, c) => sum + (c.total_spent || 0), 0);
  const totalOrdersCount = customers.reduce((sum, c) => sum + (c.total_orders || 0), 0);

  const handleToggleStatus = async (customer) => {
    try {
      const nextStatus = !customer.is_active;
      await adminService.toggleUserActive(customer.id, nextStatus);
      toast.success(
        `Customer "${customer.full_name || customer.email}" ${
          nextStatus ? 'activated' : 'deactivated'
        }`
      );
      loadCustomers();
    } catch (err) {
      toast.error(err.message || 'Failed to update customer status');
    }
  };

  const handleViewOrders = async (customer) => {
    setSelectedCustomer(customer);
    try {
      setLoadingOrders(true);
      const allOrders = await adminService.getOrders();
      // Match by phone or customer name
      const matched = allOrders.filter(
        (o) =>
          (customer.phone && o.customer_phone === customer.phone) ||
          (customer.full_name && o.customer_name?.toLowerCase() === customer.full_name.toLowerCase())
      );
      setCustomerOrders(matched);
    } catch (err) {
      toast.error('Failed to load customer orders');
    } finally {
      setLoadingOrders(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Customer Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-50 text-primary-700 border border-primary-200">
              {totalCustomers} Profiles
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Track customer shopping history, lifetime spend, and account statuses
          </p>
        </div>

        <button
          onClick={loadCustomers}
          disabled={loading}
          className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors shadow-sm disabled:opacity-50 self-start sm:self-auto"
          title="Refresh customers"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ── Metric Cards ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Registered</p>
            <p className="text-xl font-bold text-slate-900">{totalCustomers}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Active Accounts</p>
            <p className="text-xl font-bold text-emerald-600">{activeCustomers}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Orders Placed</p>
            <p className="text-xl font-bold text-slate-900">{totalOrdersCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <IndianRupee className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Lifetime Spend</p>
            <p className="text-xl font-bold text-slate-900">
              ₹{totalCustomerSpend.toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      </div>

      {/* ── Search Bar ─────────────────────────────────────────────────────────── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer name, phone, or email..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
          />
        </div>
      </div>

      {/* ── Customers Table ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-3 border-primary-600/30 border-t-primary-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600">Loading customers...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No customers found</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              {search
                ? `No customers match "${search}". Try searching with a different keyword.`
                : 'Customer profiles will appear here as users sign in or register.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-6">Customer</th>
                  <th className="py-3.5 px-6">Contact Info</th>
                  <th className="py-3.5 px-6">Orders</th>
                  <th className="py-3.5 px-6">Lifetime Spend</th>
                  <th className="py-3.5 px-6">Role</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-sm shadow-primary-500/20">
                          {c.full_name?.charAt(0) || c.email?.charAt(0) || 'C'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">
                            {c.full_name || 'Customer'}
                          </p>
                          <p className="text-xs text-slate-400">
                            ID: {c.id?.slice(0, 8)}...
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="space-y-0.5 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{c.email || '—'}</span>
                        </div>
                        {c.phone && (
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{c.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700">
                        <ShoppingBag className="w-3 h-3 text-slate-500" />
                        {c.total_orders || 0} Orders
                      </span>
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-900">
                      ₹{(c.total_spent || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-4 px-6">
                      <span className="capitalize text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                        {c.role || 'customer'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <button
                        onClick={() => handleToggleStatus(c)}
                        title="Click to toggle status"
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all hover:scale-105 ${
                          c.is_active !== false
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {c.is_active !== false ? (
                          <>
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            Active
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-rose-500" />
                            Blocked
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => handleViewOrders(c)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 text-primary-600" />
                        Order History
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Order History Drawer / Modal ───────────────────────────────────────── */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center font-bold">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Order History for {selectedCustomer.full_name || selectedCustomer.email}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedCustomer.email} {selectedCustomer.phone && `• ${selectedCustomer.phone}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {loadingOrders ? (
                <div className="p-8 text-center">
                  <div className="w-6 h-6 border-2 border-primary-600/30 border-t-primary-600 rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Loading order records...</p>
                </div>
              ) : customerOrders.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl">
                  <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No order history found</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    This customer hasn't completed any online orders or POS checkouts yet.
                  </p>
                </div>
              ) : (
                customerOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-sm transition-all flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">
                          {ord.order_number}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            ord.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-700'
                              : ord.status === 'refunded'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {ord.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {new Date(ord.created_at).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                          {ord.payment_method || 'Cash'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-black text-slate-900">
                        ₹{Number(ord.total).toLocaleString('en-IN')}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Payment: {ord.payment_status || 'paid'}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 text-right">
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-semibold text-slate-700 transition-colors"
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
