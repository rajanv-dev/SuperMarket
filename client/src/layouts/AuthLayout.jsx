import { Outlet, Link } from 'react-router-dom';

/**
 * Centered card layout used for Login and Register pages.
 */
export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-primary-900 to-slate-950 flex items-center justify-center p-4">
      {/* Decorative blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-red-600/15 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8 flex flex-col items-center">
          <Link to="/" className="inline-block group mb-3" aria-label="VRK Supermarket Storefront">
            <img
              src="/logo.png"
              alt="VRK Shopping Mall & Supermarket Logo"
              className="w-16 h-16 sm:w-20 sm:h-20 vrk-logo-3d mx-auto drop-shadow-xl"
              width="80"
              height="80"
              loading="eager"
            />
          </Link>
          <span className="text-2xl sm:text-3xl font-display font-extrabold text-white tracking-tight">
            VRK Supermarket
          </span>
          <p className="mt-1 text-blue-200 text-sm">Fresh Groceries & Online Shopping</p>
        </div>

        <div className="card p-8 animate-scale-in">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
