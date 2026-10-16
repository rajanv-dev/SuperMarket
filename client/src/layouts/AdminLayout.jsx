import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, Users, ShoppingBag, BarChart3,
  Warehouse, LogOut, ChevronRight, Menu, X
} from 'lucide-react';
import { useState } from 'react';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const navItems = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/admin/products', label: 'Products', icon: Package },
  { path: '/admin/users', label: 'Users', icon: Users },
  { path: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { path: '/admin/inventory', label: 'Inventory', icon: Warehouse },
  { path: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
];

export default function AdminLayout() {
  const { user, logout } = useAuthStore();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/login');
  };

  const isActive = (item) =>
    item.exact ? pathname === item.path : pathname.startsWith(item.path);

  const Sidebar = () => (
    <aside className="flex flex-col h-full bg-surface-900 text-slate-300 w-64">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-surface-800">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-xl font-display font-bold text-white">🛒 SUPER</span>
        </Link>
        <p className="text-xs text-slate-500 mt-0.5">Admin Panel</p>
      </div>

      {/* User info */}
      <div className="px-4 py-4 border-b border-surface-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center">
            <span className="text-white text-sm font-bold">{user?.name?.charAt(0)}</span>
          </div>
          <div className="overflow-hidden">
            <p className="text-white text-sm font-semibold truncate">{user?.name}</p>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setSidebarOpen(false)}
            className={clsx(
              'flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
              isActive(item)
                ? 'bg-primary-500 text-white shadow-glow'
                : 'text-slate-400 hover:bg-surface-800 hover:text-white'
            )}
          >
            <span className="flex items-center gap-3">
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </span>
            {isActive(item) && <ChevronRight className="w-3 h-3" />}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-surface-800 space-y-1">
        <Link to="/" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:bg-surface-800 hover:text-white transition-fast">
          🛍️ View Store
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-fast"
        >
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-surface-100">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <div className="relative flex-shrink-0 animate-slide-up">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-surface-200">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-surface-100">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-display font-bold text-slate-900">🛒 SUPER Admin</span>
        </header>

        <main className="flex-1 overflow-y-auto animate-fade-in">
          <div className="page-container">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
