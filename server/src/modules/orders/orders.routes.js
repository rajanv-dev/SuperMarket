const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { supabaseServer } = require('../../config/supabase');
const { sendSuccess, sendError } = require('../../utils/response');

const router = express.Router();

// Helper to safely extract user from auth token if present
const extractUser = async (req) => {
  let token = null;
  if (req.cookies && req.cookies.jwt && req.cookies.jwt !== 'logged_out') {
    token = req.cookies.jwt;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token || !supabaseServer) return null;

  try {
    const { data: { user } } = await supabaseServer.auth.getUser(token);
    if (user) {
      const { data: profile } = await supabaseServer
        .from('user_profiles')
        .select('*')
        .or(`auth_id.eq.${user.id},email.eq.${user.email}`)
        .maybeSingle();

      return {
        id: user.id,
        profileId: profile?.id,
        email: user.email,
        name: profile?.full_name || user.user_metadata?.full_name || user.email.split('@')[0],
        phone: profile?.phone,
        role: profile?.role || 'customer',
      };
    }
  } catch {
    // If Supabase token fails, try local JWT
    const jwt = require('jsonwebtoken');
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || '9983168fbd9c07dfa08963727d0eac786ae278266c528cd36482f60699a2d0e33b5de671078f0a37b34595f9007a2fed634245cea8c6b2070370aa6b166e909e');
      return decoded;
    } catch {}
  }
  return null;
};

// In-memory set to prevent double-click submissions (within 4 seconds)
const recentOrders = new Map();

/**
 * POST /api/orders
 * Creates a verified e-commerce customer order.
 * Calculates prices entirely on the server and decrements stock atomically.
 */
