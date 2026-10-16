const express = require('express');
const { supabaseServer } = require('../../config/supabase');
const { sendSuccess, sendError } = require('../../utils/response');

const router = express.Router();

/**
 * POST /api/cart/validate
 * Validates a list of cart items against real database prices and stock quantities.
 * Ensures the client cannot forge prices or order unavailable products.
 */
router.post('/validate', async (req, res) => {
  try {
    if (!supabaseServer) {
      return sendError(res, { status: 503, message: 'Database service unavailable' });
    }

    const { items = [] } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return sendSuccess(res, {
        status: 200,
        data: {
          items: [],
          subtotal: 0,
          isValid: true,
          outOfStockItems: [],
          priceChangedItems: [],
        },
      });
    }

    const productIds = items
      .map((i) => i.productId || i.product?.id || i.id)
      .filter(Boolean);

    if (productIds.length === 0) {
      return sendError(res, { status: 400, message: 'No valid product IDs in cart' });
    }

    // Fetch live product records from Supabase
    const { data: dbProducts, error } = await supabaseServer
      .from('products')
      .select('id, name, sku, category, price, stock_quantity, image_url, is_active')
      .in('id', productIds);

    if (error) throw error;

    const dbProductMap = new Map();
    (dbProducts || []).forEach((p) => dbProductMap.set(p.id, p));

    const validatedItems = [];
    const outOfStockItems = [];
    const priceChangedItems = [];
    let subtotal = 0;

    for (const item of items) {
      const pid = item.productId || item.product?.id || item.id;
      const requestedQty = Math.max(1, parseInt(item.qty || item.quantity || 1, 10));
      const dbProduct = dbProductMap.get(pid);

      if (!dbProduct || !dbProduct.is_active) {
        outOfStockItems.push({
          productId: pid,
          name: item.product?.name || 'Product',
          reason: 'Product no longer available',
        });
        continue;
      }

      if (dbProduct.stock_quantity < requestedQty) {
        outOfStockItems.push({
          productId: pid,
          name: dbProduct.name,
          availableStock: dbProduct.stock_quantity,
          requestedQty,
          reason:
            dbProduct.stock_quantity <= 0
              ? 'Out of stock'
              : `Only ${dbProduct.stock_quantity} available`,
        });
      }

      const clientPrice = Number(item.product?.price || item.price || 0);
      const serverPrice = Number(dbProduct.price);

      if (Math.abs(clientPrice - serverPrice) > 0.01) {
        priceChangedItems.push({
          productId: pid,
          name: dbProduct.name,
          oldPrice: clientPrice,
          newPrice: serverPrice,
        });
      }

      const itemTotal = serverPrice * requestedQty;
      subtotal += itemTotal;

      validatedItems.push({
        product: {
          id: dbProduct.id,
          name: dbProduct.name,
          sku: dbProduct.sku,
          category: dbProduct.category,
          price: serverPrice,
          stock_quantity: dbProduct.stock_quantity,
          image_url: dbProduct.image_url,
          is_active: dbProduct.is_active,
        },
        qty: requestedQty,
        itemTotal,
      });
    }

    const isValid = outOfStockItems.length === 0;

    return sendSuccess(res, {
      status: 200,
      data: {
        items: validatedItems,
        subtotal: Math.round(subtotal * 100) / 100,
        isValid,
        outOfStockItems,
        priceChangedItems,
      },
    });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

/**
 * Standard cart sync stub endpoints so any client-side background sync does not error.
 */
router.get('/', (req, res) => {
  return sendSuccess(res, { status: 200, data: { items: [] } });
});

router.post('/items', (req, res) => {
  return sendSuccess(res, { status: 200, message: 'Item synced', data: { items: [] } });
});

router.patch('/items/:productId', (req, res) => {
  return sendSuccess(res, { status: 200, message: 'Item updated', data: { items: [] } });
});

router.delete('/items/:productId', (req, res) => {
  return sendSuccess(res, { status: 200, message: 'Item removed', data: { items: [] } });
});

router.delete('/', (req, res) => {
  return sendSuccess(res, { status: 200, message: 'Cart cleared', data: { items: [] } });
});

module.exports = router;
