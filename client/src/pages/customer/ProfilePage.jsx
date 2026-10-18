import { Link, useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  ShoppingBag,
  ShoppingCart,
  LogOut,
  Shield,
  Clock,
  ArrowRight,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const displayName = user?.name || user?.email?.split('@')[0] || 'Customer';
  const avatarUrl = user?.avatar || user?.picture;

  const handleLogout = async () => {
    try {
      if (supabase) await supabase.auth.signOut();
    } catch {}
    await logout();
    toast.success('Signed out successfully');
    navigate('/login');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          My Account
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Manage your supermarket customer profile, order history, and preferences
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row items-center gap-5 pb-6 border-b border-slate-100 text-center sm:text-left">
          <div className="relative">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-20 h-20 rounded-full object-cover ring-4 ring-primary-500/20"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary-100 text-primary-700 font-black text-3xl flex items-center justify-center ring-4 ring-primary-500/20">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-900">{displayName}</h2>
            <p className="text-xs text-slate-500 font-mono flex items-center justify-center sm:justify-start gap-1.5">
              <Mail className="w-3.5 h-3.5" /> {user?.email}
            </p>
            <div className="pt-1">
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                {user?.role || 'Customer'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Links Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            to="/orders"
            className="p-4 rounded-2xl border border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50 flex items-center justify-between transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 group-hover:text-primary-600 transition-colors">
                  My Orders
                </p>
                <p className="text-[11px] text-slate-400">Track and review past orders</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            to="/cart"
            className="p-4 rounded-2xl border border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50 flex items-center justify-between transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 group-hover:text-primary-600 transition-colors">
                  Active Cart
                </p>
                <p className="text-[11px] text-slate-400">View items ready for checkout</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            to="/products"
            className="p-4 rounded-2xl border border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50 flex items-center justify-between transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 group-hover:text-primary-600 transition-colors">
                  Shop Catalog
                </p>
                <p className="text-[11px] text-slate-400">Browse fresh supermarket deals</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </Link>

          {user?.role === 'admin' && (
            <Link
              to="/admin"
              className="p-4 rounded-2xl border border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50 flex items-center justify-between transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 group-hover:text-primary-600 transition-colors">
                    Admin Portal
                  </p>
                  <p className="text-[11px] text-slate-400">Manage products and store operations</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </Link>
          )}
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
