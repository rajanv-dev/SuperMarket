import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  Plus,
  Minus,
  ArrowLeft,
  Truck,
  ShieldCheck,
  Clock,
  Sparkles,
  Check,
  AlertCircle,
  Package,
  Zap,
} from 'lucide-react';
import { productService } from '../../services';
import useCartStore from '../../store/cartStore';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem, setBuyNowItem } = useCartStore();

  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [isAdded, setIsAdded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setQuantity(1);

    productService
      .getById(id)
      .then((res) => {
        if (!isMounted) return;
        const p = res.data?.data;
        setProduct(p);

        // Fetch related products in same category
        if (p?.category) {
          productService
            .getAll({ category: p.category })
            .then((catRes) => {
              if (isMounted) {
                const list = (catRes.data?.data || []).filter((item) => item.id !== p.id);
                setRelatedProducts(list.slice(0, 4));
              }
            })
            .catch(() => {});
        }
      })
      .catch((err) => {
        console.error('Error loading product details:', err);
        toast.error('Product not found');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
        <LoadingSpinner size="lg" />
        <p className="text-sm font-medium text-slate-500">Loading product details...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Product Not Found</h1>
        <p className="text-sm text-slate-500">
          The requested supermarket product does not exist or has been removed from the catalog.
        </p>
        <Link
          to="/products"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 text-white font-bold text-xs"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Catalog
        </Link>
      </div>
    );
  }

  const maxStock = Number(product.stock_quantity ?? 0);
  const inStock = maxStock > 0 && product.is_active;

  const handleAddToCart = async () => {
    if (!inStock) {
      toast.error('Product is out of stock');
      return;
    }

    setIsAdding(true);
    const res = await addItem(product, quantity);
    setIsAdding(false);

    if (res.success) {
      setIsAdded(true);
      toast.success(`Added ${quantity} ${product.name} to cart`);
      setTimeout(() => setIsAdded(false), 1500);
    } else {
      toast.error(res.error || 'Failed to add to cart');
    }
  };

  const handleBuyNow = () => {
    if (!inStock) {
      toast.error('Product is out of stock');
      return;
    }
    const res = setBuyNowItem(product, quantity);
    if (res.success) {
      navigate('/checkout?mode=buynow');
    } else {
      toast.error(res.error || 'Failed to process Buy Now');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
      {/* ── Breadcrumb & Back Link ────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link to="/" className="hover:text-primary-600 transition-colors">
          Home
        </Link>
        <span>/</span>
        <Link to="/products" className="hover:text-primary-600 transition-colors">
          Products
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-800 truncate max-w-xs">{product.name}</span>
      </div>

      {/* ── Main Product Section ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-14 bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-10 shadow-xs">
        {/* Left Column: Product Photo & Visuals */}
        <div className="space-y-4">
          <div className="h-80 sm:h-96 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center p-6 relative overflow-hidden group">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-primary-100 text-primary-700 font-black text-4xl flex items-center justify-center">
                {product.name.charAt(0)}
              </div>
            )}

            {/* Category tag */}
            <span className="absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold bg-white/95 text-slate-700 shadow-xs border border-slate-200 backdrop-blur-xs">
              {product.category || 'Grocery'}
            </span>

            {/* Stock pill */}
            <span
              className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                inStock
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {inStock ? `${maxStock} In Stock` : 'Out of Stock'}
            </span>
          </div>

          {/* Supermarket Guarantees */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center pt-2">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <Truck className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
              <p className="text-[11px] font-bold text-slate-800">15-Min Delivery</p>
              <p className="text-[10px] text-slate-400">Hyperlocal Hub</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <ShieldCheck className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
              <p className="text-[11px] font-bold text-slate-800">Fresh Quality</p>
              <p className="text-[10px] text-slate-400">100% Guaranteed</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <Sparkles className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
              <p className="text-[11px] font-bold text-slate-800">Best Price</p>
              <p className="text-[10px] text-slate-400">Direct From Farm</p>
            </div>
          </div>
        </div>

        {/* Right Column: Information, Pricing, & Actions */}
        <div className="flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div>
              <span className="text-xs font-bold text-primary-600 tracking-wider uppercase">
                {product.category || 'Supermarket Fresh'}
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
                {product.name}
              </h1>
              <p className="text-xs text-slate-400 font-mono mt-1">SKU: {product.sku}</p>
            </div>

            {/* Price Tag */}
            <div className="flex items-baseline gap-3 pt-2">
              <span className="text-3xl sm:text-4xl font-black text-slate-900 font-mono">
                ₹{Number(product.price).toFixed(2)}
              </span>
              <span className="text-xs text-slate-400">Inclusive of all taxes</span>
            </div>

            {/* Stock status indicator */}
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  inStock ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span className="text-xs font-bold text-slate-700">
                {inStock
                  ? maxStock <= 10
                    ? `Hurry, only ${maxStock} units left in stock!`
                    : `In Stock ready to dispatch (${maxStock} available)`
                  : 'Currently Out of Stock'}
              </span>
            </div>

            {/* Description */}
            <div className="pt-2 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                About this item
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {product.description ||
                  'Carefully sourced and packed to preserve peak nutritional value, freshness, and authentic supermarket quality for your household.'}
              </p>
            </div>
          </div>

          {/* Quantity Selector & Action Buttons */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            {inStock && (
              <div className="flex items-center gap-4">
                <span className="text-xs font-bold text-slate-700">Quantity:</span>
                <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 p-1">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white hover:bg-slate-100 text-slate-700 shadow-xs transition-colors disabled:opacity-40"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-10 text-center font-bold text-sm text-slate-900 font-mono">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(maxStock, q + 1))}
                    disabled={quantity >= maxStock}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white hover:bg-slate-100 text-slate-700 shadow-xs transition-colors disabled:opacity-40"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className="text-xs text-slate-400">
                  Subtotal: ₹{(Number(product.price) * quantity).toFixed(2)}
                </span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={handleAddToCart}
                disabled={!inStock || isAdding}
                className={`w-full sm:flex-1 flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl text-sm font-bold shadow-md transition-all ${
                  isAdded
                    ? 'bg-emerald-600 text-white'
                    : inStock
                    ? 'bg-primary-600 hover:bg-primary-700 text-white hover:scale-[1.02] active:scale-[0.98]'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                {isAdded ? (
                  <>
                    <Check className="w-4 h-4" /> Added to Cart!
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4" /> Add to Cart
                  </>
                )}
              </button>

              <button
                onClick={handleBuyNow}
                disabled={!inStock}
                className={`w-full sm:flex-1 py-3.5 px-6 rounded-2xl text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 ${
                  inStock
                    ? 'bg-red-600 hover:bg-red-700 text-white hover:scale-[1.02] active:scale-[0.98] shadow-red-600/20'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Zap className="w-4 h-4 fill-current" />
                <span>Buy Now</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Related Products Carousel/Grid ─────────────────────────────────── */}
      {relatedProducts.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Similar Products You Might Like</h2>
              <p className="text-xs text-slate-500">More fresh items in {product.category}</p>
            </div>
            <Link
              to={`/products?category=${encodeURIComponent(product.category)}`}
              className="text-xs font-bold text-primary-600 hover:text-primary-700"
            >
              View Category →
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {relatedProducts.map((p) => (
              <Link
                key={p.id}
                to={`/products/${p.id}`}
                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="h-32 bg-slate-50 rounded-xl mb-3 flex items-center justify-center p-2 overflow-hidden">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 font-bold flex items-center justify-center">
                        {p.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {p.category}
                  </span>
                  <h3 className="text-xs font-bold text-slate-900 line-clamp-1 mt-0.5 group-hover:text-primary-600">
                    {p.name}
                  </h3>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">₹{Number(p.price).toFixed(2)}</span>
                  <span className="text-[10px] font-semibold text-primary-600">View</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
