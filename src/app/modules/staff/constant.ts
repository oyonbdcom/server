import { Prisma } from '@prisma/client';

export const DIAGNOSTIC_SELECT = {
  id: true,
  userId: true,

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
} satisfies Prisma.DiagnosticSelect;
export interface IDiagnosticFilterRequest {
  searchTerm?: string;
  deactivate?: string;
  minRating?: string;
  area?: string;
  district?: string;
}
export const DiagnosticFilterableFields = [
  'searchTerm',
  'deactivate',
  'district',
  'area',
  'minRating',
];

export interface IDiagnosticFilterRequest {
  searchTerm?: string;
  deactivate?: string;
  districtId?: string;

  minRating?: string;
}
