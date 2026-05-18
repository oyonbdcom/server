import z from 'zod';

export const CreateAppointmentSchema = z.object({
  body: z.object({
    patientName: z.string().min(2, 'রোগীর নাম অন্তত ২ অক্ষরের হতে হবে'),

    ptAge: z.coerce.number().min(1, 'সঠিক বয়স দিন'),

    phoneNumber: z.string().regex(/^(?:\+8801|01)[3-9]\d{8}$/, 'সঠিক বাংলাদেশি মোবাইল নম্বর দিন'),
    consultationFee: z.coerce.number().optional(),

    appointmentDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'সঠিক তারিখ প্রদান করুন',
    }),

    address: z.string().min(3, 'ঠিকানা লিখুন').optional(),

    doctorId: z.string().min(2, 'ডাক্তার সিলেক্ট করা নেই'),

    isEmergency: z.boolean().default(false),

    clinicId: z.string().optional(),
    membershipId: z.string().optional(),

    // 🔥 FLAT emergency fields
    transactionId: z.string().min(6, 'TrxID দিতে হবে').optional(),
    paymentMethod: z.enum(['BKASH', 'NAGAD', 'ROCKET']).optional(),
    emergencyType: z.enum(['PLATFORM', 'COORDINATOR']).optional(),
  }),
});
export type IAppointmentForm = z.infer<typeof CreateAppointmentSchema>;

export const UpdateAppointmentSchema = z.object({
  body: z.object({
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
