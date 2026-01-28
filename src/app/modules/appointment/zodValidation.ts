import z from 'zod';

export const CreateAppointmentSchema = z.object({
  body: z.object({
    patientName: z.string().min(2, 'নাম আবশ্যক'),
    ptAge: z.preprocess(
      (val) => Number(val),
      z.number().min(1, 'বয়স অন্তত ১ বছর হতে হবে').max(120, 'সঠিক বয়স দিন'),
    ),

    phoneNumber: z.string().length(14, 'মোবাইল নম্বর অবশ্যই ১১ ডিজিটের হতে হবে'),
    address: z.string().optional().or(z.literal('')),

    note: z.string().optional().or(z.literal('')),

    appointmentDate: z.string().min(1, 'তারিখ সিলেক্ট করুন'),

    // সার্ভার সাইডে এগুলো ডাটাবেজ রিলেশনের জন্য প্রয়োজন হয়
    doctorId: z.string().min(1, "ডাক্তার আইডি প্রয়োজন'"),
    clinicId: z.string().min(1, 'ক্লিনিক আইডি প্রয়োজন'),
  }),
});

export const UpdateAppointmentSchema = z.object({
  body: z.object({
    appointmentDate: z.coerce.date().optional(),
    reason: z.string().min(5).optional(),
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
