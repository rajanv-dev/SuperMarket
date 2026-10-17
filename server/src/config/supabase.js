const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;

// Prioritize service role / secret key for backend, falling back to anon / publishable key
const candidateKeys = [
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  process.env.SUPABASE_SECRET_KEY,
  process.env.SUPABASE_ANON_KEY,
  process.env.SUPABASE_PUBLISHABLE_KEY,
];

const supabaseKey =
  candidateKeys.find(
    (key) => key && typeof key === 'string' && !key.includes('REPLACE') && key.trim().length > 0
  ) || null;

const supabaseServer =
  supabaseUrl && supabaseKey
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
  supabaseUrl,
  supabaseKey,
};
