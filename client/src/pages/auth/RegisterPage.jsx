import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Phone } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().regex(/^\d{10}$/, 'Phone must be exactly 10 digits').optional().or(z.literal('')),
  password: z
    .string()
    .min(8, 'Minimum 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export default function RegisterPage() {
  const { register: registerUser, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (data) => {
    const payload = { name: data.name, email: data.email, password: data.password };
    if (data.phone) payload.phone = data.phone;

    const result = await registerUser(payload);
    if (result.success) {
      toast.success('Account created! Welcome to SUPER 🎉');
      navigate('/');
    } else {
      toast.error(result.error || 'Registration failed');
    }
  };

  const Field = ({ id, label, icon: Icon, error, children }) => (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
        {children}
      </div>
      {error && <p className="field-error">⚠ {error.message}</p>}
    </div>
  );

  return (
    <div>
      <h1 className="text-2xl font-display font-bold text-slate-900 mb-1">Create account</h1>
      <p className="text-sm text-slate-500 mb-6">Start shopping fresh with SUPER</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field id="name" label="Full Name" icon={User} error={errors.name}>
          <input id="name" type="text" autoComplete="name"
            className={`input pl-10 ${errors.name ? 'input-error' : ''}`}
            placeholder="Rajiv Kumar"
            {...register('name')} />
        </Field>

        <Field id="email" label="Email" icon={Mail} error={errors.email}>
          <input id="email" type="email" autoComplete="email"
            className={`input pl-10 ${errors.email ? 'input-error' : ''}`}
            placeholder="you@example.com"
            {...register('email')} />
        </Field>

        <Field id="phone" label="Phone (optional)" icon={Phone} error={errors.phone}>
          <input id="phone" type="tel" autoComplete="tel"
            className={`input pl-10 ${errors.phone ? 'input-error' : ''}`}
            placeholder="9876543210"
            {...register('phone')} />
        </Field>

        <Field id="password" label="Password" icon={Lock} error={errors.password}>
          <input id="password" type={showPw ? 'text' : 'password'}
            autoComplete="new-password"
            className={`input pl-10 pr-10 ${errors.password ? 'input-error' : ''}`}
            placeholder="Min 8 chars, 1 uppercase, 1 number"
            {...register('password')} />
          <button type="button" onClick={() => setShowPw(!showPw)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            aria-label="Toggle password visibility">
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </Field>

        <Field id="confirmPassword" label="Confirm Password" icon={Lock} error={errors.confirmPassword}>
          <input id="confirmPassword" type={showPw ? 'text' : 'password'}
            autoComplete="new-password"
            className={`input pl-10 ${errors.confirmPassword ? 'input-error' : ''}`}
            placeholder="Repeat password"
            {...register('confirmPassword')} />
        </Field>

        <button type="submit" id="register-submit" disabled={isLoading}
          className="btn-lg btn-primary w-full mt-2">
          {isLoading ? <LoadingSpinner size="sm" /> : 'Create Account'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link to="/login" className="text-primary-600 font-medium hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
