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
} from 'lucide-react';
import { orderService } from '../../services';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function OrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    orderService
      .getById(id)
      .then((res) => setOrder(res.data?.data))
      .catch((err) => console.error('Error loading order details:', err))
      .finally(() => setLoading(false));
  }, [id]);

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
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-xs font-bold"
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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* ── Breadcrumb & Actions ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <Link
          to="/orders"
          className="text-xs font-bold text-slate-600 hover:text-primary-600 flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" /> All Orders
        </Link>

        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs transition-colors"
        >
          <Printer className="w-3.5 h-3.5" /> Print Receipt
        </button>
      </div>

      {/* ── Order Status Banner ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider block mb-1">
              Order Confirmed
            </span>
            <h1 className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              {order.order_number}
            </h1>
            <p className="text-xs text-slate-400 mt-1">Placed on {orderDate}</p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                order.status === 'completed'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              Status: {order.status}
            </span>
          </div>
        </div>

        {/* Customer & Shipping Summary Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
          <div className="space-y-1">
            <p className="font-bold text-slate-400 uppercase tracking-wider">Customer Details</p>
            <p className="font-bold text-slate-900">{order.customer_name || 'Walk-in Customer'}</p>
            <p className="text-slate-500">{order.customer_email}</p>
            {order.customer_phone && <p className="text-slate-500">{order.customer_phone}</p>}
          </div>

          <div className="space-y-1">
            <p className="font-bold text-slate-400 uppercase tracking-wider">Shipping Details</p>
            <p className="text-slate-700 leading-relaxed font-medium">
              {order.notes || 'Express Supermarket Hyperlocal Delivery'}
            </p>
          </div>

          <div className="space-y-1">
            <p className="font-bold text-slate-400 uppercase tracking-wider">Payment Info</p>
            <p className="font-bold text-slate-900 uppercase">{order.payment_method}</p>
            <p className="text-slate-500 capitalize">Payment: {order.payment_status}</p>
          </div>
        </div>

        {/* Order Items Table */}
        <div className="pt-4 border-t border-slate-100">
          <h2 className="text-sm font-bold text-slate-900 mb-3">Purchased Items</h2>
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
                      {item.sku && <span className="text-[10px] text-slate-400 font-mono">SKU: {item.sku}</span>}
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

        {/* Financial Summary */}
        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <div className="w-full sm:w-72 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-bold text-slate-900 font-mono">₹{Number(order.subtotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Delivery Fee</span>
              <span className="font-bold text-slate-900 font-mono">
                {Number(order.total) - Number(order.subtotal) > 0 ? `₹${(Number(order.total) - Number(order.subtotal)).toFixed(2)}` : 'FREE'}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-black text-slate-900">
              <span>Total Paid</span>
              <span className="font-mono text-base">₹{Number(order.total).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
