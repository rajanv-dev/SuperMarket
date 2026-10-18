import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingBag,
  BarChart3,
  Warehouse,
  Settings,
  LogOut,
  ChevronRight,
  Menu,
  X,
  Store,
  Monitor,
  Bell,
  ShieldCheck,
  Layers,
  UserCheck,
  ClipboardCheck,
  Camera,
  QrCode,
} from 'lucide-react';
import { useState } from 'react';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { ROLES } from '../utils/constants';

const navItems = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/admin/products', label: 'Products', icon: Package },
  { path: '/admin/inventory', label: 'Inventory & Batches', icon: Warehouse },
  { path: '/admin/categories', label: 'Categories', icon: Layers },
  { path: '/admin/orders', label: 'Orders & Sales', icon: ShoppingBag },
  { path: '/admin/staff', label: 'Staff Management', icon: Users },
  { path: '/admin/attendance', label: 'Staff Attendance', icon: ClipboardCheck },
  { path: '/admin/customers', label: 'Customers', icon: UserCheck },
  { path: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { path: '/admin/users', label: 'Staff & Roles', icon: Users },
  { path: '/admin/settings', label: 'Store Settings', icon: Settings },
];

export default function AdminLayout() {
  const { user, logout } = useAuthStore();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const isActive = (item) =>
    item.exact ? pathname === item.path : pathname.startsWith(item.path);

  const Sidebar = () => (
    <aside className="flex flex-col h-full bg-slate-900 text-slate-300 w-64 border-r border-slate-800">
      {/* Brand header */}
      <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
        <Link to="/admin" className="flex items-center gap-2.5 group">
          <img
            src="/logo.png"
            alt="VRK Shopping Mall & Supermarket Logo"
            className="w-8 h-8 vrk-logo-3d shrink-0"
            width="32"
            height="32"
          />
          <div className="flex flex-col">
            <span className="text-base font-black bg-gradient-to-r from-blue-400 via-primary-300 to-red-400 bg-clip-text text-transparent leading-none">
              VRK Supermarket
            </span>
            <span className="text-[10px] font-semibold text-blue-400/90 uppercase tracking-wider mt-0.5">
              Admin Portal
            </span>
          </div>
        </Link>
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden p-1.5 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Admin user banner */}
      <div className="px-5 py-4 border-b border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-emerald-600 flex items-center justify-center text-white font-bold shadow-md shadow-primary-500/20 shrink-0">
            {user?.name?.charAt(0) || 'A'}
          </div>
          <div className="overflow-hidden">
            <p className="text-white text-sm font-semibold truncate leading-tight">
              {user?.name || 'Administrator'}
            </p>
            <p className="text-xs text-slate-400 truncate">{user?.email || 'admin@super.local'}</p>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-medium text-emerald-400 capitalize">
                {user?.role || 'Admin'} Mode
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation items */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
          Management
        </div>
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setSidebarOpen(false)}
            className={clsx(
              'flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
              isActive(item)
                ? 'bg-primary-500 text-white font-semibold shadow-md shadow-primary-500/25'
                : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
            )}
          >
            <span className="flex items-center gap-3">
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </span>
            {isActive(item) && <ChevronRight className="w-3.5 h-3.5 opacity-80" />}
          </Link>
        ))}

        <div className="pt-4 px-3 pb-2 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
          Operations
        </div>
        <Link
          to="/scan"
          className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-sky-400 bg-sky-950/30 border border-sky-900/50 hover:bg-sky-900/40 hover:text-sky-300 transition-all"
        >
          <Camera className="w-4 h-4" />
          <span>Attendance Scanner (/scan)</span>
        </Link>
        <Link
          to="/pos"
          className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-emerald-400 bg-emerald-950/30 border border-emerald-900/50 hover:bg-emerald-900/40 hover:text-emerald-300 transition-all"
        >
          <Monitor className="w-4 h-4" />
          <span>Launch POS Terminal</span>
        </Link>
        <Link
          to="/"
          className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-800/70 hover:text-white transition-all"
        >
          <Store className="w-4 h-4" />
          <span>Customer Storefront</span>
        </Link>
      </nav>

      {/* Logout button */}
      <div className="p-3 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-rose-400 hover:bg-rose-950/30 hover:text-rose-300 transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out</span>
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative shrink-0">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 px-4 lg:px-8 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0 shadow-xs z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Open navigation sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="lg:hidden flex items-center gap-2">
              <img
                src="/logo.png"
                alt="VRK Supermarket Logo"
                className="w-7 h-7 vrk-logo-3d shrink-0"
                width="28"
                height="28"
              />
              <span className="font-bold text-sm text-slate-900">VRK Admin</span>
            </div>
            <div className="hidden sm:block">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Supermarket Management System
              </span>
              <h2 className="text-base font-bold text-slate-800 capitalize leading-tight">
                {pathname.split('/')[2] || 'Overview Dashboard'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all relative"
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 max-w-sm bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-50 animate-slide-up">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <span className="font-bold text-sm text-slate-900">Notifications</span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                      Live
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto mt-2">
                    <div className="py-2.5">
                      <p className="text-xs font-semibold text-slate-800">FEFO Expiry Alert</p>
                      <p className="text-[11px] text-slate-500">
                        Batch MILK-BATCH-001 (Milk 500ml) is scheduled to expire on 2026-10-25.
                      </p>
                    </div>
                    <div className="py-2.5">
                      <p className="text-xs font-semibold text-slate-800">Low Stock Notice</p>
                      <p className="text-[11px] text-slate-500">
                        Bread stock is at 25 units. Threshold is 10 units.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* View Storefront */}
            <Link
              to="/"
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-xl border border-primary-200 transition-all"
            >
              <Store className="w-3.5 h-3.5" />
              <span>Storefront</span>
            </Link>
          </div>
        </header>

        {/* Page Container */}
        <main className="flex-1 overflow-y-auto p-3.5 sm:p-6 lg:p-8 animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
