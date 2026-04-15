/* eslint-disable prefer-const */
import { z } from 'zod';

const banglaRegex = /^[০-৯\u0980-\u09FF\s\-:.,()]+$/;

const scheduleSchema = z.object({
  time: z
    .string()
    .min(1, 'শিডিউল বর্ণনা আবশ্যক')
    .regex(
      /^[\u0980-\u09FF\s\d,।:-]+$/,
      'শুধুমাত্র বাংলা অক্ষর ব্যবহার করুন (যেমন: শনি-সোম, বিকাল ৫টা)',
    ),
});
// 2. Create Schema wrapped in 'body'
export const createScheduleSchema = z.object({
  body: scheduleSchema,
});

// 3. Update Schema wrapped in 'body'
export const updateScheduleSchema = z.object({
  body: scheduleSchema.partial().extend({
    // For updates, the ID usually comes from the URL params,
    // but if you want it in the body:
    id: z.string().cuid().optional(),
  }),
});

export const ScheduleZodValidation = {
  createScheduleSchema,
  updateScheduleSchema,
};
