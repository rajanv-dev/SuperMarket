import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  Truck,
  CreditCard,
  Banknote,
  QrCode,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  ShoppingCart,
  User,
  MapPin,
  Phone,
  Mail,
  Lock,
  Plus,
  Minus,
  Zap,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useCartStore from '../../store/cartStore';
import { orderService } from '../../services';
import DeliveryLocationMap from '../../components/checkout/DeliveryLocationMap';
import toast from 'react-hot-toast';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isBuyNow = searchParams.get('mode') === 'buynow';

  const { user } = useAuthStore();
  const {
    items,
    clearCart,
    coupon,
    buyNowItem,
    updateBuyNowQty,
    clearBuyNowItem,
  } = useCartStore();

  // Active items for this checkout session
  const checkoutItems = isBuyNow && buyNowItem ? [buyNowItem] : items;

  // Contact info
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    notes: '',
  });

  // Delivery address & Google Maps state
  const [deliveryData, setDeliveryData] = useState({
    formattedAddress: '',
    houseNo: '',
    street: '',
    area: '',
    city: '',
    postalCode: '',
    deliveryNotes: '',
    latitude: null,
    longitude: null,
  });
  const [isAddressConfirmed, setIsAddressConfirmed] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState('cod'); // 'cod' | 'upi' | 'card'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Sync user info if user logs in during session
  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        name: prev.name || user.name || user.email?.split('@')[0] || '',
        email: prev.email || user.email || '',
      }));
    }
  }, [user]);

  // If no items in checkout session, redirect appropriately
  useEffect(() => {
    if (checkoutItems.length === 0) {
      if (isBuyNow) {
        navigate('/products');
      } else {
        navigate('/cart');
      }
    }
  }, [checkoutItems, isBuyNow, navigate]);

  // Calculations
  const subtotal = checkoutItems.reduce(
    (sum, item) => sum + (Number(item.qty) || 0) * (Number(item.product?.price) || 0),
    0
  );
  const isFreeDelivery = subtotal >= 500 || coupon?.freeShipping;
  const deliveryFee = subtotal === 0 ? 0 : isFreeDelivery ? 0 : 40;

  let discountAmount = 0;
  if (!isBuyNow && coupon) {
    if (coupon.discountAmount) discountAmount = coupon.discountAmount;
    else if (coupon.discountPercent) {
      discountAmount = Math.round((subtotal * coupon.discountPercent) / 100);
    }
  }

  const total = Math.max(0, subtotal - discountAmount + deliveryFee);

  const handleContactChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDeliverySelect = (data) => {
    setDeliveryData((prev) => ({
      ...prev,
      ...data,
    }));
  };

  // Submit Order
  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      toast.error('Please enter your full name');
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    if (!formData.phone.trim()) {
      toast.error('Please enter your phone number');
      return;
    }

    // Require address confirmation or at least minimal address fields
    if (!deliveryData.houseNo && !deliveryData.formattedAddress) {
      toast.error('Please specify your Flat / House number and complete address');
      return;
    }
    if (!deliveryData.city) {
      toast.error('Please specify your delivery City');
      return;
    }
    if (!deliveryData.postalCode) {
      toast.error('Please specify your PIN code');
      return;
    }

    try {
      setIsSubmitting(true);

      const orderPayload = {
        items: checkoutItems.map((i) => ({
          productId: i.product?.id,
          qty: i.qty,
          price: i.product?.price,
        })),
        customerName: formData.name.trim(),
        customerEmail: formData.email.trim(),
        customerPhone: formData.phone.trim(),
        deliveryAddress: deliveryData.formattedAddress,
        houseNo: deliveryData.houseNo,
        street: deliveryData.street,
        area: deliveryData.area,
        city: deliveryData.city,
        pincode: deliveryData.postalCode,
        postalCode: deliveryData.postalCode,
        latitude: deliveryData.latitude,
        longitude: deliveryData.longitude,
        deliveryNotes: deliveryData.deliveryNotes || formData.notes,
        paymentMethod,
        notes: deliveryData.deliveryNotes || formData.notes || undefined,
      };

      const res = await orderService.create(orderPayload);
      const created = res.data?.data;

      // Clear the respective checkout source
      if (isBuyNow) {
        clearBuyNowItem();
      } else {
        clearCart();
      }

      toast.success(`Order placed successfully! Ref: ${created.orderNumber}`);

      if (created.orderId) {
        navigate(`/orders/${created.orderId}`);
      } else {
        navigate('/orders');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      const msg = err.response?.data?.message || err.userMessage || 'Failed to place order';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ── Top Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Checkout & Delivery
            </h1>
            {isBuyNow && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                <Zap className="w-3.5 h-3.5 fill-amber-500 text-amber-600" />
                Buy Now Mode
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Pin your delivery location on Google Maps and select payment to complete your order.
          </p>
        </div>

        <Link
          to={isBuyNow ? '/products' : '/cart'}
          className="text-xs font-bold text-slate-600 hover:text-primary-600 flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          {isBuyNow ? 'Back to Catalog' : 'Back to Cart'}
        </Link>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-3 text-xs font-semibold">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Main Layout ─────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left 2 Columns: Contact, Maps Address, & Payment */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Contact Information */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                1
              </div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-600" /> Contact Details
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Full Name *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleContactChange}
                    placeholder="e.g. Arun Kumar"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Email Address *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleContactChange}
                    placeholder="e.g. arun@example.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Phone Number *</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    name="phone"
                    required
                    value={formData.phone}
                    onChange={handleContactChange}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 2. Google Maps Delivery Location Selection */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-600" /> Delivery Location & Map
                </h2>
              </div>

              {isAddressConfirmed && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" /> Location Confirmed
                </span>
              )}
            </div>

            <DeliveryLocationMap
              initialCity={deliveryData.city}
              initialPincode={deliveryData.postalCode}
              onAddressSelect={handleDeliverySelect}
              isConfirmed={isAddressConfirmed}
              onConfirmChange={setIsAddressConfirmed}
            />
          </div>

          {/* 3. Payment Method */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                3
              </div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" /> Payment Option
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Cash On Delivery */}
              <label
                className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 cursor-pointer transition-all ${
                  paymentMethod === 'cod'
                    ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Banknote className="w-5 h-5 text-emerald-600" />
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cod"
                    checked={paymentMethod === 'cod'}
                    onChange={() => setPaymentMethod('cod')}
                    className="accent-primary-600"
                  />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Cash on Delivery</p>
                  <p className="text-[11px] text-slate-500">Pay cash or UPI at delivery</p>
                </div>
              </label>

              {/* UPI */}
              <label
                className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 cursor-pointer transition-all ${
                  paymentMethod === 'upi'
                    ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <QrCode className="w-5 h-5 text-primary-600" />
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="upi"
                    checked={paymentMethod === 'upi'}
                    onChange={() => setPaymentMethod('upi')}
                    className="accent-primary-600"
                  />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">UPI / QR Code</p>
                  <p className="text-[11px] text-slate-500">GPay, PhonePe, Paytm</p>
                </div>
              </label>

              {/* Card */}
              <label
                className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 cursor-pointer transition-all ${
                  paymentMethod === 'card'
                    ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <CreditCard className="w-5 h-5 text-indigo-600" />
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="card"
                    checked={paymentMethod === 'card'}
                    onChange={() => setPaymentMethod('card')}
                    className="accent-primary-600"
                  />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Credit / Debit Card</p>
                  <p className="text-[11px] text-slate-500">Visa, Mastercard, RuPay</p>
                </div>
              </label>
            </div>

            <p className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Secure checkout. Real-time inventory deduction and order tracking.</span>
            </p>
          </div>
        </div>

        {/* Right Column: Order Review, Quantity Adjuster & Summary */}
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-5 sticky top-24">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                Order Review ({checkoutItems.length} {checkoutItems.length === 1 ? 'item' : 'items'})
              </h2>
              {isBuyNow && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  Instant Checkout
                </span>
              )}
            </div>

            {/* Items List with Quantity Controls for Buy Now */}
            <div className="space-y-3">
              {checkoutItems.map((item) => (
                <div
                  key={item.product?.id}
                  className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900 truncate max-w-[180px]">
                      {item.product?.name}
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      ₹{(Number(item.product?.price || 0) * item.qty).toFixed(2)}
                    </span>
                  </div>

                  {/* Quantity selector */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center border border-slate-200 rounded-xl bg-white p-0.5 shadow-2xs">
                      {isBuyNow ? (
                        <>
                          <button
                            type="button"
                            onClick={() => updateBuyNowQty(item.qty - 1)}
                            disabled={item.qty <= 1}
                            className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 disabled:opacity-30"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-8 text-center text-xs font-bold text-slate-800 font-mono">
                            {item.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateBuyNowQty(item.qty + 1)}
                            disabled={item.qty >= Number(item.product?.stock_quantity ?? 999)}
                            className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 disabled:opacity-30"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </>
                      ) : (
                        <span className="px-2 py-0.5 text-xs font-semibold text-slate-600">
                          Qty: {item.qty}
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] text-slate-500 font-mono">
                      @ ₹{Number(item.product?.price || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Confirmed Delivery Location Badge in Review */}
            {deliveryData.formattedAddress && (
              <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-[11px] uppercase tracking-wider">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Delivery Destination</span>
                </div>
                <p className="text-slate-800 font-medium line-clamp-2">
                  {deliveryData.formattedAddress}
                </p>
                {deliveryData.latitude && deliveryData.longitude && (
                  <p className="text-[10px] text-emerald-700 font-mono">
                    GPS: {deliveryData.latitude.toFixed(5)}, {deliveryData.longitude.toFixed(5)}
                  </p>
                )}
              </div>
            )}

            {/* Calculations Breakdown */}
            <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-bold text-slate-900 font-mono">₹{subtotal.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>Delivery Charge</span>
                <span className={`font-bold font-mono ${isFreeDelivery ? 'text-emerald-600' : 'text-slate-900'}`}>
                  {isFreeDelivery ? 'FREE' : `₹${deliveryFee.toFixed(2)}`}
                </span>
              </div>

              {discountAmount > 0 && (
                <div className="flex items-center justify-between text-emerald-600 font-bold">
                  <span>Coupon ({coupon?.code})</span>
                  <span className="font-mono">-₹{discountAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-baseline justify-between">
                <div>
                  <span className="text-sm font-extrabold text-slate-900">Total Payable</span>
                  <p className="text-[10px] text-slate-400">All taxes included</p>
                </div>
                <span className="text-2xl font-black text-slate-900 font-mono">
                  ₹{total.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99]"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Placing Order...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Place Order • ₹{total.toFixed(2)}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
