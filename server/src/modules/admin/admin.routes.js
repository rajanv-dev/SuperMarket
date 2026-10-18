const express = require('express');
const { protect, restrictTo } = require('../../middleware/auth');
const { supabaseServer } = require('../../config/supabase');
const { sendSuccess, sendError, paginationMeta } = require('../../utils/response');
const { ROLES } = require('../../config/constants');

const router = express.Router();

// All admin routes require authentication and manager or admin role
router.use(protect);
router.use(restrictTo(ROLES.ADMIN, ROLES.INVENTORY_MANAGER, 'manager'));

// ═══════════════════════════════════════════════════════════════════════════════
// 1. DASHBOARD METRICS & REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/metrics', async (req, res) => {
  try {
    if (!supabaseServer) {
      return sendError(res, { status: 503, message: 'Database service unavailable' });
    }

    const { data: products } = await supabaseServer
      .from('products')
      .select('id, price, stock_quantity, is_active, category');

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

    const { data: orders } = await supabaseServer
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    const allOrders = orders || [];
    const totalOrders = allOrders.length;
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayOrders = allOrders.filter(
      (o) => o.created_at?.slice(0, 10) === todayStr && o.status === 'completed'
    );
    const todaySales = todayOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    // Expiring batches in next 30 days
    const thirtyDaysAhead = new Date();
    thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);
    const { data: expiringBatches } = await supabaseServer
      .from('product_batches')
      .select('*, products(name, sku, category)')
      .gt('quantity_remaining', 0)
      .lte('expiry_date', thirtyDaysAhead.toISOString().slice(0, 10))
      .order('expiry_date', { ascending: true })
      .limit(6);

    // 7-day sales trend
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

    // Category valuation distribution
    const categoryMap = {};
    activeProducts.forEach((p) => {
      const cat = p.category || 'General';
      if (!categoryMap[cat]) categoryMap[cat] = { name: cat, count: 0, value: 0 };
      categoryMap[cat].count += 1;
      categoryMap[cat].value = Math.round((categoryMap[cat].value + (Number(p.price) || 0) * (Number(p.stock_quantity) || 0)) * 100) / 100;
    });

    return sendSuccess(res, {
      status: 200,
      data: {
        totalProducts,
        totalInventoryValue: Math.round(totalInventoryValue * 100) / 100,
        lowStockCount,
        outOfStockCount,
        todaySales: Math.round(todaySales * 100) / 100,
        todayOrdersCount: todayOrders.length,
        totalOrders,
        recentTransactions: allOrders.slice(0, 6),
        expiringBatches: expiringBatches || [],
        salesTrend: last7Days,
        categoryDistribution: Object.values(categoryMap),
      },
    });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

