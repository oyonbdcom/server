import z from 'zod';

export const CreateAppointmentSchema = z.object({
  body: z.object({
    patientName: z.string().min(2, 'নাম আবশ্যক'),
    ptAge: z.coerce.number().min(1, 'বয়স আবশ্যক'),

    phoneNumber: z.string().length(14, 'মোবাইল নম্বর অবশ্যই ১১ ডিজিটের হতে হবে'),
    address: z.string().optional().or(z.literal('')),
    discount: z.number().optional(),
    note: z.string().optional().or(z.literal('')),

    appointmentDate: z.string().min(1, 'তারিখ সিলেক্ট করুন'),
    serialNumber: z.number().optional(),
    // সার্ভার সাইডে এগুলো ডাটাবেজ রিলেশনের জন্য প্রয়োজন হয়
    otp: z.string().min(6, "ওটিপি আবশ্যক'").optional(),
    refby: z.string().min(2, "ওটিপি আবশ্যক'").optional(),
    doctorId: z.string().min(1, "ডাক্তার আইডি আবশ্যক'"),
    clinicId: z.string().min(1, 'ক্লিনিক আইডি আবশ্যক'),
    membershipId: z.string().min(1, 'ক্লিনিক আইডি আবশ্যক'),
  }),
});

export const UpdateAppointmentSchema = z.object({
  body: z.object({
    times: z.string(),
    serialNumber: z.number(),
    status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED', 'PENDING', 'RESCHEDULED']).optional(),
  }),
});

export const CreateMedicalRecordSchema = z.object({
  body: z.object({
    appointmentId: z.string().cuid(),
    name: z.string().min(2, 'Title is required'),
    description: z.string().optional(),
    document: z.string().url('Invalid document URL').optional(),
  }),
});

export const AppointmentZodValidation = {
  CreateAppointmentSchema,
  UpdateAppointmentSchema,
  CreateMedicalRecordSchema,
};
