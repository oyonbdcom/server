import { z } from 'zod';

// Base Prescription schema
export const prescriptionSchema = z.object({
  id: z.string().cuid(),
  doctorId: z.string().cuid(),
  patientId: z.string().cuid(),
  appointmentId: z.string().cuid().optional(),
  image: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Schema for creating a new Prescription
export const createPrescriptionSchema = z.object({
  doctorId: z.string().cuid(),
  patientId: z.string().cuid(),
  appointmentId: z.string().cuid().optional(),
  image: z.string().optional(),
});

// Schema for updating an existing Prescription
export const updatePrescriptionSchema = z.object({
  doctorId: z.string().cuid().optional(),
  patientId: z.string().cuid().optional(),
  appointmentId: z.string().cuid().optional(),
  image: z.string().optional(),
});
export const PrescriptionZodValidation = {
  prescriptionSchema,
  createPrescriptionSchema,
  updatePrescriptionSchema,
};
