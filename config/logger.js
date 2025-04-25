import winston from 'winston';

export const winstonLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// 👇 This is the fix you need:
winstonLogger.stream = {
  write: (message) => {
    winstonLogger.info(message.trim()); // trim to remove extra newline
  }
};
