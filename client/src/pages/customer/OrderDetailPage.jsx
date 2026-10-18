import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  MapPin,
  CreditCard,
  Printer,
  Package,
  AlertCircle,
  Truck,
  Box,
  Check,
  ShieldCheck,
  ExternalLink,
  RefreshCw,
  Radio,
  XCircle,
} from 'lucide-react';
import { orderService } from '../../services';
import useAuthStore from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

const ORDER_STEPS = [
  { key: 'pending', label: 'Order Placed', icon: Clock, desc: 'Received & queued' },
  { key: 'confirmed', label: 'Confirmed', icon: ShieldCheck, desc: 'Accepted by store' },
  { key: 'packed', label: 'Packed', icon: Box, desc: 'Items safely packed' },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: Truck, desc: 'En route to your door' },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2, desc: 'Handed over' },
];

export default function OrderDetailPage() {
  const { id } = useParams();
  const { user } = useAuthStore();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(new Date());

  const fetchOrder = async (showInitialLoader = false) => {
    if (showInitialLoader) setLoading(true);
    else setIsRefreshing(true);

    try {
      const res = await orderService.getById(id);
      if (res.data?.data) {
        setOrder(res.data.data);
        setLastRefreshedAt(new Date());
      }
    } catch (err) {
      console.error('Error loading order details:', err);
      if (showInitialLoader) {
        toast.error('Could not load order details');
      }
    } finally {
      if (showInitialLoader) setLoading(false);
      else setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!id) return;

    fetchOrder(true);

    // ── Supabase Realtime Subscription ─────────────────────────────────────
    let channel = null;
    if (supabase) {
      channel = supabase
        .channel(`order-realtime-${id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `id=eq.${id}`,
          },
          (payload) => {
            if (payload?.new) {
              setOrder((prev) => ({
                ...prev,
                ...payload.new,
              }));
              setLastRefreshedAt(new Date());
              toast.success(
                `Order status updated: ${payload.new.status?.replace(/_/g, ' ').toUpperCase()}`
              );
            }
          }
        )
        .subscribe();
    }

    // ── Periodic polling fallback (every 5s) while order is in flight ─────
    const pollInterval = setInterval(() => {
      fetchOrder(false);
    }, 5000);

    return () => {
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
      clearInterval(pollInterval);
    };
  }, [id]);

  const handleStatusChange = async (newStatus) => {
    if (!newStatus || newStatus === order?.status) return;
    setUpdatingStatus(true);
    setStatusMsg(null);
    try {
      const res = await orderService.updateStatus(order.id, { status: newStatus });
      const updated = res.data?.data || { ...order, status: newStatus };
      setOrder(updated);
      setLastRefreshedAt(new Date());
      setStatusMsg({ type: 'success', text: `Status updated to ${newStatus.replace(/_/g, ' ')}` });
      toast.success(`Status updated to ${newStatus.replace(/_/g, ' ')}`);
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to update order status';
      setStatusMsg({ type: 'error', text: errMsg });
      toast.error(errMsg);
    } finally {
      setUpdatingStatus(false);
      setTimeout(() => setStatusMsg(null), 4000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
        <LoadingSpinner size="lg" />
        <p className="text-sm font-medium text-slate-500">Loading order receipt & tracking...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h1 className="text-xl font-bold text-slate-900">Order Not Found</h1>
        <p className="text-xs text-slate-500">
          We could not locate this order or you may not have authorization to view it.
        </p>
        <Link
          to="/orders"
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-emerald-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Orders
        </Link>
      </div>
    );
  }

  const orderDate = new Date(order.created_at).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const isStaff = user && ['admin', 'staff', 'cashier', 'inventoryManager', 'manager'].includes(user.role);

  // Normalize order status index for stepper
  const currentStatus = (order.status || 'pending').toLowerCase();
  const isCancelled = currentStatus === 'cancelled';
  const isRefunded = currentStatus === 'refunded';

  let activeStepIndex = 0;
  if (currentStatus === 'confirmed') activeStepIndex = 1;
  else if (currentStatus === 'packed') activeStepIndex = 2;
  else if (currentStatus === 'out_for_delivery') activeStepIndex = 3;
  else if (currentStatus === 'delivered' || currentStatus === 'completed') activeStepIndex = 4;
  else activeStepIndex = 0;

  const hasCoords = order.latitude && order.longitude;
  const mapsUrl = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${order.latitude},${order.longitude}`
    : null;

  // Status visual badge styling
  const getBadgeStyle = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'confirmed':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'packed':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'out_for_delivery':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'delivered':
      case 'completed':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'cancelled':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      case 'refunded':
        return 'bg-slate-100 text-slate-800 border-slate-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* ── Breadcrumb & Actions ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <Link
          to="/orders"
          className="text-xs font-bold text-slate-600 hover:text-emerald-600 flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> All Orders
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchOrder(false)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs transition-colors disabled:opacity-60"
            title="Refresh current order status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Status'}</span>
          </button>

          <Link
            to="/products"
            className="text-xs font-bold text-slate-600 hover:text-emerald-600 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
          >
            Continue Shopping
          </Link>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5" /> Print Receipt
          </button>
        </div>
      </div>

      {/* ── Order Status Banner ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider block mb-1">
              VRK Supermarket Order Receipt
            </span>
            <h1 className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              {order.order_number}
            </h1>
            <p className="text-xs text-slate-400 mt-1">Placed on {orderDate}</p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider border ${getBadgeStyle(
                currentStatus
              )}`}
            >
              <span className="w-2 h-2 rounded-full bg-current opacity-80" />
              Status: {currentStatus.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        {/* ── Visual Order Fulfillment Tracker ───────────────────────────────── */}
        <div className="py-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Order Fulfillment Tracking
            </h2>
            <span className="text-[11px] text-slate-400 font-medium">
              Verified Supermarket Dispatch
            </span>
          </div>

          {isCancelled ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-3">
              <XCircle className="w-5 h-5 shrink-0 text-rose-600" />
              <div>
                <p className="font-bold">Order Cancelled</p>
                <p className="font-normal text-rose-700 text-[11px] mt-0.5">
                  This order has been cancelled. Any reserved stock has been returned to the store inventory.
                </p>
              </div>
            </div>
          ) : isRefunded ? (
            <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-slate-600" />
              <div>
                <p className="font-bold">Order Refunded</p>
                <p className="font-normal text-slate-600 text-[11px] mt-0.5">
                  Items have been returned and refunded.
                </p>
              </div>
            </div>
          ) : (
            <div className="relative pt-2">
              {/* Desktop Stepper */}
              <div className="hidden sm:grid sm:grid-cols-5 gap-2 relative">
                {/* Connecting track line */}
                <div
                  className="absolute top-5 left-[10%] right-[10%] h-1 bg-slate-100 -z-0"
                  aria-hidden="true"
                >
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{
                      width: `${(activeStepIndex / (ORDER_STEPS.length - 1)) * 100}%`,
                    }}
                  />
                </div>

                {ORDER_STEPS.map((step, idx) => {
                  const Icon = step.icon;
                  const isDone = idx <= activeStepIndex;
                  const isCurrent = idx === activeStepIndex;

                  return (
                    <div key={step.key} className="flex flex-col items-center text-center relative z-10">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                          isDone
                            ? 'bg-emerald-600 text-white shadow-sm ring-4 ring-emerald-100'
                            : 'bg-white border-2 border-slate-200 text-slate-400'
                        } ${isCurrent ? 'ring-emerald-200 ring-4 scale-105' : ''}`}
                      >
                        {isDone && !isCurrent ? (
                          <Check className="w-5 h-5 stroke-[2.5]" />
                        ) : (
                          <Icon className="w-4 h-4" />
                        )}
                      </div>
                      <span
                        className={`mt-2.5 text-xs font-bold ${
                          isDone ? 'text-slate-900' : 'text-slate-400'
                        }`}
                      >
                        {step.label}
                      </span>
                      <span className="text-[10px] text-slate-400 leading-tight mt-0.5">
                        {step.desc}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Mobile Stepper */}
              <div className="sm:hidden space-y-2.5">
                {ORDER_STEPS.map((step, idx) => {
                  const Icon = step.icon;
                  const isDone = idx <= activeStepIndex;
                  const isCurrent = idx === activeStepIndex;

                  return (
                    <div
                      key={step.key}
                      className={`flex items-center gap-3 p-3 rounded-2xl border text-xs transition-all ${
                        isCurrent
                          ? 'border-emerald-300 bg-emerald-50/70 shadow-xs'
                          : isDone
                          ? 'border-slate-200 bg-white'
                          : 'border-slate-100 bg-slate-50 opacity-60'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          isDone ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400'
                        }`}
                      >
                        {isDone && !isCurrent ? (
                          <Check className="w-4 h-4 stroke-[2.5]" />
                        ) : (
                          <Icon className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <p className={`font-bold ${isDone ? 'text-slate-900' : 'text-slate-400'}`}>
                          {step.label}
                        </p>
                        <p className="text-[10px] text-slate-400">{step.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Live Tracking Footer with Timestamps ────────────────────────── */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-4 text-xs text-slate-500 border-t border-slate-100">
            <div className="flex items-center gap-2">
              {!isCancelled && !isRefunded && currentStatus !== 'delivered' && currentStatus !== 'completed' ? (
                <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full text-[11px] border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Realtime Tracking Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-full text-[11px] border border-slate-200">
                  Tracking Closed
                </span>
              )}
            </div>

            <span className="text-[11px] text-slate-400 font-mono">
              Status updated: {new Date(order.updated_at || order.created_at).toLocaleString('en-IN', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
          </div>
        </div>

        {/* ── Staff Status Controller ────────────────────────────────────────── */}
        {isStaff && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> Staff Order Management
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                Role: {user.role}
              </span>
            </div>

            {statusMsg && (
              <div
                className={`p-2.5 rounded-xl text-xs font-bold ${
                  statusMsg.type === 'success'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {statusMsg.text}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {[
                { status: 'confirmed', label: '1. Confirm' },
                { status: 'packed', label: '2. Pack' },
                { status: 'out_for_delivery', label: '3. Dispatch' },
                { status: 'delivered', label: '4. Deliver' },
                { status: 'cancelled', label: 'Cancel Order' },
              ].map((btn) => (
                <button
                  key={btn.status}
                  type="button"
                  disabled={updatingStatus || currentStatus === btn.status}
                  onClick={() => handleStatusChange(btn.status)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    currentStatus === btn.status
                      ? 'bg-emerald-600 text-white shadow-xs cursor-default'
                      : btn.status === 'cancelled'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  } disabled:opacity-50`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Delivery Location & Contact ────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100 text-xs">
          {/* Address Details */}
          <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-2">
            <span className="font-bold text-slate-700 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-600" /> Delivery Address
            </span>
            <p className="font-bold text-slate-900 leading-snug">
              {order.delivery_address || 'Standard Store Delivery Address'}
            </p>
            {order.delivery_notes && (
              <p className="text-slate-500 italic mt-1">
                Instructions: "{order.delivery_notes}"
              </p>
            )}
            {hasCoords && mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 mt-2"
              >
                <span>View Exact Pin on Google Maps</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {/* Customer & Payment Meta */}
          <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-2">
            <span className="font-bold text-slate-700 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-emerald-600" /> Customer & Payment
            </span>
            <div className="space-y-1">
              <p className="text-slate-600">
                <span className="font-semibold text-slate-800">Recipient:</span> {order.customer_name || 'Customer'}
              </p>
              {order.customer_email && (
                <p className="text-slate-600">
                  <span className="font-semibold text-slate-800">Email:</span> {order.customer_email}
                </p>
              )}
              {order.customer_phone && (
                <p className="text-slate-600">
                  <span className="font-semibold text-slate-800">Phone:</span> {order.customer_phone}
                </p>
              )}
              <div className="flex items-center gap-2 pt-1">
                <span className="font-semibold text-slate-800">Payment:</span>
                <span className="uppercase font-mono px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-bold">
                  {order.payment_method || 'COD'}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    order.payment_status === 'paid'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {order.payment_status || 'Pending'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Order Line Items Table ─────────────────────────────────────────── */}
        <div className="pt-2 space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-600" /> Purchased Supermarket Items
          </h3>

          <div className="overflow-x-auto border border-slate-200/80 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Item</th>
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4 text-center">Qty</th>
                  <th className="py-3 px-4 text-right">Unit Price</th>
                  <th className="py-3 px-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(order.order_items || []).map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {item.product_name}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                      {item.sku || 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-700">
                      {item.quantity}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600">
                      ₹{Number(item.price).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      ₹{Number(item.total).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Calculation Summary ────────────────────────────────────────────── */}
        <div className="pt-2 flex justify-end">
          <div className="w-full max-w-xs space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-900">₹{Number(order.subtotal || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Delivery Charges</span>
              <span className="font-semibold text-slate-900">
                {Number(order.delivery_fee || 0) === 0 ? 'FREE' : `₹${Number(order.delivery_fee).toFixed(2)}`}
              </span>
            </div>
            {Number(order.discount || 0) > 0 && (
              <div className="flex justify-between text-emerald-600 font-semibold">
                <span>Discount</span>
                <span>-₹{Number(order.discount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200">
              <span>Grand Total</span>
              <span className="text-emerald-700">₹{Number(order.total || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
