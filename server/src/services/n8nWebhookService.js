const logger = require('../utils/logger');
const { supabaseServer } = require('../config/supabase');
const { normalizePhoneNumber, maskPhoneNumber, toDigitsOnly } = require('../utils/phone');

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
 * Persists or updates notification delivery logs in the database.
 * Safe from throwing so it never impacts order fulfillment.
 */
const logNotificationStatus = async ({
  orderId,
  notificationType = 'whatsapp_order_confirmation',
  recipientPhone,
  templateName = 'vrk_order_confirmation',
  whatsappMessageId = null,
  status = 'pending',
  errorCode = null,
  errorMessage = null,
  metadata = {},
}) => {
  if (!supabaseServer || !orderId) return;

  try {
    const payload = {
      order_id: orderId,
      notification_type: notificationType,
      recipient_phone: maskPhoneNumber(recipientPhone),
      template_name: templateName,
      whatsapp_message_id: whatsappMessageId,
      status,
      error_code: errorCode ? String(errorCode) : null,
      error_message: errorMessage ? String(errorMessage).slice(0, 500) : null,
      metadata,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabaseServer
      .from('order_notifications')
      .upsert(payload, { onConflict: 'order_id,notification_type' });

    if (error) {
      logger.warn(`Could not update order_notifications for order ${orderId}: ${error.message}`);
    }
  } catch (dbErr) {
    logger.warn(`Failed persisting notification status: ${dbErr.message}`);
  }
};

/**
 * Dispatches an order confirmation event to the configured n8n webhook URL.
 * Uses native fetch with AbortController timeout handling, exponential retry on transient
 * network/5xx errors, idempotency headers, privacy-safe diagnostic logging, and database logging.
 *
 * @param {Object} order - Authoritative order record from database
 * @param {Array} [orderItems=[]] - Line items associated with the order
 * @param {Object} [options={}] - Additional metadata or override options (e.g. { isDiagnostic: true })
 * @returns {Promise<{ success: boolean, statusCode?: number, attempts: number, error?: string, responseBody?: string }>}
 */
const sendOrderConfirmationWebhook = async (order, orderItems = [], options = {}) => {
  const webhookUrl = process.env.N8N_ORDER_WEBHOOK_URL;
  const isDiagnostic = Boolean(options.isDiagnostic);

  if (!webhookUrl || !webhookUrl.trim()) {
    logger.info('N8N_ORDER_WEBHOOK_URL is not configured; skipping WhatsApp order confirmation webhook');
    return { success: false, attempts: 0, skipped: true, reason: 'unconfigured' };
  }

  if (!order || !order.id) {
    logger.warn('n8nWebhookService: invalid order object supplied');
    return { success: false, attempts: 0, reason: 'invalid_order' };
  }

  // Idempotency: Prevent duplicate dispatch for the same order ID (skip for diagnostic tests)
  const orderKey = String(order.id);
  if (!isDiagnostic && dispatchedOrderIds.has(orderKey)) {
    logger.warn(
      `[DUPLICATE_PREVENTED] n8nWebhookService: Webhook already dispatched for order ${order.order_number || order.id}; skipping duplicate`
    );
    return { success: true, attempts: 0, duplicateSuppressed: true };
  }

  if (!isDiagnostic) {
    dispatchedOrderIds.add(orderKey);

    // Evict older keys if set grows beyond 5000 items to avoid memory leak
    if (dispatchedOrderIds.size > 5000) {
      const firstKey = dispatchedOrderIds.values().next().value;
      dispatchedOrderIds.delete(firstKey);
    }
  }

  // Phone normalization
  const rawCustomerPhone = order.customer_phone || '';
  const normalizedPhone = normalizePhoneNumber(rawCustomerPhone);
  const digitsPhone = toDigitsOnly(rawCustomerPhone);
  const maskedPhone = maskPhoneNumber(normalizedPhone || rawCustomerPhone);

  // Structured payload matching user specification while maintaining root-level compatibility
  const lineItems = (orderItems || []).map((i) => ({
    productId: i.product_id,
    name: i.product_name,
    sku: i.sku || null,
    price: Number(i.price || 0),
    quantity: Number(i.quantity || 1),
    total: Number(i.total || (Number(i.price || 0) * Number(i.quantity || 1))),
  }));

  const payload = {
    // Primary structured payload as requested
    event: 'order.placed',
    orderId: order.id,
    customer: {
      name: order.customer_name || 'Valued Customer',
      phone: normalizedPhone || rawCustomerPhone,
      rawPhone: rawCustomerPhone,
      digitsPhone: digitsPhone,
      email: order.customer_email || '',
    },
    items: lineItems,
    total: Number(order.total || 0),
    currency: 'INR',
    createdAt: order.created_at || new Date().toISOString(),

    // Backwards-compatible aliases for varied n8n expression access
    order_id: order.id,
    id: order.id,
    orderNumber: order.order_number,
    order_number: order.order_number,
    customerName: order.customer_name || 'Valued Customer',
    customerPhone: normalizedPhone || rawCustomerPhone,
    customerEmail: order.customer_email || '',
    status: order.status || 'pending',
    paymentMethod: order.payment_method || 'cod',
    paymentStatus: order.payment_status || 'pending',
    subtotal: Number(order.subtotal || 0),
    deliveryFee: Number(order.delivery_fee || 0),
    deliveryAddress: order.delivery_address || '',
    houseNo: order.house_no || null,
    city: order.city || null,
    postalCode: order.postal_code || null,
    deliveryNotes: order.delivery_notes || null,
    whatsappOptIn: true,
    itemsCount: lineItems.length,
    isDiagnosticTest: isDiagnostic,
  };

  // Configure authentication headers
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'VRK-Supermarket-Backend/1.0',
    'X-Order-Id': String(order.id),
    'X-Order-Number': String(order.order_number || ''),
    'X-Idempotency-Key': String(order.id),
  };

  // Support Basic auth or Bearer auth if configured in environment
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
  const maxRetries = isDiagnostic ? 0 : 2;
  let attempt = 0;
  let lastError = null;

  // Log start of webhook request
  logger.info(
    `[N8N_WEBHOOK_REQUEST_STARTED] OrderId=${order.id} OrderNumber=${order.order_number} RecipientPhone=${maskedPhone} Timestamp=${new Date().toISOString()}`
  );

  if (!isDiagnostic) {
    await logNotificationStatus({
      orderId: order.id,
      recipientPhone: normalizedPhone || rawCustomerPhone,
      status: 'pending',
      metadata: {
        orderNumber: order.order_number,
        total: order.total,
        maskedPhone,
      },
    });
  }

  while (attempt <= maxRetries) {
    attempt++;
    let controller = null;
    let timeoutId = null;

    try {
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
        logger.info(
          `[N8N_WEBHOOK_REQUEST_SUCCEEDED] OrderId=${order.id} OrderNumber=${order.order_number} StatusCode=${status} Attempts=${attempt} Timestamp=${new Date().toISOString()}`
        );

        if (!isDiagnostic) {
          await logNotificationStatus({
            orderId: order.id,
            recipientPhone: normalizedPhone || rawCustomerPhone,
            status: 'sent',
            metadata: {
              attempts: attempt,
              statusCode: status,
              sentAt: new Date().toISOString(),
            },
          });
        }

        return {
          success: true,
          statusCode: status,
          attempts: attempt,
          responseBody: responseText,
        };
      }

      // If client-side HTTP error (4xx)
      if (status >= 400 && status < 500) {
        const safeTarget = sanitizeUrl(webhookUrl);
        const errDetail = status === 403 && responseText.includes('Authorization')
          ? 'Basic Authentication required on n8n webhook; configure N8N_WEBHOOK_USER/PASSWORD in Render or set Authentication: None in n8n'
          : responseText.slice(0, 200);

        logger.error(
          `[N8N_WEBHOOK_REQUEST_FAILED] OrderId=${order.id} OrderNumber=${order.order_number} StatusCode=${status} Target=${safeTarget} Reason=${errDetail} Timestamp=${new Date().toISOString()}`
        );

        if (!isDiagnostic) {
          await logNotificationStatus({
            orderId: order.id,
            recipientPhone: normalizedPhone || rawCustomerPhone,
            status: 'failed',
            errorCode: `HTTP_${status}`,
            errorMessage: errDetail,
            metadata: { attempts: attempt, statusCode: status },
          });
        }

        return {
          success: false,
          statusCode: status,
          attempts: attempt,
          error: `HTTP ${status}: ${errDetail}`,
          responseBody: responseText,
        };
      }

      throw new Error(`HTTP ${status}: ${responseText.slice(0, 200)}`);
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      lastError = err;

      const isAbort = err.name === 'AbortError' || err.code === 20;
      const errMsg = isAbort ? `Request timed out after ${timeoutMs}ms` : err.message;

      logger.warn(
        `[N8N_WEBHOOK_ATTEMPT_FAILED] OrderId=${order.id} Attempt=${attempt}/${maxRetries + 1} Reason=${errMsg}`
      );

      if (attempt <= maxRetries) {
        const delay = attempt * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  logger.error(
    `[N8N_WEBHOOK_REQUEST_FAILED] OrderId=${order.id} OrderNumber=${order.order_number} ExhaustedAttempts=${attempt} Error=${lastError?.message} Timestamp=${new Date().toISOString()}`
  );

  if (!isDiagnostic) {
    await logNotificationStatus({
      orderId: order.id,
      recipientPhone: normalizedPhone || rawCustomerPhone,
      status: 'failed',
      errorCode: 'NETWORK_ERROR',
      errorMessage: lastError?.message || 'Unknown network error',
      metadata: { attempts: attempt },
    });
  }

  return {
    success: false,
    attempts: attempt,
    error: lastError?.message || 'Unknown network error',
  };
};

/**
 * Diagnostic method to test the live webhook connection without placing a customer order.
 */
const testWebhookConnection = async () => {
  const webhookUrl = process.env.N8N_ORDER_WEBHOOK_URL;
  if (!webhookUrl || !webhookUrl.trim()) {
    return {
      success: false,
      configured: false,
      error: 'N8N_ORDER_WEBHOOK_URL is not configured in environment variables',
    };
  }

  const dummyOrder = {
    id: 'diagnostic-' + Date.now(),
    order_number: 'ORD-DIAGNOSTIC-PING',
    customer_name: 'Diagnostic Tester',
    customer_phone: '+919894508265',
    customer_email: 'tester@super.local',
    status: 'pending',
    payment_method: 'cod',
    payment_status: 'pending',
    subtotal: 65,
    delivery_fee: 40,
    total: 105,
    delivery_address: '123 Test Street, Chennai 600001',
    created_at: new Date().toISOString(),
  };

  const dummyItems = [
    {
      product_id: 'prod-test-01',
      product_name: 'Rice 1kg',
      sku: 'GRC-RICE-001',
      price: 65,
      quantity: 1,
      total: 65,
    },
  ];

  const startTime = Date.now();
  const result = await sendOrderConfirmationWebhook(dummyOrder, dummyItems, { isDiagnostic: true });
  const latencyMs = Date.now() - startTime;

  return {
    configured: true,
    targetUrl: sanitizeUrl(webhookUrl),
    latencyMs,
    ...result,
  };
};

module.exports = {
  sendOrderConfirmationWebhook,
  testWebhookConnection,
  logNotificationStatus,
  dispatchedOrderIds,
};
