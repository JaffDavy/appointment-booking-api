
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import createError from 'http-errors';
import http from 'http';
import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';

// Import our modules
import authRoutes from './routes/auth.js';
import timeSlotRoutes from './routes/timeSlots.js';
import { winstonLogger } from './config/logger.js';
import { initSocketServer } from './services/socketService.js';

// For ES modules support
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
initSocketServer(server);

// Swagger documentation setup
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Schedule Sync API',
      version: '1.0.0',
      description: 'API documentation for Schedule Sync appointment booking system'
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:3000',
        description: 'API Server'
      }
    ]
  },
  apis: ['./src/routes/*.js'] // Path to the API routes folders
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Configure morgan logging
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat, { stream: winstonLogger.stream }));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Only try to use static files if they exist
try {
  const publicPath = join(__dirname, '../public');
  const fs = require('fs');
  if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
    winstonLogger.info(`Serving static files from: ${publicPath}`);
  } else {
    winstonLogger.warn(`Public directory not found at: ${publicPath}`);
  }
} catch (err) {
  winstonLogger.error(`Error setting up static files: ${err.message}`);
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/timeslots', timeSlotRoutes);

// Basic test route
app.get('/api/test', (req, res) => {
    winstonLogger.info('Test endpoint called');
    res.json({ message: 'API is working' });
});

// Root route - return JSON instead of trying to serve index.html
app.get('/', (req, res) => {
  res.json({
    message: 'Schedule Sync API is running',
    documentation: '/api-docs',
    test: '/api/test'
  });
});

// SPA fallback - Only try to serve if public directory exists
app.get('*', (req, res, next) => {
  try {
    const publicPath = join(__dirname, '../public');
    const indexPath = join(publicPath, 'index.html');
    const fs = require('fs');
    
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      // If index.html doesn't exist, return a 404 JSON response
      res.status(404).json({ message: 'Resource not found', path: req.path });
    }
  } catch (err) {
    next(err);
  }
});

// Error handling
app.use((req, res, next) => next(createError(404)));
app.use((err, req, res, next) => {
  winstonLogger.error(`${err.status || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  res.status(err.status || 500).json({
    message: err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    winstonLogger.info(`Server is running on port ${PORT}`);
    winstonLogger.info('Test the endpoints with Thunder Client:');
    winstonLogger.info(`API documentation available at: ${process.env.API_URL || 'http://localhost:3000'}/api-docs`);
});

// MongoDB Connection - Use environment variable for MongoDB URI
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/schedule_sync';
mongoose.connect(MONGODB_URI, {})
  .then(() => {
    winstonLogger.info(`Connected to MongoDB at ${MONGODB_URI}`);
  })
  .catch((err) => {
    winstonLogger.error('MongoDB connection error:', err);
    winstonLogger.info('API will continue to run without database connection. Some features may not work.');
  });

export default app;
