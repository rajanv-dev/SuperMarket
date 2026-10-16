import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, ArrowRight, ShieldCheck, Truck, Clock, Sparkles } from 'lucide-react';
import { productService } from '../../services';

export default function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    productService
      .getAll()
      .then((res) => setFeaturedProducts(res.data?.data?.slice(0, 4) || []))
      .catch((err) => console.warn('Could not fetch homepage products:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-12 pb-16">
      {/* ── Hero Banner ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-900 via-primary-800 to-emerald-950 text-white rounded-3xl mx-4 sm:mx-6 lg:mx-8 mt-6 p-8 sm:p-12 shadow-2xl">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-bold text-emerald-300">
            <Sparkles className="w-3.5 h-3.5" /> Fresh Farm Supermarket
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">
            Fresh Groceries Delivered in 15 Minutes
          </h1>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Shop fresh produce, dairy, bakery essentials, and household goods directly from our supermarket fulfillment hubs.
          </p>
          <div className="pt-2 flex items-center gap-3">
            <Link
              to="/products"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white text-primary-900 font-bold text-sm shadow-lg hover:bg-slate-100 transition-all hover:scale-105 active:scale-95"
            >
              Shop All Products <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Feature badges */}
        <div className="mt-8 pt-8 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold text-slate-300">
          <div className="flex items-center gap-2.5">
            <Truck className="w-5 h-5 text-emerald-400" />
            <span>Express Hyperlocal Delivery</span>
          </div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span>100% Quality & Freshness Guarantee</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-emerald-400" />
            <span>Live Inventory Synchronization</span>
          </div>
        </div>
      </section>

      {/* ── Featured Products Grid ────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900">Featured Grocery Items</h2>
            <p className="text-xs text-slate-500 mt-0.5">Top-selling daily essentials</p>
          </div>
          <Link
            to="/products"
            className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            View Full Catalog <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-3 border-primary-600/30 border-t-primary-600 rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500">Loading essentials...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
            {featuredProducts.map((p) => (
              <div
                key={p.id}
                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="h-32 bg-slate-50 rounded-xl mb-3 flex items-center justify-center p-2">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="max-h-full max-w-full object-contain" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-primary-100 text-primary-700 font-bold flex items-center justify-center">
                        {p.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {p.category || 'Grocery'}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 line-clamp-1 mt-0.5">{p.name}</h3>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-base font-black text-slate-900">₹{Number(p.price).toFixed(2)}</span>
                  <Link
                    to="/products"
                    className="p-2 rounded-xl bg-primary-50 text-primary-600 hover:bg-primary-600 hover:text-white transition-colors"
                  >
                    <ShoppingBag className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
