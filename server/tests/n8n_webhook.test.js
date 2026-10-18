const { sendOrderConfirmationWebhook, dispatchedOrderIds } = require('../src/services/n8nWebhookService');

describe('n8n Webhook Service — WhatsApp Order Confirmation Dispatcher', () => {
  const originalEnv = process.env.N8N_ORDER_WEBHOOK_URL;
  const originalFetch = global.fetch;

  beforeEach(() => {
    dispatchedOrderIds.clear();
    process.env.N8N_ORDER_WEBHOOK_URL = 'https://rajanv2907.app.n8n.cloud/webhook/vrk-order-confirmation';
    global.fetch = jest.fn();
  });

  afterAll(() => {
    process.env.N8N_ORDER_WEBHOOK_URL = originalEnv;
    global.fetch = originalFetch;
  });

  const mockOrder = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    order_number: 'ORD-20261018-9999',
    customer_name: 'Rajiv Kumar',
    customer_phone: '+919876543210',
    customer_email: 'rajiv@example.com',
    status: 'pending',
    payment_method: 'cod',
    payment_status: 'pending',
    subtotal: 350,
    delivery_fee: 40,
    total: 390,
    delivery_address: 'Flat 101, Palm Grove, Indiranagar, Bangalore 560038',
    created_at: new Date().toISOString(),
  };

  const mockItems = [
    {
      product_id: 'p1',
      product_name: 'Organic Milk 1L',
      sku: 'DRY-MLK-001',
      price: 65,
      quantity: 2,
      total: 130,
    },
    {
      product_id: 'p2',
      product_name: 'Whole Wheat Bread',
      sku: 'BKY-BRD-002',
      price: 50,
      quantity: 1,
      total: 50,
    },
  ];

  it('formats payload with redundant order ID properties for n8n Extract Order ID compatibility', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '{"success":true}',
    });

    const result = await sendOrderConfirmationWebhook(mockOrder, mockItems);

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const [calledUrl, calledInit] = global.fetch.mock.calls[0];

    expect(calledUrl).toBe('https://rajanv2907.app.n8n.cloud/webhook/vrk-order-confirmation');
    expect(calledInit.method).toBe('POST');

    const calledPayload = JSON.parse(calledInit.body);

    // Confirm that orderId, order_id, id, orderNumber, order_number are all populated
    expect(calledPayload.orderId).toBe(mockOrder.id);
    expect(calledPayload.order_id).toBe(mockOrder.id);
    expect(calledPayload.id).toBe(mockOrder.id);
    expect(calledPayload.orderNumber).toBe(mockOrder.order_number);
    expect(calledPayload.order_number).toBe(mockOrder.order_number);

    expect(calledPayload.customerName).toBe('Rajiv Kumar');
    expect(calledPayload.customerPhone).toBe('+919876543210');
    expect(calledPayload.total).toBe(390);
    expect(calledPayload.whatsappOptIn).toBe(true);
    expect(calledPayload.items).toHaveLength(2);

    expect(calledInit.headers['X-Order-Id']).toBe(mockOrder.id);
    expect(calledInit.headers['X-Order-Number']).toBe(mockOrder.order_number);
  });

  it('suppresses duplicate webhook calls for the same order ID to avoid duplicate WhatsApp messages', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '{"success":true}',
    });

    // First call
    const firstResult = await sendOrderConfirmationWebhook(mockOrder, mockItems);
    expect(firstResult.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Second call with same order
    const secondResult = await sendOrderConfirmationWebhook(mockOrder, mockItems);
    expect(secondResult.success).toBe(true);
    expect(secondResult.duplicateSuppressed).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1); // Still 1, not called again
  });

  it('does not retry on 4xx client errors (e.g. 403 Forbidden)', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => 'Authorization data is wrong!',
    });

    const result = await sendOrderConfirmationWebhook(mockOrder, mockItems);

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(403);
    expect(result.attempts).toBe(1); // Exited immediately without retry
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('skips dispatch cleanly when N8N_ORDER_WEBHOOK_URL is not set', async () => {
    delete process.env.N8N_ORDER_WEBHOOK_URL;

    const result = await sendOrderConfirmationWebhook(mockOrder, mockItems);

    expect(result.success).toBe(false);
    expect(result.skipped).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
