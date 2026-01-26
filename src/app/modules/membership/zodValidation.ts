import { z } from 'zod';

export const clinicMembershipSchema = z.object({
  doctorId: z.string().min(1, 'চিকিৎসক নির্বাচন করা আবশ্যক'),

  // ডাটাবেজে "৫০০" স্ট্রিং হিসেবে সেভ হবে
  fee: z
    .string()
    .min(1, 'ভিজিট বা কনসালটেশন ফি প্রয়োজন')
    .regex(/^[০-৯.]+$/, 'দয়া করে শুধুমাত্র বাংলা সংখ্যা ব্যবহার করুন'),

  // ডাটাবেজে "২০" স্ট্রিং হিসেবে সেভ হবে
  maxAppointments: z
    .string()
    .min(1, 'সর্বোচ্চ অ্যাপয়েন্টমেন্ট সংখ্যা প্রয়োজন')
    .regex(/^[০-৯]*$/, 'শুধুমাত্র বাংলা সংখ্যা ব্যবহার করুন'),

  // ডাটাবেজে "১০" স্ট্রিং হিসেবে সেভ হবে
  discount: z
    .string()
    .min(1, 'ডিসকাউন্ট প্রদান করা প্রয়োজন')
    .regex(/^[০-৯]*$/, 'ডিসকাউন্ট শুধুমাত্র বাংলা সংখ্যায় লিখুন')
    .refine((val) => {
      // ভ্যালিডেশনের জন্য সাময়িকভাবে ইংরেজিতে রূপান্তর করে ১০০ এর বেশি কি না চেক করা
      const enNum = Number(val.replace(/[০-৯]/g, (d) => '০১২৩৪৫৬৭৮৯'.indexOf(d).toString()));
      return enNum >= 0 && enNum <= 100;
    }, 'ডিসকাউন্ট ০% থেকে ১০০% এর মধ্যে হতে হবে'),
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
