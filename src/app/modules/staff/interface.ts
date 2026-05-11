import z from 'zod';

import { IAppointmentResponse } from '../appointment/interface';
import { IAreaResponse } from '../location/interface';
import { IReviewResponse } from '../review/interface';
import { IUserResponse } from '../user/interface';
import { createClinicSchema, updateClinicSchema } from './zodValidation';

export interface IDistrict {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface IClinicResponse {
  id: string;
  userId: string;
  user: IUserResponse;
  name: string;
  slug: string;
  address: string;
  areaId: string;
  area: IAreaResponse;
  website?: string;
  createdAt: string;
  updatedAt: string;
}

export type ICreateClinicRequest = z.infer<typeof createClinicSchema>['body'];

export type IUpdateClinicRequest = z.infer<typeof updateClinicSchema>['body'];
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
export interface IClinicWithRelationsResponse extends IClinicResponse {
  reviews?: IReviewResponse[];

  appointments?: IAppointmentResponse[];
}
