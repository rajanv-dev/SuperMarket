const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { supabaseServer } = require('../../config/supabase');
const { sendSuccess, sendError } = require('../../utils/response');
const { sendOrderConfirmationWebhook, logNotificationStatus } = require('../../services/n8nWebhookService');
const { normalizePhoneNumber, maskPhoneNumber } = require('../../utils/phone');
const logger = require('../../utils/logger');

const router = express.Router();

// Helper to safely extract user from auth token if present
const extractUser = async (req) => {
  let token = null;
  if (req.cookies && req.cookies.jwt && req.cookies.jwt !== 'logged_out') {
    token = req.cookies.jwt;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) return null;

  // 1. Try verifying with Supabase Auth
  if (supabaseServer) {
    try {
      const { data: { user }, error: sbErr } = await supabaseServer.auth.getUser(token);
      if (user && !sbErr) {
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
    } catch {}
  }

  // 2. Fall back to local JWT
  try {
    const jwt = require('jsonwebtoken');
    const secret =
      process.env.JWT_SECRET ||
      '9983168fbd9c07dfa08963727d0eac786ae278266c528cd36482f60699a2d0e33b5de671078f0a37b34595f9007a2fed634245cea8c6b2070370aa6b166e909e';
    const decoded = jwt.verify(token, secret);
    if (decoded) {
      if (supabaseServer && decoded.email) {
        try {
          const { data: profile } = await supabaseServer
            .from('user_profiles')
            .select('*')
            .eq('email', decoded.email.toLowerCase())
            .maybeSingle();

          if (profile) {
            return {
              id: profile.id,
              profileId: profile.id,
              email: profile.email,
              name: profile.full_name || decoded.name,
              phone: profile.phone,
              role: profile.role || decoded.role || 'customer',
            };
          }
        } catch {}
      }
      return decoded;
    }
  } catch {}

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
      houseNo,
      street,
      area,
      city,
      pincode,
      postalCode,
      latitude,
      longitude,
      deliveryNotes,
      paymentMethod = 'cod', // 'cod' | 'card' | 'upi'
      notes,
      whatsappOptIn = true,
    } = req.body;

    const email = (customerEmail || authUser?.email || '').trim().toLowerCase();
    const name = (customerName || authUser?.name || '').trim();
    const rawPhone = (customerPhone || authUser?.phone || '').trim();
    const phone = normalizePhoneNumber(rawPhone) || rawPhone;

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

    const effectivePin = (postalCode || pincode || '').trim();
    const formattedAddress = [
      houseNo ? `Flat/House ${houseNo}` : null,
      street,
      area,
      deliveryAddress,
      city,
      effectivePin ? `PIN: ${effectivePin}` : '',
    ].filter(Boolean).join(', ');

    const finalAddress = deliveryAddress || formattedAddress;
    const isOptedIn = whatsappOptIn !== false && whatsappOptIn !== 'false';
    const optInTag = isOptedIn ? '[WhatsApp Opt-in: Yes]' : '[WhatsApp Opt-in: No]';
    const finalDeliveryNotes = deliveryNotes || notes;
    const combinedNotes = finalDeliveryNotes
      ? `${finalDeliveryNotes} | ${optInTag} | Ship to: ${finalAddress}`
      : `${optInTag} | Ship to: ${finalAddress}`;

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
          delivery_fee: deliveryFee,
          discount: 0,
          tax: 0,
          total: calculatedTotal,
          delivery_address: finalAddress,
          house_no: houseNo || null,
          street: street || null,
          area: area || null,
          city: city || null,
          postal_code: effectivePin || null,
          latitude: latitude !== undefined && latitude !== null && !isNaN(Number(latitude)) ? Number(latitude) : null,
          longitude: longitude !== undefined && longitude !== null && !isNaN(Number(longitude)) ? Number(longitude) : null,
          delivery_notes: finalDeliveryNotes || null,
          notes: combinedNotes,
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

    // ── Diagnostic Log: ORDER_CREATED ──────────────────────────────────────
    logger.info(
      `[ORDER_CREATED] OrderId=${newOrder.id} OrderNumber=${newOrder.order_number} CustomerName="${name}" RecipientPhone=${maskPhoneNumber(phone)} Total=₹${calculatedTotal} Timestamp=${new Date().toISOString()}`
    );

    // ── Dispatch n8n WhatsApp Order Confirmation Webhook (only when opted-in) ──
    if (isOptedIn) {
      sendOrderConfirmationWebhook(newOrder, itemsToInsert).catch((webhookErr) => {
        logger.error(`[N8N_WEBHOOK_UNHANDLED_ERROR] OrderId=${newOrder.id}: ${webhookErr.message}`);
      });
    } else {
      logger.info(`Customer opted out of WhatsApp notification for order ${newOrder.order_number}`);
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
        whatsappOptIn: isOptedIn,
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
 * Enforces ownership check for customers while allowing staff/admin full access.
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
      .maybeSingle();

    if (error || !order) {
      return sendError(res, { status: 404, message: 'Order not found' });
    }

    // Ownership check if customer is authenticated
    const authUser = await extractUser(req);
    const staffRoles = ['admin', 'inventoryManager', 'cashier', 'manager', 'staff'];
    if (authUser && !staffRoles.includes(authUser.role)) {
      const isOwner =
        (order.customer_id && order.customer_id === authUser.profileId) ||
        (order.customer_email && order.customer_email.toLowerCase() === authUser.email.toLowerCase());
      if (!isOwner) {
        return sendError(res, { status: 403, message: 'Access denied: You can only view your own orders' });
      }
    }

    return sendSuccess(res, { status: 200, data: order });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

/**
 * PATCH /api/orders/:id/status
 * Allows authorized staff or admin to update order fulfillment status
 * Supports: pending, confirmed, packed, out_for_delivery, delivered, completed, cancelled, refunded
 */
router.patch('/:id/status', async (req, res) => {
  try {
    if (!supabaseServer) {
      return sendError(res, { status: 503, message: 'Database service unavailable' });
    }

    const authUser = await extractUser(req);
    const allowedRoles = ['admin', 'inventoryManager', 'cashier', 'manager', 'staff'];
    if (!authUser || !allowedRoles.includes(authUser.role)) {
      return sendError(res, { status: 403, message: 'Only authorized staff or administrators can update order status' });
    }

    const { id } = req.params;
    const { status, notes } = req.body;

    const validStatuses = [
      'pending',
      'confirmed',
      'packed',
      'out_for_delivery',
      'delivered',
      'cancelled',
      'completed',
      'refunded',
    ];

    const cleanStatus = (status || '').toLowerCase().trim();
    if (!cleanStatus || !validStatuses.includes(cleanStatus)) {
      return sendError(res, {
        status: 400,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    // Fetch existing order
    const { data: existingOrder, error: fetchErr } = await supabaseServer
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !existingOrder) {
      return sendError(res, { status: 404, message: 'Order not found' });
    }

    if (existingOrder.status === 'cancelled') {
      return sendError(res, { status: 400, message: 'Cancelled orders cannot change status' });
    }

    if (existingOrder.status === 'delivered' && cleanStatus !== 'cancelled' && cleanStatus !== 'refunded') {
      return sendError(res, { status: 400, message: 'Delivered orders cannot be reverted to earlier stages' });
    }

    const updates = {
      status: cleanStatus,
      updated_at: new Date().toISOString(),
    };

    if (cleanStatus === 'delivered' || cleanStatus === 'completed') {
      updates.payment_status = 'paid';
    }

    if (notes) {
      updates.delivery_notes = notes;
    }

    // If order is cancelled, restock product quantities
    if (cleanStatus === 'cancelled' && existingOrder.status !== 'cancelled') {
      const items = existingOrder.order_items || [];
      for (const item of items) {
        if (item.product_id && item.quantity > 0) {
          const { data: prod } = await supabaseServer
            .from('products')
            .select('stock_quantity')
            .eq('id', item.product_id)
            .maybeSingle();
          if (prod) {
            await supabaseServer
              .from('products')
              .update({
                stock_quantity: Number(prod.stock_quantity || 0) + Number(item.quantity),
                updated_at: new Date().toISOString(),
              })
              .eq('id', item.product_id);
          }
        }
      }
    }

    const { data: updated, error } = await supabaseServer
      .from('orders')
      .update(updates)
      .eq('id', id)
      .select('*, order_items(*)')
      .maybeSingle();

    if (error) throw error;
    if (!updated) {
      return sendError(res, { status: 404, message: 'Order not found' });
    }

    return sendSuccess(res, {
      status: 200,
      message: `Order status updated to "${cleanStatus}" successfully`,
      data: updated,
    });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

/**
 * POST /api/orders/notification-status
 * Webhook status callback for n8n automation and Meta WhatsApp Cloud API status updates.
 * Updates public.order_notifications and outputs diagnostic logs:
 *   - [WHATSAPP_API_ACCEPTED]
 *   - [WHATSAPP_DELIVERED]
 *   - [WHATSAPP_FAILED]
 */
router.post('/notification-status', async (req, res) => {
  try {
    const {
      orderId,
      orderNumber,
      status, // 'accepted' | 'sent' | 'delivered' | 'read' | 'failed'
      whatsappMessageId,
      errorCode,
      errorMessage,
      recipientPhone,
      templateName,
    } = req.body;

    if (!orderId && !orderNumber) {
      return sendError(res, { status: 400, message: 'orderId or orderNumber is required' });
    }

    let resolvedOrderId = orderId;
    if (!resolvedOrderId && orderNumber) {
      const { data: ord } = await supabaseServer
        .from('orders')
        .select('id, order_number')
        .eq('order_number', orderNumber)
        .maybeSingle();
      if (ord) resolvedOrderId = ord.id;
    }

    const timestamp = new Date().toISOString();
    const maskedPhone = maskPhoneNumber(recipientPhone);

    if (status === 'accepted' || status === 'sent') {
      logger.info(
        `[WHATSAPP_API_ACCEPTED] OrderId=${resolvedOrderId || orderNumber} WAMID=${whatsappMessageId || 'N/A'} RecipientPhone=${maskedPhone} Timestamp=${timestamp}`
      );
    } else if (status === 'delivered') {
      logger.info(
        `[WHATSAPP_DELIVERED] OrderId=${resolvedOrderId || orderNumber} WAMID=${whatsappMessageId || 'N/A'} RecipientPhone=${maskedPhone} Timestamp=${timestamp}`
      );
    } else if (status === 'failed') {
      logger.error(
        `[WHATSAPP_FAILED] OrderId=${resolvedOrderId || orderNumber} ErrorCode=${errorCode || 'UNKNOWN'} ErrorMsg=${errorMessage || 'Delivery failed'} Timestamp=${timestamp}`
      );
    }

    if (resolvedOrderId) {
      await logNotificationStatus({
        orderId: resolvedOrderId,
        recipientPhone: recipientPhone || '',
        templateName: templateName || 'vrk_order_confirmation',
        whatsappMessageId,
        status: status || 'pending',
        errorCode,
        errorMessage,
      });
    }

    return sendSuccess(res, {
      message: 'Notification status updated successfully',
      data: { orderId: resolvedOrderId, status, timestamp },
    });
  } catch (err) {
    logger.error(`Error processing notification status callback: ${err.message}`);
    return sendError(res, { status: 500, message: err.message });
  }
});

module.exports = router;
