import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { cartService } from '../services';

const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],        // [{ product, qty, priceAtAdd }]
      isLoading: false,
      error: null,

      // ── Fetch cart from server (for logged-in users) ──────────────────────
      fetchCart: async () => {
        set({ isLoading: true });
        try {
          const res = await cartService.get();
          set({ items: res.data.data.items || [], isLoading: false });
        } catch {
          set({ isLoading: false });
        }
      },

      addItem: async (productId, qty = 1) => {
        set({ isLoading: true, error: null });
        try {
          const res = await cartService.addItem({ productId, qty });
          set({ items: res.data.data.items, isLoading: false });
          return { success: true };
        } catch (err) {
          const error = err.userMessage || 'Could not add to cart';
          set({ isLoading: false, error });
          return { success: false, error };
        }
      },

      updateItem: async (productId, qty) => {
        set({ isLoading: true });
        try {
          const res = await cartService.updateItem(productId, { qty });
          set({ items: res.data.data.items, isLoading: false });
        } catch (err) {
          set({ isLoading: false, error: err.userMessage });
        }
      },

      removeItem: async (productId) => {
        set({ isLoading: true });
        try {
          const res = await cartService.removeItem(productId);
          set({ items: res.data.data.items, isLoading: false });
        } catch (err) {
          set({ isLoading: false, error: err.userMessage });
        }
      },

      clearCart: () => set({ items: [] }),

      // ── Computed getters ──────────────────────────────────────────────────
      get totalItems() {
        return get().items.reduce((sum, i) => sum + i.qty, 0);
      },
      get subtotal() {
        return get().items.reduce((sum, i) => sum + i.qty * (i.product?.basePrice || 0), 0);
      },
    }),
    {
      name: 'super-cart',
      partialize: (state) => ({ items: state.items }),
    }
  )
);

export default useCartStore;
