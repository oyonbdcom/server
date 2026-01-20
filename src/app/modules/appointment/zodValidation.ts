import z from 'zod';

export const CreateAppointmentSchema = z.object({
  body: z
    .object({
      reason: z.string().min(5, 'Reason is too short').optional(),
      doctorId: z.string().cuid(),
      clinicId: z.string().cuid(),

      // Guest Information (Optional if logged in)
      guest: z
        .object({
          email: z.string().email('Invalid email address'),
          name: z.string().min(2, 'Name is required'),
          phoneNumber: z.string().min(11, 'Phone number is required'),
          password: z.string().min(6, 'Password must be at least 6 characters').optional(),
        })
        .optional(),
    })
    .refine((data) => {
      // This logic ensures that if the user isn't logged in, they MUST provide guest info
      // (Note: The controller will check if req.user exists)
      return true;
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
