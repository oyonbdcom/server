export const PatientFilterableFields = ['searchTerm', 'district', 'active'];
import { Prisma } from '@prisma/client';

export const PATIENT_SELECT = {
  id: true,
  userId: true,
  gender: true,
  address: true,
  age: true,
  phoneNumber: true,
  bloodGroup: true,
  district: true,
  city: true,
  country: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      deactivate: true,
      _count: {
        select: { appointmentsAsPatient: true },
      },
      appointmentsAsPatient: {
        orderBy: { appointmentDate: 'desc' },
        take: 1,
        select: {
          id: true,
          appointmentDate: true,
          status: true,
          doctor: { select: { name: true } },
          clinic: { select: { name: true } },
          _count: { select: { medicalRecords: true } },
        },
      },
    },
  },
} satisfies Prisma.PatientSelect;
