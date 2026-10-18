import api from './api';
import { supabase } from '../lib/supabase';

/**
 * Supermarket Admin & Management Service
 * Communicates with Express backend (/api/admin) with Supabase PostgreSQL fallback
 */
export const adminService = {
  // ── 1. Dashboard Metrics ──────────────────────────────────────────────────
  async getDashboardMetrics() {
    try {
      const res = await api.get('/admin/metrics');
      if (res.data?.success && res.data?.data) {
        return res.data.data;
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        throw err;
      }
      console.warn('Backend /admin/metrics unavailable, using direct Supabase client:', err.message);
    }

    if (!supabase) throw new Error('Supabase client not initialized');

    // Products metrics
    const { data: products, error: prodErr } = await supabase
      .from('products')
      .select('id, price, stock_quantity, is_active');
    if (prodErr) throw prodErr;

    const totalProducts = products?.length || 0;
    const activeProducts = products?.filter((p) => p.is_active) || [];
    const totalInventoryValue = activeProducts.reduce(
      (sum, p) => sum + (Number(p.price) || 0) * (Number(p.stock_quantity) || 0),
      0
    );
    const lowStockCount = activeProducts.filter(
      (p) => (Number(p.stock_quantity) || 0) <= 10 && (Number(p.stock_quantity) || 0) > 0
    ).length;
    const outOfStockCount = activeProducts.filter(
      (p) => (Number(p.stock_quantity) || 0) === 0
    ).length;

    // Orders metrics
    const { data: orders, error: ordErr } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (ordErr) throw ordErr;

    const allOrders = orders || [];
    const totalOrders = allOrders.length;

    // Today's sales
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayOrders = allOrders.filter(
      (o) => o.created_at?.slice(0, 10) === todayStr && o.status === 'completed'
    );
    const todaySales = todayOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    // Recent transactions (top 6)
    const recentTransactions = allOrders.slice(0, 6);

    // Expiring batches (within 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const dateLimit = thirtyDaysFromNow.toISOString().slice(0, 10);

    const { data: expiringBatches, error: batchErr } = await supabase
      .from('product_batches')
      .select('*, products(name, sku, category)')
      .gt('quantity_remaining', 0)
      .lte('expiry_date', dateLimit)
      .order('expiry_date', { ascending: true })
      .limit(6);
    if (batchErr) console.warn('Could not fetch expiring batches:', batchErr.message);

    // Sales trend for the last 7 days
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().slice(0, 10);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayOrders = allOrders.filter(
        (o) => o.created_at?.slice(0, 10) === dateKey && o.status === 'completed'
      );
      const sales = dayOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
      last7Days.push({
        date: dateKey,
        day: dayName,
        sales: Math.round(sales * 100) / 100,
        orders: dayOrders.length,
      });
    }

    // Category distribution
    const categoryMap = {};
    activeProducts.forEach((p) => {
      const cat = p.category || 'General';
      if (!categoryMap[cat]) categoryMap[cat] = { name: cat, count: 0, value: 0 };
      categoryMap[cat].count += 1;
      categoryMap[cat].value += (Number(p.price) || 0) * (Number(p.stock_quantity) || 0);
    });

    return {
      totalProducts,
      totalInventoryValue: Math.round(totalInventoryValue * 100) / 100,
      lowStockCount,
      outOfStockCount,
      todaySales: Math.round(todaySales * 100) / 100,
      todayOrdersCount: todayOrders.length,
      totalOrders,
      recentTransactions,
      expiringBatches: expiringBatches || [],
      salesTrend: last7Days,
      categoryDistribution: Object.values(categoryMap),
    };
  },

  // ── 2. Product Management ─────────────────────────────────────────────────
  async getProducts({ search = '', category = '', status = 'all' } = {}) {
    try {
      const res = await api.get('/admin/products', {
        params: { search, category, status, limit: 100 },
      });
      if (res.data?.success && Array.isArray(res.data?.data)) {
        return res.data.data;
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        throw err;
      }
      console.warn('Backend /admin/products unavailable, using direct Supabase client:', err.message);
    }

    if (!supabase) throw new Error('Supabase not ready');
    let query = supabase.from('products').select('*').order('name', { ascending: true });

    if (search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(`name.ilike.${term},sku.ilike.${term},barcode.ilike.${term}`);
    }
    if (category && category !== 'all') {
      query = query.eq('category', category);
    }
    if (status === 'active') {
      query = query.eq('is_active', true);
    } else if (status === 'inactive') {
      query = query.eq('is_active', false);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async addProduct(product) {
    try {
      const res = await api.post('/admin/products', product);
      if (res.data?.success && res.data?.data) {
        return res.data.data;
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        throw err;
      }
      console.warn('Backend /admin/products POST failed, using direct Supabase client:', err.message);
    }

    if (!supabase) throw new Error('Supabase not ready');
    const { data, error } = await supabase
      .from('products')
      .insert([
        {
          name: product.name,
          sku: product.sku,
          barcode: product.barcode || null,
          category: product.category || 'General',
          description: product.description || '',
          price: Number(product.price),
          cost_price: Number(product.cost_price || 0),
          stock_quantity: Number(product.stock_quantity || 0),
          low_stock_threshold: Number(product.low_stock_threshold || 10),
          image_url: product.image_url || null,
          is_active: product.is_active ?? true,
        },
      ])
      .select()
      .single();
    if (error) throw error;

    // If initial stock quantity and batch info provided, record initial batch & movement
    if (Number(product.stock_quantity) > 0 && product.batch_number) {
      await supabase.from('product_batches').insert([
        {
          product_id: data.id,
          batch_number: product.batch_number,
          barcode: product.barcode || null,
          quantity_received: Number(product.stock_quantity),
          quantity_remaining: Number(product.stock_quantity),
          expiry_date: product.expiry_date || new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10),
        },
      ]);

      await supabase.from('stock_movements').insert([
        {
          product_id: data.id,
          movement_type: 'received',
          quantity: Number(product.stock_quantity),
          previous_stock: 0,
          new_stock: Number(product.stock_quantity),
          reason: 'Initial stock on product creation',
          reference_id: product.batch_number,
        },
      ]);
    }

    return data;
  },

  async updateProduct(id, updates) {
    try {
      const res = await api.put(`/admin/products/${id}`, updates);
      if (res.data?.success && res.data?.data) {
        return res.data.data;
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        throw err;
      }
      console.warn('Backend /admin/products PUT failed, using direct Supabase client:', err.message);
    }

    if (!supabase) throw new Error('Supabase not ready');
    const { data, error } = await supabase
      .from('products')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async toggleProductStatus(id, isActive) {
    return this.updateProduct(id, { is_active: isActive });
  },

  async deleteProduct(id) {
    try {
      const res = await api.delete(`/admin/products/${id}`);
      if (res.data?.success) {
        return true;
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        throw err;
      }
      console.warn('Backend /admin/products DELETE failed, using direct Supabase client:', err.message);
    }

    if (!supabase) throw new Error('Supabase not ready');
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  // ── 3. Inventory & FEFO Batches ───────────────────────────────────────────
  async getInventoryBatches() {
    try {
      const res = await api.get('/admin/inventory');
      if (res.data?.success && Array.isArray(res.data?.data)) {
        return res.data.data;
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        throw err;
      }
      console.warn('Backend /admin/inventory failed, using direct Supabase client:', err.message);
    }

    if (!supabase) throw new Error('Supabase not ready');
    const { data, error } = await supabase
      .from('product_batches')
      .select('*, products(name, sku, category, price, stock_quantity)')
      .order('expiry_date', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async receiveStockBatch(batchData) {
    try {
      const res = await api.post('/admin/inventory/batches', batchData);
      if (res.data?.success && res.data?.data) {
        return res.data.data;
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        throw err;
      }
      console.warn('Backend /admin/inventory/batches failed, using direct Supabase client:', err.message);
    }

    const {
      productId,
      batchNumber,
      barcode,
      quantityReceived,
      manufacturingDate,
      expiryDate,
      costPrice,
    } = batchData;

    if (!supabase) throw new Error('Supabase not ready');

    const qty = Number(quantityReceived);
    if (qty <= 0) throw new Error('Quantity must be greater than 0');

    // 1. Get current product stock
    const { data: product, error: fetchErr } = await supabase
      .from('products')
      .select('stock_quantity')
      .eq('id', productId)
      .single();
    if (fetchErr) throw fetchErr;

    const prevStock = Number(product.stock_quantity) || 0;
    const newStock = prevStock + qty;

    // 2. Insert batch record
    const { data: batch, error: batchErr } = await supabase
      .from('product_batches')
      .insert([
        {
          product_id: productId,
          batch_number: batchNumber,
          barcode: barcode || null,
          quantity_received: qty,
          quantity_remaining: qty,
          manufacturing_date: manufacturingDate || null,
          expiry_date: expiryDate,
          is_available: true,
        },
      ])
      .select()
      .single();
    if (batchErr) throw batchErr;

    // 3. Update product total stock
    const { error: prodErr } = await supabase
      .from('products')
      .update({
        stock_quantity: newStock,
        ...(costPrice ? { cost_price: Number(costPrice) } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId);
    if (prodErr) throw prodErr;

    // 4. Record stock movement
    await supabase.from('stock_movements').insert([
      {
        product_id: productId,
        batch_id: batch.id,
        movement_type: 'received',
        quantity: qty,
        previous_stock: prevStock,
        new_stock: newStock,
        reason: `Restock batch ${batchNumber}`,
        reference_id: batchNumber,
      },
    ]);

    return batch;
  },

  async adjustStock(adjustData) {
    try {
      const res = await api.post('/admin/inventory/adjust', adjustData);
      if (res.data?.success && res.data?.data) {
        return res.data.data;
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        throw err;
      }
      console.warn('Backend /admin/inventory/adjust failed, using direct Supabase client:', err.message);
    }

    const { productId, batchId, quantityDelta, reason, performedBy } = adjustData;
    if (!supabase) throw new Error('Supabase not ready');

    const delta = Number(quantityDelta);
    if (delta === 0) throw new Error('Adjustment quantity cannot be 0');

    // Current product stock
    const { data: product, error: pErr } = await supabase
      .from('products')
      .select('stock_quantity')
      .eq('id', productId)
      .single();
    if (pErr) throw pErr;

    const prevStock = Number(product.stock_quantity) || 0;
    const newStock = Math.max(0, prevStock + delta);

    // Adjust batch if specified
    if (batchId) {
      const { data: batch } = await supabase
        .from('product_batches')
        .select('quantity_remaining')
        .eq('id', batchId)
        .single();
      if (batch) {
        const newBatchRemaining = Math.max(0, (Number(batch.quantity_remaining) || 0) + delta);
        await supabase
          .from('product_batches')
          .update({ quantity_remaining: newBatchRemaining })
          .eq('id', batchId);
      }
    }

    // Update product stock
    await supabase
      .from('products')
      .update({
        stock_quantity: newStock,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId);

    // Record movement
    const movementType = delta > 0 ? 'adjustment' : reason?.toLowerCase().includes('expire') ? 'expired' : 'adjustment';
    await supabase.from('stock_movements').insert([
      {
        product_id: productId,
        batch_id: batchId || null,
        movement_type: movementType,
        quantity: delta,
        previous_stock: prevStock,
        new_stock: newStock,
        reason: reason || 'Manual stock adjustment',
        performed_by: performedBy || null,
      },
    ]);

    return { prevStock, newStock };
  },

  async toggleBatchAvailability(batchId, isAvailable) {
    if (!supabase) throw new Error('Supabase not ready');
    const { data, error } = await supabase
      .from('product_batches')
      .update({ is_available: isAvailable })
      .eq('id', batchId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getStockMovements(limit = 40) {
    try {
      const res = await api.get('/admin/inventory/movements', { params: { limit } });
      if (res.data?.success && Array.isArray(res.data?.data)) {
        return res.data.data;
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        throw err;
      }
      console.warn('Backend /admin/inventory/movements failed, using direct Supabase client:', err.message);
    }

    if (!supabase) throw new Error('Supabase not ready');
    const { data, error } = await supabase
      .from('stock_movements')
      .select('*, products(name, sku, category)')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  // ── 4. Orders & Sales (with atomic FEFO deduction) ────────────────────────
  async getOrders({ search = '', type = 'all', status = 'all' } = {}) {
    try {
      const res = await api.get('/admin/orders', {
        params: { search, type, status, limit: 100 },
      });
      if (res.data?.success && Array.isArray(res.data?.data)) {
        return res.data.data;
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        throw err;
      }
      console.warn('Backend /admin/orders failed, using direct Supabase client:', err.message);
    }

    if (!supabase) throw new Error('Supabase not ready');
    let query = supabase.from('orders').select('*').order('created_at', { ascending: false });

    if (search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(`order_number.ilike.${term},customer_name.ilike.${term},customer_phone.ilike.${term}`);
    }
    if (type && type !== 'all') {
      query = query.eq('type', type);
    }
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getOrderDetails(orderId) {
    try {
      const res = await api.get(`/admin/orders/${orderId}`);
      if (res.data?.success && res.data?.data) {
        return res.data.data;
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        throw err;
      }
      console.warn('Backend /admin/orders/:id failed, using direct Supabase client:', err.message);
    }

    if (!supabase) throw new Error('Supabase not ready');
    const { data: order, error: ordErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();
    if (ordErr) throw ordErr;

    const { data: items, error: itemErr } = await supabase
      .from('order_items')
      .select('*, products(name, sku, image_url)')
      .eq('order_id', orderId);
    if (itemErr) throw itemErr;

    return {
      ...order,
      items: items || [],
    };
  },

  async updateOrderStatus(orderId, newStatus, notes = '') {
    try {
      const res = await api.patch(`/admin/orders/${orderId}/status`, { status: newStatus, notes });
      if (res.data?.success && res.data?.data) {
        return res.data.data;
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        throw new Error(err.response?.data?.message || 'Unauthorized');
      }
      try {
        const fallbackRes = await api.patch(`/orders/${orderId}/status`, { status: newStatus, notes });
        if (fallbackRes.data?.success && fallbackRes.data?.data) {
          return fallbackRes.data.data;
        }
      } catch (fbErr) {
        const msg = fbErr.response?.data?.message || fbErr.message;
        throw new Error(msg);
      }
      console.warn('Backend updateOrderStatus failed, using direct Supabase fallback:', err.message);
    }

    if (!supabase) throw new Error('Supabase not ready');
    const { data, error } = await supabase
      .from('orders')
      .update({
        status: newStatus,
        payment_status: newStatus === 'completed' || newStatus === 'delivered' ? 'paid' : newStatus === 'refunded' ? 'refunded' : 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async refundOrder(orderId, reason = 'Customer refund') {
    try {
      const res = await api.post(`/admin/orders/${orderId}/refund`, { reason });
      if (res.data?.success) {
        return true;
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        throw err;
      }
      console.warn('Backend /admin/orders/:id/refund failed, using direct Supabase client:', err.message);
    }

    if (!supabase) throw new Error('Supabase not ready');

    // 1. Fetch order and items
    const order = await this.getOrderDetails(orderId);
    if (order.status === 'refunded') throw new Error('Order is already refunded');

    // 2. Mark order as refunded
    await supabase
      .from('orders')
      .update({
        status: 'refunded',
        payment_status: 'refunded',
        notes: `${order.notes || ''} [Refunded: ${reason}]`.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    // 3. Restock items back into inventory
    for (const item of order.items) {
      if (item.product_id) {
        const { data: prod } = await supabase
          .from('products')
          .select('stock_quantity')
          .eq('id', item.product_id)
          .single();

        if (prod) {
          const prev = Number(prod.stock_quantity) || 0;
          const next = prev + Number(item.quantity);

          await supabase
            .from('products')
            .update({ stock_quantity: next, updated_at: new Date().toISOString() })
            .eq('id', item.product_id);

          // Restock batch if available
          if (item.batch_id) {
            const { data: batch } = await supabase
              .from('product_batches')
              .select('quantity_remaining')
              .eq('id', item.batch_id)
              .single();
            if (batch) {
              await supabase
                .from('product_batches')
                .update({ quantity_remaining: (Number(batch.quantity_remaining) || 0) + Number(item.quantity) })
                .eq('id', item.batch_id);
            }
          }

          // Record stock movement
          await supabase.from('stock_movements').insert([
            {
              product_id: item.product_id,
              batch_id: item.batch_id || null,
              movement_type: 'return',
              quantity: Number(item.quantity),
              previous_stock: prev,
              new_stock: next,
              reason: `Refund Order #${order.order_number}`,
              reference_id: order.order_number,
            },
          ]);
        }
      }
    }

    return true;
  },

  // ── 5. POS Transaction with FEFO Stock Deduction ──────────────────────────
  async createPOSOrder({
    items,
    paymentMethod = 'cash',
    customerName = 'Walk-in Customer',
    customerPhone = '',
    cashierName = 'POS Cashier',
    discount = 0,
    taxRate = 5,
    notes = '',
  }) {
    if (!supabase) throw new Error('Supabase not ready');
    if (!items || items.length === 0) throw new Error('No items in cart');

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
    const tax = Math.round((subtotal - discount) * (taxRate / 100) * 100) / 100;
    const total = Math.round((subtotal - discount + tax) * 100) / 100;
    const orderNumber = `POS-${Date.now().toString().slice(-8)}`;

    // 1. Create Order
    const { data: order, error: ordErr } = await supabase
      .from('orders')
      .insert([
        {
          order_number: orderNumber,
          customer_name: customerName,
          customer_phone: customerPhone || null,
          type: 'pos',
          cashier_name: cashierName,
          status: 'completed',
          payment_method: paymentMethod,
          payment_status: 'paid',
          subtotal,
          discount: Number(discount),
          tax,
          total,
          notes,
        },
      ])
      .select()
      .single();
    if (ordErr) throw ordErr;

    // 2. Process each item with FEFO (First Expiring, First Out) batch deduction
    for (const item of items) {
      let neededQty = Number(item.quantity);

      // Check product current stock
      const { data: prod } = await supabase
        .from('products')
        .select('id, name, sku, stock_quantity')
        .eq('id', item.id)
        .single();

      const prevStock = Number(prod?.stock_quantity) || 0;
      const newStock = Math.max(0, prevStock - neededQty);

      // Fetch active batches for product sorted by expiry date ascending (FEFO)
      const { data: batches } = await supabase
        .from('product_batches')
        .select('*')
        .eq('product_id', item.id)
        .eq('is_available', true)
        .gt('quantity_remaining', 0)
        .order('expiry_date', { ascending: true });

      let primaryBatchId = null;

      if (batches && batches.length > 0) {
        for (const batch of batches) {
          if (neededQty <= 0) break;
          const availableInBatch = Number(batch.quantity_remaining) || 0;
          const take = Math.min(neededQty, availableInBatch);

          if (!primaryBatchId) primaryBatchId = batch.id;

          await supabase
            .from('product_batches')
            .update({ quantity_remaining: availableInBatch - take })
            .eq('id', batch.id);

          neededQty -= take;
        }
      }

      // Update product stock
      await supabase
        .from('products')
        .update({ stock_quantity: newStock, updated_at: new Date().toISOString() })
        .eq('id', item.id);

      // Record order item
      await supabase.from('order_items').insert([
        {
          order_id: order.id,
          product_id: item.id,
          product_name: item.name,
          sku: item.sku || null,
          price: Number(item.price),
          quantity: Number(item.quantity),
          batch_id: primaryBatchId,
          total: Number(item.price) * Number(item.quantity),
        },
      ]);

      // Record stock movement
      await supabase.from('stock_movements').insert([
        {
          product_id: item.id,
          batch_id: primaryBatchId,
          movement_type: 'sale',
          quantity: -Number(item.quantity),
          previous_stock: prevStock,
          new_stock: newStock,
          reason: `POS Sale Order #${orderNumber}`,
          reference_id: orderNumber,
        },
      ]);
    }

    return order;
  },

  // ── 6. Users & Staff Management ───────────────────────────────────────────
  async getUsersAndStaff() {
    try {
      const res = await api.get('/admin/users');
      if (res.data?.success && Array.isArray(res.data?.data)) {
        return res.data.data;
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        throw err;
      }
      console.warn('Backend /admin/users failed, using direct Supabase client:', err.message);
    }

    if (!supabase) throw new Error('Supabase not ready');
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async updateUserRole(userId, newRole) {
    try {
      const res = await api.patch(`/admin/users/${userId}/role`, { role: newRole });
      if (res.data?.success && res.data?.data) {
        return res.data.data;
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        throw err;
      }
      console.warn('Backend /admin/users/:id/role failed, using direct Supabase client:', err.message);
    }

    if (!supabase) throw new Error('Supabase not ready');
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async toggleUserActive(userId, isActive) {
    if (!supabase) throw new Error('Supabase not ready');
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async addStaffMember({ email, fullName, role, phone }) {
    if (!supabase) throw new Error('Supabase not ready');
    const { data, error } = await supabase
      .from('user_profiles')
      .insert([
        {
          email,
          full_name: fullName,
          role: role || 'cashier',
          phone: phone || null,
          is_active: true,
        },
      ])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // ── 7. Settings ───────────────────────────────────────────────────────────
  async getStoreSettings() {
    try {
      const res = await api.get('/admin/settings');
      if (res.data?.success && res.data?.data) {
        return res.data.data;
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        throw err;
      }
      console.warn('Backend /admin/settings failed, using direct Supabase client:', err.message);
    }

    if (!supabase) throw new Error('Supabase not ready');
    const { data, error } = await supabase
      .from('store_settings')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();
    if (error) throw error;
    return (
      data || {
        store_name: 'VRK Supermarket',
        email: 'support@vrksupermarket.com',
        phone: '+91 98765 43210',
        address: '123 Market Street, Tech Park',
        tax_rate: 5.0,
        currency: '₹',
        low_stock_threshold: 10,
        invoice_prefix: 'INV-',
      }
    );
  },

  async updateStoreSettings(settings) {
    try {
      const res = await api.put('/admin/settings', settings);
      if (res.data?.success && res.data?.data) {
        return res.data.data;
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        throw err;
      }
      console.warn('Backend /admin/settings PUT failed, using direct Supabase client:', err.message);
    }

    if (!supabase) throw new Error('Supabase not ready');
    const { data, error } = await supabase
      .from('store_settings')
      .upsert({
        id: 'default',
        ...settings,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // ── 8. Categories ─────────────────────────────────────────────────────────
  async getCategories({ search = '' } = {}) {
    try {
      const res = await api.get('/admin/categories', { params: { search } });
      if (res.data?.success && Array.isArray(res.data?.data)) {
        return res.data.data;
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        throw err;
      }
      console.warn('Backend /admin/categories failed, using direct Supabase client:', err.message);
    }

    if (!supabase) throw new Error('Supabase not ready');
    let query = supabase.from('categories').select('*').order('name', { ascending: true });
    if (search.trim()) {
      query = query.ilike('name', `%${search.trim()}%`);
    }
    const { data: categories, error } = await query;
    if (error) throw error;

    // Enrich with live product count
    const { data: prods } = await supabase.from('products').select('category');
    const countMap = {};
    (prods || []).forEach((p) => {
      const c = p.category || 'General';
      countMap[c] = (countMap[c] || 0) + 1;
    });

    return (categories || []).map((cat) => ({
      ...cat,
      product_count: countMap[cat.name] || 0,
    }));
  },

  async addCategory({ name, description }) {
    try {
      const res = await api.post('/admin/categories', { name, description });
      if (res.data?.success && res.data?.data) {
        return res.data.data;
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        throw err;
      }
      console.warn('Backend /admin/categories POST failed, using direct Supabase client:', err.message);
    }

    if (!supabase) throw new Error('Supabase not ready');
    if (!name?.trim()) throw new Error('Category name is required');

    // Duplicate check
    const { data: existing } = await supabase
      .from('categories')
      .select('id')
      .ilike('name', name.trim())
      .maybeSingle();

    if (existing) throw new Error(`Category "${name.trim()}" already exists`);

    const { data, error } = await supabase
      .from('categories')
      .insert([
        {
          name: name.trim(),
          description: description?.trim() || null,
          is_active: true,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateCategory(id, { name, description, is_active }) {
    try {
      const res = await api.put(`/admin/categories/${id}`, { name, description, is_active });
      if (res.data?.success && res.data?.data) {
        return res.data.data;
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        throw err;
      }
      console.warn('Backend /admin/categories PUT failed, using direct Supabase client:', err.message);
    }

    if (!supabase) throw new Error('Supabase not ready');
    const { data: existing, error: fetchErr } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) throw new Error('Category not found');

    if (name && name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const { data: duplicate } = await supabase
        .from('categories')
        .select('id')
        .ilike('name', name.trim())
        .neq('id', id)
        .maybeSingle();

      if (duplicate) throw new Error(`Category "${name.trim()}" already exists`);
    }

    const updates = {
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(is_active !== undefined && { is_active: Boolean(is_active) }),
    };

    const { data, error } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Propagate rename to products table
    if (name && name.trim() !== existing.name) {
      await supabase
        .from('products')
        .update({ category: name.trim(), updated_at: new Date().toISOString() })
        .eq('category', existing.name);
    }

    return data;
  },

  async deleteCategory(id, force = false) {
    try {
      const res = await api.delete(`/admin/categories/${id}`, { params: { force } });
      if (res.data?.success) {
        return true;
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        throw err;
      }
      console.warn('Backend /admin/categories DELETE failed, using direct Supabase client:', err.message);
    }

    if (!supabase) throw new Error('Supabase not ready');
    const { data: category } = await supabase.from('categories').select('*').eq('id', id).single();
    if (!category) throw new Error('Category not found');

    const { data: prods } = await supabase.from('products').select('id').eq('category', category.name);
    if (prods && prods.length > 0 && !force) {
      throw new Error(`Cannot delete category "${category.name}" because ${prods.length} product(s) belong to it. Deactivate it or reassign products first.`);
    }

    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  // ── 9. Customers & Orders Aggregation ──────────────────────────────────────
  async getCustomers({ search = '' } = {}) {
    try {
      const res = await api.get('/admin/customers', { params: { search } });
      if (res.data?.success && Array.isArray(res.data?.data)) {
        return res.data.data;
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        throw err;
      }
      console.warn('Backend /admin/customers failed, using direct Supabase client:', err.message);
    }

    if (!supabase) throw new Error('Supabase not ready');

    const { data: profiles, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const { data: orders } = await supabase
      .from('orders')
      .select('customer_name, customer_phone, total, status, created_at');

    const customerMap = {};
    (orders || []).forEach((o) => {
      const key = o.customer_phone || o.customer_name || 'Walk-in';
      if (!customerMap[key]) {
        customerMap[key] = {
          order_count: 0,
          total_spend: 0,
          last_order: o.created_at,
        };
      }
      customerMap[key].order_count += 1;
      if (o.status === 'completed') {
        customerMap[key].total_spend += Number(o.total) || 0;
      }
    });

    const enriched = (profiles || []).map((u) => {
      const agg = customerMap[u.phone] || customerMap[u.full_name] || { order_count: 0, total_spend: 0 };
      return {
        ...u,
        total_orders: agg.order_count,
        total_spent: Math.round(agg.total_spend * 100) / 100,
        last_order: agg.last_order || u.created_at,
      };
    });

    if (search.trim()) {
      const s = search.toLowerCase();
      return enriched.filter(
        (c) =>
          c.full_name?.toLowerCase().includes(s) ||
          c.email?.toLowerCase().includes(s) ||
          c.phone?.toLowerCase().includes(s)
      );
    }

    return enriched;
  },

  // ── 10. Staff Attendance & ID Card Scanner ────────────────────────────────
  async getAttendanceSummary(date) {
    try {
      const res = await api.get('/admin/attendance/summary', { params: { date } });
      if (res.data?.success && res.data?.data) {
        return res.data.data;
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) throw err;
      console.warn('Backend /admin/attendance/summary failed:', err.message);
    }
    return {
      totalStaff: 0,
      presentToday: 0,
      currentlyWorking: 0,
      lateArrivals: 0,
      absentCount: 0,
      totalRecords: 0,
      totalHoursWorked: 0,
    };
  },

  async getAttendanceRecords(params = {}) {
    try {
      const res = await api.get('/admin/attendance', { params });
      if (res.data?.success && Array.isArray(res.data?.data)) {
        return res.data.data;
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) throw err;
      console.warn('Backend /admin/attendance failed:', err.message);
    }
    return [];
  },

  async getAttendanceStaffList(params = {}) {
    try {
      const res = await api.get('/admin/attendance/staff', { params });
      if (res.data?.success && Array.isArray(res.data?.data)) {
        return res.data.data;
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) throw err;
      console.warn('Backend /admin/attendance/staff failed:', err.message);
    }
    return [];
  },

  async scanStaffIdCard({ identifier, method = 'card_scan' }) {
    const res = await api.post('/admin/attendance/scan', { identifier, method });
    return res.data;
  },

  async manualClockIn(data) {
    const res = await api.post('/admin/attendance/clock-in', data);
    return res.data;
  },

  async manualClockOut(data) {
    const res = await api.post('/admin/attendance/clock-out', data);
    return res.data;
  },

  async getStaffAttendanceHistory(staffProfileId, limit = 30) {
    try {
      const res = await api.get(`/admin/attendance/history/${staffProfileId}`, { params: { limit } });
      if (res.data?.success && Array.isArray(res.data?.data)) {
        return res.data.data;
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) throw err;
      console.warn('Backend history failed:', err.message);
    }
    return [];
  },

  async assignStaffCard(data) {
    const res = await api.post('/admin/attendance/cards/assign', data);
    return res.data;
  },

  async revokeStaffCard(data) {
    const res = await api.post('/admin/attendance/cards/revoke', data);
    return res.data;
  },

  async correctAttendance(id, data) {
    const res = await api.patch(`/admin/attendance/${id}`, data);
    return res.data;
  },
};


