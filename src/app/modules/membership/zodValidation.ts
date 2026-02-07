import { z } from 'zod';

export const clinicMembershipSchema = z.object({
  doctorId: z.string().min(1, 'চিকিৎসক নির্বাচন করা আবশ্যক'),

  fee: z.number().min(1, 'ভিজিট বা কনসালটেশন ফি প্রয়োজন'),
  // ডাটাবেজে "২০" স্ট্রিং হিসেবে সেভ হবে
  maxAppointments: z.number().min(1, 'সর্বোচ্চ অ্যাপয়েন্টমেন্ট সংখ্যা প্রয়োজন'),
  // ডাটাবেজে "১০" স্ট্রিং হিসেবে সেভ হবে
  discount: z.number().min(1, 'ডিসকাউন্ট প্রদান করা প্রয়োজন'),
});

// Schema for creating a new ClinicMembership
export const createClinicMembershipSchema = z.object({
  body: clinicMembershipSchema,
});

// Schema for updating an existing ClinicMembership
export const updateClinicMembershipSchema = z.object({
  body: clinicMembershipSchema.partial(),
});

export const ClinicMembershipZodValidation = {
  createClinicMembershipSchema,
  updateClinicMembershipSchema,
};
