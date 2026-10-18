const express = require('express');
const { supabaseServer } = require('../../config/supabase');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');

const router = express.Router();

/**
 * GET /api/products
 * Public endpoint to list active products from Supabase
 * Supports ?category=... and ?q=... or ?search=...
 */
router.get('/', async (req, res) => {
  try {
    if (!supabaseServer) {
      logger.error('GET /api/products: Supabase server client is not initialized');
      return sendError(res, { status: 503, message: 'Database service unavailable' });
    }

    const { category, search, q } = req.query;
    const rawTerm = (search || q || '').trim();

    let query = supabaseServer
      .from('products')
      .select('id, name, sku, barcode, category, description, price, stock_quantity, image_url, is_active, created_at')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    // Safely sanitize user input for PostgREST .or() filter to prevent logic tree syntax errors
    const sanitizedTerm = rawTerm.replace(/[,()"]/g, ' ').trim();
    if (sanitizedTerm) {
      query = query.or(`name.ilike.%${sanitizedTerm}%,sku.ilike.%${sanitizedTerm}%,description.ilike.%${sanitizedTerm}%,category.ilike.%${sanitizedTerm}%`);
    }

    const { data, error } = await query;
    if (error) {
      logger.error('Supabase query error in GET /api/products:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      return sendError(res, { status: 500, message: 'Failed to retrieve products from database' });
    }

    return sendSuccess(res, { status: 200, data: data || [] });
  } catch (err) {
    logger.error('Unexpected exception in GET /api/products:', {
      message: err.message,
      stack: err.stack,
    });
    return sendError(res, { status: 500, message: 'Internal server error while fetching products' });
  }
});

/**
 * GET /api/products/:id
 * Public endpoint to get a single product by ID
 */
router.get('/:id', async (req, res) => {
  try {
    if (!supabaseServer) {
      logger.error(`GET /api/products/${req.params.id}: Supabase server client is not initialized`);
      return sendError(res, { status: 503, message: 'Database service unavailable' });
    }

    const { data, error } = await supabaseServer
      .from('products')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !data) {
      if (error && error.code !== 'PGRST116') {
        logger.warn(`Supabase error fetching product ${req.params.id}:`, {
          message: error.message,
          code: error.code,
        });
      }
      return sendError(res, { status: 404, message: 'Product not found' });
    }

    return sendSuccess(res, { status: 200, data });
  } catch (err) {
    logger.error(`Unexpected exception in GET /api/products/${req.params.id}:`, {
      message: err.message,
      stack: err.stack,
    });
    return sendError(res, { status: 500, message: 'Internal server error while fetching product details' });
  }
});

module.exports = router;
