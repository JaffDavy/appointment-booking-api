
import { Server } from 'socket.io';
import { winstonLogger } from '../config/logger.js';

let io;

// Initialize the Socket.IO server
export function initSocketServer(server) {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  
  io.on('connection', (socket) => {
    winstonLogger.info(`New client connected: ${socket.id}`);
    
    // Handle client joining a room (for user-specific or provider-specific notifications)
    socket.on('join', (room) => {
      socket.join(room);
      winstonLogger.debug(`Client ${socket.id} joined room: ${room}`);
    });
    
    socket.on('disconnect', () => {
      winstonLogger.info(`Client disconnected: ${socket.id}`);
    });
  });
  
  return io;
}

// Send notification to specific room (user or provider)
export function sendNotification(room, notificationType, data) {
  if (io) {
    io.to(room).emit('notification', { type: notificationType, data });
    winstonLogger.debug(`Notification sent to room ${room}: ${notificationType}`);
  } else {
    winstonLogger.error('Socket.IO server not initialized');
  }
}

// Helper to create user-specific room ID
export function getUserRoom(userId) {
  return `user_${userId}`;
}

// Helper to create provider-specific room ID
export function getProviderRoom(providerId) {
  return `provider_${providerId}`;
}
