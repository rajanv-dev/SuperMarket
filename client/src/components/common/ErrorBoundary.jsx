import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl border border-slate-100 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100 shadow-sm">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Something went wrong
            </h1>

            <p className="text-sm text-slate-600 leading-relaxed">
              An unexpected error occurred while rendering the page. We have prevented a blank screen so you can recover gracefully.
            </p>

            {this.state.error && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-left overflow-auto max-h-32 text-xs font-mono text-slate-700">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-xs transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reload
              </button>
              <button
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-xs shadow-sm transition-colors"
              >
                <Home className="w-3.5 h-3.5" /> Return Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
