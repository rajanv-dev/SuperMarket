const logger = require('../utils/logger');

// In-memory set to prevent duplicate webhook dispatches for the same order
const dispatchedOrderIds = new Set();

/**
 * Sanitizes a URL for safe logging (removes embedded password credentials)
 */
const sanitizeUrl = (rawUrl) => {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
};

/**
 * Dispatches an order confirmation event to the configured n8n webhook URL.
 * Uses native fetch with AbortController timeout handling, exponential retry on transient
 * network/5xx errors, idempotency headers, and strict duplicate-prevention.
 *
 * @param {Object} order - Authoritative order record from database
 * @param {Array} [orderItems=[]] - Line items associated with the order
 * @param {Object} [options={}] - Additional metadata or override options
 * @returns {Promise<{ success: boolean, attempts: number, error?: string }>}
 */
const sendOrderConfirmationWebhook = async (order, orderItems = [], options = {}) => {
  const webhookUrl = process.env.N8N_ORDER_WEBHOOK_URL;

  if (!webhookUrl || !webhookUrl.trim()) {
    logger.info('N8N_ORDER_WEBHOOK_URL is not configured; skipping WhatsApp order confirmation webhook');
    return { success: false, attempts: 0, skipped: true, reason: 'unconfigured' };
  }

  if (!order || !order.id) {
    logger.warn('n8nWebhookService: invalid order object supplied');
    return { success: false, attempts: 0, reason: 'invalid_order' };
  }

  // Idempotency: Prevent duplicate dispatch for the same order ID
  const orderKey = String(order.id);
  if (dispatchedOrderIds.has(orderKey)) {
    logger.warn(`n8nWebhookService: Webhook already dispatched for order ${order.order_number || order.id}; skipping to prevent duplicate messages`);
    return { success: true, attempts: 0, duplicateSuppressed: true };
  }

  // Mark order key as in-flight / dispatched
  dispatchedOrderIds.add(orderKey);

  // Evict older keys if set grows beyond 5000 items to avoid memory leak
  if (dispatchedOrderIds.size > 5000) {
    const firstKey = dispatchedOrderIds.values().next().value;
    dispatchedOrderIds.delete(firstKey);
  }

  // Payload formatted specifically for "Order Placed Webhook" and "Extract Order ID" nodes
  // Includes orderId, order_id, id, orderNumber, and order_number at root level for guaranteed compatibility
  const payload = {
    orderId: order.id,
    order_id: order.id,
    id: order.id,
    orderNumber: order.order_number,
    order_number: order.order_number,
    customerName: order.customer_name || '',
    customerPhone: order.customer_phone || '',
    customerEmail: order.customer_email || '',
    status: order.status || 'pending',
    paymentMethod: order.payment_method || 'cod',
    paymentStatus: order.payment_status || 'pending',
    subtotal: Number(order.subtotal || 0),
    deliveryFee: Number(order.delivery_fee || 0),
    total: Number(order.total || 0),
    deliveryAddress: order.delivery_address || '',
    houseNo: order.house_no || null,
    city: order.city || null,
    postalCode: order.postal_code || null,
    deliveryNotes: order.delivery_notes || null,
    whatsappOptIn: true,
    itemsCount: Array.isArray(orderItems) ? orderItems.length : 0,
    items: (orderItems || []).map((i) => ({
      productId: i.product_id,
      name: i.product_name,
      sku: i.sku,
      price: Number(i.price),
      quantity: Number(i.quantity),
      total: Number(i.total),
    })),
    createdAt: order.created_at || new Date().toISOString(),
    event: 'ORDER_PLACED',
  };

  // Configure authentication headers if provided
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'VRK-Supermarket-Backend/1.0',
    'X-Order-Id': String(order.id),
    'X-Order-Number': String(order.order_number || ''),
    'X-Idempotency-Key': String(order.id),
  };

  // Basic auth: support N8N_WEBHOOK_USER & N8N_WEBHOOK_PASSWORD, or N8N_WEBHOOK_BASIC_AUTH
  const authUser = process.env.N8N_WEBHOOK_USER;
  const authPass = process.env.N8N_WEBHOOK_PASSWORD;
  const basicAuthHeader = process.env.N8N_WEBHOOK_BASIC_AUTH;
  const bearerToken = process.env.N8N_WEBHOOK_BEARER_TOKEN;

  if (authUser && authPass) {
    const encoded = Buffer.from(`${authUser}:${authPass}`).toString('base64');
    headers['Authorization'] = `Basic ${encoded}`;
  } else if (basicAuthHeader) {
    headers['Authorization'] = basicAuthHeader.startsWith('Basic ') ? basicAuthHeader : `Basic ${basicAuthHeader}`;
  } else if (bearerToken) {
    headers['Authorization'] = bearerToken.startsWith('Bearer ') ? bearerToken : `Bearer ${bearerToken}`;
  }

  const timeoutMs = parseInt(process.env.N8N_WEBHOOK_TIMEOUT_MS || '8000', 10);
  const maxRetries = 2; // Up to 2 retries for transient 5xx or network errors
  let attempt = 0;
  let lastError = null;

  while (attempt <= maxRetries) {
    attempt++;
    let controller = null;
    let timeoutId = null;

    try {
      logger.info(`Sending order confirmation webhook to n8n (attempt ${attempt}/${maxRetries + 1}) for order ${order.order_number} (${order.id})`);

      controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const status = response.status;
      const responseText = await response.text().catch(() => '');

      if (response.ok) {
        logger.info(`n8n order confirmation webhook succeeded with status ${status} for order ${order.order_number}`);
        return {
          success: true,
          statusCode: status,
          attempts: attempt,
        };
      }

      // Do NOT retry on 4xx client errors (400, 401, 403, 404, etc.)
      if (status >= 400 && status < 500) {
        const safeTarget = sanitizeUrl(webhookUrl);
        logger.error(`n8n webhook rejected with HTTP ${status} for ${safeTarget}: ${responseText}`);
        return {
          success: false,
          statusCode: status,
          attempts: attempt,
          error: `HTTP ${status}: ${responseText}`,
        };
      }

      throw new Error(`HTTP ${status}: ${responseText}`);
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      lastError = err;

      const isAbort = err.name === 'AbortError' || err.code === 20;
      const errMsg = isAbort ? `Request timed out after ${timeoutMs}ms` : err.message;

      logger.warn(`n8n webhook attempt ${attempt} failed: ${errMsg}. ${attempt <= maxRetries ? 'Retrying...' : 'All attempts exhausted.'}`);

      if (attempt <= maxRetries) {
        // Exponential backoff delay: 1000ms, 2000ms
        const delay = attempt * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  logger.error(`n8n order confirmation webhook failed after ${attempt} attempts for order ${order.order_number}: ${lastError?.message}`);
  return {
    success: false,
    attempts: attempt,
    error: lastError?.message || 'Unknown network error',
  };
};

module.exports = {
  sendOrderConfirmationWebhook,
  dispatchedOrderIds,
};
