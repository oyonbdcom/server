import { AppointmentStatus } from '@prisma/client';
import z from 'zod';
import { IMedicalRecordResponse } from '../medical-history/interface';
import { CreateAppointmentSchema, UpdateAppointmentSchema } from './zodValidation';

export interface IAppointmentResponse {
  id: string;
  appointmentDate: Date;
  status: AppointmentStatus | null;
  serialNumber: number;
  phoneNumber: string | null;
  code: string | null;
  type?: string | null;
  followUp?: string | null;
  duration?: string | null;
  createdAt: Date;
  discount: number;
  refby?: string | null;
  doctor: {
    id: string;
    name: string;
    image: string | null;

    doctor: {
      department: string | null;
      specialization: string | null;
    } | null;
  };
  patient: {
    id: string;
    name: string;
    image: string | null;

    patient: {
      phoneNumber: string | null;
      bloodGroup: string | null;
    } | null;
  };

  diagnostic: {
    id: string;
    name: string;
    image: string | null;
    diagnostic: {
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
  pending: number;
};

export type IAppointmentCreateInput = z.infer<typeof CreateAppointmentSchema>['body'];
export type IAppointmentUpdateInput = z.infer<typeof UpdateAppointmentSchema>['body'];
