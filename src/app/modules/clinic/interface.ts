import z from 'zod';

import { IAppointmentResponse } from '../appointment/interface';
import { IMembershipResponse } from '../membership/interface';
import { IReviewResponse } from '../review/interface';
import { IUserResponse } from '../user/interface';
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
  user: IUserResponse;

  memberships?: IMembershipResponse[];
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
