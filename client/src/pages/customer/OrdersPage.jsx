import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  ShoppingBag,
  ExternalLink,
} from 'lucide-react';
import { orderService } from '../../services';
import useAuthStore from '../../store/authStore';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function OrdersPage() {
  const { user } = useAuthStore();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    orderService
      .getAll({ email: user?.email })
      .then((res) => {
        setOrders(res.data?.data || []);
      })
      .catch((err) => {
        console.error('Error fetching orders:', err);
      })
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
        <LoadingSpinner size="lg" />
        <p className="text-sm font-medium text-slate-500">Loading your supermarket order history...</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="bg-white rounded-3xl p-10 border border-slate-200/80 shadow-xs space-y-4">
          <div className="w-20 h-20 mx-auto rounded-full bg-slate-50 text-slate-400 flex items-center justify-center">
            <ShoppingBag className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">No Orders Placed Yet</h1>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            You haven't placed any grocery orders yet. Start exploring our supermarket catalog!
          </p>
          <div className="pt-2">
            <Link
              to="/products"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-md transition-all"
            >
              Start Shopping <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          My Order History
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Review past supermarket purchases, delivery updates, and receipts
        </p>
      </div>

      <div className="space-y-4">
        {orders.map((order) => {
          const itemsCount = (order.order_items || []).reduce((s, i) => s + (i.quantity || 1), 0);
          const orderDate = new Date(order.created_at).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <div
              key={order.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs hover:border-slate-300 transition-all space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-slate-900">
                      {order.order_number}
                    </span>
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        order.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : order.status === 'cancelled'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Placed on {orderDate}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Total Amount</span>
                    <span className="text-base font-black text-slate-900 font-mono">
                      ₹{Number(order.total).toFixed(2)}
                    </span>
                  </div>

                  <Link
                    to={`/orders/${order.id}`}
                    className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <span>Details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {/* Items Summary preview */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-600">
                <span className="font-semibold text-slate-500">{itemsCount} item{itemsCount === 1 ? '' : 's'}:</span>
                {(order.order_items || []).map((item, idx) => (
                  <span key={item.id || idx} className="inline-flex items-center bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                    {item.product_name} ({item.quantity}x)
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
