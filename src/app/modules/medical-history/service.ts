// services/MedicalHistoryService.ts
import httpStatus from 'http-status';
import prisma from '../../../prisma/client';
import ApiError from '../../../utils/apiError';
import { IMedicalRecordResponse } from './interface';

export const addMedicalHistory = async (
  data: any, // Use your IMedicalHistoryCreateInput type here
): Promise<IMedicalRecordResponse> => {
  const existingAppointment = await prisma.appointment.findFirst({
    where: { id: data.appointmentId },
  });

  if (!existingAppointment) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Appointment not found!');
  }

  // 2. Create the record
  const result = await prisma.medicalRecord.create({
    data: {
      name: data.title || data.name,
      description: data.description,
      date: data.date ? new Date(data.date) : new Date(),
      document: data.document,
      appointmentId: data.appointmentId,
    },
    include: {
      appointment: true, // Optional: include appointment details in response
    },
  });

  return result;
};
// export const updateMedicalHistory = async (
//   historyId: string,
//   data: IMedicalHistoryUpdateInput,
//   user: JwtPayload,
// ) => {
//   const existing = await prisma.medicalRecord.findUnique({
//     where: { id: historyId },
//     select: { id: true, patient: { select: { userId: true } } },
//   });

//   if (!existing) {
//     throw new ApiError(httpStatus.NOT_FOUND, 'Medical history not found');
//   }

//   if (user.id !== existing.patient?.userId) {
//     throw new ApiError(httpStatus.FORBIDDEN, 'Your are not permission action this ');
//   }

//   // Prevent updating patientId or id
//   const safeData = { ...data };
//   delete (safeData as any).patientId;
//   delete (safeData as any).id;

//   return await prisma.medicalRecord.update({
//     where: { id: historyId },
//     data: safeData,
//   });
// };

// export const removeMedicalHistory = async (historyId: string, user: JwtPayload) => {
//   const existing = await prisma.medicalRecord.findUnique({
//     where: { id: historyId },
//     select: { id: true, patient: { select: { userId: true } } },
//   });

//   if (!existing) {
//     throw new ApiError(httpStatus.NOT_FOUND, 'Medical history not found');
//   }

//   if (user.id !== existing.patient.userId) {
//     throw new ApiError(httpStatus.FORBIDDEN, 'Access denied');
//   }

//   return await prisma.medicalRecord.delete({
//     where: { id: historyId },
//   });
// };

export const MedicalHistoryService = {
  addMedicalHistory,

  // updateMedicalHistory,
  // removeMedicalHistory,
};
