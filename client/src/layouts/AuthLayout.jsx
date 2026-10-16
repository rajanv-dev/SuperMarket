import { Outlet } from 'react-router-dom';

/**
 * Centered card layout used for Login and Register pages.
 */
export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-surface-900 flex items-center justify-center p-4">
      {/* Decorative blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-accent-500/15 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-3xl font-display font-extrabold text-white tracking-tight">
            🛒 VRK Supermarket
          </span>
          <p className="mt-1 text-primary-200 text-sm">Fresh Groceries & Online Shopping</p>
        </div>

        <div className="card p-8 animate-scale-in">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
