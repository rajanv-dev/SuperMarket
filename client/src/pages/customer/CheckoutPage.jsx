import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useCartStore from '../../store/cartStore';
import { orderService } from '../../services';
import toast from 'react-hot-toast';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { items, clearCart, coupon } = useCartStore();

  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    address: '',
    city: '',
    pincode: '',
    notes: '',
  });

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

  // If cart is empty, redirect to /cart
  useEffect(() => {
    if (items.length === 0) {
      navigate('/cart');
    }
  }, [items, navigate]);

  const subtotal = items.reduce(
    (sum, item) => sum + (Number(item.qty) || 0) * (Number(item.product?.price) || 0),
    0
  );
  const isFreeDelivery = subtotal >= 500 || coupon?.freeShipping;
  const deliveryFee = subtotal === 0 ? 0 : isFreeDelivery ? 0 : 40;

  let discountAmount = 0;
  if (coupon) {
    if (coupon.discountAmount) discountAmount = coupon.discountAmount;
    else if (coupon.discountPercent) {
      discountAmount = Math.round((subtotal * coupon.discountPercent) / 100);
    }
  }

  const total = Math.max(0, subtotal - discountAmount + deliveryFee);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

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
      toast.error('Please enter your 10-digit phone number');
      return;
    }
    if (!formData.address.trim() || !formData.city.trim()) {
      toast.error('Please enter your complete delivery address and city');
      return;
    }

    try {
      setIsSubmitting(true);

      const orderPayload = {
        items: items.map((i) => ({
          productId: i.product?.id,
          qty: i.qty,
          price: i.product?.price,
        })),
        customerName: formData.name.trim(),
        customerEmail: formData.email.trim(),
        customerPhone: formData.phone.trim(),
        deliveryAddress: formData.address.trim(),
        city: formData.city.trim(),
        pincode: formData.pincode.trim(),
        paymentMethod,
        notes: formData.notes.trim() || undefined,
      };

      const res = await orderService.create(orderPayload);
      const created = res.data?.data;

      clearCart();
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
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Checkout & Delivery
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Enter your delivery address and choose your preferred payment option
          </p>
        </div>

        <Link
          to="/cart"
          className="text-xs font-bold text-slate-600 hover:text-primary-600 flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Cart
        </Link>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-3 text-xs font-semibold">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Main Two-Column Layout ────────────────────────────────────────────── */}
      <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left 2 Columns: Address & Payment Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Step 1: Contact & Delivery Address */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                1
              </div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600" /> Delivery Address
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Full Name *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                    onChange={handleChange}
                    placeholder="e.g. 9876543210"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">Email Address *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="e.g. rahul@example.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Street Address & House / Flat # *
                </label>
                <textarea
                  name="address"
                  required
                  rows="2"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="e.g. Flat 302, Green Valley Apartments, MG Road"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">City / Town *</label>
                <input
                  type="text"
                  name="city"
                  required
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="e.g. Bangalore"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Postal PIN Code *</label>
                <input
                  type="text"
                  name="pincode"
                  required
                  value={formData.pincode}
                  onChange={handleChange}
                  placeholder="e.g. 560001"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Delivery Notes / Landmarks (Optional)
                </label>
                <input
                  type="text"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="e.g. Near HDFC Bank ATM, please call on arrival"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Step 2: Payment Method */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                2
              </div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" /> Payment Option
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Cash on Delivery */}
              <label
                className={`p-4 rounded-xl border flex flex-col justify-between gap-3 cursor-pointer transition-all ${
                  paymentMethod === 'cod'
                    ? 'border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-500/20'
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
                  <p className="text-[11px] text-slate-500">Pay when order arrives</p>
                </div>
              </label>

              {/* UPI (Simulated / Instant) */}
              <label
                className={`p-4 rounded-xl border flex flex-col justify-between gap-3 cursor-pointer transition-all ${
                  paymentMethod === 'upi'
                    ? 'border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-500/20'
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

              {/* Card Payment (Simulated) */}
              <label
                className={`p-4 rounded-xl border flex flex-col justify-between gap-3 cursor-pointer transition-all ${
                  paymentMethod === 'card'
                    ? 'border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-500/20'
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
              <span>Simulated e-commerce checkout. No real money or card numbers are collected.</span>
            </p>
          </div>
        </div>

        {/* Right Column: Order Review & Confirmation */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-5 sticky top-24">
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight pb-3 border-b border-slate-100">
              Order Review ({items.length} items)
            </h2>

            {/* Items Mini-List */}
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 space-y-2 pr-1 scrollbar-thin">
              {items.map((item) => (
                <div key={item.product?.id} className="pt-2 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 truncate max-w-48">
                    <span className="font-bold text-slate-900">{item.qty}x</span>
                    <span className="truncate text-slate-700">{item.product?.name}</span>
                  </div>
                  <span className="font-bold text-slate-900 font-mono">
                    ₹{(Number(item.product?.price || 0) * item.qty).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Calculations */}
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
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
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
