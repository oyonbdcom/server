import { z } from 'zod';

export const clinicMembershipSchema = z.object({
  doctorId: z.string(),
  fee: z.coerce.number().min(0, 'Fee cannot be negative'),
  maxAppointments: z.coerce.number().min(1, 'At least 1 appointment is required').default(20),
  discount: z.coerce
    .number()
    .min(0, 'Discount cannot be negative')
    .max(100, 'Discount cannot exceed 100%')
    .default(0),
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
