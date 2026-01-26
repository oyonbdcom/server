import { UserRole } from '@prisma/client';
import z from 'zod';

import { IAppointmentResponse } from '../appointment/interface';
import { IReviewResponse } from '../review/interface';
import { IScheduleResponse } from '../schedule/interface';
import { createClinicSchema, updateClinicSchema } from './zodValidation';

export interface IClinicResponse {
  id: string;
  userId: string;
  slug: string;
  phoneNumber: string | null;
  description: string | null;
  openingHour: string | null;
  // CHANGE THIS:
  establishedYear: number | null;
  address: string | null;
  district: string | null;
  city: string | null;
  country: string | null;
  active: boolean;
  website: string | null;
  averageRating: number;
  reviewsCount: number;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    emailVerified: boolean;
    deactivate: boolean;
    image: string | null;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };

  memberships?: {
    id: string;
    fee: string;
    maxAppointments: string;
    discount: string;
    createdAt: Date;
    updatedAt: Date;
    doctor?: any | null;
    clinic?: any;
    schedules?: IScheduleResponse[];
  }[];
}
export type ICreateClinicRequest = z.infer<typeof createClinicSchema>['body'];

export type IUpdateClinicRequest = z.infer<typeof updateClinicSchema>['body'];
export interface IClinicStats {
  total: number;
  active: number;
  inactive: number;
}
export interface IClinicWithRelationsResponse extends IClinicResponse {
  reviews?: IReviewResponse[];

  appointments?: IAppointmentResponse[];
}
