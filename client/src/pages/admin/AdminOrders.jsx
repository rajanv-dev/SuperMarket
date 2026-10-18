import { useEffect, useState } from 'react';
import {
  ShoppingBag,
  Search,
  Filter,
  Eye,
  RotateCcw,
  Printer,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  Truck,
  Box,
  ShieldCheck,
  Check,
  AlertCircle,
  MapPin,
  ExternalLink,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';
import { adminService } from '../../services/adminSupabaseService';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    bg: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
    nextAction: { status: 'confirmed', label: 'Confirm Order', icon: ShieldCheck, color: 'bg-blue-600 hover:bg-blue-700 text-white' },
  },
  confirmed: {
    label: 'Confirmed',
    bg: 'bg-blue-50 text-blue-800 border-blue-200',
    dot: 'bg-blue-500',
    nextAction: { status: 'packed', label: 'Mark Packed', icon: Box, color: 'bg-purple-600 hover:bg-purple-700 text-white' },
  },
  packed: {
    label: 'Packed',
    bg: 'bg-purple-50 text-purple-800 border-purple-200',
    dot: 'bg-purple-500',
    nextAction: { status: 'out_for_delivery', label: 'Dispatch Order', icon: Truck, color: 'bg-indigo-600 hover:bg-indigo-700 text-white' },
  },
  out_for_delivery: {
    label: 'Out for Delivery',
    bg: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    dot: 'bg-indigo-500',
    nextAction: { status: 'delivered', label: 'Mark Delivered', icon: CheckCircle, color: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
  },
  delivered: {
    label: 'Delivered',
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
    nextAction: null,
  },
  completed: {
    label: 'Completed',
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
    nextAction: null,
  },
  cancelled: {
    label: 'Cancelled',
    bg: 'bg-rose-50 text-rose-800 border-rose-200',
    dot: 'bg-rose-500',
    nextAction: null,
  },
  refunded: {
    label: 'Refunded',
    bg: 'bg-slate-100 text-slate-800 border-slate-200',
    dot: 'bg-slate-500',
    nextAction: null,
  },
};

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Modal states
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [customStatus, setCustomStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');

  const loadOrders = async () => {
    try {
      setIsLoading(true);
      const data = await adminService.getOrders({
        search,
        type: selectedType,
        status: selectedStatus,
      });
      setOrders(data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [selectedType, selectedStatus]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadOrders();
  };

  const openOrderDetails = async (orderId) => {
    try {
      setIsDetailLoading(true);
      const details = await adminService.getOrderDetails(orderId);
      setSelectedOrder(details);
      setCustomStatus(details.status || 'pending');
      setStatusNotes('');
    } catch (err) {
      toast.error('Failed to load order details');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleStatusUpdate = async (orderId, newStatus, notes = '') => {
    if (!newStatus) return;
    try {
      setIsUpdatingStatus(true);
      const updated = await adminService.updateOrderStatus(orderId, newStatus, notes);
      toast.success(`Order status updated to "${newStatus.replace(/_/g, ' ')}"`);

      // Update in local list
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus, ...updated } : o))
      );

      // Update in open modal if active
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev) => ({ ...prev, status: newStatus, ...updated }));
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update order status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleCancelOrder = async (order) => {
    const confirmed = window.confirm(
      `Are you sure you want to cancel order #${order.order_number}? Reserved stock will be automatically returned to store inventory.`
    );
    if (!confirmed) return;

    await handleStatusUpdate(order.id, 'cancelled', 'Cancelled by administrator');
  };

  const handleRefund = async (order) => {
    const reason = window.prompt(
      `Please enter refund reason for order #${order.order_number}:`,
      'Customer requested return'
    );
    if (!reason) return;

    try {
      setIsRefunding(true);
      await adminService.refundOrder(order.id, reason);
      toast.success(`Order #${order.order_number} refunded and items restocked`);
      setSelectedOrder(null);
      loadOrders();
    } catch (err) {
      toast.error(err.message || 'Refund failed');
    } finally {
      setIsRefunding(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const formatCurrency = (val) => `₹${Number(val || 0).toFixed(2)}`;

  // Summary Metrics calculations
  const totalCount = orders.length;
  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  const confirmedCount = orders.filter((o) => o.status === 'confirmed').length;
  const packedCount = orders.filter((o) => o.status === 'packed').length;
  const outForDeliveryCount = orders.filter((o) => o.status === 'out_for_delivery').length;
  const deliveredCount = orders.filter(
    (o) => o.status === 'delivered' || o.status === 'completed'
  ).length;

  return (
    <div className="space-y-6">
      {/* ── Page Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-slate-900 tracking-tight">
            Order Fulfillment & Sales Management
          </h1>
          <p className="text-sm text-slate-500">
            Monitor real-time online grocery delivery orders and POS cashier registers
          </p>
        </div>

        <button
          onClick={loadOrders}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-xs transition-all w-fit cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* ── Status Overview Metrics Cards ────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div
          onClick={() => setSelectedStatus('all')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            selectedStatus === 'all'
              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
              : 'bg-white text-slate-800 border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider block opacity-70">
            All Orders
          </span>
          <span className="text-xl font-black mt-1 block font-mono">{totalCount}</span>
        </div>

        <div
          onClick={() => setSelectedStatus('pending')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            selectedStatus === 'pending'
              ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
              : 'bg-white text-slate-800 border-slate-200/80 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider block text-amber-700">
              Pending
            </span>
            {pendingCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            )}
          </div>
          <span className="text-xl font-black mt-1 block font-mono text-amber-900">
            {pendingCount}
          </span>
        </div>

        <div
          onClick={() => setSelectedStatus('confirmed')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            selectedStatus === 'confirmed'
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
              : 'bg-white text-slate-800 border-slate-200/80 hover:border-blue-300'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider block text-blue-700">
            Confirmed
          </span>
          <span className="text-xl font-black mt-1 block font-mono text-blue-900">
            {confirmedCount}
          </span>
        </div>

        <div
          onClick={() => setSelectedStatus('packed')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            selectedStatus === 'packed'
              ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
              : 'bg-white text-slate-800 border-slate-200/80 hover:border-purple-300'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider block text-purple-700">
            Packed
          </span>
          <span className="text-xl font-black mt-1 block font-mono text-purple-900">
            {packedCount}
          </span>
        </div>

        <div
          onClick={() => setSelectedStatus('out_for_delivery')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            selectedStatus === 'out_for_delivery'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
              : 'bg-white text-slate-800 border-slate-200/80 hover:border-indigo-300'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider block text-indigo-700">
            On Delivery
          </span>
          <span className="text-xl font-black mt-1 block font-mono text-indigo-900">
            {outForDeliveryCount}
          </span>
        </div>

        <div
          onClick={() => setSelectedStatus('delivered')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            selectedStatus === 'delivered'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
              : 'bg-white text-slate-800 border-slate-200/80 hover:border-emerald-300'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider block text-emerald-700">
            Delivered
          </span>
          <span className="text-xl font-black mt-1 block font-mono text-emerald-900">
            {deliveredCount}
          </span>
        </div>
      </div>

      {/* ── Search & Filter Controls ────────────────────────────────────────── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order #, customer name, phone, or email..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </form>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Channel Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
          >
            <option value="all">All Channels</option>
            <option value="online">Online Delivery</option>
            <option value="pos">POS In-Store</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="packed">Packed</option>
            <option value="out_for_delivery">Out for Delivery</option>
            <option value="delivered">Delivered</option>
            <option value="completed">Completed / Paid</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
      </div>

      {/* ── Orders Table & Mobile Cards ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : orders.length > 0 ? (
          <>
            {/* Mobile View (< 768px) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {orders.map((o) => {
                const conf = STATUS_CONFIG[o.status] || STATUS_CONFIG.pending;
                return (
                  <div key={`m-${o.id}`} className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          {o.order_number}
                        </span>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {new Date(o.created_at).toLocaleString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase border ${conf.bg}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} />
                        {conf.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <div>
                        <p className="font-bold text-slate-900">{o.customer_name || 'Walk-in Customer'}</p>
                        {o.customer_phone && <p className="text-[11px] text-slate-400">{o.customer_phone}</p>}
                      </div>
                      <span className="font-mono font-extrabold text-slate-900 text-sm">
                        {formatCurrency(o.total)}
                      </span>
                    </div>

                    {/* Quick Action Button for Mobile */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      {conf.nextAction ? (
                        <button
                          type="button"
                          disabled={isUpdatingStatus}
                          onClick={() => handleStatusUpdate(o.id, conf.nextAction.status)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-all ${conf.nextAction.color} disabled:opacity-50`}
                        >
                          <conf.nextAction.icon className="w-3.5 h-3.5" />
                          <span>{conf.nextAction.label}</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">No pending actions</span>
                      )}

                      <button
                        type="button"
                        onClick={() => openOrderDetails(o.id)}
                        className="px-3 py-1.5 text-xs font-bold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-xl transition-all"
                      >
                        View & Manage
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200/60">
                  <tr>
                    <th className="py-3 px-4">Order Number</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Channel</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Total Amount</th>
                    <th className="py-3 px-4 text-center">Quick Action</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {orders.map((o) => {
                    const conf = STATUS_CONFIG[o.status] || STATUS_CONFIG.pending;
                    return (
                      <tr key={o.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          {o.order_number}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-500">
                          {new Date(o.created_at).toLocaleString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md font-bold text-[10px] uppercase ${
                              o.type === 'pos'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {o.type}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-800">{o.customer_name || 'Walk-in'}</p>
                          {o.customer_phone && (
                            <p className="text-[11px] text-slate-400 font-mono">{o.customer_phone}</p>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold text-[11px] uppercase border ${conf.bg}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} />
                            {conf.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-extrabold text-slate-900 text-sm font-mono">
                          {formatCurrency(o.total)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {conf.nextAction ? (
                            <button
                              type="button"
                              disabled={isUpdatingStatus}
                              onClick={() => handleStatusUpdate(o.id, conf.nextAction.status)}
                              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold shadow-2xs transition-all ${conf.nextAction.color} disabled:opacity-50`}
                            >
                              <conf.nextAction.icon className="w-3.5 h-3.5" />
                              <span>{conf.nextAction.label}</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => openOrderDetails(o.id)}
                            className="px-3 py-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-xl transition-all cursor-pointer"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="py-16 text-center text-slate-400">
            <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold text-slate-700">No orders found matching filters</p>
          </div>
        )}
      </div>

      {/* ── Order Details & Status Management Modal ─────────────────────────── */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                  VRK Supermarket Order Management
                </span>
                <h3 className="text-lg font-black text-slate-900 font-mono">
                  {selectedOrder.order_number}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* 1. Fulfillment Status Controller */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" /> Fulfillment Stage Controller
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase border ${
                      STATUS_CONFIG[selectedOrder.status]?.bg || 'bg-slate-100'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        STATUS_CONFIG[selectedOrder.status]?.dot || 'bg-slate-400'
                      }`}
                    />
                    {selectedOrder.status}
                  </span>
                </div>

                {/* Direct Lifecycle Action Buttons */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isUpdatingStatus || selectedOrder.status === 'confirmed'}
                    onClick={() => handleStatusUpdate(selectedOrder.id, 'confirmed')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      selectedOrder.status === 'confirmed'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-blue-50 hover:text-blue-700'
                    } disabled:opacity-50`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>1. Confirm Order</span>
                  </button>

                  <button
                    type="button"
                    disabled={isUpdatingStatus || selectedOrder.status === 'packed'}
                    onClick={() => handleStatusUpdate(selectedOrder.id, 'packed')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      selectedOrder.status === 'packed'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-purple-50 hover:text-purple-700'
                    } disabled:opacity-50`}
                  >
                    <Box className="w-3.5 h-3.5" />
                    <span>2. Mark Packed</span>
                  </button>

                  <button
                    type="button"
                    disabled={isUpdatingStatus || selectedOrder.status === 'out_for_delivery'}
                    onClick={() => handleStatusUpdate(selectedOrder.id, 'out_for_delivery')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      selectedOrder.status === 'out_for_delivery'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'
                    } disabled:opacity-50`}
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>3. Dispatch</span>
                  </button>

                  <button
                    type="button"
                    disabled={isUpdatingStatus || selectedOrder.status === 'delivered'}
                    onClick={() => handleStatusUpdate(selectedOrder.id, 'delivered')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      selectedOrder.status === 'delivered'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
                    } disabled:opacity-50`}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>4. Mark Delivered</span>
                  </button>

                  {selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'delivered' && (
                    <button
                      type="button"
                      disabled={isUpdatingStatus}
                      onClick={() => handleCancelOrder(selectedOrder)}
                      className="px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Cancel Order</span>
                    </button>
                  )}
                </div>

                {/* Custom Status Dropdown Override */}
                <div className="pt-2 border-t border-slate-200/80 flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-500 shrink-0">
                    Manual Override:
                  </span>
                  <select
                    value={customStatus}
                    onChange={(e) => setCustomStatus(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none"
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="packed">Packed</option>
                    <option value="out_for_delivery">Out for Delivery</option>
                    <option value="delivered">Delivered</option>
                    <option value="completed">Completed / Paid</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="refunded">Refunded</option>
                  </select>
                  <button
                    type="button"
                    disabled={isUpdatingStatus || customStatus === selectedOrder.status}
                    onClick={() => handleStatusUpdate(selectedOrder.id, customStatus, statusNotes)}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-40"
                  >
                    Apply Status
                  </button>
                </div>
              </div>

              {/* 2. Customer & Delivery Address Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px] uppercase font-bold">Customer</span>
                  <p className="font-bold text-slate-800 mt-0.5">{selectedOrder.customer_name || 'Walk-in'}</p>
                  {selectedOrder.customer_email && (
                    <p className="text-slate-500">{selectedOrder.customer_email}</p>
                  )}
                  {selectedOrder.customer_phone && (
                    <p className="text-slate-500 font-mono">{selectedOrder.customer_phone}</p>
                  )}
                </div>

                <div>
                  <span className="text-slate-400 block text-[11px] uppercase font-bold">Delivery Address</span>
                  <p className="font-bold text-slate-800 mt-0.5 leading-snug">
                    {selectedOrder.delivery_address || 'In-Store Counter Pickup'}
                  </p>
                  {selectedOrder.delivery_notes && (
                    <p className="text-slate-500 italic mt-0.5">
                      Note: "{selectedOrder.delivery_notes}"
                    </p>
                  )}
                  {selectedOrder.latitude && selectedOrder.longitude && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${selectedOrder.latitude},${selectedOrder.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-primary-600 hover:underline mt-1"
                    >
                      <MapPin className="w-3 h-3" />
                      <span>View Delivery Pin on Google Maps</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              </div>

              {/* 3. Line Items Breakdown */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Purchased Items ({selectedOrder.items?.length || 0})
                </h4>
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                  {selectedOrder.items?.map((item) => (
                    <div key={item.id} className="p-3 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-900">{item.product_name}</p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          SKU: {item.sku || 'N/A'} · {item.quantity} × {formatCurrency(item.price)}
                        </p>
                      </div>
                      <span className="font-extrabold text-slate-900 font-mono">
                        {formatCurrency(item.total)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Price Calculation Breakdown */}
              <div className="space-y-1.5 pt-2 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span>{formatCurrency(selectedOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Delivery Charges</span>
                  <span>
                    {Number(selectedOrder.delivery_fee || 0) === 0
                      ? 'FREE'
                      : formatCurrency(selectedOrder.delivery_fee)}
                  </span>
                </div>
                {Number(selectedOrder.discount) > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Discount</span>
                    <span>-{formatCurrency(selectedOrder.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-200 font-mono">
                  <span>Grand Total</span>
                  <span className="text-primary-700">{formatCurrency(selectedOrder.total)}</span>
                </div>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
              <div>
                {selectedOrder.status === 'completed' && (
                  <button
                    type="button"
                    onClick={() => handleRefund(selectedOrder)}
                    disabled={isRefunding}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-xl transition-all disabled:opacity-60 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Issue Refund</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
