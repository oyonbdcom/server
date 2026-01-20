import { Prisma } from '@prisma/client';

export const DOCTOR_SELECT = {
  id: true,
  userId: true,
  department: true,
  specialization: true,
  bio: true,
  gender: true,
  district: true,
  city: true,
  country: true,
  website: true,
  hospital: true,
  position: true,
  active: true,
  averageRating: true,
  reviewsCount: true,
  education: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      role: true,
      deactivate: true,
      lastLoginAt: true,
    },
  },
  memberships: {
    select: {
      id: true,
      fee: true,
      maxAppointments: true,
      discount: true,
      schedules: true,
      clinic: {
        select: {
          address: true,
          district: true,
          city: true,
          phoneNumber: true,
          reviewsCount: true,
          averageRating: true,
          user: { select: { name: true, id: true, image: true } },
        },
      },
      doctor: {
        select: {
          specialization: true,
          user: { select: { id: true, name: true, image: true } },
        },
      },
    },
  },
} satisfies Prisma.DoctorSelect;
export const DoctorFilterableFields = [
  'searchTerm',
  'department',
  'specialization',
  'district',
  'city',
  'minRating',
  'active',
  'gender',
];