router.get('/reports', async (req, res) => {
  try {
    const { data: orders } = await supabaseServer
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: products } = await supabaseServer
      .from('products')
      .select('id, name, sku, category, price, stock_quantity, is_active');

    const totalRevenue = (orders || [])
      .filter((o) => o.status === 'completed')
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const totalInventoryValue = (products || [])
      .filter((p) => p.is_active)
      .reduce((sum, p) => sum + (Number(p.price) || 0) * (Number(p.stock_quantity) || 0), 0);

    return sendSuccess(res, {
      status: 200,
      data: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalOrders: orders?.length || 0,
        totalInventoryValue: Math.round(totalInventoryValue * 100) / 100,
        totalProducts: products?.length || 0,
      },
    });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. PRODUCT CRUD
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/admin/products (List with search, category, status, pagination)
router.get('/products', async (req, res) => {
  try {
    const { search = '', category = '', status = 'all', page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    let query = supabaseServer
      .from('products')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    const cleanSearch = search.trim().replace(/[,()"]/g, ' ').trim();
    if (cleanSearch) {
      const term = `%${cleanSearch}%`;
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

    const { data, count, error } = await query.range(from, to);
    if (error) throw error;

    return sendSuccess(res, {
      status: 200,
      data,
      meta: paginationMeta(count || 0, pageNum, limitNum),
    });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

// GET /api/admin/products/:id
router.get('/products/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseServer
      .from('products')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !data) {
      return sendError(res, { status: 404, message: 'Product not found' });
    }
    return sendSuccess(res, { status: 200, data });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

// POST /api/admin/products
router.post('/products', async (req, res) => {
  try {
    const {
      name,
      sku,
      barcode,
      category,
      description,
      price,
      cost_price,
      stock_quantity,
      low_stock_threshold,
      image_url,
      is_active,
      batch_number,
      expiry_date,
    } = req.body;

    // Server-side validation
    if (!name || !name.trim()) {
      return sendError(res, { status: 400, message: 'Product name is required' });
    }
    if (!sku || !sku.trim()) {
      return sendError(res, { status: 400, message: 'Product SKU is required' });
    }
    if (price === undefined || Number(price) < 0) {
      return sendError(res, { status: 400, message: 'Valid non-negative price is required' });
    }
    if (stock_quantity !== undefined && Number(stock_quantity) < 0) {
      return sendError(res, { status: 400, message: 'Stock quantity cannot be negative' });
    }

    // Check duplicate SKU
    const { data: existingSku } = await supabaseServer
      .from('products')
      .select('id')
      .eq('sku', sku.trim())
      .maybeSingle();

    if (existingSku) {
      return sendError(res, { status: 409, message: `A product with SKU "${sku.trim()}" already exists` });
    }

    // Check duplicate barcode if provided
    if (barcode && barcode.trim()) {
      const { data: existingBarcode } = await supabaseServer
        .from('products')
        .select('id')
        .eq('barcode', barcode.trim())
        .maybeSingle();

      if (existingBarcode) {
        return sendError(res, { status: 409, message: `A product with barcode "${barcode.trim()}" already exists` });
      }
    }

    const { data: product, error } = await supabaseServer
      .from('products')
      .insert([
        {
          name: name.trim(),
          sku: sku.trim(),
          barcode: barcode?.trim() || null,
          category: category?.trim() || 'General',
          description: description?.trim() || '',
          price: Number(price),
          cost_price: Number(cost_price || 0),
          stock_quantity: Number(stock_quantity || 0),
          low_stock_threshold: Number(low_stock_threshold || 10),
          image_url: image_url?.trim() || null,
          is_active: is_active ?? true,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    // Optional initial batch and stock movement logging
    if (Number(stock_quantity) > 0 && batch_number) {
      const defaultExp = new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10);
      const { data: batch } = await supabaseServer
        .from('product_batches')
        .insert([
          {
            product_id: product.id,
            batch_number: batch_number.trim(),
            barcode: barcode?.trim() || null,
            quantity_received: Number(stock_quantity),
            quantity_remaining: Number(stock_quantity),
            expiry_date: expiry_date || defaultExp,
            is_available: true,
          },
        ])
        .select()
        .single();

      await supabaseServer.from('stock_movements').insert([
        {
          product_id: product.id,
          batch_id: batch ? batch.id : null,
          movement_type: 'received',
          quantity: Number(stock_quantity),
          previous_stock: 0,
          new_stock: Number(stock_quantity),
          reason: 'Initial stock on product creation',
          reference_id: batch_number.trim(),
          performed_by: req.user?.email || 'admin',
        },
      ]);
    }

    return sendSuccess(res, {
      status: 201,
      message: 'Product created successfully',
      data: product,
    });
  } catch (err) {
    if (err.code === '23505') {
      return sendError(res, { status: 409, message: 'Duplicate SKU or barcode violation' });
    }
    return sendError(res, { status: 500, message: err.message });
  }
});

// PUT /api/admin/products/:id
router.put('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      sku,
      barcode,
      category,
      description,
      price,
      cost_price,
      stock_quantity,
      low_stock_threshold,
      image_url,
      is_active,
    } = req.body;

    // Verify product exists
    const { data: existing, error: findErr } = await supabaseServer
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (findErr || !existing) {
      return sendError(res, { status: 404, message: 'Product not found' });
    }

    if (price !== undefined && Number(price) < 0) {
      return sendError(res, { status: 400, message: 'Price cannot be negative' });
    }
    if (stock_quantity !== undefined && Number(stock_quantity) < 0) {
      return sendError(res, { status: 400, message: 'Stock quantity cannot be negative' });
    }

    // Check duplicate SKU if changed
    if (sku && sku.trim() !== existing.sku) {
      const { data: duplicateSku } = await supabaseServer
        .from('products')
        .select('id')
        .eq('sku', sku.trim())
        .neq('id', id)
        .maybeSingle();

      if (duplicateSku) {
        return sendError(res, { status: 409, message: `SKU "${sku.trim()}" is already used by another product` });
      }
    }

    // Check duplicate barcode if changed
    if (barcode && barcode.trim() !== existing.barcode) {
      const { data: duplicateBarcode } = await supabaseServer
        .from('products')
        .select('id')
        .eq('barcode', barcode.trim())
        .neq('id', id)
        .maybeSingle();

      if (duplicateBarcode) {
        return sendError(res, { status: 409, message: `Barcode "${barcode.trim()}" is already used by another product` });
      }
    }

    const updates = {
      ...(name !== undefined && { name: name.trim() }),
      ...(sku !== undefined && { sku: sku.trim() }),
      ...(barcode !== undefined && { barcode: barcode?.trim() || null }),
      ...(category !== undefined && { category: category?.trim() || 'General' }),
      ...(description !== undefined && { description: description?.trim() || '' }),
      ...(price !== undefined && { price: Number(price) }),
      ...(cost_price !== undefined && { cost_price: Number(cost_price) }),
      ...(stock_quantity !== undefined && { stock_quantity: Number(stock_quantity) }),
      ...(low_stock_threshold !== undefined && { low_stock_threshold: Number(low_stock_threshold) }),
      ...(image_url !== undefined && { image_url: image_url?.trim() || null }),
      ...(is_active !== undefined && { is_active: Boolean(is_active) }),
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error } = await supabaseServer
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return sendSuccess(res, {
      status: 200,
      message: 'Product updated successfully',
      data: updated,
    });
  } catch (err) {
    if (err.code === '23505') {
      return sendError(res, { status: 409, message: 'Duplicate SKU or barcode constraint violation' });
    }
    return sendError(res, { status: 500, message: err.message });
  }
});

// DELETE /api/admin/products/:id
router.delete('/products/:id', restrictTo(ROLES.ADMIN), async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query;

    const { data: product, error: fetchErr } = await supabaseServer
      .from('products')
      .select('id, name')
      .eq('id', id)
      .single();

    if (fetchErr || !product) {
      return sendError(res, { status: 404, message: 'Product not found' });
    }

    // Check if product is referenced in order_items or product_batches
    const { data: orderItemRefs } = await supabaseServer
      .from('order_items')
      .select('id')
      .eq('product_id', id)
      .limit(1);

    const hasOrderHistory = orderItemRefs && orderItemRefs.length > 0;

    // Prefer soft delete if order history exists or if permanent flag is not requested
    if (hasOrderHistory || permanent !== 'true') {
      const { data, error } = await supabaseServer
        .from('products')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return sendSuccess(res, {
        status: 200,
        message: hasOrderHistory
          ? 'Product has order history and was safely deactivated instead of deleted'
          : 'Product deactivated successfully',
        data,
      });
    }

    // Safe hard delete (removes unused batches first if needed)
    await supabaseServer.from('product_batches').delete().eq('product_id', id);
    const { error: delErr } = await supabaseServer.from('products').delete().eq('id', id);
    if (delErr) throw delErr;

    return sendSuccess(res, {
      status: 200,
      message: 'Product permanently deleted',
    });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. INVENTORY & BATCH CRUD
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/admin/inventory (List batches with product info)
router.get('/inventory', async (req, res) => {
  try {
    const { search = '', status = 'all' } = req.query;

    let query = supabaseServer
      .from('product_batches')
      .select('*, products(id, name, sku, category, price, stock_quantity)')
      .order('expiry_date', { ascending: true });

    const cleanSearch = search.trim().replace(/[,()"]/g, ' ').trim();
    if (cleanSearch) {
      const term = `%${cleanSearch}%`;
      query = query.or(`batch_number.ilike.${term},barcode.ilike.${term}`);
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const thirtyDaysAhead = new Date();
    thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);
    const dateLimit = thirtyDaysAhead.toISOString().slice(0, 10);

    if (status === 'expiring_soon') {
      query = query.gt('quantity_remaining', 0).gte('expiry_date', todayStr).lte('expiry_date', dateLimit);
    } else if (status === 'expired') {
      query = query.lt('expiry_date', todayStr);
    } else if (status === 'active') {
      query = query.gt('quantity_remaining', 0).gte('expiry_date', todayStr).eq('is_available', true);
    }

    const { data, error } = await query;
    if (error) throw error;

    return sendSuccess(res, { status: 200, data });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

// POST /api/admin/inventory/batches (Receive new stock batch)
router.post('/inventory/batches', async (req, res) => {
  try {
    const product_id = req.body.product_id || req.body.productId;
    const batch_number = req.body.batch_number || req.body.batchNumber;
    const barcode = req.body.barcode;
    const quantity_received = req.body.quantity_received !== undefined ? req.body.quantity_received : req.body.quantityReceived;
    const manufacturing_date = req.body.manufacturing_date || req.body.manufacturingDate;
    const expiry_date = req.body.expiry_date || req.body.expiryDate;
    const cost_price = req.body.cost_price !== undefined ? req.body.cost_price : req.body.costPrice;

    if (!product_id) {
      return sendError(res, { status: 400, message: 'Product ID is required' });
    }
    if (!batch_number || !batch_number.trim()) {
      return sendError(res, { status: 400, message: 'Batch number is required' });
    }
    const qty = Number(quantity_received);
    if (!qty || qty <= 0) {
      return sendError(res, { status: 400, message: 'Quantity received must be greater than 0' });
    }
    if (!expiry_date) {
      return sendError(res, { status: 400, message: 'Expiry date is required' });
    }

    // 1. Get current product
    const { data: product, error: fetchErr } = await supabaseServer
      .from('products')
      .select('id, stock_quantity')
      .eq('id', product_id)
      .single();

    if (fetchErr || !product) {
      return sendError(res, { status: 404, message: 'Product not found' });
    }

    const prevStock = Number(product.stock_quantity) || 0;
    const newStock = prevStock + qty;

    // 2. Insert batch record
    const { data: batch, error: batchErr } = await supabaseServer
      .from('product_batches')
      .insert([
        {
          product_id,
          batch_number: batch_number.trim(),
          barcode: barcode?.trim() || null,
          quantity_received: qty,
          quantity_remaining: qty,
          manufacturing_date: manufacturing_date || null,
          expiry_date,
          is_available: true,
        },
      ])
      .select()
      .single();

    if (batchErr) throw batchErr;

    // 3. Atomically update product stock
    await supabaseServer
      .from('products')
      .update({
        stock_quantity: newStock,
        ...(cost_price ? { cost_price: Number(cost_price) } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', product_id);

    // 4. Log auditable movement
    await supabaseServer.from('stock_movements').insert([
      {
        product_id,
        batch_id: batch.id,
        movement_type: 'received',
        quantity: qty,
        previous_stock: prevStock,
        new_stock: newStock,
        reason: `Restock batch ${batch_number.trim()}`,
        reference_id: batch_number.trim(),
        performed_by: req.user?.email || 'admin',
      },
    ]);

    return sendSuccess(res, {
      status: 201,
      message: 'Stock batch added successfully',
      data: batch,
    });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

// PUT /api/admin/inventory/batches/:id (Update batch details or toggle availability)
router.put('/inventory/batches/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { expiry_date, is_available, barcode } = req.body;

    const updates = {
      ...(expiry_date !== undefined && { expiry_date }),
      ...(is_available !== undefined && { is_available: Boolean(is_available) }),
      ...(barcode !== undefined && { barcode: barcode?.trim() || null }),
    };

    const { data, error } = await supabaseServer
      .from('product_batches')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return sendSuccess(res, { status: 200, message: 'Batch updated successfully', data });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

// POST /api/admin/inventory/adjust (Manual auditable stock adjustment)
router.post('/inventory/adjust', async (req, res) => {
  try {
    const product_id = req.body.product_id || req.body.productId;
    const batch_id = req.body.batch_id || req.body.batchId;
    const quantity_delta = req.body.quantity_delta !== undefined ? req.body.quantity_delta : req.body.quantityDelta;
    const reason = req.body.reason;
    const delta = Number(quantity_delta);

    if (!product_id) return sendError(res, { status: 400, message: 'Product ID required' });
    if (!delta || delta === 0) return sendError(res, { status: 400, message: 'Adjustment delta cannot be 0' });

    const { data: product, error: pErr } = await supabaseServer
      .from('products')
      .select('stock_quantity')
      .eq('id', product_id)
      .single();

    if (pErr || !product) return sendError(res, { status: 404, message: 'Product not found' });

    const prevStock = Number(product.stock_quantity) || 0;
    const newStock = Math.max(0, prevStock + delta);

    if (batch_id) {
      const { data: batch } = await supabaseServer
        .from('product_batches')
        .select('quantity_remaining')
        .eq('id', batch_id)
        .single();

      if (batch) {
        const nextBatch = Math.max(0, (Number(batch.quantity_remaining) || 0) + delta);
        await supabaseServer
          .from('product_batches')
          .update({ quantity_remaining: nextBatch })
          .eq('id', batch_id);
      }
    }

    await supabaseServer
      .from('products')
      .update({ stock_quantity: newStock, updated_at: new Date().toISOString() })
      .eq('id', product_id);

    const movementType = delta > 0 ? 'adjustment' : reason?.toLowerCase().includes('expire') ? 'expired' : 'adjustment';
    await supabaseServer.from('stock_movements').insert([
      {
        product_id,
        batch_id: batch_id || null,
        movement_type: movementType,
        quantity: delta,
        previous_stock: prevStock,
        new_stock: newStock,
        reason: reason || 'Manual stock adjustment',
        performed_by: req.user?.email || 'admin',
      },
    ]);

    return sendSuccess(res, {
      status: 200,
      message: 'Stock adjusted successfully',
      data: { previous_stock: prevStock, new_stock: newStock },
    });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

// GET /api/admin/inventory/movements
router.get('/inventory/movements', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const { data, error } = await supabaseServer
      .from('stock_movements')
      .select('*, products(name, sku, category)')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit, 10));

    if (error) throw error;
    return sendSuccess(res, { status: 200, data });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. CATEGORY CRUD
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/admin/categories (List categories with product count)
router.get('/categories', async (req, res) => {
  try {
    const { search = '', status = 'all' } = req.query;

    let query = supabaseServer.from('categories').select('*').order('name', { ascending: true });

    if (search.trim()) {
      query = query.ilike('name', `%${search.trim()}%`);
    }
    if (status === 'active') {
      query = query.eq('is_active', true);
    } else if (status === 'inactive') {
      query = query.eq('is_active', false);
    }

    const { data: categories, error } = await query;
    if (error) throw error;

    // Compute live product counts per category
    const { data: products } = await supabaseServer.from('products').select('category');
    const countMap = {};
    (products || []).forEach((p) => {
      const c = p.category || 'General';
      countMap[c] = (countMap[c] || 0) + 1;
    });

    const enriched = (categories || []).map((cat) => ({
      ...cat,
      product_count: countMap[cat.name] || 0,
    }));

    return sendSuccess(res, { status: 200, data: enriched });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

// POST /api/admin/categories
router.post('/categories', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return sendError(res, { status: 400, message: 'Category name is required' });
    }

    // Check duplicate
    const { data: existing } = await supabaseServer
      .from('categories')
      .select('id')
      .ilike('name', name.trim())
      .maybeSingle();

    if (existing) {
      return sendError(res, { status: 409, message: `Category "${name.trim()}" already exists` });
    }

    const { data, error } = await supabaseServer
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
    return sendSuccess(res, { status: 201, message: 'Category created successfully', data });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

// PUT /api/admin/categories/:id
router.put('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, is_active } = req.body;

    const { data: existing, error: findErr } = await supabaseServer
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();

    if (findErr || !existing) {
      return sendError(res, { status: 404, message: 'Category not found' });
    }

    if (name && name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const { data: duplicate } = await supabaseServer
        .from('categories')
        .select('id')
        .ilike('name', name.trim())
        .neq('id', id)
        .maybeSingle();

      if (duplicate) {
        return sendError(res, { status: 409, message: `Category "${name.trim()}" already exists` });
      }
    }

    const updates = {
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(is_active !== undefined && { is_active: Boolean(is_active) }),
    };

    const { data, error } = await supabaseServer
      .from('categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // If category name was renamed, update associated products
    if (name && name.trim() !== existing.name) {
      await supabaseServer
        .from('products')
        .update({ category: name.trim(), updated_at: new Date().toISOString() })
        .eq('category', existing.name);
    }

    return sendSuccess(res, { status: 200, message: 'Category updated successfully', data });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

// DELETE /api/admin/categories/:id
router.delete('/categories/:id', restrictTo(ROLES.ADMIN), async (req, res) => {
  try {
    const { id } = req.params;
    const { force } = req.query;

    const { data: category, error: findErr } = await supabaseServer
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();

    if (findErr || !category) {
      return sendError(res, { status: 404, message: 'Category not found' });
    }

    // Check if products are using this category
    const { data: associatedProducts } = await supabaseServer
      .from('products')
      .select('id, name')
      .eq('category', category.name);

    if (associatedProducts && associatedProducts.length > 0 && force !== 'true') {
      return sendError(res, {
        status: 400,
        message: `Cannot delete category "${category.name}" because ${associatedProducts.length} product(s) are assigned to it. Deactivate the category instead or reassign the products.`,
      });
    }

    const { error: delErr } = await supabaseServer.from('categories').delete().eq('id', id);
    if (delErr) throw delErr;

    return sendSuccess(res, { status: 200, message: `Category "${category.name}" deleted successfully` });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. ORDERS & SALES CRUD
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/orders', async (req, res) => {
  try {
    const { search = '', type = 'all', status = 'all', page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    let query = supabaseServer
      .from('orders')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    const cleanSearch = search.trim().replace(/[,()"]/g, ' ').trim();
    if (cleanSearch) {
      const term = `%${cleanSearch}%`;
      query = query.or(`order_number.ilike.${term},customer_name.ilike.${term},customer_phone.ilike.${term}`);
    }
    if (type && type !== 'all') {
      query = query.eq('type', type);
    }
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, count, error } = await query.range(from, to);
    if (error) throw error;

    return sendSuccess(res, {
      status: 200,
      data,
      meta: paginationMeta(count || 0, pageNum, limitNum),
    });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

router.get('/orders/:id', async (req, res) => {
  try {
    const { data: order, error: ordErr } = await supabaseServer
      .from('orders')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (ordErr || !order) {
      return sendError(res, { status: 404, message: 'Order not found' });
    }

    const { data: items } = await supabaseServer
      .from('order_items')
      .select('*, products(name, sku, image_url)')
      .eq('order_id', order.id);

    return sendSuccess(res, {
      status: 200,
      data: { ...order, items: items || [] },
    });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

// POST /api/admin/orders/:id/refund
router.post('/orders/:id/refund', restrictTo(ROLES.ADMIN), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Admin initiated refund' } = req.body;

    const { data: order } = await supabaseServer.from('orders').select('*').eq('id', id).single();
    if (!order) return sendError(res, { status: 404, message: 'Order not found' });
    if (order.status === 'refunded') {
      return sendError(res, { status: 400, message: 'Order has already been refunded' });
    }

    // 1. Mark as refunded
    await supabaseServer
      .from('orders')
      .update({
        status: 'refunded',
        payment_status: 'refunded',
        notes: `${order.notes || ''} [Refunded: ${reason}]`.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    // 2. Fetch items & return stock
    const { data: items } = await supabaseServer.from('order_items').select('*').eq('order_id', id);
    for (const item of items || []) {
      if (item.product_id) {
        const { data: prod } = await supabaseServer
          .from('products')
          .select('stock_quantity')
          .eq('id', item.product_id)
          .single();

        if (prod) {
          const nextStock = (Number(prod.stock_quantity) || 0) + Number(item.quantity);
          await supabaseServer
            .from('products')
            .update({ stock_quantity: nextStock, updated_at: new Date().toISOString() })
            .eq('id', item.product_id);

          if (item.batch_id) {
            const { data: batch } = await supabaseServer
              .from('product_batches')
              .select('quantity_remaining')
              .eq('id', item.batch_id)
              .single();

            if (batch) {
              await supabaseServer
                .from('product_batches')
                .update({ quantity_remaining: (Number(batch.quantity_remaining) || 0) + Number(item.quantity) })
                .eq('id', item.batch_id);
            }
          }

          await supabaseServer.from('stock_movements').insert([
            {
              product_id: item.product_id,
              batch_id: item.batch_id || null,
              movement_type: 'return',
              quantity: Number(item.quantity),
              previous_stock: Number(prod.stock_quantity) || 0,
              new_stock: nextStock,
              reason: `Refund Order #${order.order_number}`,
              reference_id: order.order_number,
              performed_by: req.user?.email || 'admin',
            },
          ]);
        }
      }
    }

    return sendSuccess(res, { status: 200, message: 'Order refunded and stock returned successfully' });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. CUSTOMER & USER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/users', async (req, res) => {
  try {
    const { data, error } = await supabaseServer
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return sendSuccess(res, { status: 200, data });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

// GET /api/admin/customers (Customers with order aggregation)
router.get('/customers', async (req, res) => {
  try {
    const { search = '' } = req.query;

    const { data: profiles, error } = await supabaseServer
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch order aggregates
    const { data: orders } = await supabaseServer
      .from('orders')
      .select('customer_name, customer_phone, total, status, created_at');

    // Aggregate by customer name/phone
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
      };
    });

    let filtered = enriched;
    if (search.trim()) {
      const s = search.toLowerCase();
      filtered = enriched.filter(
        (c) =>
          c.full_name?.toLowerCase().includes(s) ||
          c.email?.toLowerCase().includes(s) ||
          c.phone?.toLowerCase().includes(s)
      );
    }

    return sendSuccess(res, { status: 200, data: filtered });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

router.patch('/users/:id/role', restrictTo(ROLES.ADMIN), async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'manager', 'cashier', 'customer'].includes(role)) {
      return sendError(res, { status: 400, message: 'Invalid role specified' });
    }
    const { data, error } = await supabaseServer
      .from('user_profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    return sendSuccess(res, { status: 200, data, message: 'Role updated successfully' });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. STORE SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/settings', async (req, res) => {
  try {
    const { data, error } = await supabaseServer
      .from('store_settings')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();

    if (error) throw error;

    return sendSuccess(res, {
      status: 200,
      data:
        data || {
          store_name: 'SUPER Supermarket',
          email: 'admin@super.local',
          phone: '+91 98765 43210',
          address: '123 Market Street, Tech Park',
          tax_rate: 5.0,
          currency: '₹',
          low_stock_threshold: 10,
          invoice_prefix: 'INV-',
        },
    });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

router.put('/settings', restrictTo(ROLES.ADMIN), async (req, res) => {
  try {
    const {
      store_name,
      email,
      phone,
      address,
      tax_rate,
      currency,
      low_stock_threshold,
      invoice_prefix,
    } = req.body;

    const updates = {
      id: 'default',
      ...(store_name && { store_name: store_name.trim() }),
      ...(email && { email: email.trim() }),
      ...(phone && { phone: phone.trim() }),
      ...(address && { address: address.trim() }),
      ...(tax_rate !== undefined && { tax_rate: Number(tax_rate) }),
      ...(currency && { currency: currency.trim() }),
      ...(low_stock_threshold !== undefined && { low_stock_threshold: Number(low_stock_threshold) }),
      ...(invoice_prefix && { invoice_prefix: invoice_prefix.trim() }),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseServer
      .from('store_settings')
      .upsert(updates)
      .select()
      .single();

    if (error) throw error;
    return sendSuccess(res, { status: 200, message: 'Settings saved successfully', data });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

module.exports = router;
