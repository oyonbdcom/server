import { Prisma } from '@prisma/client';

export const DOCTOR_SELECT = {
  id: true,
  userId: true,
  departmentId: true,
  department: {
    select: {
      name: true,
      slug: true,
    },
  },
  areas: {
    select: {
      area: {
        select: {
          name: true,
          district: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
      },
    },
  },
  memberships: {
    select: {
      id: true,
      discount: true,
      fee: true,
      clinic: {
        select: {
          id: true,
          address: true,
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          slug: true,
          area: {
            select: {
              name: true,
              district: {
                select: { name: true },
              },
            },
          },
        },
      },
      doctor: {
        select: {
          id: true,
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      },
      schedules: true,
    },
  },
  slug: true,
  specialization: true,
  experience: true,
  gender: true,
  hospital: true,
  position: true,
  website: true,
  averageRating: true,
  reviewsCount: true,
  education: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      name: true,
      phoneNumber: true,
      image: true,
      role: true,
      deactivate: true,
      isPhoneVerified: true,
    },
  },
} satisfies Prisma.DoctorSelect;

export const AREA_DOCTOR_SELECT = {
  id: true,
  userId: true,
  departmentId: true,
  department: {
    select: {
      name: true,
    },
  },

  slug: true,
  specialization: true,
  averageRating: true,
  reviewsCount: true,

  user: {
    select: {
      id: true,
      name: true,

      deactivate: true,
    },
  },
} satisfies Prisma.DoctorSelect;

export const DoctorFilterableFields = [
  'searchTerm',
  'department',
  'area',
  'district',
  'myAreaOnly',
  'minRating',
  'deactivate',
  'gender',
  'area_doctor',
  'isEmergency',
  'membership',
];
