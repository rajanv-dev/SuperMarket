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
} from 'lucide-react';
import { adminService } from '../../services/adminSupabaseService';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Modal states
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);

  const loadOrders = async () => {
    try {
      setIsLoading(true);
      const data = await adminService.getOrders({
        search,
        type: selectedType,
        status: selectedStatus,
      });
      setOrders(data);
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
    } catch (err) {
      toast.error('Failed to load order details');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleRefund = async (order) => {
    const reason = window.prompt(`Please enter refund reason for order #${order.order_number}:`, 'Customer requested return');
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-slate-900 tracking-tight">
            Sales & Orders Management
          </h1>
          <p className="text-sm text-slate-500">
            Monitor real-time POS cash register bills and online customer orders
          </p>
        </div>

        <button
          onClick={loadOrders}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-xs transition-all w-fit"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order number or customer name..."
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
            <option value="pos">POS In-Store</option>
            <option value="online">Online Delivery</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed / Paid</option>
            <option value="pending">Pending</option>
            <option value="refunded">Refunded</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : orders.length > 0 ? (
          <>
            {/* Mobile Responsive Cards (< 768px) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {orders.map((o) => (
                <div key={`m-${o.id}`} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-slate-900 text-sm">{o.order_number}</span>
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
                      className={`inline-block px-2.5 py-0.5 rounded-full font-semibold text-[11px] capitalize ${
                        o.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : o.status === 'refunded'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {o.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="font-medium text-slate-800">{o.customer_name || 'Walk-in Customer'}</span>
                    <span className="flex items-center gap-1 uppercase font-semibold text-[11px]">
                      {o.payment_method === 'cash' ? (
                        <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                      ) : o.payment_method === 'card' ? (
                        <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                      ) : (
                        <Smartphone className="w-3.5 h-3.5 text-purple-600" />
                      )}
                      <span>{o.payment_method || 'cash'}</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="font-extrabold text-slate-900 text-base">
                      {formatCurrency(o.total)}
                    </span>
                    <button
                      onClick={() => openOrderDetails(o.id)}
                      className="px-3 py-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-xl transition-all"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
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
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4 text-right">Total Amount</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {orders.map((o) => (
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
                      <td className="py-3.5 px-4 font-medium text-slate-800">
                        {o.customer_name || 'Walk-in Customer'}
                      </td>
                      <td className="py-3.5 px-4 uppercase font-semibold text-slate-600">
                        <span className="flex items-center gap-1.5">
                          {o.payment_method === 'cash' ? (
                            <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                          ) : o.payment_method === 'card' ? (
                            <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                          ) : (
                            <Smartphone className="w-3.5 h-3.5 text-purple-600" />
                          )}
                          <span>{o.payment_method || 'cash'}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-slate-900 text-sm">
                        {formatCurrency(o.total)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full font-semibold text-[11px] capitalize ${
                            o.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : o.status === 'refunded'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => openOrderDetails(o.id)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-all"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="py-16 text-center text-slate-400">
            <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold text-slate-700">No orders found</p>
          </div>
        )}
      </div>

      {/* Order Details & Receipt Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-xl overflow-hidden animate-slide-up">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Transaction Receipt
                </span>
                <h3 className="text-base font-extrabold text-slate-900 font-mono">
                  {selectedOrder.order_number}
                </h3>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Receipt Content */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Order Meta Info */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Customer</span>
                  <span className="font-bold text-slate-800">{selectedOrder.customer_name || 'Walk-in'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Date</span>
                  <span className="font-bold text-slate-800">
                    {new Date(selectedOrder.created_at).toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Channel</span>
                  <span className="font-bold uppercase text-slate-800">{selectedOrder.type}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Cashier / Staff</span>
                  <span className="font-bold text-slate-800">{selectedOrder.cashier_name || 'System Online'}</span>
                </div>
              </div>

              {/* Items Breakdown */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Line Items
                </h4>
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                  {selectedOrder.items?.map((item) => (
                    <div key={item.id} className="p-3 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-900">{item.product_name}</p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          {item.sku} · {item.quantity} × {formatCurrency(item.price)}
                        </p>
                      </div>
                      <span className="font-extrabold text-slate-900">
                        {formatCurrency(item.total)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price Calculation Summary */}
              <div className="space-y-1.5 pt-2 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span>{formatCurrency(selectedOrder.subtotal)}</span>
                </div>
                {Number(selectedOrder.discount) > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Discount</span>
                    <span>-{formatCurrency(selectedOrder.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-500">
                  <span>Tax (GST)</span>
                  <span>{formatCurrency(selectedOrder.tax)}</span>
                </div>
                <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-200">
                  <span>Grand Total</span>
                  <span className="text-primary-700">{formatCurrency(selectedOrder.total)}</span>
                </div>
              </div>

              {selectedOrder.notes && (
                <div className="p-2.5 bg-slate-50 rounded-xl text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">Notes:</span> {selectedOrder.notes}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                {selectedOrder.status === 'completed' && (
                  <button
                    onClick={() => handleRefund(selectedOrder)}
                    disabled={isRefunding}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-xl transition-all disabled:opacity-60"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Issue Refund</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintReceipt}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-xs transition-all"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Receipt</span>
                </button>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
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
