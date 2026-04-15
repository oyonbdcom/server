import { z } from 'zod';

// বাংলা অক্ষর এবং স্পেস চেক করার জন্য Regex
const banglaRegex = /^[ঀ-৿\s]+$/;
const banglaErrorMessage = 'শুধুমাত্র বাংলা অক্ষর ব্যবহার করুন';

// ইংরেজি স্লাগ চেক করার জন্য Regex
const slugRegex = /^[a-z0-9-]+$/;
const slugErrorMessage = 'স্লাগ শুধুমাত্র ইংরেজি ছোট হাতের অক্ষর, সংখ্যা এবং ড্যাশ (-) হতে হবে';

// জেলা ভ্যালিডেশন
const districtSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(2, 'জেলার নাম অন্তত ২ অক্ষরের হতে হবে')
      .max(50, 'জেলার নাম ৫০ অক্ষরের বেশি হতে পারবে না')
      .regex(banglaRegex, banglaErrorMessage),
    slug: z.string().min(2, 'স্লাগ অন্তত ২ অক্ষরের হতে হবে').regex(slugRegex, slugErrorMessage),
  }),
});

// এরিয়া ভ্যালিডেশন
const areaSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(2, 'এরিয়ার নাম অন্তত ২ অক্ষরের হতে হবে')
      .regex(banglaRegex, banglaErrorMessage),
    slug: z.string().min(2, 'স্লাগ অন্তত ২ অক্ষরের হতে হবে').regex(slugRegex, slugErrorMessage),
    districtId: z.string().cuid('সঠিক জেলা নির্বাচন করুন'),
  }),
});

// ডিপার্টমেন্ট ভ্যালিডেশন
const departmentSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(2, 'ডিপার্টমেন্টের নাম অবশ্যই দিতে হবে')
      .regex(banglaRegex, banglaErrorMessage),
    slug: z.string().min(2, 'স্লাগ অন্তত ২ অক্ষরের হতে হবে').regex(slugRegex, slugErrorMessage),
    image: z
      .string()
      .url('অনুগ্রহ করে সঠিক একটি ইমেজ লিঙ্ক (URL) দিন')
      .optional()
      .or(z.literal('')),
  }),
});

export const SetupZodValidation = {
  districtSchema,
  areaSchema,
  departmentSchema,
};
