import { Outlet, Link, useLocation } from 'react-router-dom';
import { Warehouse, ArrowLeftRight, TrendingUp } from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { path: '/inventory', label: 'Dashboard', icon: Warehouse, exact: true },
  { path: '/inventory/adjustments', label: 'Adjustments', icon: TrendingUp },
  { path: '/inventory/movements', label: 'Movements', icon: ArrowLeftRight },
];

export default function InventoryLayout() {
  const { pathname } = useLocation();
  const isActive = (item) => item.exact ? pathname === item.path : pathname.startsWith(item.path);

  return (
    <div className="min-h-screen bg-surface-50">
      <header className="bg-white border-b border-surface-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <span className="font-display font-bold text-slate-900">📦 Inventory Manager</span>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link key={item.path} to={item.path}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-fast',
                  isActive(item)
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-slate-600 hover:bg-surface-100'
                )}>
                <item.icon className="w-4 h-4" />{item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="page-container animate-fade-in"><Outlet /></main>
    </div>
  );
}
