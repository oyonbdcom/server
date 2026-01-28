import { z } from 'zod';

import { phoneRegex, userRoleEnum } from '../../../constants/constant';

export const clinicSchema = z.object({
  id: z.string().cuid().optional(),
  userId: z.string().cuid().optional(),

  user: z.object({
    name: z
      .string()
      .min(2, 'নাম অন্তত ২ অক্ষরের হতে হবে')
      .regex(/^[ঀ-৿\s]+$/, 'নাম অবশ্যই বাংলায় হতে হবে'), // শুধুমাত্র বাংলা

    phoneNumber: z
      .string()
      .min(1, 'মোবাইল নম্বর দেওয়া আবশ্যক')
      .regex(phoneRegex, 'সঠিক মোবাইল নম্বর প্রদান করুন'),
    password: z.string().min(8, 'পাসওয়ার্ড অন্তত ৮ অক্ষরের হতে হবে'),
    deactivate: z.boolean().default(true),
    image: z.string().default('null'),
    isPhoneVerified: z.boolean().optional(),
    role: userRoleEnum, // আপনার UserRole এনাম
  }),

  phoneNumber: z
    .string()
    .min(11, 'ফোন নম্বর অন্তত ১১ ডিজিটের হতে হবে')
    .regex(/^[0-9+]+$/, 'সঠিক ফোন নম্বর দিন'),

  description: z
    .string()
    .regex(/^[ঀ-৿\s.,।/()/-]*$/, 'বর্ণনা বাংলায় লিখুন')
    .nullable(),

  openingHour: z.string().nullable(),
  establishedYear: z.number().nullable(),
  active: z.boolean().default(false),
  website: z.string().url('সঠিক ইউআরএল দিন').nullable().or(z.literal('')),

  // ঠিকানা, জেলা এবং শহর বাংলায় রেস্ট্রিক্ট করা হয়েছে
  address: z
    .string()
    .regex(/^[ঀ-৿\s.,।/()/-]*$/, 'ঠিকানা বাংলায় লিখুন')
    .nullable(),

  district: z.string().nullable(),

  city: z
    .string()
    .regex(/^[ঀ-৿\s]*$/, 'শহরের নাম বাংলায় লিখুন')
    .nullable(),

  country: z.string().min(1, 'দেশ নির্বাচন করা বাধ্যতামূলক').default('Bangladesh'),

  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

// --- CREATE CLINIC SCHEMA ---
// We omit system-generated fields and relations
export const createClinicSchema = z.object({
  body: clinicSchema
    .omit({
      id: true,
      createdAt: true,
      updatedAt: true,
    })
    .extend({
      userId: z.string().cuid().optional(),
    }),
});

export const updateClinicSchema = z.object({
  body: createClinicSchema.shape.body.partial(),
});

export const ClinicZodValidation = {
  clinicSchema,
  createClinicSchema,
  updateClinicSchema,
};
