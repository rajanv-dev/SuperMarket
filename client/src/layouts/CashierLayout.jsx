import { Outlet, Link, useLocation } from 'react-router-dom';
import { Monitor, Clock, Receipt } from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { path: '/pos', label: 'POS Terminal', icon: Monitor, exact: true },
  { path: '/pos/history', label: 'Sale History', icon: Clock },
];

export default function CashierLayout() {
  const { pathname } = useLocation();
  const isActive = (item) => item.exact ? pathname === item.path : pathname.startsWith(item.path);

  return (
    <div className="min-h-screen bg-surface-900 flex flex-col">
      <header className="bg-surface-800 border-b border-surface-700 px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
        <span className="font-display font-bold text-white flex items-center gap-2.5 text-sm sm:text-base shrink-0">
          <img
            src="/logo.png"
            alt="VRK Shopping Mall & Supermarket Logo"
            className="w-7 h-7 vrk-logo-3d shrink-0"
            width="28"
            height="28"
          />
          <span className="hidden sm:inline">VRK Supermarket POS</span>
          <span className="sm:hidden">VRK POS</span>
        </span>
        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <Link key={item.path} to={item.path}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-fast',
                isActive(item)
                  ? 'bg-primary-500 text-white'
                  : 'text-slate-400 hover:bg-surface-700 hover:text-white'
              )}>
              <item.icon className="w-4 h-4" />{item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex-1 overflow-hidden"><Outlet /></main>
    </div>
  );
}