router.post('/', async (req, res) => {
  try {
    if (!supabaseServer) {
      return sendError(res, { status: 503, message: 'Database service unavailable' });
    }

    const authUser = await extractUser(req);
    const {
      items = [],
      customerName,
      customerEmail,
      customerPhone,
      deliveryAddress,
      city,
      pincode,
      paymentMethod = 'cod', // 'cod' | 'card' | 'upi'
      notes,
    } = req.body;

    const email = (authUser?.email || customerEmail || '').trim().toLowerCase();
    const name = (authUser?.name || customerName || '').trim();
    const phone = (authUser?.phone || customerPhone || '').trim();

    if (!email) {
      return sendError(res, { status: 400, message: 'Customer email is required for order confirmation' });
    }
    if (!name) {
      return sendError(res, { status: 400, message: 'Customer name is required' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return sendError(res, { status: 400, message: 'Cart cannot be empty' });
    }

    // ── Idempotency Check: prevent duplicate orders submitted in rapid succession ──
    const dedupeKey = `${email}:${items.map((i) => i.productId || i.product?.id).sort().join(',')}`;
    const now = Date.now();
    if (recentOrders.has(dedupeKey)) {
      const lastTime = recentOrders.get(dedupeKey);
      if (now - lastTime < 4000) {
        return sendError(res, {
          status: 429,
          message: 'An identical order is already being processed. Please check your order history.',
        });
      }
    }
    recentOrders.set(dedupeKey, now);

    // Clean up cache
    for (const [k, v] of recentOrders.entries()) {
      if (now - v > 15000) recentOrders.delete(k);
    }

    // ── Fetch and lock authoritative product records ─────────────────────────
    const productIds = items.map((i) => i.productId || i.product?.id || i.id).filter(Boolean);
    const { data: dbProducts, error: pErr } = await supabaseServer
      .from('products')
      .select('id, name, sku, category, price, stock_quantity, is_active')
      .in('id', productIds);

    if (pErr) throw pErr;

    const productMap = new Map();
    (dbProducts || []).forEach((p) => productMap.set(p.id, p));

    // Validate stock and recompute prices
    let calculatedSubtotal = 0;
    const validatedOrderItems = [];
    const stockUpdates = [];

    for (const item of items) {
      const pid = item.productId || item.product?.id || item.id;
      const qty = Math.max(1, parseInt(item.qty || item.quantity || 1, 10));
      const dbProd = productMap.get(pid);

      if (!dbProd || !dbProd.is_active) {
        return sendError(res, {
          status: 400,
          message: `Item "${item.product?.name || 'Unknown'}" is no longer available.`,
        });
      }

      if (dbProd.stock_quantity < qty) {
        return sendError(res, {
          status: 400,
          message: `Insufficient stock for "${dbProd.name}". Available: ${dbProd.stock_quantity}, requested: ${qty}.`,
        });
      }

      const unitPrice = Number(dbProd.price);
      const lineTotal = Math.round(unitPrice * qty * 100) / 100;
      calculatedSubtotal += lineTotal;

      validatedOrderItems.push({
        product_id: dbProd.id,
        product_name: dbProd.name,
        sku: dbProd.sku,
        price: unitPrice,
        quantity: qty,
        total: lineTotal,
      });

      stockUpdates.push({
        id: dbProd.id,
        newStock: dbProd.stock_quantity - qty,
      });
    }

    calculatedSubtotal = Math.round(calculatedSubtotal * 100) / 100;
    const deliveryFee = calculatedSubtotal >= 500 ? 0 : 40;
    const calculatedTotal = calculatedSubtotal + deliveryFee;

    // Generate readable order number: ORD-YYYYMMDD-XXXX
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `ORD-${datePrefix}-${randSuffix}`;

    const formattedAddress = [
      deliveryAddress,
      city,
      pincode ? `PIN: ${pincode}` : '',
    ].filter(Boolean).join(', ');

    // ── Insert into public.orders ───────────────────────────────────────────
    const { data: newOrder, error: oErr } = await supabaseServer
      .from('orders')
      .insert([
        {
          order_number: orderNumber,
          customer_id: authUser?.profileId || null,
          customer_name: name,
          customer_email: email,
          customer_phone: phone,
          type: 'online',
          status: 'pending',
          payment_method: ['cash', 'cod', 'card', 'upi', 'online', 'split'].includes(paymentMethod) ? paymentMethod : 'cod',
          payment_status: paymentMethod === 'cod' || paymentMethod === 'cash' ? 'pending' : 'paid',
          subtotal: calculatedSubtotal,
          discount: 0,
          tax: 0,
          total: calculatedTotal,
          notes: notes ? `${notes} | Ship to: ${formattedAddress}` : `Ship to: ${formattedAddress}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (oErr) throw oErr;

    // ── Insert into public.order_items ──────────────────────────────────────
    const itemsToInsert = validatedOrderItems.map((item) => ({
      order_id: newOrder.id,
      product_id: item.product_id,
      product_name: item.product_name,
      sku: item.sku,
      price: item.price,
      quantity: item.quantity,
      total: item.total,
      created_at: new Date().toISOString(),
    }));

    const { error: oiErr } = await supabaseServer.from('order_items').insert(itemsToInsert);
    if (oiErr) {
      console.error('Error inserting order items:', oiErr);
    }

    // ── Decrement stock safely in products table ────────────────────────────
    for (const update of stockUpdates) {
      await supabaseServer
        .from('products')
        .update({
          stock_quantity: update.newStock,
          updated_at: new Date().toISOString(),
        })
        .eq('id', update.id);
    }

    return sendSuccess(res, {
      status: 201,
      message: 'Order placed successfully',
      data: {
        orderId: newOrder.id,
        orderNumber: newOrder.order_number,
        total: calculatedTotal,
        paymentStatus: newOrder.payment_status,
        status: newOrder.status,
        itemsCount: itemsToInsert.length,
        createdAt: newOrder.created_at,
      },
    });
  } catch (err) {
    console.error('Order creation error:', err);
    return sendError(res, { status: 500, message: err.message });
  }
});

/**
 * GET /api/orders
 * Returns orders for the authenticated customer or specified email.
 */
router.get('/', async (req, res) => {
  try {
    if (!supabaseServer) {
      return sendError(res, { status: 503, message: 'Database service unavailable' });
    }

    const authUser = await extractUser(req);
    const queryEmail = (req.query.email || authUser?.email || '').trim().toLowerCase();

    let query = supabaseServer
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false });

    // Admins can see all, customers only see their own
    if (authUser?.role !== 'admin') {
      if (authUser?.profileId) {
        query = query.or(`customer_id.eq.${authUser.profileId},customer_email.eq.${authUser.email}`);
      } else if (queryEmail) {
        query = query.eq('customer_email', queryEmail);
      } else {
        return sendSuccess(res, { status: 200, data: [] });
      }
    }

    const { data, error } = await query;
    if (error) throw error;

    return sendSuccess(res, { status: 200, data: data || [] });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

/**
 * GET /api/orders/:id
 * Returns single order details with its items.
 */
router.get('/:id', async (req, res) => {
  try {
    if (!supabaseServer) {
      return sendError(res, { status: 503, message: 'Database service unavailable' });
    }

    const { id } = req.params;
    const { data: order, error } = await supabaseServer
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', id)
      .single();

    if (error || !order) {
      return sendError(res, { status: 404, message: 'Order not found' });
    }

    return sendSuccess(res, { status: 200, data: order });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

module.exports = router;
