import { UserRole } from '@prisma/client';
import { z } from 'zod';

// বাংলা সংখ্যা চেক করার Regex (যদি প্রয়োজন হয়)

// const userCoreSchema = z.object({
//   name: z.string().min(1, 'আপনার নাম অবশ্যই দিতে হবে'),

//   // ইমেইল ভ্যালিডেশন সরিয়ে ফোন নম্বর ভ্যালিডেশন যোগ করা হয়েছে
//   phoneNumber: z
//     .string()
//     .min(11, 'ফোন নম্বর অন্তত ১১ ডিজিটের হতে হবে')
//     .max(14, 'ফোন নম্বরটি সঠিক নয়')
//     .refine((val) => /^\d+$/.test(val), {
//       message: 'সঠিক মোবাইল নম্বর প্রদান করুন (উদা: 017xxxxxxxx)',
//     }),

//   // enum হ্যান্ডলিং
//   role: z.nativeEnum(UserRole, {
//     errorMap: () => ({ message: 'সঠিক রোল (Role) নির্বাচন করুন' }),
//   }),

//   image: z.string().nullable().optional(),
// });

// export const createUserSchema = userCoreSchema.extend({
//   password: z
//     .string()
//     .min(8, 'পাসওয়ার্ড অন্তত ৮ অক্ষরের হতে হবে')
//     .regex(
//       /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/,
//       'পাসওয়ার্ডে অন্তত একটি বড় হাতের অক্ষর, একটি ছোট হাতের অক্ষর, একটি সংখ্যা এবং একটি বিশেষ চিহ্ন থাকতে হবে',
//     ),
// });

// // আপডেট স্কিমা (Partial)
// export const updateUserSchema = userCoreSchema.partial().extend({
//   id: z.string().cuid('ইউজার আইডিটি সঠিক নয়').optional(),
// });

export const updateUserRoleSchema = z.object({
  role: z.nativeEnum(UserRole, {
    error: () => ({ message: 'সঠিক রোল নির্বাচন করুন' }),
  }),
});

// export type CreateUserInput = z.infer<typeof createUserSchema>;
// export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const UserZodValidation = {
  updateUserRoleSchema,
};
