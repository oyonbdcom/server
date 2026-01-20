import { AppointmentStatus } from '@prisma/client';
import z from 'zod';
import { IMedicalRecordResponse } from '../medical-history/interface';
import { CreateAppointmentSchema, UpdateAppointmentSchema } from './zodValidation';

export interface IAppointmentResponse {
  id: string;
  appointmentDate: Date;
  status: AppointmentStatus | null;
  serialNumber: number; // Note: 'number' should be lowercase in TS
  code: string | null;
  type?: string | null;
  followUp?: string | null;
  duration?: string | null;
  createdAt: Date;

  doctor: {
    id: string;
    name: string;
    image: string | null;
    email?: string;
    // This allows the profile to be null if the record is missing
    doctor: {
      department: string | null;
      specialization: string | null;
    } | null;
  };

  patient: {
    id: string;
    name: string;
    image: string | null;
    email?: string;
    patient: {
      phoneNumber: string | null;
      bloodGroup: string | null;
    } | null;
  };

  clinic: {
    id: string;
    name: string;
    image: string | null;
    clinic: {
      address: string | null;
      city: string | null;
      district: string | null;
    } | null;
  };

  medicalRecords: IMedicalRecordResponse[];
}
export type IAppointmentStats = {
  total: number;
  scheduled: number;
  completed: number;
  cancelled: number;
};

export type IAppointmentCreateInput = z.infer<typeof CreateAppointmentSchema>['body'];
export type IAppointmentUpdateInput = z.infer<typeof UpdateAppointmentSchema>['body'];
