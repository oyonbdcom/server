import { z } from 'zod';

export const membershipSchema = z.object({
  doctorId: z.string().min(1, { message: 'ডাক্তার নির্বাচন করা আবশ্যক' }),
  clinicId: z.string().min(1, { message: 'ক্লিনিক নির্বাচন করা আবশ্যক' }).optional(),

  fee: z.coerce.number().min(0, { message: 'ফি ০ এর কম হতে পারবে না' }),

  discount: z.coerce
    .number()
    .min(0, { message: 'ডিসকাউন্ট ০ এর কম হতে পারবে না' })
    .max(100, { message: 'ডিসকাউন্ট ১০০% এর বেশি হতে পারবে না' }),

  active: z.boolean().default(true),
});
// Schema for creating a new ClinicMembership
export const createMembershipSchema = z.object({
  body: membershipSchema,
});

// Schema for updating an existing ClinicMembership
export const updateClinicMembershipSchema = z.object({
  body: membershipSchema.partial(),
});

export const ClinicMembershipZodValidation = {
  createMembershipSchema,
  updateClinicMembershipSchema,
};
