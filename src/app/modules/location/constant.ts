import { Prisma } from '@prisma/client';
import { jwtTokenHelper } from '../../../helper';
import { IUserResponse } from '../user/interface';

export const appointmentPopulate = {
  doctor: {
    select: {
      id: true,
      user: {
        select: { name: true, image: true, id: true },
      },

      department: true,
      specialization: true,
    },
  },

  clinic: {
    select: {
      id: true,
      user: {
        select: { name: true, image: true, id: true },
      },
      address: true,
      area: { select: { name: true } }, // Profile info
    },
  },

  medicalRecords: true,
} satisfies Prisma.AppointmentSelect;
export const generateAppointmentCode = (length: number = 8): string => {
  return Math.random()
    .toString(36)
    .substring(2, 2 + length)
    .toUpperCase();
};
export const generateTokens = (user: IUserResponse) => {
  const payload = { userId: user.id, email: user.phoneNumber, role: user.role };
  return {
    accessToken: jwtTokenHelper.accessToken(payload),
    refreshToken: jwtTokenHelper.refreshToken(payload),
  };
};
export const AppointmentsFilterableFields = ['status', 'date', 'doctorId'];
