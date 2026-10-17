const { supabaseServer, isSupabaseConfigured, supabaseUrl } = require('./supabase');
const logger = require('../utils/logger');

let isConnected = false;

/**
 * Initializes and verifies connectivity to Supabase PostgreSQL database.
 * No longer depends on MongoDB or MONGO_URI.
 */
const connectDB = async () => {
  if (isConnected) return true;

  if (!isSupabaseConfigured || !supabaseServer) {
    const errorMsg =
      'Supabase PostgreSQL is not configured: Please set SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY / SUPABASE_PUBLISHABLE_KEY) in environment variables';
    logger.error(errorMsg);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      logger.warn('Running in development mode without active Supabase credentials.');
    }
    return false;
  }

  try {
    const { error } = await supabaseServer.from('products').select('id').limit(1);
    if (error) {
      logger.error(`Supabase PostgreSQL connectivity check failed: ${error.message}`);
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
      return false;
    }

    isConnected = true;
    logger.info(`Supabase PostgreSQL connected successfully (${supabaseUrl})`);
    return true;
  } catch (err) {
    logger.error(`Supabase connection error: ${err.message}`);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
    return false;
  }
};

module.exports = connectDB;
