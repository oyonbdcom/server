import z from 'zod';
import { createClinicMembershipSchema, updateClinicMembershipSchema } from './zodValidation';

export interface IMemberDoctor {
  id: string;
  department: string;
  specialization: string | null;
  position: string | null;
  hospital: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}

export interface IMembershipResponse {
  id: string;
  fee: string;
  maxAppointments: string;
  discount: string;
  createdAt: Date;
  updatedAt: Date;
  doctor?: IMemberDoctor | null;
  clinic?: any;
  schedules?: any[];
}
export type CreateMembershipInput = z.infer<typeof createClinicMembershipSchema>['body'];
export type UpdateMembershipInput = z.infer<typeof updateClinicMembershipSchema>['body'];

export const MembershipFilterableFields = ['joinAt'];
