import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';

import useAuthStore from './store/authStore';
import { supabase } from './lib/supabase';
import { ROLES } from './utils/constants';

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
  const { user, token } = useAuthStore();

  if (!token || !user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <AccessDeniedPage />;
  }
  return children;
};

const GuestRoute = ({ children }) => {
  const { token } = useAuthStore();
  return token ? <Navigate to="/" replace /> : children;
};

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const { fetchMe, setSupabaseSession, isLoading } = useAuthStore();

  useEffect(() => {
    // 1. Intercept OAuth redirect error parameters in URL hash or search query
    const hash = window.location.hash.substring(1);
    const search = window.location.search.substring(1);
    const params = new URLSearchParams(hash || search);

    const error = params.get('error');
    const errorDesc = params.get('error_description');

    if (error || errorDesc) {
      const message = errorDesc
        ? decodeURIComponent(errorDesc).replace(/\+/g, ' ')
        : 'Authentication failed';

      if (message.includes('Unable to exchange external code')) {
        toast.error(
          'Google Sign-In failed: The Google Client Secret configured in Supabase Dashboard is invalid. Please update the Client Secret under Authentication -> Providers -> Google.',
          { duration: 8000 }
        );
      } else {
        toast.error(`Authentication notice: ${message}`, { duration: 6000 });
      }

      // Clean up the URL hash/search to prevent repeat error prompts
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // 2. Refresh local user session
    fetchMe();

    // 3. Listen to Supabase auth events (e.g. OAuth redirect callback)
    if (supabase) {
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
          <Route path="cart" element={
            <ProtectedRoute allowedRoles={[ROLES.CUSTOMER]}>
              <CartPage />
            </ProtectedRoute>
          } />
          <Route path="checkout" element={
            <ProtectedRoute allowedRoles={[ROLES.CUSTOMER]}>
              <CheckoutPage />
            </ProtectedRoute>
          } />
          <Route path="orders" element={
            <ProtectedRoute allowedRoles={[ROLES.CUSTOMER]}>
              <OrdersPage />
            </ProtectedRoute>
          } />
          <Route path="orders/:id" element={
            <ProtectedRoute allowedRoles={[ROLES.CUSTOMER]}>
              <OrderDetailPage />
            </ProtectedRoute>
          } />
          <Route path="profile" element={
            <ProtectedRoute allowedRoles={[ROLES.CUSTOMER]}>
              <ProfilePage />
            </ProtectedRoute>
          } />
        </Route>

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
          <Route path="settings" element={<AdminSettings />} />
        </Route>

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
