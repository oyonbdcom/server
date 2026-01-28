import { Gender } from '@prisma/client';
import { IUserResponse } from '../user/interface';
export interface IEducation {
  degree: string;
  institution: string;
  year: number;
}
export interface IDoctorResponse {
  id: string;
  userId: string;
  department: string | null;
  specialization: string | null;
  slug: string | null;
  bio: string | null;
  gender: Gender | null;
  district: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
  hospital: string | null;
  position: string | null;
  active: boolean;
  averageRating: number;
  reviewsCount: number;
  education: IEducation | any;
  createdAt: Date;
  updatedAt: Date;
  user: IUserResponse;
  memberships?: IDoctorMembership[];
}
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED' | 'PENDING_APPROVAL';

export interface IDepartmentStat {
  name: string;
  count: number;
}

export interface IDoctorStats {
  total: number;
  active: number;
  inactive: number;
  departments: IDepartmentStat[];
}

export interface IDoctorMembership {
  id: string;
  fee: string;
  maxAppointments: string;
  discount: string;
  schedules: any[];
  clinic: {
    address: string;
    district: string;
    city: string;
    phoneNumber: string;
    reviewsCount: number;
    averageRating: number;
    user: { name: string; id: string; image: string | null };
  };
  doctor: {
    specialization: string;
    user: { id: string; name: string; image: string | null };
  };
}
export const UserFilterableFields = ['searchTerm', 'role', 'emailVerified', 'active', 'gender'];
