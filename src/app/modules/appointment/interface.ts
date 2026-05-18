import { AppointmentStatus, PatientType } from '@prisma/client';
import z from 'zod';
import { IAreaResponse } from '../location/interface';
import { IMedicalRecordResponse } from '../medical-history/interface';
import { CreateAppointmentSchema, UpdateAppointmentSchema } from './zodValidation';

export interface IAppointmentResponse {
  id: string;
  appointmentDate: Date;
  status: AppointmentStatus | null;
  serialNumber: number;
  type: PatientType;
  phoneNumber: string | null;

  createdAt: Date;

  createdBy?: string | null;
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

  clinic: {
    id: string;
    name: string;
    image: string | null;
    area: IAreaResponse;
  };

  medicalRecords: IMedicalRecordResponse[];
}
export type IAppointmentStats = {
  total: number;
  todayAppointments: number;
  scheduled: number;
  completed: number;
  cancelled: number;
  pending: number;
};

export type IAppointmentCreateInput = z.infer<typeof CreateAppointmentSchema>['body'];
export type IAppointmentUpdateInput = z.infer<typeof UpdateAppointmentSchema>['body'];
