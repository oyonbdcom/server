import { UserRole } from '@prisma/client';
import z from 'zod';
import { updatePatientSchema } from './zodValidation';

export type IPatientResponse = {
  id: string;
  name: string | null;
  phoneNumber: string;
  image: string | null;

  role: UserRole;
  deactivate: boolean;

  // ================= PATIENTS ARRAY =================
  patients: {
    id: string;
    age: number | null;
    gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
    address: string | null;
  }[];

  createdAt: string;
  updatedAt: string;
};

export type UpdatePatientInput = z.infer<typeof updatePatientSchema>['body'];

export const PatientFilterableFields = ['searchTerm', 'district', 'gender', 'active'];
