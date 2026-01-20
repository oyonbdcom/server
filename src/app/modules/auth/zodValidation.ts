import { UserRole } from '@prisma/client';
import { z } from 'zod';

// ---------------------- LOGIN ----------------------
export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
});

// ---------------------- REGISTER ----------------------
export const registerSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name must be less than 100 characters'),
    email: z.string().email('Invalid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    role: z.nativeEnum(UserRole).default(UserRole.PATIENT),
  }),
});
export const verifyEmailSchema = z.object({
  body: z.object({
    token: z.string(),
  }),
});
export const resendVerificationSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
  }),
});

// ---------------------- FORGOT PASSWORD ----------------------
export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
  }),
});

// ---------------------- VERIFY OTP ----------------------
export const verifyOtpSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'), // Fixed: was z.email()
    otp: z.string().length(6, 'OTP must be exactly 6 digits'),
  }),
});

// ---------------------- CHANGE PASSWORD ----------------------
export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(6),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  }),
});

// ---------------------- RESET PASSWORD ----------------------
export const resetPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    otp: z.string().length(6, 'OTP must be 6 digits'), // Added for security context
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
  }),
});

// ---------------------- EXPORT ALL ----------------------
export const AuthValidation = {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  verifyOtpSchema,
  changePasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
};

// ---------------------- TYPES ----------------------
export type LoginRequest = z.infer<typeof loginSchema>['body'];
export type RegisterRequest = z.infer<typeof registerSchema>['body'];
export type VerifyEmailRequest = z.infer<typeof verifyEmailSchema>['body'];
export type ResendVerifyEmailRequest = z.infer<typeof resendVerificationSchema>['body'];
export type VerifyOtpRequest = z.infer<typeof verifyOtpSchema>['body'];
export type ResetPasswordRequest = z.infer<typeof resetPasswordSchema>['body'];
