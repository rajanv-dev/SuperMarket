import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import {
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowLeft,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { ROLES } from '../../utils/constants';
import { supabase } from '../../lib/supabase';
import { getAuthRedirectUrl, savePostLoginDestination } from '../../utils/authRedirect';

export default function AdminLoginPage() {
  const { user, adminLogin, resetPassword, isLoading } = useAuthStore();
  const navigate = useNavigate();

  // If already authenticated as admin, go straight to /admin
  if (user && user.role === ROLES.ADMIN) {
    return <Navigate to="/admin" replace />;
  }

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Forgot password modal
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting || isGoogleLoading) return;
    setErrorMessage(null);

    if (!email.trim() || !password) {
      toast.error('Please enter both administrator email and password');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await adminLogin({ email, password });
      if (result.success) {
        toast.success('Administrator authenticated successfully');
        navigate('/admin');
      } else {
        setErrorMessage(result.error || 'Authentication failed');
      }
    } catch (err) {
      setErrorMessage(err.message || 'An unexpected error occurred during login');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      toast.error('Please enter your administrator email address');
      return;
    }

    try {
      setIsResetting(true);
      await resetPassword(resetEmail);
      setResetSuccess(true);
      toast.success('Password recovery email sent');
    } catch (err) {
      toast.error(err.message || 'Failed to send password recovery email');
    } finally {
      setIsResetting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isGoogleLoading || isSubmitting) return;

    if (!supabase) {
      toast.error('Supabase authentication is not configured.');
      return;
    }

    setIsGoogleLoading(true);
    setErrorMessage(null);
    try {
      // Save intended destination so App.jsx redirects to /admin on session return
      savePostLoginDestination('/admin');
      const redirectTo = getAuthRedirectUrl('/admin');

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
        },
      });

      if (error) {
        toast.error(error.message || 'Google authentication failed');
        setErrorMessage(error.message || 'Google authentication failed');
        setIsGoogleLoading(false);
      }
    } catch (err) {
      const msg = err?.message || 'Error initiating Google sign-in';
      toast.error(msg);
      setErrorMessage(msg);
      setIsGoogleLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden select-none"
      style={{
        background: 'linear-gradient(135deg, #022C22 0%, #064E3B 52%, #065F46 100%)',
      }}
    >
      {/* ── Soft Ambient Lighting & Radial Gradients ─────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(circle at 18% 18%, rgba(16, 185, 129, 0.18) 0%, transparent 45%),
            radial-gradient(circle at 82% 82%, rgba(5, 150, 105, 0.22) 0%, transparent 48%),
            radial-gradient(ellipse at 50% 50%, rgba(52, 211, 153, 0.08) 0%, transparent 65%)
          `,
        }}
      />

      {/* ── Decorative Supermarket & Leaf Motifs (Low Opacity) ───────────── */}
      {/* Top Left Leaf Cluster */}
      <svg
        className="absolute top-4 left-4 sm:top-12 sm:left-12 w-48 sm:w-72 h-48 sm:h-72 text-emerald-300 opacity-[0.045] pointer-events-none transform -rotate-12 transition-transform duration-1000"
        viewBox="0 0 200 200"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M42.7,24.5 C68.1,7.2 99.4,12.8 120.3,37.3 C141.2,61.8 147.1,95.4 135.5,123.6 C123.9,151.8 97.4,168.9 67.8,167.3 C38.2,165.7 12.1,145.9 3.8,117.4 C-4.5,88.9 6.8,57.8 24.5,42.7 Z" />
        <path d="M100,20 C120,60 140,110 90,170" stroke="currentColor" strokeWidth="4" fill="none" />
        <path d="M110,65 C130,70 145,85 145,85" stroke="currentColor" strokeWidth="3" fill="none" />
        <path d="M98,95 C118,102 130,118 130,118" stroke="currentColor" strokeWidth="3" fill="none" />
        <path d="M88,125 C102,135 112,148 112,148" stroke="currentColor" strokeWidth="3" fill="none" />
      </svg>

      {/* Bottom Right Grocery Cart & Ingredients Motif */}
      <svg
        className="absolute -bottom-8 -right-8 sm:bottom-6 sm:right-6 w-56 sm:w-80 h-56 sm:h-80 text-emerald-200 opacity-[0.04] pointer-events-none transform rotate-6"
        viewBox="0 0 240 240"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Shopping Cart Outline */}
        <circle cx="90" cy="195" r="14" fill="currentColor" />
        <circle cx="175" cy="195" r="14" fill="currentColor" />
        <path d="M30 40 h35 l24 95 h100 l22 -75 H68" />
        {/* Fresh Produce silhouettes inside cart */}
        <path d="M105 50 Q115 30 130 50 Q145 70 120 75 Z" fill="currentColor" />
        <path d="M140 45 Q155 35 165 52 Q170 70 150 72 Z" fill="currentColor" />
      </svg>

      {/* Subtle Ambient Floating Particles (Lightweight CSS) */}
      <div className="absolute top-1/4 right-1/4 w-2 h-2 rounded-full bg-emerald-400/20 blur-[1px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-1/3 left-1/5 w-2.5 h-2.5 rounded-full bg-emerald-300/15 blur-[1px] animate-pulse pointer-events-none" />

      {/* ── Back to Customer Storefront ─────────────────────────────────── */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20">
        <Link
          to="/"
          className="flex items-center gap-2 text-xs font-semibold text-emerald-100/80 hover:text-white bg-[#022119]/80 hover:bg-[#032e23] border border-emerald-500/20 hover:border-emerald-400/40 px-3.5 py-2 rounded-xl backdrop-blur-md transition-all shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-emerald-400" />
          <span>Customer Storefront</span>
        </Link>
      </div>

      {/* ── Main Container ──────────────────────────────────────────────── */}
      <div className="w-full max-w-md mx-auto relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-6 sm:mb-8 flex flex-col items-center">
          <Link
            to="/"
            className="inline-block group mb-3 transform hover:scale-105 transition-transform duration-300"
            aria-label="VRK Supermarket Storefront"
          >
            <div className="relative">
              <div className="absolute -inset-2 bg-emerald-500/15 rounded-2xl blur-md pointer-events-none" />
              <img
                src="/logo.png"
                alt="VRK Supermarket Logo"
                className="w-16 h-16 sm:w-20 sm:h-20 vrk-logo-3d relative mx-auto drop-shadow-2xl object-contain"
                width="80"
                height="80"
                loading="eager"
              />
            </div>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white tracking-tight drop-shadow-sm">
            VRK Supermarket Admin Portal
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100/75 mt-1 font-medium max-w-xs sm:max-w-none">
            Authorized Administrator & Staff Management Access
          </p>
        </div>

        {/* ── Login Card (Glassmorphism + Subtle Green Border + Shadow) ─── */}
        <div className="bg-[#02231b]/80 sm:bg-[#03281f]/85 backdrop-blur-2xl py-7 px-5 sm:py-9 sm:px-10 shadow-[0_20px_50px_rgba(0,0,0,0.55)] rounded-3xl border border-emerald-500/25 relative overflow-hidden">
          {/* Subtle top edge glow highlight */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent pointer-events-none" />

          {/* Error Message Alert */}
          {errorMessage && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2.5 shadow-sm animate-fade-in"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5" noValidate>
            {/* Email Address */}
            <div>
              <label
                htmlFor="admin-email"
                className="block text-xs font-semibold text-emerald-100/90 mb-1.5 uppercase tracking-wider"
              >
                Administrator Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/80 pointer-events-none" />
                <input
                  id="admin-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@super.local"
                  disabled={isSubmitting || isGoogleLoading}
                  className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-[#011712]/80 border border-emerald-800/70 rounded-xl text-sm text-white placeholder-emerald-100/30 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400 transition-all disabled:opacity-60"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="admin-password"
                  className="block text-xs font-semibold text-emerald-100/90 uppercase tracking-wider"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setResetSuccess(false);
                    setIsResetOpen(true);
                  }}
                  className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 transition-colors cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/80 pointer-events-none" />
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  disabled={isSubmitting || isGoogleLoading}
                  className="w-full pl-10 pr-10 py-2.5 sm:py-3 bg-[#011712]/80 border border-emerald-800/70 rounded-xl text-sm text-white placeholder-emerald-100/30 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400 transition-all disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-emerald-300/70 hover:text-white rounded-lg transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button (Original Green Brand Color) */}
            <button
              type="submit"
              disabled={isSubmitting || isGoogleLoading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-emerald-600 via-primary-600 to-[#075B35] hover:from-emerald-500 hover:via-primary-500 hover:to-[#097846] active:scale-[0.99] text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-950/70 border border-emerald-400/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Verifying Administrator Access...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-emerald-200" />
                  <span>Sign In to Admin Dashboard</span>
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-5 sm:my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-emerald-800/60" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#03281f] px-3.5 text-emerald-200/70 font-semibold tracking-wider text-[11px] rounded-full border border-emerald-800/50">
                OR SIGN IN WITH GOOGLE
              </span>
            </div>
          </div>

          {/* Google OAuth Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || isSubmitting}
            className="w-full flex items-center justify-center gap-3 py-2.5 sm:py-3 px-4 bg-[#011712]/85 hover:bg-[#022119] border border-emerald-700/60 hover:border-emerald-500/60 rounded-xl text-emerald-50 text-sm font-medium transition-all shadow-sm disabled:opacity-60 cursor-pointer"
          >
            {isGoogleLoading ? (
              <div className="flex items-center gap-2">
                <LoadingSpinner size="sm" />
                <span className="text-emerald-200">Authenticating with Google...</span>
              </div>
            ) : (
              <>
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Continue with Admin Google Account</span>
              </>
            )}
          </button>
        </div>

        {/* Security Notice */}
        <div className="text-center text-[11px] text-emerald-200/60 mt-5 sm:mt-6 flex items-center justify-center gap-1.5 px-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Role verification is enforced on backend for all administrator operations.</span>
        </div>
      </div>

      {/* ── Forgot Password Modal ────────────────────────────────────────── */}
      {isResetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#03281f] rounded-3xl shadow-2xl border border-emerald-500/30 w-full max-w-md p-6 animate-scale-in text-white relative">
            <div className="flex items-center justify-between pb-4 border-b border-emerald-800/60">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30">
                  <KeyRound className="w-4 h-4 text-emerald-300" />
                </div>
                <h3 className="font-bold text-base text-white">Reset Admin Password</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsResetOpen(false)}
                className="text-emerald-300/70 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {resetSuccess ? (
              <div className="py-6 text-center space-y-3">
                <div className="w-12 h-12 bg-emerald-500/20 text-emerald-300 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-sm text-white">Password Recovery Email Sent</h4>
                <p className="text-xs text-emerald-100/70 max-w-xs mx-auto leading-relaxed">
                  We have dispatched a password recovery link to{' '}
                  <strong className="text-emerald-200">{resetEmail}</strong> via Supabase Auth.
                  Please check your inbox.
                </p>
                <button
                  type="button"
                  onClick={() => setIsResetOpen(false)}
                  className="mt-4 px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all cursor-pointer shadow-sm"
                >
                  Return to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="py-4 space-y-4">
                <p className="text-xs text-emerald-100/70 leading-relaxed">
                  Enter your registered administrator email address. Supabase Auth will dispatch a secure password reset link.
                </p>

                <div>
                  <label htmlFor="reset-email" className="block text-xs font-semibold text-emerald-100/90 mb-1">
                    Administrator Email Address
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="admin@super.local"
                    className="w-full px-4 py-2.5 bg-[#011712]/90 border border-emerald-800/80 rounded-xl text-sm text-white placeholder-emerald-100/30 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-emerald-800/60">
                  <button
                    type="button"
                    onClick={() => setIsResetOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-emerald-200/70 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isResetting}
                    className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-primary-600 hover:from-emerald-500 hover:to-primary-500 rounded-xl transition-all disabled:opacity-60 flex items-center gap-2 cursor-pointer shadow-sm"
                  >
                    {isResetting ? <LoadingSpinner size="sm" /> : 'Send Reset Link'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
