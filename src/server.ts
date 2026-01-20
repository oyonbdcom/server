// src/server.ts
import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import app from './app';
import config from './config/config';
import { errorLogger, infoLogger } from './shared/logger';

// Create HTTP server
const server = http.createServer(app);

// Start server
server.listen(config.port, () => {
  infoLogger.info(`Server running on port ${config.port}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  errorLogger.error(`Uncaught Exception: ${err.message}`);
  errorLogger.error(err.stack || '');
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  errorLogger.error(`Unhandled Rejection at: ${promise} reason: ${reason}`);
  server.close(() => process.exit(1));
});

// Graceful shutdown on SIGINT / SIGTERM
const shutdownSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
shutdownSignals.forEach((signal) => {
  process.on(signal, () => {
    infoLogger.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
      infoLogger.info('Server closed.');
      process.exit(0);
    });

    // Force exit after 10s
    setTimeout(() => {
      errorLogger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  });
});
