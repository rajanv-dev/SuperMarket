import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { orderService } from '../../services';
import useAuthStore from '../../store/authStore';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const ORDER_STEPS = [
  { key: 'pending', label: 'Pending', icon: Clock, desc: 'Order received & queued' },
  { key: 'confirmed', label: 'Confirmed', icon: ShieldCheck, desc: 'Order accepted' },
  { key: 'packed', label: 'Packed', icon: Box, desc: 'Items safely packed' },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: Truck, desc: 'En route to your door' },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2, desc: 'Handed over' },
];

export default function OrderDetailPage() {
  const { id } = useParams();
  const { user } = useAuthStore();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  useEffect(() => {
    orderService
      .getById(id)
      .then((res) => setOrder(res.data?.data))
      .catch((err) => console.error('Error loading order details:', err))
      .finally(() => setLoading(false));
  }, [id]);

  const handleStatusChange = async (newStatus) => {
    if (!newStatus || newStatus === order?.status) return;
    setUpdatingStatus(true);
    setStatusMsg(null);
    try {
      const res = await orderService.updateStatus(order.id, { status: newStatus });
      setOrder(res.data?.data || { ...order, status: newStatus });
      setStatusMsg({ type: 'success', text: `Status updated to ${newStatus}` });
    } catch (err) {
      setStatusMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to update order status',
      });
    } finally {
      setUpdatingStatus(false);
      setTimeout(() => setStatusMsg(null), 4000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
        <LoadingSpinner size="lg" />
        <p className="text-sm font-medium text-slate-500">Loading order receipt...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h1 className="text-xl font-bold text-slate-900">Order Not Found</h1>
        <Link
          to="/orders"
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
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
  let activeStepIndex = ORDER_STEPS.findIndex((s) => s.key === currentStatus);
  if (currentStatus === 'completed') activeStepIndex = 4;
  if (activeStepIndex === -1 && !isCancelled) activeStepIndex = 0;

  const hasCoords = order.latitude && order.longitude;
  const mapsUrl = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${order.latitude},${order.longitude}`
    : null;

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
          <Link
            to="/products"
            className="text-xs font-bold text-slate-600 hover:text-emerald-600 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
          >
            Continue Shopping
          </Link>
          <button
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
              className={`inline-block px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                isCancelled
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : currentStatus === 'delivered' || currentStatus === 'completed'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              }`}
            >
              Status: {order.status?.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        {/* ── Visual Order Fulfillment Tracker ───────────────────────────────── */}
        <div className="py-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Order Fulfillment Tracking
            </h2>
            <span className="text-[11px] text-slate-400 font-medium">
              Verified Supermarket Dispatch
            </span>
          </div>

          {isCancelled ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>This order has been cancelled.</span>
            </div>
          ) : (
            <div className="relative">
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
              <div className="sm:hidden space-y-3">
                {ORDER_STEPS.map((step, idx) => {
                  const Icon = step.icon;
                  const isDone = idx <= activeStepIndex;
                  const isCurrent = idx === activeStepIndex;

                  return (
                    <div
                      key={step.key}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border text-xs ${
                        isCurrent
                          ? 'border-emerald-300 bg-emerald-50/50'
                          : isDone
                          ? 'border-slate-200 bg-white'
                          : 'border-slate-100 bg-slate-50 opacity-60'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                          isDone ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400'
                        }`}
                      >
                        {isDone && !isCurrent ? (
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        ) : (
                          <Icon className="w-3.5 h-3.5" />
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
        </div>

        {/* ── Staff Status Controller ────────────────────────────────────────── */}
        {isStaff && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> Staff Order Management
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
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

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500 font-medium mr-1">Update Status:</span>
              {['pending', 'confirmed', 'packed', 'out_for_delivery', 'delivered', 'cancelled'].map(
                (st) => (
                  <button
                    key={st}
                    onClick={() => handleStatusChange(st)}
                    disabled={updatingStatus || order.status === st}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                      order.status === st
                        ? 'bg-emerald-600 text-white cursor-default'
                        : 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 disabled:opacity-50'
                    }`}
                  >
                    {st.replace(/_/g, ' ')}
                  </button>
                )
              )}
            </div>
          </div>
        )}

        {/* ── Customer & Delivery Location Grid ───────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs pt-4 border-t border-slate-100">
          <div className="space-y-1">
            <p className="font-bold text-slate-400 uppercase tracking-wider">Customer Details</p>
            <p className="font-bold text-slate-900">{order.customer_name || 'Walk-in Customer'}</p>
            <p className="text-slate-500">{order.customer_email}</p>
            {order.customer_phone && <p className="text-slate-500 font-mono">{order.customer_phone}</p>}
          </div>

          <div className="space-y-1 sm:col-span-1">
            <p className="font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Delivery Address
            </p>
            {order.house_no || order.street || order.city ? (
              <div className="text-slate-700 leading-relaxed font-medium">
                {order.house_no && <p>{order.house_no}, {order.street}</p>}
                <p>
                  {order.area && `${order.area}, `}
                  {order.city} {order.postal_code && `- ${order.postal_code}`}
                </p>
              </div>
            ) : (
              <p className="text-slate-700 leading-relaxed font-medium">
                {order.delivery_address || order.notes || 'Express Supermarket Hyperlocal Delivery'}
              </p>
            )}

            {order.delivery_notes && (
              <p className="text-[11px] text-amber-700 bg-amber-50 p-1.5 rounded-lg border border-amber-200/60 mt-1">
                Note: {order.delivery_notes}
              </p>
            )}

            {hasCoords && (
              <div className="pt-1">
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 underline"
                >
                  <MapPin className="w-3 h-3" /> View Map Location ({order.latitude.toFixed(4)}, {order.longitude.toFixed(4)})
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <p className="font-bold text-slate-400 uppercase tracking-wider">Payment Info</p>
            <p className="font-bold text-slate-900 uppercase">{order.payment_method || 'COD'}</p>
            <p className="text-slate-500 capitalize">Payment Status: {order.payment_status || 'Pending'}</p>
          </div>
        </div>

        {/* ── Order Items Table ──────────────────────────────────────────────── */}
        <div className="pt-4 border-t border-slate-100">
          <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5">
            <Package className="w-4 h-4 text-emerald-600" /> Purchased Items
          </h2>
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4">Unit Price</th>
                  <th className="py-3 px-4 text-center">Qty</th>
                  <th className="py-3 px-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {(order.order_items || []).map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-medium">
                      <div>{item.product_name}</div>
                      {item.sku && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          SKU: {item.sku}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono">₹{Number(item.price).toFixed(2)}</td>
                    <td className="py-3 px-4 text-center font-bold font-mono">{item.quantity}</td>
                    <td className="py-3 px-4 text-right font-black font-mono">
                      ₹{Number(item.total).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Financial Summary ──────────────────────────────────────────────── */}
        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <div className="w-full sm:w-72 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-bold text-slate-900 font-mono">
                ₹{Number(order.subtotal || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Delivery Fee</span>
              <span className="font-bold text-slate-900 font-mono">
                {Number(order.delivery_fee) > 0
                  ? `₹${Number(order.delivery_fee).toFixed(2)}`
                  : Number(order.total) - Number(order.subtotal) > 0
                  ? `₹${(Number(order.total) - Number(order.subtotal)).toFixed(2)}`
                  : 'FREE'}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-black text-slate-900">
              <span>Total Paid</span>
              <span className="font-mono text-base text-emerald-700">
                ₹{Number(order.total).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
