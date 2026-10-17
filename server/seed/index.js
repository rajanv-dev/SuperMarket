const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { supabaseServer, isSupabaseConfigured } = require('../src/config/supabase');
const logger = require('../src/utils/logger');
const { ROLES } = require('../src/config/constants');

const seedAdmin = async () => {
  if (!isSupabaseConfigured || !supabaseServer) {
    logger.error('Supabase is not configured. Aborting seed.');
    process.exit(1);
  }

  logger.info('Connected to Supabase PostgreSQL for seeding');

  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@super.local').toLowerCase().trim();
  const password = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345';
  const name = process.env.SEED_ADMIN_NAME || 'Super Admin';

  if (!password) {
    logger.error('SEED_ADMIN_PASSWORD is not set in .env. Aborting.');
    process.exit(1);
  }

  // 1. Check existing profile in user_profiles
  const { data: existing, error: fetchErr } = await supabaseServer
    .from('user_profiles')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (fetchErr) {
    logger.error(`Error querying user_profiles: ${fetchErr.message}`);
    process.exit(1);
  }

  let authId = existing?.auth_id || null;

  // 2. Try creating or confirming user in Supabase Auth if needed
  if (!authId) {
    try {
      const { data: authData, error: authErr } = await supabaseServer.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
        },
      });

      if (!authErr && authData?.user) {
        authId = authData.user.id;
        logger.info(`Admin user created in Supabase Auth (${email})`);
      }
    } catch (err) {
      logger.warn(`Supabase Auth signup notice: ${err.message}`);
    }
  }

  // 3. Upsert admin profile
  const { data: profile, error: upsertErr } = await supabaseServer
    .from('user_profiles')
    .upsert(
      {
        auth_id: authId,
        email,
        full_name: name,
        role: ROLES.ADMIN,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'email' }
    )
    .select()
    .single();

  if (upsertErr) {
    logger.error(`Error upserting admin profile: ${upsertErr.message}`);
    process.exit(1);
  }

  logger.info(`Admin profile verified in Supabase: ${profile.email} (${profile.role})`);
  logger.info('Seed complete');
};

seedAdmin().catch((err) => {
  logger.error(`Seed failed: ${err.message}`);
  process.exit(1);
});
