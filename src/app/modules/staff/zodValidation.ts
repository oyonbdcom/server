import { z } from 'zod';

import { phoneRegex } from '../../../constants/constant';
import { banglaRegex } from '../../../utils/common';

export const clinicSchema = z.object({
  user: z.object({
    name: z
      .string()
      .min(1, 'ক্লিনিকের নাম আবশ্যক')
      .regex(banglaRegex, 'ক্লিনিকের নাম  অবশ্যই বাংলায় হতে হবে'),
    phoneNumber: z
      .string()
      .min(11, 'সঠিক মোবাইল নম্বর দিন')
      .regex(phoneRegex, 'সঠিক মোবাইল নম্বর দিন'),
    password: z.string().min(6, 'পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে').optional().or(z.literal('')),
    image: z.string().optional(),
  }),
  slug: z.string().min(1, 'ইউনিক স্লাগ আবশ্যক'),
  address: z.string().min(1, 'ঠিকানা আবশ্যক').regex(banglaRegex, 'ঠিকানা   অবশ্যই বাংলায় হতে হবে'),
  website: z.string().url('সঠিক ওয়েবসাইট URL দিন').optional().or(z.literal('')),
});
export const createClinicSchema = z.object({
  body: clinicSchema,
});

export const updateClinicSchema = z.object({
  body: clinicSchema.partial().extend({
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

export const ClinicZodValidation = {
  clinicSchema,
  createClinicSchema,
  updateClinicSchema,
};
