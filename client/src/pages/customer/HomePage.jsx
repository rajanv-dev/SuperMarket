import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, ArrowRight, ShieldCheck, Truck, Clock, Sparkles, ShoppingCart, Zap, Check } from 'lucide-react';
import { productService } from '../../services';
import useCartStore from '../../store/cartStore';
import toast from 'react-hot-toast';

export default function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  const { addItem, setBuyNowItem } = useCartStore();
  const [addedMap, setAddedMap] = useState({});

  useEffect(() => {
    productService
      .getAll()
      .then((res) => setFeaturedProducts(res.data?.data?.slice(0, 4) || []))
      .catch((err) => console.warn('Could not fetch homepage products:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleAddToCart = async (product) => {
    const maxStock = Number(product.stock_quantity ?? 0);
    if (maxStock <= 0) {
      toast.error(`${product.name} is currently out of stock`);
      return;
    }

    setAddedMap((prev) => ({ ...prev, [product.id]: true }));
    const result = await addItem(product, 1);
    if (result.success) {
      toast.success(`Added ${product.name} to cart`);
    } else {
      toast.error(result.error || 'Could not add to cart');
    }

    setTimeout(() => {
      setAddedMap((prev) => ({ ...prev, [product.id]: false }));
    }, 1200);
  };

  const handleBuyNow = (product) => {
    const maxStock = Number(product.stock_quantity ?? 0);
    if (maxStock <= 0) {
      toast.error(`${product.name} is currently out of stock`);
      return;
    }

    const result = setBuyNowItem(product, 1);
    if (result.success) {
      navigate('/checkout?mode=buynow');
    } else {
      toast.error(result.error || 'Could not initiate checkout');
    }
  };

  return (
    <div className="space-y-12 pb-16">
      {/* ── Hero Banner ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#075B35] via-[#054829] to-[#003D2D] text-white rounded-3xl mx-3 sm:mx-6 lg:mx-8 mt-4 sm:mt-6 p-6 sm:p-10 lg:p-16 min-h-[520px] lg:min-h-[550px] shadow-2xl flex flex-col justify-between">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 lg:gap-12 flex-1 my-auto">
          <div className="max-w-2xl space-y-6 sm:space-y-8 text-left">
            <h1 className="text-3xl sm:text-5xl lg:text-[56px] font-black tracking-tight leading-[1.12] text-white">
              Fresh Groceries Delivered in 15 Minutes
            </h1>
            <p className="text-emerald-50/90 text-base sm:text-lg lg:text-[19px] leading-relaxed max-w-xl">
              Shop fresh produce, dairy, bakery essentials, and household goods directly from our supermarket fulfillment hubs.
            </p>
            <div className="pt-2 flex items-center gap-4">
              <Link
                to="/products"
                className="inline-flex items-center gap-2.5 px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl bg-white text-[#075B35] font-extrabold text-sm sm:text-base shadow-xl hover:bg-emerald-50 transition-all hover:scale-105 active:scale-95"
              >
                Shop All Products <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </Link>
            </div>
          </div>

          <div className="hidden md:flex items-center justify-center shrink-0">
            <div className="relative p-3 sm:p-4 rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl">
              <img
                src="/logo.png"
                alt="VRK Shopping Mall & Supermarket 3D Brand Badge"
                className="w-48 h-48 sm:w-56 sm:h-56 lg:w-64 lg:h-64 vrk-logo-3d drop-shadow-2xl"
                width="256"
                height="256"
                loading="eager"
              />
            </div>
          </div>
        </div>

        {/* Feature badges */}
        <div className="mt-8 pt-8 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-xs font-semibold text-slate-300">
          <div className="flex items-center gap-2.5">
            <Truck className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>Express Hyperlocal Delivery</span>
          </div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>100% Quality & Freshness Guarantee</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-emerald-400 shrink-0" />
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

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-1">
                  <span className="text-sm font-black text-slate-900">₹{Number(p.price).toFixed(2)}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleAddToCart(p)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                      title="Add to Cart"
                    >
                      {addedMap[p.id] ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <ShoppingCart className="w-4 h-4 text-slate-600" />
                      )}
                    </button>
                    <button
                      onClick={() => handleBuyNow(p)}
                      className="px-2.5 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1"
                      title="Buy Now"
                    >
                      <Zap className="w-3 h-3 fill-current" />
                      <span>Buy</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
