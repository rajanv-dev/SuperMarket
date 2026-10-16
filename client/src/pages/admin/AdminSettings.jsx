import { useEffect, useState } from 'react';
import { Settings, Save, Store, Mail, Phone, MapPin, Percent, DollarSign, ShieldAlert } from 'lucide-react';
import { adminService } from '../../services/adminSupabaseService';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

export default function AdminSettings() {
  const [settings, setSettings] = useState({
    store_name: '',
    email: '',
    phone: '',
    address: '',
    tax_rate: 5.0,
    currency: '₹',
    low_stock_threshold: 10,
    invoice_prefix: 'INV-',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const data = await adminService.getStoreSettings();
      setSettings(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load store settings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await adminService.updateStoreSettings(settings);
      toast.success('Store settings updated successfully');
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 flex justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-display font-extrabold text-slate-900 tracking-tight">
          Supermarket Store Settings
        </h1>
        <p className="text-sm text-slate-500">
          Configure general store information, invoice prefixes, tax rules, and alert thresholds
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
        {/* Store Info */}
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Store className="w-4 h-4 text-primary-600" />
            <span>Store Identity & Contact</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Supermarket Store Name</label>
              <input
                type="text"
                required
                value={settings.store_name}
                onChange={(e) => setSettings({ ...settings, store_name: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label className="label">Contact Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={settings.email || ''}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  className="input pl-10"
                />
              </div>
            </div>

            <div>
              <label className="label">Support Phone</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="tel"
                  value={settings.phone || ''}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  className="input pl-10"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="label">Physical Store Address</label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <textarea
                  rows={2}
                  value={settings.address || ''}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  className="input pl-10"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Taxes & Billing */}
        <div className="pt-6 border-t border-slate-100">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Percent className="w-4 h-4 text-primary-600" />
            <span>Taxes & Invoice Configuration</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Default GST / Tax Rate (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={settings.tax_rate}
                onChange={(e) => setSettings({ ...settings, tax_rate: Number(e.target.value) })}
                className="input"
              />
            </div>

            <div>
              <label className="label">Currency Symbol</label>
              <input
                type="text"
                value={settings.currency}
                onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                className="input font-mono font-bold"
              />
            </div>

            <div>
              <label className="label">Invoice Number Prefix</label>
              <input
                type="text"
                value={settings.invoice_prefix}
                onChange={(e) => setSettings({ ...settings, invoice_prefix: e.target.value })}
                className="input font-mono uppercase"
              />
            </div>
          </div>
        </div>

        {/* Inventory Defaults */}
        <div className="pt-6 border-t border-slate-100">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-primary-600" />
            <span>Inventory Alert Rules</span>
          </h2>
          <div className="max-w-xs">
            <label className="label">Default Low-Stock Threshold</label>
            <input
              type="number"
              min="1"
              value={settings.low_stock_threshold}
              onChange={(e) => setSettings({ ...settings, low_stock_threshold: Number(e.target.value) })}
              className="input font-mono"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Products with stock at or below this value trigger alerts on the dashboard.
            </p>
          </div>
        </div>

        {/* Submit */}
        <div className="pt-6 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-all disabled:opacity-60"
          >
            {isSaving ? <LoadingSpinner size="sm" /> : <Save className="w-4 h-4" />}
            <span>Save Store Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
}
