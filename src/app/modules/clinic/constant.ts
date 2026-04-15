import { Prisma } from '@prisma/client';

export const CLINIC_SELECT = {
  id: true,
  userId: true,
  name: true,
  address: true,
  slug: true,

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
      createdAt: true,
      updatedAt: true,
    },
  },

  area: {
    select: {
      id: true,
      name: true,
      slug: true,
      districtId: true,
      district: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  },
} satisfies Prisma.ClinicSelect;
export interface IClinicFilterRequest {
  searchTerm?: string;
  deactivate?: string;
  minRating?: string;
  area?: string;
  district?: string;
}
export const ClinicFilterableFields = ['searchTerm', 'deactivate', 'district', 'area', 'minRating'];

export interface IClinicFilterRequest {
  searchTerm?: string;
  deactivate?: string;
  districtId?: string;

  minRating?: string;
}
