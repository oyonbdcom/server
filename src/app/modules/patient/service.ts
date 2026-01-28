import httpStatus from 'http-status';
import prisma from '../../../prisma/client';

import { Prisma } from '@prisma/client';
import { IOptions, paginationCalculator } from '../../../helper/pagination';
import { IGenericResponse } from '../../../interface/common';
import ApiError from '../../../utils/apiError';
import { PATIENT_SELECT } from './constant';
import { IPatientResponse, IPatientStats, UpdatePatientInput } from './interface';

const getPatients = async (
  filter: {
    searchTerm?: string;
    district?: string;
    active?: string | boolean;
    gender?: 'MALE' | 'FEMALE' | 'OTHER';
  },
  options: IOptions,
): Promise<IGenericResponse<IPatientResponse[]>> => {
  const { page, limit, skip, sortBy, sortOrder } = paginationCalculator(options);
  const { searchTerm, active, gender, ...filterData } = filter;

  const andConditions: Prisma.PatientWhereInput[] = [];

  // --- Filter Logic ---
  if (searchTerm) {
    andConditions.push({
      OR: [
        { user: { name: { contains: searchTerm, mode: 'insensitive' } } },
        { district: { contains: searchTerm, mode: 'insensitive' } },
        { city: { contains: searchTerm, mode: 'insensitive' } },
      ],
    });
  }

  if (active !== undefined && active !== '') {
    andConditions.push({
      user: { deactivate: active === 'true' },
    });
  }

  if (gender) {
    andConditions.push({ gender });
  }

  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      AND: Object.entries(filterData).map(([key, value]) => ({
        [key]: { equals: value, mode: 'insensitive' },
      })),
    });
  }

  const whereCondition: Prisma.PatientWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  // --- Database Query ---
  const [patients, total] = await Promise.all([
    prisma.patient.findMany({
      where: whereCondition,
      skip,
      take: limit,
      orderBy: sortBy && sortOrder ? { [sortBy]: sortOrder } : { createdAt: 'desc' },
      select: {
        id: true,
        gender: true,
        address: true,
        age: true,
        phoneNumber: true,
        bloodGroup: true,
        district: true,
        city: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
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
                doctor: { select: { name: true, image: true } },
                clinic: { select: { name: true, image: true } },
                _count: { select: { medicalRecords: true } },
              },
            },
          },
        },
      },
    }),
    prisma.patient.count({ where: whereCondition }),
  ]);

  // --- Data Formatting & Flattening ---
  const formattedData = patients.map((patient) => {
    const { user, ...patientData } = patient;
    const latestApp = user.appointmentsAsPatient[0] || null;

    return {
      ...patientData,
      // User details merged into root
      name: user.name,
      phoneNumber: user.phoneNumber,
      image: user.image,
      deactivate: user.deactivate,
      userId: user.id,
      totalAppointments: user._count.appointmentsAsPatient,
      latestAppointment: latestApp
        ? {
            id: latestApp.id,
            date: latestApp.appointmentDate,
            status: latestApp.status,
            doctorName: latestApp.doctor?.name,
            clinicName: latestApp.clinic?.name,
            medicalRecordsCount: latestApp._count.medicalRecords,
          }
        : null,
    };
  });

  return {
    meta: { page, limit, total },
    data: formattedData,
  };
};
const getPatientStats = async (): Promise<IPatientStats> => {
  const [activeCount, inactiveCount] = await Promise.all([
    // Count based on the 'active' boolean in Doctor model
    prisma.patient.count({
      where: { user: { deactivate: false } },
    }),
    prisma.patient.count({
      where: { user: { deactivate: true } },
    }),
  ]);

  return {
    total: activeCount + inactiveCount,
    active: activeCount,
    inactive: inactiveCount,
  };
};
const updatePatient = async (
  userId: string, // This could be userId OR patientId
  payload: UpdatePatientInput,
): Promise<IPatientResponse | null> => {
  if (!userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User ID is required');
  }

  console.log(userId);
  // 1. Find the patient first to get their ACTUAL userId and id
  const existingPatient = await prisma.patient.findFirst({
    where: {
      OR: [{ userId: userId }, { id: userId }],
    },
  });

  if (!existingPatient) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Patient profile not found!');
  }

  const { name, email, image, deactivate, ...patientData } = payload;

  const userUpdateData: any = {};
  if (name !== undefined) userUpdateData.name = name;
  if (email !== undefined) userUpdateData.email = email;
  if (image !== undefined) userUpdateData.image = image;
  if (deactivate !== undefined) userUpdateData.deactivate = deactivate;

  // 4. Execute Update using the verified userId from the existing record
  const updatedData = await prisma.patient.update({
    where: {
      userId: existingPatient.userId, // FIX: Use the userId from the record we found
    },
    data: {
      ...patientData,
      country: patientData.country || 'Bangladesh',
      ...(Object.keys(userUpdateData).length > 0 && {
        user: {
          update: userUpdateData,
        },
      }),
    },
    include: {
      user: {
        select: {
          name: true,
          phoneNumber: true,
          image: true,
          deactivate: true,
          _count: {
            select: { appointmentsAsPatient: true },
          },
        },
      },
    },
  });

  return {
    id: updatedData.id,
    userId: updatedData.userId,
    age: updatedData.age,
    gender: updatedData.gender,
    address: updatedData.address,
    district: updatedData.district,
    city: updatedData.city,
    bloodGroup: updatedData.bloodGroup,

    name: updatedData.user.name,
    phoneNumber: updatedData.user.phoneNumber,
    image: updatedData.user.image,
    deactivate: updatedData.user.deactivate,
    latestAppointment: null,
    totalAppointments: updatedData.user._count.appointmentsAsPatient,
    createdAt: updatedData.createdAt,
    updatedAt: updatedData.updatedAt,
  } as IPatientResponse;
};
const getPatientById = async (id: string): Promise<IPatientResponse | null> => {
  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Patient ID is required');
  }

  const patient = await prisma.patient.findUnique({
    where: { userId: id },
    select: {
      id: true,
      userId: true,
      gender: true,
      address: true,
      age: true,
      phoneNumber: true,
      bloodGroup: true,
      district: true,
      city: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          name: true,
          phoneNumber: true,
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
    },
  });

  if (!patient) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Patient not found');
  }

  // --- Flattening logic to match IPatientResponse ---
  const latestApp = patient.user.appointmentsAsPatient[0] || null;

  return {
    id: patient.id,
    userId: patient.userId,
    age: patient.age,
    gender: patient.gender,
    address: patient.address,
    district: patient.district,
    city: patient.city,
    bloodGroup: patient.bloodGroup,

    name: patient.user.name,
    phoneNumber: patient.user.phoneNumber,
    image: patient.user.image,
    deactivate: patient.user.deactivate,

    totalAppointments: patient.user._count.appointmentsAsPatient,

    latestAppointment: latestApp
      ? {
          id: latestApp.id,
          date: latestApp.appointmentDate,
          status: latestApp.status,
          doctorName: latestApp.doctor?.name || 'N/A',
          clinicName: latestApp.clinic?.name || 'N/A',
          medicalRecordsCount: latestApp._count.medicalRecords,
        }
      : null,
    createdAt: patient.createdAt,
    updatedAt: patient.updatedAt,
  };
};

