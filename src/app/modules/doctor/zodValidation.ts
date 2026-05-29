import { Gender } from '@prisma/client';
import { z } from 'zod';
import { phoneRegex } from '../../../constants/constant';
import { banglaRegex } from '../../../utils/common';

export const doctorSchema = z.object({
  departmentId: z.string().min(1, 'ডিপার্টমেন্ট নির্বাচন করা বাধ্যতামূলক'),

  specialization: z
    .string()
    .min(1, 'স্পেশালাইজেশন দিন')
    .regex(banglaRegex, 'স্পেশালাইজেশন অবশ্যই বাংলায় হতে হবে'),

  slug: z
    .string()
    .min(3, 'স্লাগ অন্তত ৩ অক্ষরের হবে')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'স্লাগ ছোট হাতের ইংরেজি এবং ড্যাশ হতে হবে')
    .toLowerCase() // ইনপুট যাই আসুক, এটি ডাটাবেজে পাঠানোর আগে lowercase করে ফেলবে
    .trim(),

  gender: z.nativeEnum(Gender).default(Gender.MALE),

  experience: z.coerce.number().min(0, 'অভিজ্ঞতা ০ বা তার বেশি হতে হবে'),
  isEmergency: z.boolean().default(false), // ডিফল্টভাবে এটি ফলস থাকবে
  hospital: z
    .string()
    .min(1, 'হসপিটালের নাম দিন')
    .regex(banglaRegex, 'হসপিটালের নাম অবশ্যই বাংলায় হতে হবে'),

  position: z
    .string()
    .regex(banglaRegex, 'পদবী অবশ্যই বাংলায় হতে হবে')
    .optional()
    .or(z.literal('')),

  website: z
    .string()
    .trim()
    .nullable()
    .transform((val) => (val === '' ? undefined : val))
    .refine((val) => !val || /^https?:\/\/.+/.test(val), 'সঠিক ইউআরএল (URL) দিন'),

  active: z.boolean().default(true),

  // --- Nested User Fields ---
  user: z.object({
    name: z.string().min(1, 'নাম প্রদান করুন').regex(banglaRegex, 'নাম অবশ্যই বাংলায় হতে হবে'),

    phoneNumber: z
      .string()
      .min(1, 'মোবাইল নম্বর দেওয়া আবশ্যক')
      .regex(phoneRegex, 'সঠিক মোবাইল নম্বর প্রদান করুন'),

    password: z.string().min(8, 'পাসওয়ার্ড অন্তত ৮ অক্ষরের হতে হবে'),

    image: z.string().optional().default('null'),

    role: z.string().default('DOCTOR'),

    isPhoneVerified: z.boolean().optional().default(false),
    deactivate: z.boolean().optional().default(false),
  }),
});
export const createDoctorSchema = z.object({
  body: doctorSchema,
});

export const updateDoctorSchema = z.object({
  body: doctorSchema.partial().extend({
    user: z
      .object({
        name: z.string().regex(banglaRegex, 'নাম অবশ্যই বাংলায় হতে হবে').optional(),
        phoneNumber: z.string().regex(phoneRegex, 'সঠিক মোবাইল নম্বর প্রদান করুন').optional(),
        // পাসওয়ার্ডকে এখানে স্পেশালভাবে হ্যান্ডেল করা হয়েছে
        password: z
          .string()
          .optional()
          .or(z.literal(''))
          .refine((val) => !val || val.length >= 8, {
            message: 'পাসওয়ার্ড অন্তত ৮ অক্ষরের হতে হবে',
          }),
        image: z.string().optional().nullable(),
        deactivate: z.boolean().optional(),
      })
      .partial()
      .optional(), // ইউজার অবজেক্টকেও পারশিয়াল করা হয়েছে
  }),
});

export const DoctorZodValidation = {
  createDoctorSchema,
  updateDoctorSchema,
};

export type CreateDoctorInput = z.infer<typeof createDoctorSchema>['body'];
export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>['body'];
