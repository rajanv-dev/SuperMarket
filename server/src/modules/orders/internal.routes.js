const express = require('express');
const { supabaseServer } = require('../../config/supabase');
const { sendSuccess, sendError } = require('../../utils/response');
const { normalizePhoneNumber, toDigitsOnly } = require('../../utils/phone');
const logger = require('../../utils/logger');

const router = express.Router();

/**
 * Middleware: Optional verification for internal requests
 * If INTERNAL_API_KEY is configured in .env, requires matching x-api-key or Authorization Bearer header.
 */
const verifyInternalAccess = (req, res, next) => {
  const internalKey = process.env.INTERNAL_API_KEY;
  if (!internalKey) {
    // Open internally if no key configured
    return next();
  }

  const providedKey =
    req.headers['x-api-key'] ||
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);

  if (!providedKey || providedKey !== internalKey) {
    logger.warn(`Unauthorized internal order access attempt from ${req.ip}`);
    return sendError(res, { status: 401, message: 'Invalid or missing internal service key' });
  }

  return next();
};

/**
 * GET /api/internal/orders/:id
 * Fetches full order details including line items for internal microservices,
 * n8n automation workflows, and WhatsApp dispatchers.
 * Supports querying by Supabase UUID primary key OR human-readable order_number (e.g., ORD-20261018-1234).
 */
router.get('/:id', verifyInternalAccess, async (req, res) => {
  try {
    if (!supabaseServer) {
      return sendError(res, { status: 503, message: 'Database service unavailable' });
    }

    const { id } = req.params;
    if (!id || !String(id).trim()) {
      return sendError(res, { status: 400, message: 'Order ID or order number is required' });
    }

    const cleanId = String(id).trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);

    let query = supabaseServer
      .from('orders')
      .select('*, order_items(*)')
      .limit(1);

    if (isUuid) {
      query = query.eq('id', cleanId);
    } else {
      query = query.eq('order_number', cleanId);
    }

    const { data: order, error } = await query.maybeSingle();

    if (error) {
      logger.error(`Error retrieving internal order ${cleanId}: ${error.message}`);
      return sendError(res, { status: 500, message: error.message });
    }

    if (!order) {
      return sendError(res, { status: 404, message: `Order with ID or number "${cleanId}" not found` });
    }

    const orderItems = order.order_items || [];

    const normalizedPhone = normalizePhoneNumber(order.customer_phone) || order.customer_phone;
    const digitsPhone = toDigitsOnly(order.customer_phone);

    // Structured payload accommodating various n8n node expression patterns
    const responseData = {
      id: order.id,
      order_id: order.id,
      orderNumber: order.order_number,
      order_number: order.order_number,
      customer: {
        name: order.customer_name || 'Valued Customer',
        phone: normalizedPhone,
        rawPhone: order.customer_phone,
        digitsPhone: digitsPhone,
        email: order.customer_email || '',
      },
      customer_id: order.customer_id,
      customer_name: order.customer_name,
      customerName: order.customer_name,
      customer_email: order.customer_email,
      customerEmail: order.customer_email,
      customer_phone: normalizedPhone,
      customerPhone: normalizedPhone,
      raw_phone: order.customer_phone,
      currency: 'INR',
      type: order.type,
      status: order.status,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      subtotal: Number(order.subtotal || 0),
      discount: Number(order.discount || 0),
      tax: Number(order.tax || 0),
      delivery_fee: Number(order.delivery_fee || 0),
      total: Number(order.total || 0),
      delivery_address: order.delivery_address,
      house_no: order.house_no,
      street: order.street,
      area: order.area,
      city: order.city,
      postal_code: order.postal_code,
      delivery_notes: order.delivery_notes,
      notes: order.notes,
      created_at: order.created_at,
      updated_at: order.updated_at,
      order_items: orderItems,
      items: orderItems.map((item) => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        name: item.product_name,
        sku: item.sku,
        price: Number(item.price),
        quantity: Number(item.quantity),
        qty: Number(item.quantity),
        total: Number(item.total),
      })),
      items_count: orderItems.length,
    };

    return res.status(200).json({
      success: true,
      message: 'Order retrieved successfully',
      data: responseData,
      order: responseData,
    });
  } catch (err) {
    logger.error(`Internal order endpoint error: ${err.message}`);
    return sendError(res, { status: 500, message: err.message });
  }
});

module.exports = router;
