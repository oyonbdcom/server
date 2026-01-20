import { z } from 'zod';
import { userRoleEnum } from '../../../constants/constant';

export const clinicSchema = z.object({
  id: z.string().cuid(),
  userId: z.string().cuid(),
  user: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    deactivate: z.boolean().default(true),
    image: z.string().default('null'),
    emailVerified: z.boolean().optional(),
    role: userRoleEnum,
  }),
  phoneNumber: z.string().min(11, 'Phone number is too short'),
  description: z.string().nullable(),
  openingHour: z.string().nullable(),
  establishedYear: z.number().nullable(),
  active: z.boolean().default(false),
  website: z.string().nullable(),
  address: z.string().nullable(),
  district: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().min(1, 'Country is required'),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// --- CREATE CLINIC SCHEMA ---
// We omit system-generated fields and relations
export const createClinicSchema = z.object({
  body: clinicSchema
    .omit({
      id: true,
      createdAt: true,
      updatedAt: true,
    })
    .extend({
      userId: z.string().cuid().optional(),
    }),
});

export const updateClinicSchema = z.object({
  body: createClinicSchema.shape.body.partial(),
});

export const ClinicZodValidation = {
  clinicSchema,
  createClinicSchema,
  updateClinicSchema,
};
