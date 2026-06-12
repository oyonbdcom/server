import httpStatus from 'http-status';
import prisma from '../../../prisma/client';

import ApiError from '../../../utils/apiError';
import { IPatientResponse } from './interface';

const updatePatient = async (userId: string, payload: any) => {
  if (!userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User ID required');
  }

  const result = await prisma.$transaction(async (tx) => {
    // ================= GET USER =================
    const user = await tx.user.findUnique({
      where: { id: userId },
      include: {
        patient: true,
      },
    });

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    const patient = user.patient;

    if (!patient) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Patient profile not found');
    }

    // ================= UPDATE USER =================
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        name: payload.name,
        image: payload.image,
      },
      select: {
        id: true,
        name: true,
        image: true,
        phoneNumber: true,
      },
    });

    // ================= UPDATE PATIENT =================
    const updatedPatient = await tx.patient.update({
      where: { id: patient.id },
      data: {
        age: payload.age,
        gender: payload.gender,
        address: payload.address,
      },
    });

    return {
      user: updatedUser,
      patient: updatedPatient,
    };
  });

  return result;
};

const getPatientByUserId = async (userId: string): Promise<IPatientResponse | null> => {
  if (!userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User ID is required');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },

    select: {
      id: true,
      name: true,
      phoneNumber: true,
      image: true,
      deactivate: true,
      isPhoneVerified: true,

      createdAt: true,
      updatedAt: true,

      patient: true,
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  return user as any;
};

export const PatientService = {
  getPatientByUserId,
  updatePatient,
};
