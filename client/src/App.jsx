import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';

import useAuthStore from './store/authStore';
import { supabase } from './lib/supabase';
import { ROLES } from './utils/constants';
import { cleanAuthUrlParams, getAndClearPostLoginDestination } from './utils/authRedirect';

// ── Layouts ───────────────────────────────────────────────────────────────────
import CustomerLayout from './layouts/CustomerLayout';
import AdminLayout from './layouts/AdminLayout';
import CashierLayout from './layouts/CashierLayout';
import InventoryLayout from './layouts/InventoryLayout';
import AuthLayout from './layouts/AuthLayout';

// ── Auth pages ────────────────────────────────────────────────────────────────
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// ── Customer pages ────────────────────────────────────────────────────────────
import HomePage from './pages/customer/HomePage';
import ProductsPage from './pages/customer/ProductsPage';
import ProductDetailPage from './pages/customer/ProductDetailPage';
import CartPage from './pages/customer/CartPage';
import CheckoutPage from './pages/customer/CheckoutPage';
import OrdersPage from './pages/customer/OrdersPage';
import OrderDetailPage from './pages/customer/OrderDetailPage';
import ProfilePage from './pages/customer/ProfilePage';

// ── Admin pages ───────────────────────────────────────────────────────────────
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProducts from './pages/admin/AdminProducts';
import AdminCategories from './pages/admin/AdminCategories';
import AdminCustomers from './pages/admin/AdminCustomers';
import AdminUsers from './pages/admin/AdminUsers';
import AdminOrders from './pages/admin/AdminOrders';
import AdminInventory from './pages/admin/AdminInventory';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminSettings from './pages/admin/AdminSettings';
import AdminAttendance from './pages/admin/AdminAttendance';
import AdminStaff from './pages/admin/AdminStaff';
import AdminLoginPage from './pages/admin/AdminLoginPage';
import QRScannerPage from './pages/scanner/QRScannerPage';

// ── Cashier pages ─────────────────────────────────────────────────────────────
import POSTerminal from './pages/cashier/POSTerminal';
import SaleHistory from './pages/cashier/SaleHistory';
import ReceiptPage from './pages/cashier/ReceiptPage';

// ── Inventory pages ───────────────────────────────────────────────────────────
import InventoryDashboard from './pages/inventory/InventoryDashboard';
import StockAdjustments from './pages/inventory/StockAdjustments';
import StockMovements from './pages/inventory/StockMovements';

// ── Shared ────────────────────────────────────────────────────────────────────
import NotFoundPage from './pages/NotFoundPage';
import LoadingSpinner from './components/ui/LoadingSpinner';

import AccessDeniedPage from './pages/AccessDeniedPage';

// ── Route guards ──────────────────────────────────────────────────────────────
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, token, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!token || !user) {
    const isTargetingAdmin = location.pathname.startsWith('/admin');
    return <Navigate to={isTargetingAdmin ? '/admin/login' : '/login'} state={{ from: location }} replace />;
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <AccessDeniedPage />;
  }
  return children;
};

