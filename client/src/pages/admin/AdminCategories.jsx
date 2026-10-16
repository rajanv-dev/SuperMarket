import { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Package,
  RefreshCw,
  AlertCircle,
  FolderPlus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminService } from '../../services/adminSupabaseService';
import DeleteConfirmationDialog from '../../components/common/DeleteConfirmationDialog';

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', is_active: true });
  const [formError, setFormError] = useState('');

  // Delete dialog states
  const [deleteDialog, setDeleteDialog] = useState({
    isOpen: false,
    category: null,
    loading: false,
  });

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await adminService.getCategories();
      setCategories(data);
    } catch (err) {
      toast.error('Failed to load categories: ' + (err.message || 'Database error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return categories.filter((c) => {
      const matchSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(search.toLowerCase()));
      const matchStatus =
        filterStatus === 'all'
          ? true
          : filterStatus === 'active'
          ? c.is_active !== false
          : c.is_active === false;
      return matchSearch && matchStatus;
    });
  }, [categories, search, filterStatus]);

  // Statistics
  const totalCount = categories.length;
  const activeCount = categories.filter((c) => c.is_active !== false).length;
  const populatedCount = categories.filter((c) => (c.product_count || 0) > 0).length;
  const totalProductsAssigned = categories.reduce((sum, c) => sum + (c.product_count || 0), 0);

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setFormData({ name: '', description: '', is_active: true });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      description: cat.description || '',
      is_active: cat.is_active !== false,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Category name is required');
      return;
    }

    try {
      setSaving(true);
      setFormError('');

      if (editingCategory) {
        await adminService.updateCategory(editingCategory.id, {
          name: formData.name.trim(),
          description: formData.description.trim(),
          is_active: formData.is_active,
        });
        toast.success(`Category "${formData.name.trim()}" updated successfully`);
      } else {
        await adminService.addCategory({
          name: formData.name.trim(),
          description: formData.description.trim(),
        });
        toast.success(`Category "${formData.name.trim()}" created successfully`);
      }

      setIsModalOpen(false);
      loadCategories();
    } catch (err) {
      setFormError(err.message || 'Failed to save category');
      toast.error(err.message || 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (cat) => {
    try {
      const nextStatus = !cat.is_active;
      await adminService.updateCategory(cat.id, { is_active: nextStatus });
      toast.success(
        `Category "${cat.name}" ${nextStatus ? 'activated' : 'deactivated'} successfully`
      );
      loadCategories();
    } catch (err) {
      toast.error(err.message || 'Failed to change status');
    }
  };

  const handleDeleteClick = (cat) => {
    setDeleteDialog({
      isOpen: true,
      category: cat,
      loading: false,
    });
  };

  const handleConfirmDelete = async () => {
    const cat = deleteDialog.category;
    if (!cat) return;

    try {
      setDeleteDialog((prev) => ({ ...prev, loading: true }));
      await adminService.deleteCategory(cat.id);
      toast.success(`Category "${cat.name}" deleted successfully`);
      setDeleteDialog({ isOpen: false, category: null, loading: false });
      loadCategories();
    } catch (err) {
      toast.error(err.message || 'Failed to delete category');
      setDeleteDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Category Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-50 text-primary-700 border border-primary-200">
              {totalCount} Categories
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Organize supermarket catalog categories and maintain inventory hierarchy
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadCategories}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors shadow-sm disabled:opacity-50"
            title="Refresh categories"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm rounded-xl shadow-sm shadow-primary-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            Add Category
          </button>
        </div>
      </div>

      {/* ── Metric Cards ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Categories</p>
            <p className="text-xl font-bold text-slate-900">{totalCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Active Categories</p>
            <p className="text-xl font-bold text-emerald-600">{activeCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Populated</p>
            <p className="text-xl font-bold text-blue-600">{populatedCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Assigned Products</p>
            <p className="text-xl font-bold text-slate-900">{totalProductsAssigned}</p>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls ───────────────────────────────────────────── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories by name or description..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Status:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="all">All Categories</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* ── Categories Table ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-3 border-primary-600/30 border-t-primary-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600">Loading categories...</p>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Layers className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No categories found</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              {search
                ? `No categories match "${search}". Try clearing your search term.`
                : 'Get started by creating your first supermarket category.'}
            </p>
            {!search && (
              <button
                onClick={handleOpenAdd}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-semibold text-sm rounded-xl shadow-sm hover:bg-primary-700"
              >
                <FolderPlus className="w-4 h-4" />
                Add Category Now
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-6">Category Name</th>
                  <th className="py-3.5 px-6">Description</th>
                  <th className="py-3.5 px-6">Assigned Products</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6">Created Date</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredCategories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-50 to-emerald-100 text-primary-700 flex items-center justify-center font-bold text-sm border border-primary-100">
                          {cat.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-slate-900">{cat.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-600 max-w-xs truncate">
                      {cat.description || (
                        <span className="text-slate-400 italic">No description</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        <Package className="w-3.5 h-3.5 text-slate-500" />
                        {cat.product_count || 0} Products
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <button
                        onClick={() => handleToggleStatus(cat)}
                        title="Click to toggle status"
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all hover:scale-105 ${
                          cat.is_active !== false
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {cat.is_active !== false ? (
                          <>
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            Active
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-slate-400" />
                            Inactive
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-4 px-6 text-slate-500 text-xs">
                      {cat.created_at
                        ? new Date(cat.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(cat)}
                          className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="Edit category"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(cat)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete category"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add / Edit Category Modal ─────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center font-bold">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {editingCategory ? 'Edit Category' : 'Add New Category'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingCategory ? 'Modify category properties' : 'Create a fresh supermarket department'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                &times;
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-sm text-rose-700">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <p>{formError}</p>
              </div>
            )}

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Category Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Dairy, Beverages, Snacks"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Short explanation of products included in this category..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <p className="text-sm font-bold text-slate-900">Active Status</p>
                  <p className="text-xs text-slate-500">Inactive categories hide from cashier quick-pick</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {saving && (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  {editingCategory ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Dialog ────────────────────────────────────────── */}
      <DeleteConfirmationDialog
        isOpen={deleteDialog.isOpen}
        title="Delete Category"
        itemName={deleteDialog.category?.name}
        message={
          deleteDialog.category?.product_count > 0
            ? `Warning: This category currently has ${deleteDialog.category.product_count} product(s) assigned. Deleting it will fail unless those products are reassigned first. We recommend deactivating it instead.`
            : 'Are you sure you want to permanently delete this category? This action cannot be undone.'
        }
        confirmText="Delete Category"
        isLoading={deleteDialog.loading}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteDialog({ isOpen: false, category: null, loading: false })}
      />
    </div>
  );
}
