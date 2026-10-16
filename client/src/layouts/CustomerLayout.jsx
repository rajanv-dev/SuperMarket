import { Outlet, Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Search, User, Heart, Menu, X, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import useAuthStore from '../store/authStore';
import useCartStore from '../store/cartStore';
import toast from 'react-hot-toast';

export default function CustomerLayout() {
  const { user, logout } = useAuthStore();
  const { items } = useCartStore();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const totalItems = items.reduce((s, i) => s + i.qty, 0);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white shadow-sm border-b border-surface-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 flex-shrink-0">
              <span className="text-2xl font-display font-extrabold text-gradient">🛒 SUPER</span>
            </Link>

            {/* Search bar — desktop */}
            <div className="hidden md:flex flex-1 max-w-xl">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="search"
                  placeholder="Search products, brands, categories..."
                  className="input pl-10 py-2"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.target.value.trim()) {
                      navigate(`/products?q=${encodeURIComponent(e.target.value.trim())}`);
                    }
                  }}
                />
              </div>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-3">
              {/* Cart */}
              <Link to="/cart" className="relative p-2 rounded-xl hover:bg-surface-100 transition-fast" aria-label="Cart">
                <ShoppingCart className="w-5 h-5 text-slate-600" />
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-scale-in">
                    {totalItems > 9 ? '9+' : totalItems}
                  </span>
                )}
              </Link>

              {/* User menu */}
              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-surface-100 transition-fast"
                    aria-label="User menu"
                  >
                    <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-primary-700 text-xs font-bold">
                        {user.name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="hidden sm:block text-sm font-medium text-slate-700 max-w-24 truncate">
                      {user.name?.split(' ')[0]}
                    </span>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 card shadow-card-hover py-1 animate-fade-in z-50">
                      <Link to="/profile" onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-surface-50">
                        <User className="w-4 h-4" /> Profile
                      </Link>
                      <Link to="/orders" onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-surface-50">
                        📦 My Orders
                      </Link>
                      <Link to="/profile#wishlist" onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-surface-50">
                        <Heart className="w-4 h-4" /> Wishlist
                      </Link>
                      {user.role === 'admin' && (
                        <Link to="/admin" onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-primary-600 font-medium hover:bg-primary-50">
                          ⚙️ Admin Panel
                        </Link>
                      )}
                      {user.role === 'cashier' && (
                        <Link to="/pos" onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-primary-600 font-medium hover:bg-primary-50">
                          🖥️ POS Terminal
                        </Link>
                      )}
                      <div className="divider my-1" />
                      <button onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                        🚪 Logout
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link to="/login" className="btn-md btn-primary hidden sm:flex">
                  Sign In
                </Link>
              )}

              {/* Mobile menu toggle */}
              <button
                className="sm:hidden p-2 rounded-xl hover:bg-surface-100"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-6 pb-3 text-sm font-medium text-slate-600">
            <Link to="/" className="hover:text-primary-600 transition-fast">Home</Link>
            <Link to="/products" className="hover:text-primary-600 transition-fast">All Products</Link>
            <Link to="/products?category=fruits-vegetables" className="hover:text-primary-600 transition-fast">Fresh</Link>
            <Link to="/products?category=dairy" className="hover:text-primary-600 transition-fast">Dairy</Link>
            <Link to="/products?category=snacks" className="hover:text-primary-600 transition-fast">Snacks</Link>
            <Link to="/products?category=beverages" className="hover:text-primary-600 transition-fast">Beverages</Link>
            <Link to="/products?offer=true" className="text-accent-600 font-semibold hover:text-accent-700 transition-fast">
              🔥 Offers
            </Link>
          </nav>
        </div>

        {/* Mobile search */}
        <div className="md:hidden px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input type="search" placeholder="Search products..." className="input pl-10 py-2 text-sm" />
          </div>
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="flex-1 animate-fade-in">
        <Outlet />
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="bg-surface-900 text-slate-400 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-white font-display font-bold text-lg mb-3">🛒 SUPER</h3>
            <p className="text-sm leading-relaxed">Fresh groceries delivered to your door.</p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3 text-sm">Shop</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/products" className="hover:text-white transition-fast">All Products</Link></li>
              <li><Link to="/products?offer=true" className="hover:text-white transition-fast">Today's Offers</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3 text-sm">Account</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/profile" className="hover:text-white transition-fast">My Profile</Link></li>
              <li><Link to="/orders" className="hover:text-white transition-fast">My Orders</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3 text-sm">Support</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white transition-fast">Help Center</a></li>
              <li><a href="#" className="hover:text-white transition-fast">Contact Us</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-surface-800 py-4 text-center text-xs">
          © {new Date().getFullYear()} SUPER Supermarket · Built for B.Tech Portfolio
        </div>
      </footer>
    </div>
  );
}
