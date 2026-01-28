// src/app.ts
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Application, NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import hpp from 'hpp';
import httpStatus from 'http-status';

import router from './app/routes';
import config from './config/config';
import globalErrorHandler from './middlewares/globalErrorHandler';
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

// Rate Limiter

// ১. সাধারণ এপিআই এর জন্য লিমিটর
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // ১৫ মিনিট
  max: 200,
  message: 'Too many requests from this IP, please try again later.',
});

// ২. অথেনটিকেশন (লগইন/পাসওয়ার্ড চেঞ্জ) এর জন্য কঠোর লিমিটর
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // ১ ঘণ্টা
  max: 10,
  message: 'অতিরিক্ত চেষ্টা করা হয়েছে। ১ ঘণ্টা পর আবার চেষ্টা করুন।',
  standardHeaders: true,
  legacyHeaders: false,
});

// ৩. প্রয়োগ করার সঠিক নিয়ম
app.use('/api/v1/auth', authLimiter); // এখানে শুধু authLimiter কাজ করবে

// auth ছাড়া বাকি সব রাউটে generalLimiter দিতে এভাবে লিখুন:
app.use('/api/v1/appointments', generalLimiter);
app.use('/api/v1/users', generalLimiter);
// অথবা নির্দিষ্ট কিছু রাউট বাদ দিয়ে গ্লোবাললি সেট করা।
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
