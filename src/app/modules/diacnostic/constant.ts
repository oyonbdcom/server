import { Prisma } from '@prisma/client';

export const DIAGNOSTIC_SELECT = {
  id: true,
  userId: true,

  address: true,
  slug: true,

  user: {
    select: {
      id: true,
      name: true,
      phoneNumber: true,

      deactivate: true,
      image: true,
    },
  },

  area: {
    select: {
      id: true,
      name: true,
      slug: true,

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
