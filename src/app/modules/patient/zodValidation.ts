import { z } from 'zod';

export const updatePatientSchema = z.object({
  body: z
    .object({
      age: z.number().nullable().optional(), // Now accepts number, undefined, or null
      gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
      bloodGroup: z.string().nullable().optional(),
      phoneNumber: z.string().nullable().optional(), // This fixes your specific error
      address: z.string().nullable().optional(),
      district: z.string().nullable().optional(),
      city: z.string().nullable().optional(),
      country: z.string().nullable().optional(),
      name: z.string().min(2),
      email: z.string().email(),
      image: z.string(),
      deactivate: z.boolean().default(false),
    })
    .partial(),
});
export const PatientZodValidation = {
  updatePatientSchema,
};