const deletePatient = async (userId: string): Promise<IPatientResponse> => {
  // 1️⃣ Check if Patient exists
  const existingPatient = await prisma.patient.findUnique({
    where: { userId },
    select: { id: true, userId: true },
  });

  if (!existingPatient) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Patient not found');
  }

  const updatedData = await prisma.patient.update({
    where: { userId },
    data: {
      user: {
        update: { deactivate: false },
      },
    },
    select: PATIENT_SELECT,
  });

  return {
    id: updatedData.id,
    userId: updatedData.userId,
    age: updatedData.age,
    gender: updatedData.gender,
    address: updatedData.address,
    district: updatedData.district,
    city: updatedData.city,
    bloodGroup: updatedData.bloodGroup,

    // Flattened User fields
    name: updatedData.user.name,
    phoneNumber: updatedData.user.phoneNumber,
    image: updatedData.user.image,
    deactivate: updatedData.user.deactivate,
    // Latest Appointment (usually null on update unless specifically fetched)
    latestAppointment: null,
    totalAppointments: updatedData.user._count.appointmentsAsPatient,
    createdAt: updatedData.createdAt,
    updatedAt: updatedData.updatedAt,
  } as IPatientResponse;
};

export const PatientService = {
  getPatients,
  getPatientStats,
  getPatientById,
  updatePatient,
  deletePatient,
};
