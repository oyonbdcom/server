import { Gender } from '@prisma/client';
import { z } from 'zod';
import { userRoleEnum } from '../../../constants/constant';

const doctorBodySchema = z.object({
  department: z.string().min(1, 'Department is required'),
  specialization: z.string().optional(),
  bio: z.string().max(1000).optional(),
  gender: z.nativeEnum(Gender).optional(),
  website: z.string().url().optional().or(z.literal('')),
  position: z.string().optional(),
  hospital: z.string().optional(),
  active: z.boolean().default(true),
  district: z.string().optional(),
  city: z.string().optional(),
  country: z.string().default('Bangladesh'),
  education: z.string().optional(),

  user: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    image: z.string().default('null'),
    emailVerified: z.boolean().optional(),
    active: z.boolean(),
    role: userRoleEnum,
  }),
});

export const createDoctorSchema = z.object({
  body: doctorBodySchema,
});

export const updateDoctorSchema = z.object({
  body: doctorBodySchema.partial(),
});

export const DoctorZodValidation = {
  createDoctorSchema,
  updateDoctorSchema,
};

export type CreateDoctorInput = z.infer<typeof createDoctorSchema>['body'];
export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>['body'];
