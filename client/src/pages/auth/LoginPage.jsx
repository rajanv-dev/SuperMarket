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

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export default function LoginPage() {
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);

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
          disabled={isLoading}
          className="btn-lg btn-primary w-full mt-2"
        >
          {isLoading ? <LoadingSpinner size="sm" /> : 'Sign In'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500">
        Don't have an account?{' '}
        <Link to="/register" className="text-primary-600 font-medium hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
