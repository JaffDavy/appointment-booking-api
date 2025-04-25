import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import path from 'path';           // ← added
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import createError from 'http-errors';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import { winstonLogger } from './config/logger.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/* Morgan */
const morganFormat =
  process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat, { stream: winstonLogger.stream }));  // single call

/* Middleware */
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(cors());
app.use(express.static(join(__dirname, 'public')));

/* Routes */
app.use('/api/auth', authRoutes);
app.get('/api/test', (req, res) => res.json({ message: 'API is working' }));

/* SPA fallback */
app.get('*', (req, res) =>
  res.sendFile(path.join(__dirname, '../public/index.html'))
);

/* 404 and error handlers */
app.use((req, res, next) => next(createError(404)));
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    message: err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

export default app;
