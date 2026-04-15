import httpStatus from 'http-status';
import prisma from '../../../prisma/client';

import ApiError from '../../../utils/apiError';
import { IPatientResponse } from './interface';

const updatePatient = async (id: string, payload: any): Promise<IPatientResponse | null> => {
  // ১. ইউজারটি আছে কি না তা নিশ্চিত করা
  const isUserExist = await prisma.user.findUnique({
    where: { id },
  });

  if (!isUserExist) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const { name, image, age, gender, address, area, ...patientData } = payload;

  // ২. ইউজার আপডেট এবং পেশেন্ট প্রোফাইল Upsert (থাকলে আপডেট, না থাকলে ক্রিয়েট)
  const result = await prisma.user.update({
    where: { id },
    data: {
      name,
      image,
      patient: {
        upsert: {
          // যদি প্রোফাইল থাকে তবে এই ডাটা দিয়ে আপডেট হবে
          update: {
            age,
            gender,
            address,
            ...(area && {
              area: {
                connect: { slug: area },
              },
            }),
          },
          // যদি প্রোফাইল না থাকে তবে এই ডাটা দিয়ে নতুন তৈরি হবে
          create: {
            age,
            gender,
            address,
            ...(area && {
              area: {
                connect: { slug: area },
              },
            }),
          },
        },
      },
    },
    // ডাটা রিটার্ন ফরম্যাট (আপনার IPatientResponse অনুযায়ী)
    select: {
      id: true,
      name: true,
      phoneNumber: true,
      image: true,
      role: true,
      deactivate: true,
      patient: {
        select: {
          age: true,
          gender: true,
          address: true,
          area: {
            select: {
              name: true,
              slug: true, // ফ্রন্টএন্ডে জেলা/এরিয়া সিঙ্ক রাখতে স্লাগ প্রয়োজন
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
      createdAt: true,
      updatedAt: true,
    },
  });

  return result as unknown as IPatientResponse;
};

const getPatientById = async (id: string): Promise<IPatientResponse | null> => {
  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Patient ID is required');
  }

  const patient = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      phoneNumber: true,
      image: true,
      deactivate: true,
      isPhoneVerified: true,

      patient: {
        select: {
          area: {
            select: {
              name: true,
              district: {
                select: {
                  name: true,
                },
              },
            },
          },
          userId: true,
          gender: true,
          address: true,
          age: true,
        },
      },

      createdAt: true,
      updatedAt: true,
    },
  });

  if (!patient) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Patient not found');
  }

  return patient as any;
};

// const deletePatient = async (userId: string): Promise<IPatientResponse> => {
//   // 1️⃣ Check if Patient exists
//   const existingPatient = await prisma.patient.findUnique({
//     where: { userId },
//     select: { id: true, userId: true },
//   });

//   if (!existingPatient) {
//     throw new ApiError(httpStatus.NOT_FOUND, 'Patient not found');
//   }

//   const updatedData = await prisma.patient.update({
//     where: { userId },
//     data: {
//       user: {
//         update: { deactivate: false },
//       },
//     },
//     select: PATIENT_SELECT,
//   });

//   return updatedData as IPatientResponse;
// };

export const PatientService = {
  // getPatients,
  // getPatientStats,
  getPatientById,
  updatePatient,
  // deletePatient,
};
