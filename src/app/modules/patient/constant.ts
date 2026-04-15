export const PatientFilterableFields = ['searchTerm', 'district', 'active'];
import { Prisma } from '@prisma/client';

export const PATIENT_SELECT = {
  id: true,
  userId: true,
  gender: true,
  address: true,
  age: true,
  user: {
    select: {
      id: true,
      name: true,
      phoneNumber: true,
      image: true,
      deactivate: true,
    },
  },
} satisfies Prisma.PatientSelect;
