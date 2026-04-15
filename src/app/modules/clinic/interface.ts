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

  averageRating: number;
  reviewsCount: number;
  createdAt: string;
  updatedAt: string;
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
