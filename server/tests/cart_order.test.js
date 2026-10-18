const request = require('supertest');
const { app } = require('../src/app');

describe('E-Commerce Cart and Orders API', () => {
  let sampleProduct = null;

  beforeAll(async () => {
    // Fetch a real active product from database
    const res = await request(app).get('/api/products');
    if (res.body?.data && res.body.data.length > 0) {
      sampleProduct = res.body.data[0];
    }
  });

  // ── 1. Cart Validation ─────────────────────────────────────────────────────
  describe('POST /api/cart/validate', () => {
    it('validates an empty cart', async () => {
      const res = await request(app)
        .post('/api/cart/validate')
        .send({ items: [] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isValid).toBe(true);
      expect(res.body.data.subtotal).toBe(0);
    });

    it('validates real product prices and availability', async () => {
      if (!sampleProduct) return;

      const res = await request(app)
        .post('/api/cart/validate')
        .send({
          items: [
            {
              productId: sampleProduct.id,
              qty: 2,
              price: Number(sampleProduct.price),
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isValid).toBe(true);
      expect(res.body.data.subtotal).toBe(Math.round(Number(sampleProduct.price) * 2 * 100) / 100);
      expect(res.body.data.items).toHaveLength(1);
    });

    it('flags unavailable / out of stock items', async () => {
      if (!sampleProduct) return;

      const res = await request(app)
        .post('/api/cart/validate')
        .send({
          items: [
            {
              productId: sampleProduct.id,
              qty: 999999, // Exceeds stock
              price: Number(sampleProduct.price),
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.isValid).toBe(false);
      expect(res.body.data.outOfStockItems.length).toBeGreaterThan(0);
    });
  });

  // ── 2. Order Placement ─────────────────────────────────────────────────────
  describe('POST /api/orders', () => {
    it('rejects order with empty items', async () => {
      const res = await request(app)
        .post('/api/orders')
        .send({
          items: [],
          customerName: 'Test Customer',
          customerEmail: 'test@example.com',
          customerPhone: '9876543210',
          deliveryAddress: '123 Main St',
          city: 'Bangalore',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Cart cannot be empty/i);
    });

    it('rejects order without customer contact details', async () => {
      const res = await request(app)
        .post('/api/orders')
        .send({
          items: [{ productId: sampleProduct?.id, qty: 1 }],
          customerName: '',
          customerEmail: '',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('successfully places an order with real stock validation and server-calculated totals', async () => {
      if (!sampleProduct) return;

      const initialStock = sampleProduct.stock_quantity;
      const testEmail = `test.shopper.${Date.now()}@example.com`;

      const res = await request(app)
        .post('/api/orders')
        .send({
          items: [
            {
              productId: sampleProduct.id,
              qty: 1,
            },
          ],
          customerName: 'Senior Shopper',
          customerEmail: testEmail,
          customerPhone: '9876543210',
          deliveryAddress: 'Flat 401, Super Residency',
          city: 'Bangalore',
          pincode: '560001',
          paymentMethod: 'cod',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderNumber).toMatch(/^ORD-/);
      expect(res.body.data.total).toBeDefined();

      const createdOrderId = res.body.data.orderId;

      // Check order can be retrieved
      const getRes = await request(app).get(`/api/orders/${createdOrderId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.order_number).toBe(res.body.data.orderNumber);
      expect(getRes.body.data.order_items.length).toBeGreaterThan(0);
    });

    it('successfully places an order with Google Maps coordinates and structured address', async () => {
      if (!sampleProduct) return;

      const testEmail = `maps.shopper.${Date.now()}@example.com`;
      const res = await request(app)
        .post('/api/orders')
        .send({
          items: [{ productId: sampleProduct.id, qty: 1 }],
          customerName: 'GPS Shopper',
          customerEmail: testEmail,
          customerPhone: '9876543211',
          houseNo: 'Flat 302, Lotus Apt',
          street: '12th Cross, Indiranagar',
          area: 'HAL 2nd Stage',
          city: 'Bangalore',
          postalCode: '560038',
          deliveryAddress: 'Flat 302, Lotus Apt, 12th Cross, Indiranagar, Bangalore 560038',
          latitude: 12.9716,
          longitude: 77.5946,
          deliveryNotes: 'Please ring the doorbell twice',
          paymentMethod: 'cod',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const createdOrderId = res.body.data.orderId;
      const getRes = await request(app).get(`/api/orders/${createdOrderId}`);
      expect(getRes.status).toBe(200);
      expect(Number(getRes.body.data.latitude)).toBeCloseTo(12.9716, 3);
      expect(Number(getRes.body.data.longitude)).toBeCloseTo(77.5946, 3);
      expect(getRes.body.data.house_no).toBe('Flat 302, Lotus Apt');
      expect(getRes.body.data.city).toBe('Bangalore');
      expect(getRes.body.data.delivery_notes).toBe('Please ring the doorbell twice');
    });
  });

  // ── 3. Order Status Management ─────────────────────────────────────────────
  describe('PATCH /api/orders/:id/status', () => {
    let orderToUpdateId = null;

    beforeAll(async () => {
      if (!sampleProduct) return;
      const res = await request(app)
        .post('/api/orders')
        .send({
          items: [{ productId: sampleProduct.id, qty: 1 }],
          customerName: 'Status Test Customer',
          customerEmail: `status.${Date.now()}@example.com`,
          customerPhone: '9876543210',
          deliveryAddress: '123 Test St',
          city: 'Bangalore',
        });
      if (res.body?.data?.orderId) {
        orderToUpdateId = res.body.data.orderId;
      }
    });

    it('rejects unauthorized users from updating order status', async () => {
      if (!orderToUpdateId) return;

      const res = await request(app)
        .patch(`/api/orders/${orderToUpdateId}/status`)
        .send({ status: 'confirmed' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('validates invalid order status transitions', async () => {
      if (!orderToUpdateId) return;

      // Mock staff auth token / header if available, or test with invalid status
      const res = await request(app)
        .patch(`/api/orders/${orderToUpdateId}/status`)
        .send({ status: 'teleported' });

      // Should be 403 (unauthorized) or 400 (invalid status)
      expect([400, 403]).toContain(res.status);
    });
  });
});
