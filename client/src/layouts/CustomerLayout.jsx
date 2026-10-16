import { Outlet, Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Search, User, Heart, Menu, X, ChevronDown, LogOut, Package, Shield, Monitor } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import useAuthStore from '../store/authStore';
import useCartStore from '../store/cartStore';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export default function CustomerLayout() {
  const { user, logout, setSupabaseSession } = useAuthStore();
  const { items } = useCartStore();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  const totalItems = items.reduce((s, i) => s + (Number(i.quantity) || Number(i.qty) || 1), 0);

  // Subscribe to auth state changes to update navbar immediately
  useEffect(() => {
    if (!supabase) return;

    // Check session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSupabaseSession(session);
      }
    });

    // Listen to real-time auth state changes (OAuth callback, sign in, sign out)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setSupabaseSession(session);
      } else if (event === 'SIGNED_OUT') {
        useAuthStore.setState({ user: null, token: null });
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [setSupabaseSession]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setUserMenuOpen(false);
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('Sign out error:', err);
    }
    await logout();
    toast.success('Signed out successfully');
    navigate('/login');
  };

  // Google name fallback logic: full_name -> name -> email prefix -> "My Account"
  const displayName = user?.name || user?.email?.split('@')[0] || 'My Account';
  const avatarUrl = user?.avatar || user?.picture;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* ── Top Header Navigation Bar ────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md shadow-xs border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <span className="text-2xl font-display font-extrabold bg-gradient-to-r from-primary-600 to-emerald-600 bg-clip-text text-transparent">
                🛒 SUPER
              </span>
            </Link>

            {/* Desktop Search Bar */}
            <div className="hidden md:flex flex-1 max-w-xl">
              <div className="relative w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="search"
                  placeholder="Search groceries, fresh produce, beverages..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.target.value.trim()) {
                      navigate(`/products?q=${encodeURIComponent(e.target.value.trim())}`);
                    }
                  }}
                />
              </div>
            </div>

            {/* Right Action Items */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Shopping Cart */}
              <Link
                to="/cart"
                className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
                aria-label="Shopping Cart"
              >
                <ShoppingCart className="w-5 h-5" />
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary-600 text-white text-[10px] font-extrabold rounded-full w-5 h-5 flex items-center justify-center animate-scale-in shadow-xs">
                    {totalItems > 9 ? '9+' : totalItems}
                  </span>
                )}
              </Link>

              {/* User Menu / Profile Dropdown (Authenticated vs Unauthenticated) */}
              {user ? (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200/90 hover:bg-slate-50 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    aria-label="User account menu"
                    aria-expanded={userMenuOpen}
                  >
                    {/* Google Profile Picture or Default Avatar */}
                    <div className="relative shrink-0">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={displayName}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded-full object-cover ring-2 ring-primary-500/30"
                          onError={(e) => {
                            // Fallback to initial if image fails
                            e.currentTarget.style.display = 'none';
                            if (e.currentTarget.nextElementSibling) {
                              e.currentTarget.nextElementSibling.style.display = 'flex';
                            }
                          }}
                        />
                      ) : null}
                      <div
                        className={`w-8 h-8 rounded-full bg-primary-100 items-center justify-center text-primary-700 text-xs font-bold ring-2 ring-primary-500/30 ${
                          avatarUrl ? 'hidden' : 'flex'
                        }`}
                      >
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    </div>

                    {/* User Name */}
                    <span className="hidden sm:block text-xs font-bold text-slate-700 max-w-28 truncate leading-tight">
                      {displayName}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu */}
                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-50 animate-slide-up">
                      {/* User Header */}
                      <div className="px-4 py-3 border-b border-slate-100">
                        <p className="text-xs font-bold text-slate-900 truncate">{displayName}</p>
                        <p className="text-[11px] text-slate-400 truncate font-mono">{user.email}</p>
                        {user.role && user.role !== 'customer' && (
                          <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-primary-50 text-primary-700 border border-primary-200">
                            {user.role}
                          </span>
                        )}
                      </div>

                      {/* Dropdown Links */}
                      <div className="py-1 text-xs font-medium text-slate-700">
                        <Link
                          to="/profile"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                        >
                          <User className="w-4 h-4 text-slate-400" />
                          <span>Profile</span>
                        </Link>

                        <Link
                          to="/orders"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                        >
                          <Package className="w-4 h-4 text-slate-400" />
                          <span>My Orders</span>
                        </Link>

                        <Link
                          to="/profile#wishlist"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                        >
                          <Heart className="w-4 h-4 text-slate-400" />
                          <span>Wishlist</span>
                        </Link>

                        {/* Admin / POS quick links for staff */}
                        {(user.role === 'admin' || user.role === 'manager') && (
                          <Link
                            to="/admin"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-primary-600 font-semibold hover:bg-primary-50 transition-colors"
                          >
                            <Shield className="w-4 h-4 text-primary-600" />
                            <span>Admin Panel</span>
                          </Link>
                        )}

                        {(user.role === 'cashier' || user.role === 'admin') && (
                          <Link
                            to="/pos"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-emerald-600 font-semibold hover:bg-emerald-50 transition-colors"
                          >
                            <Monitor className="w-4 h-4 text-emerald-600" />
                            <span>POS Terminal</span>
                          </Link>
                        )}
                      </div>

                      <div className="border-t border-slate-100 my-1" />

                      {/* Sign Out Button */}
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Sign In Button for Guests */
                <Link
                  to="/login"
                  id="navbar-signin-btn"
                  className="flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-xs transition-all active:scale-[0.98]"
                >
                  Sign In
                </Link>
              )}

              {/* Mobile Menu Toggle Button */}
              <button
                className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle Navigation Menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Desktop Navigation Category Links */}
          <nav className="hidden md:flex items-center gap-6 pb-3 text-xs font-semibold text-slate-600">
            <Link to="/" className="hover:text-primary-600 transition-colors">Home</Link>
            <Link to="/products" className="hover:text-primary-600 transition-colors">All Products</Link>
            <Link to="/products?category=Dairy" className="hover:text-primary-600 transition-colors">Dairy</Link>
            <Link to="/products?category=Groceries" className="hover:text-primary-600 transition-colors">Groceries</Link>
            <Link to="/products?category=Bakery" className="hover:text-primary-600 transition-colors">Bakery</Link>
            <Link to="/products?category=Cooking%20Oil" className="hover:text-primary-600 transition-colors">Cooking Oil</Link>
            <Link to="/products?offer=true" className="text-emerald-600 font-bold hover:text-emerald-700 transition-colors">
              🔥 Today's Offers
            </Link>
          </nav>
        </div>

        {/* Mobile Search Bar */}
        <div className="md:hidden px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="search"
              placeholder="Search products..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                  navigate(`/products?q=${encodeURIComponent(e.target.value.trim())}`);
                }
              }}
            />
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white px-4 py-3 space-y-2 animate-slide-up text-xs font-semibold text-slate-700">
            <Link to="/" onClick={() => setMobileMenuOpen(false)} className="block py-1.5 hover:text-primary-600">Home</Link>
            <Link to="/products" onClick={() => setMobileMenuOpen(false)} className="block py-1.5 hover:text-primary-600">All Products</Link>
            <Link to="/products?category=Dairy" onClick={() => setMobileMenuOpen(false)} className="block py-1.5 hover:text-primary-600">Dairy</Link>
            <Link to="/products?category=Groceries" onClick={() => setMobileMenuOpen(false)} className="block py-1.5 hover:text-primary-600">Groceries</Link>
            <Link to="/products?category=Bakery" onClick={() => setMobileMenuOpen(false)} className="block py-1.5 hover:text-primary-600">Bakery</Link>

            {user ? (
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex items-center gap-2.5 py-1">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} referrerPolicy="no-referrer" className="w-7 h-7 rounded-full object-cover" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center text-xs">
                      {displayName.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-bold text-slate-900">{displayName}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{user.email}</p>
                  </div>
                </div>
                <Link to="/profile" onClick={() => setMobileMenuOpen(false)} className="block py-1 text-slate-600">Profile</Link>
                <Link to="/orders" onClick={() => setMobileMenuOpen(false)} className="block py-1 text-slate-600">My Orders</Link>
                <button onClick={handleLogout} className="block py-1 text-rose-600 font-bold">Sign Out</button>
              </div>
            ) : (
              <div className="pt-2 border-t border-slate-100">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block w-full text-center py-2 bg-primary-600 text-white rounded-xl font-bold"
                >
                  Sign In
                </Link>
              </div>
            )}
          </div>
        )}
      </header>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <main className="flex-1 animate-fade-in">
        <Outlet />
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="bg-slate-900 text-slate-400 mt-16 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-white font-display font-bold text-lg mb-3">🛒 SUPER</h3>
            <p className="text-sm leading-relaxed text-slate-400">
              Fresh groceries, farm produce, and daily essentials delivered fast.
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3 text-sm">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/products" className="hover:text-white transition-colors">All Products</Link></li>
              <li><Link to="/products?offer=true" className="hover:text-white transition-colors">Today's Deals</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3 text-sm">Customer Care</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/profile" className="hover:text-white transition-colors">My Profile</Link></li>
              <li><Link to="/orders" className="hover:text-white transition-colors">My Orders</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3 text-sm">Store Information</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Open Daily: 8:00 AM – 10:00 PM<br />
              Customer Support: +91 98765 43210
            </p>
          </div>
        </div>
        <div className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} SUPER Supermarket Platform · All rights reserved.
        </div>
      </footer>
    </div>
  );
}
