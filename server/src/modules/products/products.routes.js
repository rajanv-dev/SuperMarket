const express = require('express');
const { supabaseServer } = require('../../config/supabase');
const { sendSuccess, sendError } = require('../../utils/response');

const router = express.Router();

/**
 * GET /api/products
 * Public endpoint to list active products from Supabase
 * Supports ?category=... and ?q=... or ?search=...
 */
router.get('/', async (req, res) => {
  try {
    if (!supabaseServer) {
      return sendError(res, { status: 503, message: 'Database service unavailable' });
    }

    const { category, search, q } = req.query;
    const term = (search || q || '').trim();

    let query = supabaseServer
      .from('products')
      .select('id, name, sku, barcode, category, description, price, stock_quantity, image_url, is_active, created_at')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }
    if (term) {
      query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%,description.ilike.%${term}%,category.ilike.%${term}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return sendSuccess(res, { status: 200, data: data || [] });
  } catch (err) {
    return sendError(res, { status: 500, message: err.message });
  }
});

/**
 * GET /api/products/:id
 * Public endpoint to get a single product by ID
 */
router.get('/:id', async (req, res) => {
  try {
    if (!supabaseServer) {
      return sendError(res, { status: 503, message: 'Database service unavailable' });
    }

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

module.exports = router;
