import winston from 'winston';

export const winstonLogger = winston.createLogger({
  level: 'info',
  transports: [ new winston.transports.Console() ],
});
