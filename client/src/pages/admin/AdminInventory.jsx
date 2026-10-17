import { useEffect, useState } from 'react';
import {
  Warehouse,
  PlusCircle,
  Sliders,
  History,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  Search,
} from 'lucide-react';
import { adminService } from '../../services/adminSupabaseService';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

export default function AdminInventory() {
  const [activeTab, setActiveTab] = useState('batches'); // 'batches' | 'receive' | 'adjust' | 'movements'
  const [batches, setBatches] = useState([]);
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Receive stock form state
  const [receiveForm, setReceiveForm] = useState({
    productId: '',
    batchNumber: '',
    barcode: '',
    quantityReceived: '',
    manufacturingDate: '',
    expiryDate: '',
    costPrice: '',
  });
  const [isReceiving, setIsReceiving] = useState(false);

  // Stock adjustment form state
  const [adjustForm, setAdjustForm] = useState({
    productId: '',
    batchId: '',
    quantityDelta: '',
    reason: 'Physical inventory audit',
  });
  const [isAdjusting, setIsAdjusting] = useState(false);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [batchList, prodList, movList] = await Promise.all([
        adminService.getInventoryBatches(),
        adminService.getProducts(),
        adminService.getStockMovements(50),
      ]);
      setBatches(batchList);
      setProducts(prodList);
      setMovements(movList);

      if (prodList.length > 0 && !receiveForm.productId) {
        setReceiveForm((prev) => ({
          ...prev,
          productId: prodList[0].id,
          batchNumber: `BATCH-${Date.now().toString().slice(-6)}`,
          expiryDate: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
        }));
      }
      if (prodList.length > 0 && !adjustForm.productId) {
        setAdjustForm((prev) => ({ ...prev, productId: prodList[0].id }));
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load inventory data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReceiveStock = async (e) => {
    e.preventDefault();
    if (!receiveForm.productId || !receiveForm.batchNumber || !receiveForm.quantityReceived || !receiveForm.expiryDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setIsReceiving(true);
      await adminService.receiveStockBatch(receiveForm);
      toast.success(`Received ${receiveForm.quantityReceived} units into batch ${receiveForm.batchNumber}`);
      setReceiveForm({
        productId: products[0]?.id || '',
        batchNumber: `BATCH-${Date.now().toString().slice(-6)}`,
        barcode: '',
        quantityReceived: '',
        manufacturingDate: '',
        expiryDate: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
        costPrice: '',
      });
      loadData();
      setActiveTab('batches');
    } catch (err) {
      toast.error(err.message || 'Failed to receive stock');
    } finally {
      setIsReceiving(false);
    }
  };

  const handleAdjustStock = async (e) => {
    e.preventDefault();
    if (!adjustForm.productId || !adjustForm.quantityDelta || !adjustForm.reason) {
      toast.error('Product, adjustment quantity, and reason are required');
      return;
    }

    try {
      setIsAdjusting(true);
      await adminService.adjustStock(adjustForm);
      toast.success('Stock adjusted successfully');
      setAdjustForm({
        productId: products[0]?.id || '',
        batchId: '',
        quantityDelta: '',
        reason: 'Physical inventory audit',
      });
      loadData();
      setActiveTab('movements');
    } catch (err) {
      toast.error(err.message || 'Failed to adjust stock');
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleToggleBatchAvailability = async (batchId, currentStatus) => {
    try {
      await adminService.toggleBatchAvailability(batchId, !currentStatus);
      setBatches(batches.map((b) => (b.id === batchId ? { ...b, is_available: !currentStatus } : b)));
      toast.success(`Batch marked as ${!currentStatus ? 'available' : 'unavailable (quarantined)'}`);
    } catch (err) {
      toast.error('Failed to update batch status');
    }
  };

  const filteredBatches = batches.filter((b) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      b.batch_number.toLowerCase().includes(term) ||
      (b.products?.name && b.products.name.toLowerCase().includes(term)) ||
      (b.barcode && b.barcode.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-slate-900 tracking-tight">
            Inventory & FEFO Batch Control
          </h1>
          <p className="text-sm text-slate-500">
            Track batch expiry dates, receive new shipments, and inspect movement history
          </p>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-xs transition-all w-fit"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto scrollbar-none whitespace-nowrap">
        <button
          onClick={() => setActiveTab('batches')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all shrink-0 ${
            activeTab === 'batches'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Warehouse className="w-4 h-4" />
          <span>Active Batches (FEFO View)</span>
        </button>

        <button
          onClick={() => setActiveTab('receive')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all shrink-0 ${
            activeTab === 'receive'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          <span>Receive Shipment</span>
        </button>

        <button
          onClick={() => setActiveTab('adjust')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all shrink-0 ${
            activeTab === 'adjust'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Adjust Stock</span>
        </button>

        <button
          onClick={() => setActiveTab('movements')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all shrink-0 ${
            activeTab === 'movements'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Movement Audit Log</span>
        </button>
      </div>

      {/* Tab 1: Active Batches */}
      {activeTab === 'batches' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search batches by number or product..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Sorted by FEFO (Earliest Expiry First)
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {isLoading ? (
              <div className="py-20 flex justify-center">
                <LoadingSpinner size="lg" />
              </div>
            ) : filteredBatches.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200/60">
                    <tr>
                      <th className="py-3 px-4">Batch Number</th>
                      <th className="py-3 px-4">Product Name</th>
                      <th className="py-3 px-4">Expiry Date</th>
                      <th className="py-3 px-4 text-right">Received</th>
                      <th className="py-3 px-4 text-right">Remaining</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredBatches.map((b) => {
                      const daysLeft = Math.ceil(
                        (new Date(b.expiry_date).getTime() - Date.now()) / (1000 * 3600 * 24)
                      );
                      const isExpired = daysLeft <= 0;
                      const isWarning = daysLeft > 0 && daysLeft <= 30;

                      return (
                        <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                            {b.batch_number}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-800">
                            {b.products?.name || 'Unknown Product'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                                isExpired
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : isWarning
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              <Clock className="w-3 h-3" />
                              {b.expiry_date} ({isExpired ? 'EXPIRED' : `${daysLeft} days`})
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-medium text-slate-600">
                            {b.quantity_received}
                          </td>
                          <td className="py-3.5 px-4 text-right font-extrabold text-slate-900">
                            {b.quantity_remaining} units
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full font-semibold text-[10px] uppercase ${
                                b.is_available !== false
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {b.is_available !== false ? 'Available' : 'Quarantined'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => handleToggleBatchAvailability(b.id, b.is_available !== false)}
                              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all ${
                                b.is_available !== false
                                  ? 'text-rose-600 border-rose-200 hover:bg-rose-50'
                                  : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'
                              }`}
                            >
                              {b.is_available !== false ? 'Quarantine' : 'Release'}
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
                <Warehouse className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">No batches recorded in the system.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Receive Shipment Form */}
      {activeTab === 'receive' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs max-w-2xl">
          <h2 className="text-base font-bold text-slate-900 mb-1">Receive Stock Shipment</h2>
          <p className="text-xs text-slate-500 mb-5">
            Log incoming batches from vendors. This immediately adds quantity to product stock and enforces FEFO.
          </p>

          <form onSubmit={handleReceiveStock} className="space-y-4">
            <div>
              <label className="label">Select Product *</label>
              <select
                required
                value={receiveForm.productId}
                onChange={(e) => setReceiveForm({ ...receiveForm, productId: e.target.value })}
                className="input"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku}) — Current Stock: {p.stock_quantity}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Batch Number *</label>
                <input
                  type="text"
                  required
                  value={receiveForm.batchNumber}
                  onChange={(e) => setReceiveForm({ ...receiveForm, batchNumber: e.target.value })}
                  placeholder="e.g. BATCH-20261016-01"
                  className="input font-mono"
                />
              </div>

              <div>
                <label className="label">Batch Barcode (Optional)</label>
                <input
                  type="text"
                  value={receiveForm.barcode}
                  onChange={(e) => setReceiveForm({ ...receiveForm, barcode: e.target.value })}
                  placeholder="e.g. 8901234567890"
                  className="input font-mono"
                />
              </div>

              <div>
                <label className="label">Quantity Received *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={receiveForm.quantityReceived}
                  onChange={(e) => setReceiveForm({ ...receiveForm, quantityReceived: e.target.value })}
                  placeholder="e.g. 50"
                  className="input"
                />
              </div>

              <div>
                <label className="label">Purchase Cost (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={receiveForm.costPrice}
                  onChange={(e) => setReceiveForm({ ...receiveForm, costPrice: e.target.value })}
                  placeholder="0.00"
                  className="input"
                />
              </div>

              <div>
                <label className="label">Manufacturing Date</label>
                <input
                  type="date"
                  value={receiveForm.manufacturingDate}
                  onChange={(e) => setReceiveForm({ ...receiveForm, manufacturingDate: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="label">Expiry Date *</label>
                <input
                  type="date"
                  required
                  value={receiveForm.expiryDate}
                  onChange={(e) => setReceiveForm({ ...receiveForm, expiryDate: e.target.value })}
                  className="input"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isReceiving}
              className="mt-3 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold text-xs rounded-xl shadow-sm disabled:opacity-60 flex items-center gap-2"
            >
              {isReceiving ? <LoadingSpinner size="sm" /> : <PlusCircle className="w-4 h-4" />}
              <span>Receive & Add to Inventory</span>
            </button>
          </form>
        </div>
      )}

      {/* Tab 3: Adjust Stock Form */}
      {activeTab === 'adjust' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs max-w-xl">
          <h2 className="text-base font-bold text-slate-900 mb-1">Manual Stock Adjustment</h2>
          <p className="text-xs text-slate-500 mb-5">
            Log inventory corrections, damages, returns, or shrinkage.
          </p>

          <form onSubmit={handleAdjustStock} className="space-y-4">
            <div>
              <label className="label">Select Product *</label>
              <select
                required
                value={adjustForm.productId}
                onChange={(e) => setAdjustForm({ ...adjustForm, productId: e.target.value })}
                className="input"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku}) — Current Stock: {p.stock_quantity}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Quantity Change (+ to add, - to subtract) *</label>
              <input
                type="number"
                required
                value={adjustForm.quantityDelta}
                onChange={(e) => setAdjustForm({ ...adjustForm, quantityDelta: e.target.value })}
                placeholder="e.g. -5 (spoilage) or 10 (audit found)"
                className="input font-mono"
              />
            </div>

            <div>
              <label className="label">Reason *</label>
              <select
                value={adjustForm.reason}
                onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                className="input"
              >
                <option value="Physical inventory audit discrepancy">Physical inventory audit discrepancy</option>
                <option value="Damaged or broken in store">Damaged or broken in store</option>
                <option value="Expired goods removal">Expired goods removal</option>
                <option value="Customer return / restock">Customer return / restock</option>
                <option value="Other / Manual correction">Other / Manual correction</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isAdjusting}
              className="mt-3 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-sm disabled:opacity-60 flex items-center gap-2"
            >
              {isAdjusting ? <LoadingSpinner size="sm" /> : <Sliders className="w-4 h-4" />}
              <span>Apply Adjustment</span>
            </button>
          </form>
        </div>
      )}

      {/* Tab 4: Stock Movement Audit Log */}
      {activeTab === 'movements' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Inventory Movement Audit Trail</h3>
            <span className="text-xs text-slate-500">Showing last 50 events</span>
          </div>

          <div className="overflow-x-auto">
            {movements.length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200/60">
                  <tr>
                    <th className="py-2.5 px-4">Timestamp</th>
                    <th className="py-2.5 px-4">Product</th>
                    <th className="py-2.5 px-4">Type</th>
                    <th className="py-2.5 px-4 text-right">Quantity</th>
                    <th className="py-2.5 px-4 text-right">Stock (Before → After)</th>
                    <th className="py-2.5 px-4">Reason / Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {movements.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {new Date(m.created_at).toLocaleString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {m.products?.name || 'Product'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                            m.movement_type === 'received' || m.movement_type === 'return'
                              ? 'bg-emerald-50 text-emerald-700'
                              : m.movement_type === 'sale'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {m.movement_type === 'received' ? (
                            <ArrowDownRight className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3" />
                          )}
                          {m.movement_type}
                        </span>
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-extrabold font-mono ${
                          m.quantity > 0 ? 'text-emerald-600' : 'text-slate-900'
                        }`}
                      >
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        {m.previous_stock} → {m.new_stock}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {m.reason} {m.reference_id ? `(${m.reference_id})` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-16 text-center text-slate-400">
                <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">No stock movements recorded yet.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
