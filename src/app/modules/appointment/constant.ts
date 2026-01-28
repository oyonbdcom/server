import { jwtTokenHelper } from '../../../helper';
import { IUserResponse } from '../user/interface';

export const appointmentPopulate = {
  doctor: {
    select: {
      id: true,
      name: true,
      image: true,
      phoneNumber: true,
      doctor: { select: { department: true, specialization: true } },
    },
  },
  patient: {
    select: {
      id: true,
      name: true,
      image: true,

      phoneNumber: true,
      patient: { select: { phoneNumber: true, bloodGroup: true } }, // Profile info
    },
  },
  clinic: {
    select: {
      id: true,
      name: true,
      image: true,
      clinic: { select: { address: true, city: true, district: true } }, // Profile info
    },
  },
  medicalRecords: true,
};
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
export const AppointmentsFilterableFields = ['status', 'date'];
