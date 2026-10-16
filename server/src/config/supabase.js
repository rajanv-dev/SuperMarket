const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SECRET_KEY.includes('REPLACE')
    ? process.env.SUPABASE_SECRET_KEY
    : process.env.SUPABASE_PUBLISHABLE_KEY;

const supabaseServer = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

module.exports = {
  supabaseServer,
  isSupabaseConfigured,
};