const GuestRoute = ({ children }) => {
  const { token, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return token ? <Navigate to="/" replace /> : children;
};

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const { fetchMe, setSupabaseSession, isLoading } = useAuthStore();
  const [oauthError, setOauthError] = useState(null);

  useEffect(() => {
    // 1. Safely inspect URL for OAuth errors without disturbing ?code=
    const rawHash = window.location.hash.startsWith('#')
      ? window.location.hash.substring(1)
      : window.location.hash;
    const rawSearch = window.location.search.startsWith('?')
      ? window.location.search.substring(1)
      : window.location.search;

    const hashParams = new URLSearchParams(rawHash);
    const searchParams = new URLSearchParams(rawSearch);

    const error = hashParams.get('error') || searchParams.get('error');
    const errorDesc =
      hashParams.get('error_description') || searchParams.get('error_description');

    if (error || errorDesc) {
      const rawMessage = errorDesc
        ? decodeURIComponent(errorDesc).replace(/\+/g, ' ')
        : 'Authentication failed';

      let userFriendlyMessage = rawMessage;
      if (rawMessage.includes('Unable to exchange external code')) {
        userFriendlyMessage =
          'Google Sign-In failed: The Google Client Secret configured in Supabase Dashboard is invalid. Please verify Google Cloud OAuth credentials in Supabase Dashboard.';
      }

      setOauthError(userFriendlyMessage);

      try {
        toast.error(userFriendlyMessage, { duration: 8000 });
      } catch (e) {
        console.warn('Toast display notification error:', e);
      }

      // Clean up ONLY error parameters from URL without removing ?code= if present
      if (window.location.hash.includes('error=')) {
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname + window.location.search
        );
      } else if (searchParams.has('error')) {
        searchParams.delete('error');
        searchParams.delete('error_code');
        searchParams.delete('error_description');
        const remainingSearch = searchParams.toString();
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname + (remainingSearch ? `?${remainingSearch}` : '')
        );
      }
    }

    // 2. Refresh local user session
    fetchMe();

    // 3. Listen to Supabase auth events (e.g. OAuth redirect callback)
    if (supabase) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          await setSupabaseSession(session);
          cleanAuthUrlParams();

          const destination = getAndClearPostLoginDestination();
          if (destination && typeof window !== 'undefined' && window.location.pathname !== destination) {
            window.location.replace(destination);
          }
        } else if (event === 'SIGNED_OUT') {
          useAuthStore.setState({ user: null, token: null });
        }
      });

      return () => {
        subscription?.unsubscribe();
      };
    }
  }, [fetchMe, setSupabaseSession]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          },
          success: { iconTheme: { primary: '#14b86a', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />

      {/* OAuth Error Alert Banner */}
      {oauthError && (
        <div className="bg-rose-600 text-white px-4 py-3 shadow-md relative z-50">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>
                <strong>Authentication Notice:</strong> {oauthError}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href="/login"
                className="px-3.5 py-1.5 bg-white text-rose-700 font-bold rounded-xl text-xs hover:bg-rose-50 transition-colors shadow-xs"
              >
                Return to Login
              </a>
              <button
                onClick={() => setOauthError(null)}
                className="p-1 hover:bg-rose-700 rounded-lg text-white/80 hover:text-white"
                title="Dismiss banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <Routes>
        {/* ── Auth ─────────────────────────────────────────────────────────── */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
        </Route>

        {/* ── Customer ─────────────────────────────────────────────────────── */}
        <Route element={<CustomerLayout />}>
          <Route index element={<HomePage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="products/:id" element={<ProductDetailPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="checkout" element={
            <ProtectedRoute allowedRoles={[ROLES.CUSTOMER, ROLES.ADMIN]}>
              <CheckoutPage />
            </ProtectedRoute>
          } />
          <Route path="orders" element={
            <ProtectedRoute allowedRoles={[ROLES.CUSTOMER, ROLES.ADMIN]}>
              <OrdersPage />
            </ProtectedRoute>
          } />
          <Route path="orders/:id" element={
            <ProtectedRoute allowedRoles={[ROLES.CUSTOMER, ROLES.ADMIN]}>
              <OrderDetailPage />
            </ProtectedRoute>
          } />
          <Route path="profile" element={
            <ProtectedRoute allowedRoles={[ROLES.CUSTOMER, ROLES.ADMIN]}>
              <ProfilePage />
            </ProtectedRoute>
          } />
        </Route>

        {/* ── Admin Login (Publicly accessible dedicated portal) ──────────── */}
        <Route path="/admin/login" element={<AdminLoginPage />} />

        {/* ── Admin ────────────────────────────────────────────────────────── */}
        <Route path="admin" element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
            <AdminLayout />
          </ProtectedRoute>
        }>
          <Route index element={<AdminDashboard />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="inventory" element={<AdminInventory />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="reports" element={<AdminAnalytics />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="staff" element={<AdminStaff />} />
          <Route path="attendance" element={<AdminAttendance />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        {/* ── Attendance QR Camera Scanner (/scan) ─────────────────────────── */}
        <Route path="scan" element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.CASHIER, ROLES.INVENTORY_MANAGER, 'manager', 'staff']}>
            <QRScannerPage />
          </ProtectedRoute>
        } />

        {/* ── Cashier / POS ────────────────────────────────────────────────── */}
        <Route path="pos" element={
          <ProtectedRoute allowedRoles={[ROLES.CASHIER, ROLES.ADMIN]}>
            <CashierLayout />
          </ProtectedRoute>
        }>
          <Route index element={<POSTerminal />} />
          <Route path="history" element={<SaleHistory />} />
          <Route path="receipt/:saleId" element={<ReceiptPage />} />
        </Route>

        {/* ── Inventory Manager ────────────────────────────────────────────── */}
        <Route path="inventory" element={
          <ProtectedRoute allowedRoles={[ROLES.INVENTORY_MANAGER, ROLES.ADMIN]}>
            <InventoryLayout />
          </ProtectedRoute>
        }>
          <Route index element={<InventoryDashboard />} />
          <Route path="adjustments" element={<StockAdjustments />} />
          <Route path="movements" element={<StockMovements />} />
        </Route>

        {/* ── 404 ──────────────────────────────────────────────────────────── */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
