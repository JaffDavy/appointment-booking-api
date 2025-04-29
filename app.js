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
        url: 'http://localhost:3000',
        description: 'Development server'
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
app.use(express.static(join(__dirname, '../public')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/timeslots', timeSlotRoutes);

// Basic test route
app.get('/api/test', (req, res) => {
    winstonLogger.info('Test endpoint called');
    res.json({ message: 'API is working' });
});

// SPA fallback - Serve static HTML for any other route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
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
    winstonLogger.info('API documentation available at: http://localhost:3000/api-docs');
});

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/schedule_sync', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    winstonLogger.info('Connected to MongoDB');
}).catch((err) => {
    winstonLogger.error('MongoDB connection error:', err);
});

export default app;
