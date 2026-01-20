import { z } from 'zod';

export const medicalHistorySchema = z.object({
  appointmentId: z.string().cuid(),
  name: z.string(),
  description: z.string().optional(),
  document: z.string().optional(),
});
export const createMedicalHistorySchema = z.object({
  body: medicalHistorySchema,
});

export const updateMedicalHistorySchema = z.object({
  body: medicalHistorySchema.partial(),
});

export const MedicalHistoryZodValidation = {
  medicalHistorySchema,
  createMedicalHistorySchema,
  updateMedicalHistorySchema,
};
