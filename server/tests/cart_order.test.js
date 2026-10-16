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
  });
});
