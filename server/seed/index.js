require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const User = require('../src/models/User');
const logger = require('../src/utils/logger');
const { ROLES } = require('../src/config/constants');

const seedAdmin = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    logger.error('MONGO_URI not set. Aborting seed.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  logger.info('Connected to MongoDB for seeding');

  const email = process.env.SEED_ADMIN_EMAIL || 'admin@super.local';
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME || 'Super Admin';

  if (!password) {
    logger.error('SEED_ADMIN_PASSWORD is not set in .env. Aborting.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const existing = await User.findOne({ email });
  if (existing) {
    logger.info(`Admin already exists: ${email}`);
  } else {
    await User.create({
      name,
      email,
      passwordHash: password, // pre-save hook hashes it
      role: ROLES.ADMIN,
    });
    logger.info(`Admin created: ${email}`);
  }

  await mongoose.disconnect();
  logger.info('Seed complete');
};

seedAdmin().catch((err) => {
  logger.error(`Seed failed: ${err.message}`);
  process.exit(1);
});
