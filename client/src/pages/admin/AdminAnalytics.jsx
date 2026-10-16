import { useEffect, useState } from 'react';
import {
  Download,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { adminService } from '../../services/adminSupabaseService';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

export default function AdminAnalytics() {
  const [metrics, setMetrics] = useState(null);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [met, ords] = await Promise.all([
        adminService.getDashboardMetrics(),
        adminService.getOrders(),
      ]);
      setMetrics(met);
      setOrders(ords);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatCurrency = (val) => `₹${Number(val || 0).toLocaleString('en-IN')}`;

  const handleExportSalesReport = () => {
    if (!orders.length) {
      toast.error('No sales data to export');
      return;
    }
    const headers = ['Order Number', 'Date', 'Type', 'Customer', 'Payment Method', 'Subtotal', 'Tax', 'Total'];
    const rows = orders.map((o) => [
      o.order_number,
      o.created_at,
      o.type,
      `"${(o.customer_name || 'Walk-in').replace(/"/g, '""')}"`,
      o.payment_method,
      o.subtotal,
      o.tax,
      o.total,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `sales_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Sales report exported to CSV');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-slate-900 tracking-tight">
            Sales & Inventory Analytics
          </h1>
          <p className="text-sm text-slate-500">
            Comprehensive business reports, revenue trends, and inventory valuation
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportSalesReport}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-sm transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV Report</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-24 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <>
          {/* Top 4 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Total Gross Revenue
              </span>
              <p className="text-2xl font-extrabold text-slate-900 font-display">
                {formatCurrency(orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0))}
              </p>
              <p className="text-xs text-emerald-600 font-medium mt-1">From {orders.length} orders</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Average Order Value
              </span>
              <p className="text-2xl font-extrabold text-slate-900 font-display">
                {formatCurrency(
                  orders.length
                    ? orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0) / orders.length
                    : 0
                )}
              </p>
              <p className="text-xs text-slate-500 font-medium mt-1">Per transaction ticket</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Inventory Valuation
              </span>
              <p className="text-2xl font-extrabold text-slate-900 font-display">
                {formatCurrency(metrics?.totalInventoryValue)}
              </p>
              <p className="text-xs text-blue-600 font-medium mt-1">
                Across {metrics?.totalProducts || 0} catalog items
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Batches Near Expiry
              </span>
              <p className="text-2xl font-extrabold text-amber-600 font-display">
                {metrics?.expiringBatches?.length || 0}
              </p>
              <p className="text-xs text-amber-700 font-medium mt-1">Within 30 calendar days</p>
            </div>
          </div>

          {/* Revenue & Sales Chart */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Weekly Revenue Trajectory</h2>
                <p className="text-xs text-slate-500">Gross sales performance over the past 7 days</p>
              </div>
              <span className="text-xs font-bold text-primary-700 bg-primary-50 px-2.5 py-1 rounded-full border border-primary-200">
                INR (₹)
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics?.salesTrend || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip
                    formatter={(val) => [`₹${val}`, 'Gross Revenue']}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="sales" fill="#14b86a" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Valuation Breakdown Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Inventory Valuation by Category</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4">Category Department</th>
                    <th className="py-2.5 px-4 text-right">Product SKUs</th>
                    <th className="py-2.5 px-4 text-right">Total Inventory Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {metrics?.categoryDistribution?.map((cat) => (
                    <tr key={cat.name} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-bold text-slate-900">{cat.name}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-600">
                        {cat.count} items
                      </td>
                      <td className="py-3 px-4 text-right font-extrabold text-slate-900 font-mono">
                        {formatCurrency(cat.value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
