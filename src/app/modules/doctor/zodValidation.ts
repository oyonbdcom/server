import { z } from 'zod';
import { phoneRegex, userRoleEnum } from '../../../constants/constant';

export const doctorSchema = z.object({
  department: z.string().min(1, 'ডিপার্টমেন্ট নির্বাচন করা বাধ্যতামূলক'),
  specialization: z
    .string()
    .min(1, 'স্পেশালাইজেশন দিন')
    .regex(/^[ঀ-৿\s.,।/()/-]+$/, 'স্পেশালাইজেশন অবশ্যই বাংলায় হতে হবে'),
  bio: z.string().max(1000, '১০০০ অক্ষরের বেশি লিখা যাবে না').optional(),
  gender: z
    .preprocess((val) => (val === '' ? undefined : val), z.enum(['MALE', 'FEMALE']))
    .optional(),
  website: z.string().url('সঠিক ইউআরএল দিন').optional().or(z.literal('')),
  position: z
    .string()
    .regex(/^[ঀ-৿\s.,।/()/-]+$/, 'পদবী  অবশ্যই বাংলায় হতে হবে')
    .optional(),
  district: z.string().min(1, 'জেলা নির্বাচন করুন').optional(),
  active: z.boolean().default(true),
  city: z.string().optional(),
  degree: z
    .string()
    .min(1, 'ডিগ্রি প্রদান করুন')
    .regex(/^[ঀ-৿\s.,।/()/-]+$/, 'ডিগ্রি অবশ্যই বাংলায় হতে হবে'),
  hospital: z
    .string()
    .min(1, 'হাসপাতালের নাম দিন')
    .regex(/^[ঀ-৿\s.,।/()/-]+$/, 'হাসপাতালের নাম অবশ্যই বাংলায় হতে হবে'),
  country: z.string().default('Bangladesh'),
  user: z.object({
    name: z
      .string()
      .min(1, 'নাম প্রদান করুন')
      .regex(/^[ঀ-৿\s.,।/()/-]+$/, 'নাম অবশ্যই বাংলায় হতে হবে'),
    phoneNumber: z
      .string()
      .min(1, 'মোবাইল নম্বর দেওয়া আবশ্যক')
      .regex(phoneRegex, 'সঠিক মোবাইল নম্বর প্রদান করুন'),
    password: z.string().min(8, 'পাসওয়ার্ড অন্তত ৮ অক্ষরের হতে হবে'),
    role: userRoleEnum,
    active: z.boolean().default(true),

    image: z.string().optional(),
  }),
});
export const createDoctorSchema = z.object({
  body: doctorSchema,
});

export const updateDoctorSchema = z.object({
  body: doctorSchema.partial(),
});

export const DoctorZodValidation = {
  createDoctorSchema,
  updateDoctorSchema,
};

export type CreateDoctorInput = z.infer<typeof createDoctorSchema>['body'];
export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>['body'];
