import { Prisma } from '@prisma/client';
import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import config from '../config/config';
import { IGenericErrorResponse, IGenericErrors } from '../interface/common';
import ApiError from '../utils/apiError';

// --- PRISMA ERROR HANDLERS ---

// Handle Prisma P2002 Unique constraint error
const handlePrismaUniqueError = (
  error: Prisma.PrismaClientKnownRequestError,
): IGenericErrorResponse => {
  const statusCode = 400;

  const target = (error.meta?.target as string[])?.join(', ') || 'field';

  return {
    statusCode,
    message: 'Duplicate value',
    errorMessages: [
      {
        path: target,
        message: `${target} already exists`,
      },
    ],
  };
};

// Handle Prisma P2023 (Invalid ID / cast error)
const handlePrismaCastError = (
  error: Prisma.PrismaClientKnownRequestError,
): IGenericErrorResponse => {
  return {
    statusCode: 400,
    message: 'Invalid ID format',
    errorMessages: [
      {
        path: 'id',
        message: `Invalid ID value`,
      },
    ],
  };
};

// Handle Prisma P2003 (Foreign key error)
const handlePrismaForeignKeyError = (
  error: Prisma.PrismaClientKnownRequestError,
): IGenericErrorResponse => {
  const field = String(error.meta?.field_name || 'reference');

  return {
    statusCode: 400,
    message: 'Invalid reference',
    errorMessages: [
      {
        path: field,
        message: `Referenced ${field} does not exist`,
      },
    ],
  };
};

// Handle Zod validation error
const handleZodError = (error: ZodError): IGenericErrorResponse => {
  const errors: IGenericErrors[] = error.issues.map((issue) => ({
    path: issue.path[issue.path.length - 1] as string,
    message: issue.message,
  }));

  return {
    statusCode: 400,
    message: 'Validation Error',
    errorMessages: errors,
  };
};

// --- GLOBAL ERROR HANDLER ---
const globalErrorHandler: ErrorRequestHandler = (error, req, res, next) => {
  let statusCode = 500;
  let message = 'Something went wrong!';
  let errorMessages: IGenericErrors[] = [];

  // 🔥 Prisma Known Errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': {
        const simplified = handlePrismaUniqueError(error);
        statusCode = simplified.statusCode;
        message = simplified.message;
        errorMessages = simplified.errorMessages;
        break;
      }
      case 'P2023': {
        const simplified = handlePrismaCastError(error);
        statusCode = simplified.statusCode;
        message = simplified.message;
        errorMessages = simplified.errorMessages;
        break;
      }
      case 'P2003': {
        const simplified = handlePrismaForeignKeyError(error);
        statusCode = simplified.statusCode;
        message = simplified.message;
        errorMessages = simplified.errorMessages;
        break;
      }
      default:
        message = error.message;
        errorMessages = [{ path: '', message: error.message }];
        break;
    }
  }

  // 🔥 Zod errors
  else if (error instanceof ZodError) {
    const simplified = handleZodError(error);
    statusCode = simplified.statusCode;
    message = simplified.message;
    errorMessages = simplified.errorMessages;
  }

  // 🔥 Custom ApiError
  else if (error instanceof ApiError) {
    statusCode = error.statusCode;
    message = error.message;
    errorMessages = [{ path: '', message: error.message }];
  }

  // 🔥 Native JS Error
  else if (error instanceof Error) {
    message = error.message;
    errorMessages = error.message ? [{ path: '', message: error.message }] : [];
  }

  // 🔥 Final Response
  res.status(statusCode).json({
    success: false,
    message,
    errorMessages,
    stack: config.env !== 'production' ? error?.stack : undefined,
  });
};

export default globalErrorHandler;
