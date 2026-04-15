import z from 'zod';
import { updatePatientSchema } from './zodValidation';

export type IPatientResponse = {
  id: string;
  name: string | null;
  phoneNumber: string;
  image: string | null;
  role: 'PATIENT' | 'DOCTOR' | 'ADMIN' | 'MANAGER' | 'CLINIC';
  deactivate: boolean;
  patient: {
    age: number | null;
    gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
    address: string | null;
    area: {
      name: string | null;
      district: {
        name: string | null;
      };
    } | null;
  } | null;

  createdAt: Date;
  updatedAt: Date;
};

export type UpdatePatientInput = z.infer<typeof updatePatientSchema>['body'];

export const PatientFilterableFields = ['searchTerm', 'district', 'gender', 'active'];
