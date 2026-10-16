import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, LogIn } from 'lucide-react';
import useAuthStore from '../store/authStore';

export default function AccessDeniedPage() {
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center animate-fade-in">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm">
          <ShieldAlert className="w-9 h-9" />
        </div>

        <h1 className="text-2xl font-display font-bold text-slate-900 mb-2">Access Denied</h1>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
          You are currently signed in as <span className="font-semibold text-slate-700">{user?.email || 'a customer'}</span> with the role of{' '}
          <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-amber-50 text-amber-700 rounded-md border border-amber-200 uppercase">
            {user?.role || 'customer'}
          </span>.
          <br />
          Administrative privileges are required to view this area.
        </p>

        <div className="space-y-3">
          <Link
            to="/"
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Store
          </Link>

          <Link
            to="/admin/login"
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-all shadow-sm"
          >
            <LogIn className="w-4 h-4" /> Admin Portal Sign In
          </Link>

          <Link
            to="/login"
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-sm font-semibold transition-all"
          >
            Sign In with Different Account
          </Link>
        </div>
      </div>
    </div>
  );
}
