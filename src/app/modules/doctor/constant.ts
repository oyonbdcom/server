import { Prisma } from '@prisma/client';

export const DOCTOR_SELECT = {
  id: true,
  userId: true,
  departmentId: true,
  department: {
    select: {
      name: true,
      id: true,
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
      areaId: true,
    },
  },

  slug: true,
  specialization: true,
  experience: true,
  gender: true,
  hospital: true,
  isEmergency: true,
  position: true,
  website: true,
  averageRating: true,
  reviewsCount: true,
  educations: true,

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
  memberships: {
    select: {
      diagnostic: {
        select: {
          user: {
            select: { name: true },
          },
          slug: true,
          address: true,
          area: {
            select: {
              district: {
                select: {
                  name: true,
                },
              },
              name: true,
            },
          },
        },
      },
      id: true,
      fee: true,
      discount: true,
      createdAt: true,
    },
  },
} satisfies Prisma.DoctorSelect;
export const EMERGENCY_DOCTOR_SELECT = {
  id: true,

  slug: true,
  specialization: true,
  experience: true,
  hospital: true,
  position: true,
  website: true,
  averageRating: true,
  reviewsCount: true,

  user: {
    select: {
      id: true,
      name: true,
      phoneNumber: true,
      image: true,
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
  hospital: true,
  website: true,
  isEmergency: true,
  experience: true,
  position: true,
  gender: true,
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
