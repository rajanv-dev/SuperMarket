import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

const FREE_DELIVERY_THRESHOLD = 500;
const STANDARD_DELIVERY_FEE = 40;

const useCartStore = create(
  persist(
    (set, get) => ({
      items: [], // Array of { product: { id, name, price, stock_quantity, image_url, category, sku }, qty: number }
      isLoading: false,
      coupon: null, // { code: string, discountPercent: number, discountAmount: number }

      // ── Add Item to Cart ──────────────────────────────────────────────────
      addItem: async (product, qty = 1) => {
        if (!product || !product.id) {
          return { success: false, error: 'Invalid product' };
        }

        const maxStock = Number(product.stock_quantity ?? 999);
        if (maxStock <= 0) {
          return { success: false, error: 'Product is currently out of stock' };
        }

        const currentItems = get().items;
        const existingIndex = currentItems.findIndex(
          (item) => String(item.product?.id) === String(product.id)
        );

        let updatedItems = [];
        let finalQty = qty;

        if (existingIndex > -1) {
          const currentQty = currentItems[existingIndex].qty;
          const desiredQty = currentQty + qty;

          if (desiredQty > maxStock) {
            return {
              success: false,
              error: `Only ${maxStock} unit${maxStock === 1 ? '' : 's'} available in stock. You already have ${currentQty} in your cart.`,
              maxStock,
              currentQty,
            };
          }

          finalQty = desiredQty;
          updatedItems = [...currentItems];
          updatedItems[existingIndex] = {
            ...updatedItems[existingIndex],
            qty: desiredQty,
            product: { ...updatedItems[existingIndex].product, ...product }, // refresh pricing/stock
          };
        } else {
          if (qty > maxStock) {
            return {
              success: false,
              error: `Only ${maxStock} unit${maxStock === 1 ? '' : 's'} available in stock.`,
              maxStock,
            };
          }

          updatedItems = [
            ...currentItems,
            {
              product: {
                id: product.id,
                name: product.name,
                price: Number(product.price) || 0,
                stock_quantity: maxStock,
                image_url: product.image_url,
                category: product.category,
                sku: product.sku,
                barcode: product.barcode,
              },
              qty,
              addedAt: new Date().toISOString(),
            },
          ];
        }

        set({ items: updatedItems });

        // Optional non-blocking server synchronization for authenticated users
        try {
          const rawAuth = localStorage.getItem('super-auth');
          if (rawAuth) {
            const { state } = JSON.parse(rawAuth);
            if (state?.token) {
              api.post('/cart/items', { productId: product.id, qty: finalQty }).catch(() => {});
            }
          }
        } catch {
          // Ignore sync failure — client cart remains reliable
        }

        return { success: true, qty: finalQty };
      },

      // ── Update Item Quantity ──────────────────────────────────────────────
      updateItemQty: (productId, desiredQty) => {
        const qtyNum = parseInt(desiredQty, 10);
        if (isNaN(qtyNum) || qtyNum <= 0) {
          get().removeItem(productId);
          return { success: true, removed: true };
        }

        const currentItems = get().items;
        const item = currentItems.find((i) => String(i.product?.id) === String(productId));
        if (!item) return { success: false, error: 'Item not in cart' };

        const maxStock = Number(item.product?.stock_quantity ?? 999);
        if (qtyNum > maxStock) {
          return {
            success: false,
            error: `Cannot exceed available stock of ${maxStock} units`,
            maxStock,
          };
        }

        const updatedItems = currentItems.map((i) =>
          String(i.product?.id) === String(productId) ? { ...i, qty: qtyNum } : i
        );

        set({ items: updatedItems });

        // Background server sync
        try {
          const rawAuth = localStorage.getItem('super-auth');
          if (rawAuth) {
            const { state } = JSON.parse(rawAuth);
            if (state?.token) {
              api.patch(`/cart/items/${productId}`, { qty: qtyNum }).catch(() => {});
            }
          }
        } catch {}

        return { success: true, qty: qtyNum };
      },

      // ── Remove Single Item ────────────────────────────────────────────────
      removeItem: (productId) => {
        const updatedItems = get().items.filter(
          (i) => String(i.product?.id) !== String(productId)
        );
        set({ items: updatedItems });

        try {
          const rawAuth = localStorage.getItem('super-auth');
          if (rawAuth) {
            const { state } = JSON.parse(rawAuth);
            if (state?.token) {
              api.delete(`/cart/items/${productId}`).catch(() => {});
            }
          }
        } catch {}
      },

      // ── Clear Entire Cart ─────────────────────────────────────────────────
      clearCart: () => {
        set({ items: [], coupon: null });
        try {
          const rawAuth = localStorage.getItem('super-auth');
          if (rawAuth) {
            const { state } = JSON.parse(rawAuth);
            if (state?.token) {
              api.delete('/cart').catch(() => {});
            }
          }
        } catch {}
      },

      // ── Apply Coupon Code ─────────────────────────────────────────────────
      applyCoupon: (code) => {
        const cleanCode = (code || '').trim().toUpperCase();
        if (!cleanCode) {
          set({ coupon: null });
          return { success: false, error: 'Please enter a valid coupon code' };
        }

        const subtotal = get().subtotal;
        if (subtotal <= 0) {
          return { success: false, error: 'Your cart is empty' };
        }

        if (cleanCode === 'SUPER10') {
          const discount = Math.round(subtotal * 0.1);
          const coupon = { code: 'SUPER10', discountPercent: 10, discountAmount: discount };
          set({ coupon });
          return { success: true, message: '10% discount applied!', coupon };
        }

        if (cleanCode === 'FREESHIP') {
          const coupon = { code: 'FREESHIP', discountPercent: 0, discountAmount: 0, freeShipping: true };
          set({ coupon });
          return { success: true, message: 'Free shipping applied!', coupon };
        }

        if (cleanCode === 'SUPER50' && subtotal >= 300) {
          const coupon = { code: 'SUPER50', discountPercent: 0, discountAmount: 50 };
          set({ coupon });
          return { success: true, message: '₹50 discount applied!', coupon };
        }

        return { success: false, error: 'Invalid or expired coupon code. Try SUPER10 or FREESHIP' };
      },

      removeCoupon: () => set({ coupon: null }),

      // ── Computed Getters ──────────────────────────────────────────────────
      get totalItems() {
        return (get().items || []).reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
      },

      get subtotal() {
        return (get().items || []).reduce(
          (sum, item) => sum + (Number(item.qty) || 0) * (Number(item.product?.price) || 0),
          0
        );
      },

      get deliveryFee() {
        const sub = get().subtotal;
        if (sub === 0) return 0;
        if (get().coupon?.freeShipping) return 0;
        return sub >= FREE_DELIVERY_THRESHOLD ? 0 : STANDARD_DELIVERY_FEE;
      },

      get discountAmount() {
        const coupon = get().coupon;
        if (!coupon) return 0;
        if (coupon.discountAmount) return coupon.discountAmount;
        if (coupon.discountPercent) {
          return Math.round((get().subtotal * coupon.discountPercent) / 100);
        }
        return 0;
      },

      get total() {
        const sub = get().subtotal;
        if (sub === 0) return 0;
        const discount = get().discountAmount;
        const delivery = get().deliveryFee;
        return Math.max(0, sub - discount + delivery);
      },

      get amountNeededForFreeDelivery() {
        const sub = get().subtotal;
        if (sub >= FREE_DELIVERY_THRESHOLD) return 0;
        return FREE_DELIVERY_THRESHOLD - sub;
      },
    }),
    {
      name: 'super-cart',
      partialize: (state) => ({ items: state.items, coupon: state.coupon }),
    }
  )
);

export default useCartStore;
