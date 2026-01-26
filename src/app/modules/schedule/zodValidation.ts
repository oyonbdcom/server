/* eslint-disable prefer-const */
import { z } from 'zod';

const banglaRegex = /^[০-৯\u0980-\u09FF\s\-:.,()]+$/;

const createScheduleShape = z.object({
  membershipId: z.string().cuid('মেম্বারশিপ আইডি সঠিক নয়'),
  days: z.array(z.string()).min(1, 'অন্তত একটি দিন সিলেক্ট করুন'),

  times: z
    .string()
    .min(1, 'বসার সময় অবশ্যই দিতে হবে')
    .regex(
      banglaRegex,
      'দয়া করে শুধুমাত্র বাংলা অক্ষর, সংখ্যা এবং বিরামচিহ্ন ব্যবহার করুন (যেমন: সকাল ১০:৩০ - রাত ০৮:০০)',
    ),

  note: z
    .string()
    .nullable()
    .optional()
    .refine((val) => !val || banglaRegex.test(val), {
      message: 'নোট অবশ্যই বাংলায় হতে হবে',
    }),
});

// 2. Create Schema wrapped in 'body'
export const createScheduleSchema = z.object({
  body: createScheduleShape,
});

// 3. Update Schema wrapped in 'body'
export const updateScheduleSchema = z.object({
  body: createScheduleShape.partial().extend({
    // For updates, the ID usually comes from the URL params,
    // but if you want it in the body:
    id: z.string().cuid().optional(),
  }),
});

export const ScheduleZodValidation = {
  createScheduleSchema,
  updateScheduleSchema,
};
