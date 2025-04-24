import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import createError from 'http-errors';

import { winstonLogger } from './config/logger.js';   // ← bring in your logger
import indexRouter from './routes/index.js';
import usersRouter from './routes/users.js';

const app = express();

/* __filename / __dirname equivalents in ESM */
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

/* Morgan setup */
const morganFormat =
  process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat, { stream: winstonLogger.stream }));

/* Middleware */
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(join(__dirname, 'public')));

/* Routes */
app.use('/', indexRouter);
app.use('/users', usersRouter);

/* 404 handler */
app.use((req, res, next) => next(createError(404)));

/* Error handler */
app.use((err, req, res, next) => {
  res.status(err.status || 500);
  res.json({
    message: err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

export default app;
