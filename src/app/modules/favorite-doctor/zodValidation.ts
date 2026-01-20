import { z } from 'zod';

// Base Favorite Doctor schema
export const favoriteDoctorSchema = z.object({
  id: z.string().cuid(),
  userId: z.string().cuid(),
  doctorId: z.string().cuid(),
  patientId: z.string().cuid(),
  createdAt: z.string(),
});

// Schema for creating a new Favorite Doctor entry
export const createFavoriteDoctorSchema = z.object({
  userId: z.string().cuid(),
  doctorId: z.string().cuid(),
  patientId: z.string().cuid(),
});

// Schema for updating an existing Favorite Doctor entry
export const updateFavoriteDoctorSchema = z.object({
  userId: z.string().cuid().optional(),
  doctorId: z.string().cuid().optional(),
  patientId: z.string().cuid().optional(),
});

export const FavoriteDoctorZodValidation = {
  favoriteDoctorSchema,
  createFavoriteDoctorSchema,
  updateFavoriteDoctorSchema,
};
