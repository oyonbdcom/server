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
  staffId: string;
  name: string;
  role: string;
  appointmentCount: number;
}

export interface IDoctorPerformance {
  doctorId: string;
  name: string;
  specialty: string;
  appointmentCount: number;
}

export interface IChartData {
  date: string;
  bookings: number;
}

export interface IDiagnosticManagerStats {
  summary: {
    totalBookings: number;
    completedCount: number;
    cancelledCount: number;
    platformBookings: number;
    staffManualBookings: number;
  };
  walletBalance: number;
  doctorPerformance: IDoctorPerformance[];
  staffPerformance: IStaffActivity[]; // আগে staffActivities ছিল, আপনার JSON অনুযায়ী এটি আপডেট করা হয়েছে
  chartData: IChartData[];
}
export interface IDiagnosticWithRelationsResponse extends IDiagnosticResponse {
  reviews?: IReviewResponse[];

  appointments?: IAppointmentResponse[];
}
