import z from 'zod';

import { IAppointmentResponse } from '../appointment/interface';
import { IReviewResponse } from '../doctor-review/interface';
import { IAreaResponse } from '../location/interface';
import { createDiagnosticSchema, updateDiagnosticSchema } from './zodValidation';

export interface IDistrict {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface IDiagnosticResponse {
  id: string;
  userId: string;

  name: string;
  slug: string;
  address: string;
  areaId: string;
  area: IAreaResponse;
  website?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IAreaDiagnosticResponse {
  id: string;

  name: string;
  slug: string;
  address: string;
  city: string;
  district: string;
  website?: string;
}

export type ICreateDiagnosticRequest = z.infer<typeof createDiagnosticSchema>['body'];

export type IUpdateDiagnosticRequest = z.infer<typeof updateDiagnosticSchema>['body'];
export interface IStaffActivity {
  id: string;
  name: string;
  role: string;
  totalBookings: number;
}

export interface IDiagnosticManagerStats {
  totalDoctors: number;
  todayAppointments: number;
  completedAppointments: number;
  totalStaffs: number;
  staffActivities: IStaffActivity[];
}
export interface IDiagnosticWithRelationsResponse extends IDiagnosticResponse {
  reviews?: IReviewResponse[];

  appointments?: IAppointmentResponse[];
}
