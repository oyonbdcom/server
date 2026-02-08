// src/app.ts
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Application, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import httpStatus from 'http-status';

import router from './app/routes';
import config from './config/config';
import globalErrorHandler from './middlewares/globalErrorHandler';
import { apiLimiter } from './middlewares/rateMiddleware';
import { initializeFirebase } from './utils/firebaseAdmin';

const app: Application = express();
app.use(
  cors({
    origin: [config.origin],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  }),
);
// Security Middleware
app.use(helmet());

app.use(hpp());
// ১. পুরো এপিআই-এর জন্য গ্লোবাল লিমিটর প্রয়োগ
app.use('/api/v1', apiLimiter);
app.set('trust proxy', 1);
initializeFirebase();
// CORS

// Cookie parser
app.use(cookieParser());

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check / test route
app.get('/', (req, res) => {
  res.status(200).send('Server is running!');
});

// API Routes
app.use('/api/v1', router);

// 404 handler
app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(httpStatus.NOT_FOUND).json({
    success: false,
    message: 'API not found',
    errorMessages: [{ path: req.originalUrl, message: 'API endpoint does not exist' }],
  });
});

// Global error handler
app.use(globalErrorHandler);

export default app;
