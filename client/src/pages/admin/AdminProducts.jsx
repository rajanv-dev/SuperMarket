import { useEffect, useState } from 'react';
import {
  Package,
  Plus,
  Search,
  Download,
  Upload,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  RefreshCw,
  X,
} from 'lucide-react';
import { adminService } from '../../services/adminSupabaseService';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import DeleteConfirmationDialog from '../../components/common/DeleteConfirmationDialog';
import toast from 'react-hot-toast';

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete dialog state
  const [deleteDialog, setDeleteDialog] = useState({
    isOpen: false,
    product: null,
    loading: false,
  });

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    category: 'Groceries',
    description: '',
    price: '',
    cost_price: '',
    stock_quantity: '',
    low_stock_threshold: '10',
    image_url: '',
    batch_number: '',
    expiry_date: '',
    is_active: true,
  });

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [prods, cats] = await Promise.all([
        adminService.getProducts({
          search,
          category: selectedCategory,
          status: selectedStatus,
        }),
        adminService.getCategories(),
      ]);
      setProducts(prods);
      setCategories(cats);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load products from database');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCategory, selectedStatus]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadData();
  };

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      sku: `SKU-${Date.now().toString().slice(-6)}`,
      barcode: `890${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      category: categories[0]?.name || 'Groceries',
      description: '',
      price: '',
      cost_price: '',
      stock_quantity: '20',
      low_stock_threshold: '10',
      image_url: '',
      batch_number: `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-01`,
      expiry_date: new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10),
      is_active: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (prod) => {
    setEditingProduct(prod);
    setFormData({
      name: prod.name,
      sku: prod.sku,
      barcode: prod.barcode || '',
      category: prod.category || 'General',
      description: prod.description || '',
      price: prod.price,
      cost_price: prod.cost_price || '',
      stock_quantity: prod.stock_quantity,
      low_stock_threshold: prod.low_stock_threshold || '10',
      image_url: prod.image_url || '',
      batch_number: '',
      expiry_date: '',
      is_active: prod.is_active,
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.sku || !formData.price) {
      toast.error('Name, SKU, and Price are required');
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingProduct) {
        await adminService.updateProduct(editingProduct.id, {
          name: formData.name,
          sku: formData.sku,
          barcode: formData.barcode || null,
          category: formData.category,
          description: formData.description,
          price: Number(formData.price),
          cost_price: Number(formData.cost_price || 0),
          stock_quantity: Number(formData.stock_quantity || 0),
          low_stock_threshold: Number(formData.low_stock_threshold || 10),
          image_url: formData.image_url || null,
          is_active: formData.is_active,
        });
        toast.success('Product updated successfully');
      } else {
        await adminService.addProduct(formData);
        toast.success('Product added successfully with initial batch');
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (prod) => {
    try {
      const nextStatus = !prod.is_active;
      await adminService.toggleProductStatus(prod.id, nextStatus);
      setProducts(products.map((p) => (p.id === prod.id ? { ...p, is_active: nextStatus } : p)));
      toast.success(`Product ${nextStatus ? 'activated' : 'deactivated'}`);
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleDeleteClick = (prod) => {
    setDeleteDialog({
      isOpen: true,
      product: prod,
      loading: false,
    });
  };

  const handleConfirmDelete = async () => {
    const prod = deleteDialog.product;
    if (!prod) return;

    try {
      setDeleteDialog((prev) => ({ ...prev, loading: true }));
      // Try permanent delete; if foreign key constraints exist, deactivate cleanly
      try {
        await adminService.deleteProduct(prod.id);
        toast.success(`Product "${prod.name}" permanently deleted`);
      } catch (err) {
        // If referenced in orders or inventory movements, fall back to safe deactivation
        await adminService.toggleProductStatus(prod.id, false);
        toast.success(
          `Product has transaction history and was safely deactivated instead of deleted.`
        );
      }
      setDeleteDialog({ isOpen: false, product: null, loading: false });
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to remove product');
      setDeleteDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleExportCSV = () => {
    if (!products.length) {
      toast.error('No products to export');
      return;
    }
    const headers = ['ID', 'Name', 'SKU', 'Barcode', 'Category', 'Price', 'Stock', 'Active'];
    const rows = products.map((p) => [
      p.id,
      `"${p.name.replace(/"/g, '""')}"`,
      p.sku,
      p.barcode || '',
      p.category || '',
      p.price,
      p.stock_quantity,
      p.is_active ? 'Yes' : 'No',
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `supermarket_products_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Products exported to CSV');
  };

  const handleImportCSV = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result;
        const lines = text.split('\n').filter((l) => l.trim().length > 0);
        if (lines.length < 2) throw new Error('CSV is empty or missing headers');

        // Parse rows
        let imported = 0;
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
          if (cols[0] && cols[1] && cols[2]) {
            await adminService.addProduct({
              name: cols[0],
              sku: cols[1],
              barcode: cols[2] || null,
              category: cols[3] || 'General',
              price: Number(cols[4]) || 50,
              stock_quantity: Number(cols[5]) || 10,
              is_active: true,
            });
            imported++;
          }
        }
        toast.success(`Successfully imported ${imported} products`);
        loadData();
      } catch (err) {
        toast.error(`CSV Import error: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Header and Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-slate-900 tracking-tight">
            Product Management
          </h1>
          <p className="text-sm text-slate-500">
            Add, edit, track stock, and organize supermarket inventory
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Import CSV */}
          <label className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer shadow-xs transition-all">
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Import CSV</span>
            <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
          </label>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-xs transition-all"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          {/* Add Product Button */}
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product name, SKU, or barcode..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
          />
        </form>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>

          <button
            onClick={loadData}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200 transition-all"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2">
            <LoadingSpinner size="lg" />
            <span className="text-xs text-slate-500">Loading product catalog...</span>
          </div>
        ) : products.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200/60">
                <tr>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">SKU / Barcode</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Price</th>
                  <th className="py-3 px-4 text-right">Stock</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {products.map((prod) => {
                  const stock = Number(prod.stock_quantity) || 0;
                  const threshold = Number(prod.low_stock_threshold) || 10;
                  const isLow = stock > 0 && stock <= threshold;
                  const isOut = stock === 0;

                  return (
                    <tr key={prod.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 font-bold shrink-0 overflow-hidden">
                            {prod.image_url ? (
                              <img src={prod.image_url} alt={prod.name} className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm leading-tight">{prod.name}</p>
                            <p className="text-[11px] text-slate-400 truncate max-w-xs">{prod.description || 'No description'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        <div className="text-slate-800 font-semibold">{prod.sku}</div>
                        <div className="text-[11px] text-slate-400">{prod.barcode || '—'}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2.5 py-0.5 rounded-full font-semibold text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                          {prod.category || 'General'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-slate-900 text-sm">
                        ₹{Number(prod.price).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span
                          className={`inline-flex items-center gap-1 font-bold text-xs px-2 py-0.5 rounded-md ${
                            isOut
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : isLow
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'text-slate-800'
                          }`}
                        >
                          {stock} units
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleToggleStatus(prod)}
                          title="Click to toggle status"
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                            prod.is_active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {prod.is_active ? (
                            <>
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              <span>Active</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-slate-400" />
                              <span>Inactive</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(prod)}
                            className="p-1.5 text-slate-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                            title="Edit Product"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(prod)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                            title="Delete or Deactivate Product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center text-slate-400">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold text-slate-700">No products found</p>
            <p className="text-xs text-slate-400 mt-1">Try clearing your filters or create a new product.</p>
          </div>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-xl overflow-hidden animate-slide-up">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-900">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Product Name */}
                <div className="sm:col-span-2">
                  <label className="label">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Organic Farm Whole Milk 1L"
                    className="input"
                  />
                </div>

                {/* SKU */}
                <div>
                  <label className="label">SKU *</label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="e.g. MILK-ORG-1L"
                    className="input"
                  />
                </div>

                {/* Barcode */}
                <div>
                  <label className="label">Barcode (EAN/UPC)</label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="e.g. 8901234567890"
                    className="input font-mono"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="label">Category</label>
                  <input
                    type="text"
                    list="categories-list"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="input"
                  />
                  <datalist id="categories-list">
                    {categories.map((c) => (
                      <option key={c.id} value={c.name} />
                    ))}
                  </datalist>
                </div>

                {/* Price */}
                <div>
                  <label className="label">Selling Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0.00"
                    className="input"
                  />
                </div>

                {/* Cost Price */}
                <div>
                  <label className="label">Cost / Purchase Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                    placeholder="0.00"
                    className="input"
                  />
                </div>

                {/* Initial Stock */}
                <div>
                  <label className="label">Stock Quantity</label>
                  <input
                    type="number"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                    className="input"
                  />
                </div>

                {/* Image URL */}
                <div className="sm:col-span-2">
                  <label className="label">Image URL</label>
                  <input
                    type="url"
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    placeholder="https://..."
                    className="input"
                  />
                </div>

                {/* Description */}
                <div className="sm:col-span-2">
                  <label className="label">Description</label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Product details, ingredients, packaging..."
                    className="input"
                  />
                </div>

                {/* Initial Batch details if creating new product */}
                {!editingProduct && Number(formData.stock_quantity) > 0 && (
                  <div className="sm:col-span-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100 space-y-3">
                    <p className="text-xs font-bold text-emerald-800">
                      Initial Batch Details (FEFO Tracking)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600">Batch Number</label>
                        <input
                          type="text"
                          value={formData.batch_number}
                          onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                          className="input text-xs py-1.5"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600">Expiry Date</label>
                        <input
                          type="date"
                          value={formData.expiry_date}
                          onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                          className="input text-xs py-1.5"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal footer buttons */}
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
                  {isSubmitting ? <LoadingSpinner size="sm" /> : editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete / Deactivate Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={deleteDialog.isOpen}
        title="Remove Product"
        itemName={deleteDialog.product?.name}
        message="Are you sure you want to remove this product? If it has prior order or inventory movement records, it will be safely deactivated to preserve sales auditing integrity."
        confirmText="Remove Product"
        isLoading={deleteDialog.loading}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteDialog({ isOpen: false, product: null, loading: false })}
      />
    </div>
  );
}
