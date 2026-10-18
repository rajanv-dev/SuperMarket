import { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Search, Package, AlertCircle, RefreshCw, ShoppingCart, Tag, Check, Zap } from 'lucide-react';
import { productService } from '../../services';
import useCartStore from '../../store/cartStore';
import toast from 'react-hot-toast';

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const initialCategory = searchParams.get('category') || 'all';

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [sortBy, setSortBy] = useState('popular'); // 'popular' | 'price_asc' | 'price_desc' | 'name_asc'
  const [addedMap, setAddedMap] = useState({});

  const navigate = useNavigate();
  const { addItem, setBuyNowItem } = useCartStore();

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await productService.getAll({
        q: search.trim() || undefined,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
      });
      setProducts(res.data?.data || []);
    } catch (err) {
      console.error('Products load error:', err);
      setError(err.userMessage || 'Failed to load products from server. Please verify backend connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [selectedCategory]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadProducts();
  };

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

  // Derive unique categories from products
  const categories = ['all', ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))];

  // Sorted products
  const sortedProducts = [...products].sort((a, b) => {
    if (sortBy === 'price_asc') return Number(a.price) - Number(b.price);
    if (sortBy === 'price_desc') return Number(b.price) - Number(a.price);
    if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
    return 0; // default order
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* ── Page Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Supermarket Catalog
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Browse fresh groceries, dairy, staples, and daily essentials
          </p>
        </div>

        {/* Search input */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 max-w-md w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all shadow-xs"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm rounded-xl transition-colors shadow-xs"
          >
            Search
          </button>
        </form>
      </div>

      {/* ── Category Filter Pills ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-2 flex items-center gap-1">
          <Tag className="w-3.5 h-3.5" /> Department:
        </span>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold capitalize transition-all shrink-0 ${
              selectedCategory === cat
                ? 'bg-primary-600 text-white shadow-sm shadow-primary-500/20'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            {cat === 'all' ? 'All Products' : cat}
          </button>
        ))}
      </div>

      {/* ── Sort & Results Count Bar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-xs text-slate-500 pt-1 pb-1">
        <p className="font-medium">
          Showing <span className="font-bold text-slate-800">{sortedProducts.length}</span> product{sortedProducts.length === 1 ? '' : 's'}
        </p>

        <div className="flex items-center gap-2">
          <label className="font-semibold text-slate-600">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-xs cursor-pointer"
          >
            <option value="popular">Featured</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="name_asc">Name: A to Z</option>
          </select>
        </div>
      </div>

      {/* ── Status View: Loading, Error, or Products Grid ─────────────────────── */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-10 h-10 border-3 border-primary-600/30 border-t-primary-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600">Loading supermarket catalog from server...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-center max-w-lg mx-auto space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
          <h3 className="font-bold text-base">Backend Connection Notice</h3>
          <p className="text-sm text-rose-600 leading-relaxed">{error}</p>
          <button
            onClick={loadProducts}
            className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 transition-colors shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry Request
          </button>
        </div>
      ) : sortedProducts.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-slate-100 shadow-xs">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No products found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {search ? `No items matching "${search}". Try searching for another item.` : 'The supermarket inventory is currently empty.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {sortedProducts.map((product) => {
            const isAdded = addedMap[product.id];
            const inStock = Number(product.stock_quantity) > 0;

            return (
              <div
                key={product.id}
                className="bg-white rounded-2xl border border-slate-100 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col group"
              >
                {/* Image / Thumbnail placeholder */}
                <Link
                  to={`/products/${product.id}`}
                  className="h-44 bg-slate-50 border-b border-slate-100 flex items-center justify-center p-4 relative overflow-hidden group-hover:bg-slate-100/50 transition-colors"
                >
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center font-bold text-2xl border border-primary-100">
                      {product.name.charAt(0)}
                    </div>
                  )}

                  {/* Category Pill */}
                  <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/90 text-slate-600 backdrop-blur-xs border border-slate-200">
                    {product.category || 'General'}
                  </span>

                  {/* Stock pill */}
                  <span
                    className={`absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      inStock
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {inStock ? `${product.stock_quantity} In Stock` : 'Out of Stock'}
                  </span>
                </Link>

                {/* Body */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm group-hover:text-primary-600 transition-colors line-clamp-1">
                      <Link to={`/products/${product.id}`}>{product.name}</Link>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5 font-mono">
                      SKU: {product.sku}
                    </p>
                    {product.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {product.description}
                      </p>
                    )}
                  </div>

                  {/* Price & Action */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Price</p>
                      <p className="text-lg font-black text-slate-900">
                        ₹{Number(product.price).toFixed(2)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleAddToCart(product)}
                        disabled={!inStock}
                        className={`px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                          isAdded
                            ? 'bg-emerald-600 text-white'
                            : inStock
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                        title="Add item to Cart"
                      >
                        {isAdded ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-white" />
                            <span className="hidden sm:inline">Added</span>
                          </>
                        ) : (
                          <>
                            <ShoppingCart className="w-3.5 h-3.5 text-slate-600" />
                            <span className="hidden sm:inline">Add</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleBuyNow(product)}
                        disabled={!inStock}
                        className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-xs ${
                          inStock
                            ? 'bg-red-600 hover:bg-red-700 text-white hover:scale-105 active:scale-95 shadow-red-600/20'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                        title="Buy Now and proceed directly to checkout"
                      >
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        <span>Buy Now</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
