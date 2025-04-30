import mongoose from 'mongoose';
import { winstonLogger as logger } from '../config/logger.js';
import dotenv from 'dotenv';

dotenv.config();
const { MONGO_URI } = process.env;

export const connectToDb = async () => {
  if (mongoose.connection.readyState !== 0) {
    // 0 = disconnected | 1 = connected | 2 = connecting | 3 = disconnecting
    logger.info('🔌  Mongo already connected – skipping second connect');
    return;
  }
  if (!MONGO_URI) {
    logger.error('❌ MONGO_URI not found in environment variables');
    process.exit(1);
  }  

  try {
    logger.info('Connecting to DB…');
    await mongoose.connect(MONGO_URI);
    logger.info('✅  MongoDB connected');
  } catch (err) {
    logger.error(`MongoDB connection error: ${err}`);
    process.exit(1);
  }
};
