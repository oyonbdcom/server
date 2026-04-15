import { Gender } from '@prisma/client';
import { IDoctorAreaResponse } from '../location/interface';
import { IMembershipResponse } from '../membership/interface';
import { IUserResponse } from '../user/interface';

export interface IDepartmentResponse {
  id: string;
  name: string;
  slug: string;
}

export interface IDoctorMembership {
  id: string;
  organization: string;
  position: string;
}

export interface IDoctorResponse {
  id: string;
  userId: string;
  slug: string;
  specialization: string;
  departmentId: string;

  // Optional Fields from Schema
  website: string | null;
  position: string | null;
  education: any;
  hospital: string | null;
  gender: Gender | null;
  experience: number;

  // Counters & Ratings
  averageRating: number;
  reviewsCount: number;

  // Timestamps
  createdAt: Date | string;
  updatedAt: Date | string;

  // Relationships (Include logic অনুযায়ী আসবে)
  user: IUserResponse;
  department?: IDepartmentResponse;
  areas?: IDoctorAreaResponse[]; // DoctorArea[] রিলেশন
  memberships?: IMembershipResponse[]; // আপনার প্রয়োজন অনুযায়ী Membership টাইপ যোগ করতে পারেন
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
  fee: number;
  maxAppointments: number;
  discount: number;
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
