import rateLimit from 'express-rate-limit';

// ১. গ্লোবাল এপিআই লিমিটর (পুরো এপিআই-এর সাধারণ সুরক্ষার জন্য)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // ১৫ মিনিট
  max: 100, // প্রতি আইপি থেকে সর্বোচ্চ ১০০টি রিকোয়েস্ট
  message: {
    status: 429,
    message: 'অতিরিক্ত রিকোয়েস্ট পাঠিয়েছেন। ১৫ মিনিট পর আবার চেষ্টা করুন।',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // ১৫ মিনিট
  max: 5,
  message: {
    success: false,
    message: 'অতিরিক্ত ওটিপি রিকোয়েস্ট করা হয়েছে, ১৫ মিনিট পর আবার চেষ্টা করুন।',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
// ২. অথেনটিকেশন ও ওটিপি লিমিটর (অত্যন্ত কঠোর সুরক্ষা)
export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // ১ ঘণ্টা
  max: 5, // ১ ঘণ্টায় ৫ বারের বেশি চেষ্টা করা যাবে না
  message: {
    status: 429,
    message: 'অতিরিক্ত চেষ্টা করা হয়েছে। ১ ঘণ্টা পর আবার চেষ্টা করুন।',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
