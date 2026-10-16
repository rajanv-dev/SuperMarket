import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { ROLES } from '../../utils/constants';
import { supabase } from '../../lib/supabase';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export default function LoginPage() {
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (data) => {
    const result = await login(data);
    if (result.success) {
      toast.success('Welcome back!');
      // Route by role
      if (result.role === ROLES.ADMIN) navigate('/admin');
      else if (result.role === ROLES.CASHIER) navigate('/pos');
      else if (result.role === ROLES.INVENTORY_MANAGER) navigate('/inventory');
      else navigate('/');
    } else {
      toast.error(result.error || 'Login failed');
    }
  };

  const handleGoogleSignIn = async () => {
    if (isGoogleLoading || isLoading) return;

    if (!supabase) {
      toast.error('Supabase authentication is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
      return;
    }

    setIsGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) {
        toast.error(error.message || 'Google authentication failed');
        setIsGoogleLoading(false);
      }
      // On success, Supabase will redirect the browser window to Google
    } catch (err) {
      toast.error(err?.message || 'An unexpected error occurred during Google sign-in');
      setIsGoogleLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-display font-bold text-slate-900 mb-1">Sign in</h1>
      <p className="text-sm text-slate-500 mb-6">Welcome back — enter your credentials</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Email */}
        <div>
          <label htmlFor="email" className="label">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              id="email"
              type="email"
              autoComplete="email"
              className={`input pl-10 ${errors.email ? 'input-error' : ''}`}
              placeholder="you@example.com"
              {...register('email')}
            />
          </div>
          {errors.email && <p className="field-error">⚠ {errors.email.message}</p>}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="label">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              id="password"
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              className={`input pl-10 pr-10 ${errors.password ? 'input-error' : ''}`}
              placeholder="••••••••"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label="Toggle password visibility"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && <p className="field-error">⚠ {errors.password.message}</p>}
        </div>

        <button
          type="submit"
          id="login-submit"
          disabled={isLoading || isGoogleLoading}
          className="btn-lg btn-primary w-full mt-2"
        >
          {isLoading ? <LoadingSpinner size="sm" /> : 'Sign In'}
        </button>
      </form>

      {/* Horizontal Divider: "OR CONTINUE WITH" */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-3 text-slate-400 font-semibold tracking-wider">
            OR CONTINUE WITH
          </span>
        </div>
      </div>

      {/* Google Sign-in Button */}
      <button
        type="button"
        id="google-signin-btn"
        onClick={handleGoogleSignIn}
        disabled={isGoogleLoading || isLoading}
        className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white border border-slate-200 rounded-xl text-slate-700 text-sm font-medium shadow-sm hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99]"
      >
        {isGoogleLoading ? (
          <div className="flex items-center gap-2">
            <LoadingSpinner size="sm" />
            <span className="text-slate-500">Connecting to Google...</span>
          </div>
        ) : (
          <>
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
            <span>Continue with Google</span>
          </>
        )}
      </button>

      <p className="mt-5 text-center text-sm text-slate-500">
        Don't have an account?{' '}
        <Link to="/register" className="text-primary-600 font-medium hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
