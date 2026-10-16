import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ArrowLeft,
  Truck,
  ShieldCheck,
  Tag,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import useCartStore from '../../store/cartStore';
import toast from 'react-hot-toast';

export default function CartPage() {
  const navigate = useNavigate();
  const {
    items,
    updateItemQty,
    removeItem,
    clearCart,
    applyCoupon,
    removeCoupon,
    coupon,
  } = useCartStore();

  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState('');

  // Computed values
  const totalItems = items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  const subtotal = items.reduce(
    (sum, item) => sum + (Number(item.qty) || 0) * (Number(item.product?.price) || 0),
    0
  );

  const isFreeDelivery = subtotal >= 500 || coupon?.freeShipping;
  const deliveryFee = subtotal === 0 ? 0 : isFreeDelivery ? 0 : 40;
  const freeDeliveryShortfall = Math.max(0, 500 - subtotal);
  const deliveryProgress = Math.min(100, Math.round((subtotal / 500) * 100));

  let discountAmount = 0;
  if (coupon) {
    if (coupon.discountAmount) discountAmount = coupon.discountAmount;
    else if (coupon.discountPercent) {
      discountAmount = Math.round((subtotal * coupon.discountPercent) / 100);
    }
  }

  const finalTotal = Math.max(0, subtotal - discountAmount + deliveryFee);

  const handleApplyCoupon = (e) => {
    e.preventDefault();
    setCouponError('');
    if (!couponCode.trim()) {
      setCouponError('Please enter a coupon code');
      return;
    }
    const res = applyCoupon(couponCode);
    if (res.success) {
      toast.success(res.message);
      setCouponCode('');
    } else {
      setCouponError(res.error);
      toast.error(res.error);
    }
  };

  const handleRemoveCoupon = () => {
    removeCoupon();
    toast.success('Coupon removed');
  };

  const handleIncreaseQty = (item) => {
    const max = Number(item.product?.stock_quantity ?? 999);
    if (item.qty >= max) {
      toast.error(`Only ${max} units available in stock`);
      return;
    }
    updateItemQty(item.product.id, item.qty + 1);
  };

  const handleDecreaseQty = (item) => {
    if (item.qty <= 1) {
      handleRemoveItem(item);
    } else {
      updateItemQty(item.product.id, item.qty - 1);
    }
  };

  const handleRemoveItem = (item) => {
    removeItem(item.product.id);
    toast.success(`Removed ${item.product.name} from cart`);
  };

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-3xl p-10 border border-slate-200/80 shadow-xs space-y-6">
          <div className="w-24 h-24 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ShoppingCart className="w-12 h-12" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-slate-900">Your Shopping Cart is Empty</h1>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Explore our fresh supermarket catalog for groceries, fresh vegetables, daily dairy, and bakery items!
            </p>
          </div>
          <div className="pt-2">
            <Link
              to="/products"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-sm shadow-md transition-all hover:scale-105 active:scale-95"
            >
              Start Shopping <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* ── Page Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Shopping Cart</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-200">
              {totalItems} item{totalItems === 1 ? '' : 's'}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Review your grocery items, choose delivery, and proceed to checkout
          </p>
        </div>

        <button
          onClick={clearCart}
          className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Trash2 className="w-3.5 h-3.5" /> Clear All Items
        </button>
      </div>

      {/* ── Free Delivery Progress Bar ────────────────────────────────────────── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between text-xs mb-2">
          <div className="flex items-center gap-2 font-bold text-slate-700">
            <Truck className="w-4 h-4 text-emerald-600" />
            {isFreeDelivery ? (
              <span className="text-emerald-700">Congratulations! You unlocked FREE Supermarket Delivery!</span>
            ) : (
              <span>Add ₹{freeDeliveryShortfall.toFixed(2)} more to unlock FREE Delivery</span>
            )}
          </div>
          <span className="font-bold text-slate-500">
            {isFreeDelivery ? '100%' : `${deliveryProgress}%`}
          </span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-emerald-500 to-primary-600 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${deliveryProgress}%` }}
          />
        </div>
      </div>

      {/* ── Main Two-Column Layout ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column: Cart Items List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs divide-y divide-slate-100 overflow-hidden">
            {items.map((item) => {
              const maxStock = Number(item.product?.stock_quantity ?? 999);
              const isMaxStock = item.qty >= maxStock;
              const unitPrice = Number(item.product?.price || 0);
              const itemTotal = unitPrice * item.qty;

              return (
                <div
                  key={item.product?.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
                >
                  {/* Product Thumbnail & Details */}
                  <div className="flex items-center gap-4 flex-1">
                    <Link
                      to={`/products/${item.product?.id}`}
                      className="w-20 h-20 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center p-2 shrink-0 overflow-hidden hover:opacity-90"
                    >
                      {item.product?.image_url ? (
                        <img
                          src={item.product.image_url}
                          alt={item.product.name}
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-primary-100 text-primary-700 font-bold flex items-center justify-center">
                          {item.product?.name?.charAt(0) || 'P'}
                        </div>
                      )}
                    </Link>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {item.product?.category || 'Grocery'}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 hover:text-primary-600 transition-colors line-clamp-1">
                        <Link to={`/products/${item.product?.id}`}>{item.product?.name}</Link>
                      </h3>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-slate-900">₹{unitPrice.toFixed(2)}</span>
                        <span className="text-slate-400">/ unit</span>
                      </div>
                      <p className="text-[11px] font-medium text-emerald-600">
                        {maxStock > 10 ? 'In Stock' : `Only ${maxStock} left in stock`}
                      </p>
                    </div>
                  </div>

                  {/* Quantity Stepper & Price Calculation */}
                  <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-0 border-slate-100">
                    {/* Stepper */}
                    <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 p-1">
                      <button
                        onClick={() => handleDecreaseQty(item)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-white hover:bg-slate-100 text-slate-700 shadow-xs transition-colors"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-9 text-center font-bold text-xs text-slate-900 font-mono">
                        {item.qty}
                      </span>
                      <button
                        onClick={() => handleIncreaseQty(item)}
                        disabled={isMaxStock}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-white hover:bg-slate-100 text-slate-700 shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Line Total */}
                    <div className="text-right min-w-20">
                      <span className="text-sm font-black text-slate-900 block font-mono">
                        ₹{itemTotal.toFixed(2)}
                      </span>
                    </div>

                    {/* Trash Button */}
                    <button
                      onClick={() => handleRemoveItem(item)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Remove product"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Continue Shopping Link */}
          <div className="pt-2">
            <Link
              to="/products"
              className="inline-flex items-center gap-2 text-xs font-bold text-primary-600 hover:text-primary-700"
            >
              <ArrowLeft className="w-4 h-4" /> Continue Shopping for Groceries
            </Link>
          </div>
        </div>

        {/* Right Column: Order Summary Card */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-5 sticky top-24">
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight pb-3 border-b border-slate-100">
              Order Summary
            </h2>

            {/* Price Breakdown */}
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Items Subtotal ({totalItems} items)</span>
                <span className="font-bold text-slate-900 font-mono">₹{subtotal.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-1">
                  Delivery Charges
                  {isFreeDelivery && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                      FREE
                    </span>
                  )}
                </span>
                <span className={`font-bold font-mono ${isFreeDelivery ? 'text-emerald-600' : 'text-slate-900'}`}>
                  {isFreeDelivery ? '₹0.00' : `₹${deliveryFee.toFixed(2)}`}
                </span>
              </div>

              {discountAmount > 0 && (
                <div className="flex items-center justify-between text-emerald-600 font-bold">
                  <span>Coupon Discount ({coupon?.code})</span>
                  <span className="font-mono">-₹{discountAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-baseline justify-between">
                <div>
                  <span className="text-sm font-extrabold text-slate-900">Total Payable</span>
                  <p className="text-[10px] text-slate-400">Inclusive of all local taxes</p>
                </div>
                <span className="text-xl font-black text-slate-900 font-mono">
                  ₹{finalTotal.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Coupon Code Section */}
            <div className="pt-2 border-t border-slate-100">
              {coupon ? (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <div>
                      <p className="text-xs font-bold text-emerald-900">{coupon.code} Applied</p>
                      <p className="text-[11px] text-emerald-700">
                        {coupon.freeShipping ? 'Free shipping unlocked' : `Saved ₹${discountAmount.toFixed(2)}`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleRemoveCoupon}
                    className="text-xs font-bold text-rose-600 hover:text-rose-700"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyCoupon} className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Have a coupon code?
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="e.g. SUPER10 or FREESHIP"
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs uppercase font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                    >
                      Apply
                    </button>
                  </div>
                  {couponError && <p className="text-[11px] text-rose-600 font-medium">{couponError}</p>}
                </form>
              )}
            </div>

            {/* Checkout Action Button */}
            <div className="pt-2 space-y-3">
              <button
                onClick={() => navigate('/checkout')}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-center gap-2 text-[11px] font-medium text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>100% Secure Checkout & Fresh Guarantee</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
