import { z } from 'zod';

// ---------------------- LOGIN ----------------------
export const loginSchema = z.object({
  body: z.object({
    phoneNumber: z.string().min(11, 'সঠিক মোবাইল নম্বর দিন'),
    password: z.string().min(1, 'পাসওয়ার্ড দিন'),
  }),
});

// ---------------------- REGISTER ----------------------

const phoneRegex = /^(?:\+88|88)?(?:01[3-9]\d{8}|[০-৯]{11})$/;

export const registerSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(2, 'নাম অন্তত ২ অক্ষরের হতে হবে')
      .max(100, 'নাম ১০০ অক্ষরের বেশি হওয়া সম্ভব নয়'),
    // ইমেইল সরিয়ে ফোন নম্বর যুক্ত করা হয়েছে
    phoneNumber: z
      .string()
      .min(11, 'ফোন নম্বর অন্তত ১১ ডিজিটের হতে হবে')
      .regex(phoneRegex, 'সঠিক মোবাইল নম্বর প্রদান করুন (উদা: 017xxxxxxxx)'),

    password: z
      .string()
      .min(8, 'পাসওয়ার্ড অন্তত ৮ অক্ষরের হতে হবে')
      .regex(/[A-Z]/, 'পাসওয়ার্ডে অন্তত একটি বড় হাতের অক্ষর থাকতে হবে')
      .regex(/[a-z]/, 'পাসওয়ার্ডে অন্তত একটি ছোট হাতের অক্ষর থাকতে হবে')
      .regex(/[0-9]/, 'পাসওয়ার্ডে অন্তত একটি সংখ্যা থাকতে হবে')
      .regex(/[^A-Za-z0-9]/, 'পাসওয়ার্ডে অন্তত একটি বিশেষ চিহ্ন (Special Character) থাকতে হবে'),

    confirmPassword: z.string().min(1, 'পাসওয়ার্ড নিশ্চিত করুন'),

    role: z.enum(['PATIENT', 'DOCTOR', 'CLINIC']).default('PATIENT'),

    image: z.string().url('ছবির ইউআরএল সঠিক নয়').optional().nullable(),
  }),
});

// ---------------------- VERIFY OTP ----------------------
export const verifyOtpSchema = z.object({
  body: z.object({
    phoneNumber: z
      .string()
      .min(11, 'ফোন নম্বর অন্তত ১১ ডিজিটের হতে হবে')
      .regex(phoneRegex, 'সঠিক মোবাইল নম্বর প্রদান করুন (উদা: 017xxxxxxxx)'),
    otp: z.string().length(6, 'OTP must be exactly 6 digits'),
  }),
});

// ---------------------- FORGOT PASSWORD ----------------------
export const sendOtpSchema = z.object({
  body: z.object({
    phoneNumber: z
      .string()
      .min(1, 'মোবাইল নম্বর দেওয়া আবশ্যক')
      .regex(phoneRegex, 'সঠিক মোবাইল নম্বর প্রদান করুন'),
  }),
});

// ---------------------- CHANGE PASSWORD ----------------------
export const changePasswordSchema = z.object({
  body: z
    .object({
      newPassword: z
        .string()
        .min(8, 'পাসওয়ার্ড অন্তত ৮ অক্ষরের হতে হবে')
        .regex(/[A-Z]/, 'একটি বড় হাতের অক্ষর থাকতে হবে')
        .regex(/[a-z]/, 'একটি ছোট হাতের অক্ষর থাকতে হবে')
        .regex(/[0-9]/, 'একটি সংখ্যা থাকতে হবে'),
      confirmPassword: z.string().min(1, 'পাসওয়ার্ড নিশ্চিত করুন'),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: 'পাসওয়ার্ড দুটি মিলছে না',
      path: ['confirmPassword'],
    }),
});

// ---------------------- RESET PASSWORD ----------------------
export const resetPasswordSchema = z.object({
  body: z
    .object({
      phoneNumber: z
        .string()
        .min(1, 'মোবাইল নম্বর আবশ্যক')
        .regex(/^(?:\+88|88)?(01[3-9]\d{8})$/, 'সঠিক মোবাইল নম্বর দিন'),
      otp: z.string().length(6, 'ওটিপি অবশ্যই ৬ ডিজিটের হতে হবে'),
      newPassword: z
        .string()
        .min(8, 'পাসওয়ার্ড অন্তত ৮ অক্ষরের হতে হবে')
        .regex(/[A-Z]/, 'অন্তত একটি বড় হাতের অক্ষর দিন')
        .regex(/[a-z]/, 'অন্তত একটি ছোট হাতের অক্ষর দিন')
        .regex(/[0-9]/, 'অন্তত একটি সংখ্যা দিন'),
      confirmPassword: z.string().min(1, 'পাসওয়ার্ড নিশ্চিত করুন'),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: 'পাসওয়ার্ড দুটি মিলছে না',
      path: ['confirmPassword'], // এররটি কনফার্ম পাসওয়ার্ড ফিল্ডে দেখাবে
    }),
});

// ---------------------- EXPORT ALL ----------------------
export const AuthValidation = {
  loginSchema,
  registerSchema,
  sendOtpSchema,
  verifyOtpSchema,
  changePasswordSchema,
  resetPasswordSchema,
};

// ---------------------- TYPES ----------------------
export type LoginRequest = z.infer<typeof loginSchema>['body'];
export type RegisterRequest = z.infer<typeof registerSchema>['body'];
export type SendOtpRequest = z.infer<typeof sendOtpSchema>['body'];

export type VerifyOtpRequest = z.infer<typeof verifyOtpSchema>['body'];
export type ResetPasswordRequest = z.infer<typeof resetPasswordSchema>['body'];
