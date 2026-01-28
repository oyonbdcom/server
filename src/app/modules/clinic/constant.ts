import { Prisma } from '@prisma/client';

export const CLINIC_SELECT = {
  id: true,
  userId: true,
  phoneNumber: true,
  description: true,
  openingHour: true,
  establishedYear: true,
  address: true,
  district: true,
  slug: true,
  city: true,
  country: true,
  active: true,
  website: true,
  averageRating: true,
  reviewsCount: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      name: true,
      phoneNumber: true,
      role: true,
      isPhoneVerified: true,
      deactivate: true,
      image: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  memberships: {
    select: {
      id: true,
      fee: true,
      maxAppointments: true,
      discount: true,
      createdAt: true,
      updatedAt: true,
      doctor: {
        select: {
          id: true,
          specialization: true,
          averageRating: true,
          department: true,
          hospital: true,
          position: true,
          user: { select: { name: true, image: true, id: true } },
        },
      },
      clinic: {
        select: {
          id: true,
          city: true,
          averageRating: true,
          active: true,

          user: { select: { name: true, image: true, id: true } },
        },
      },

      schedules: true,
    },
  },
} satisfies Prisma.ClinicSelect;

export interface IClinicFilterRequest {
  searchTerm?: string;
  active?: string;
  minRating?: string;
  city?: string;
  district?: string;
}
export const ClinicFilterableFields = ['searchTerm', 'active', 'district', 'city', 'minRating'];

export const exactMatchFields = ['district'] as const;
export interface IClinicFilterRequest {
  searchTerm?: string;
  active?: string;
  district?: string;
  city?: string;
  minRating?: string;
}
