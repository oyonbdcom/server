import { Prisma, UserRole } from '@prisma/client';
import httpStatus from 'http-status';

import bcrypt from 'bcrypt';
import { IOptions, paginationCalculator } from '../../../helper/pagination';
import { IGenericResponse } from '../../../interface/common';
import prisma from '../../../prisma/client';
import ApiError from '../../../utils/apiError';
import { CLINIC_SELECT, IClinicFilterRequest } from './constant';
import {
  IClinicResponse,
  IClinicStats,
  ICreateClinicRequest,
  IUpdateClinicRequest,
} from './interface';

const createClinic = async (clinicData: ICreateClinicRequest): Promise<IClinicResponse | null> => {
  const defaultPassword = 'Password@123';
  const hashedPassword = await bcrypt.hash(clinicData.user?.password || defaultPassword, 10);

  const clinic = await prisma.clinic.create({
    data: {
      user: {
        create: {
          name: clinicData.user?.name,
          email: clinicData.user?.email,
          password: hashedPassword,
          role: UserRole.CLINIC,

          image: clinicData.user?.image,
        },
      },
      phoneNumber: clinicData.phoneNumber,
      active: clinicData?.active,
      description: clinicData?.description,
      openingHour: clinicData?.openingHour,
      address: clinicData?.address,
      establishedYear: clinicData?.establishedYear,

      district: clinicData.district,
      city: clinicData.city,
      country: clinicData.country ?? 'Bangladesh',
    },
    select: CLINIC_SELECT,
  });
  if (!clinic) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create doctor');
  }
  return clinic;
};

const getClinics = async (
  filter: IClinicFilterRequest,
  options: IOptions,
): Promise<IGenericResponse<IClinicResponse[]>> => {
  const { page, limit, skip, sortBy, sortOrder } = paginationCalculator(options);
  const { searchTerm, active, minRating, ...filterData } = filter;

  const andConditions: Prisma.ClinicWhereInput[] = [];

  if (searchTerm) {
    andConditions.push({
      OR: [
        { user: { name: { contains: searchTerm, mode: 'insensitive' } } },
        { city: { contains: searchTerm, mode: 'insensitive' } },
        { district: { contains: searchTerm, mode: 'insensitive' } },
      ],
    });
  }

  if (active !== undefined && active !== null && active !== '') {
    const isActive = active === 'true';
    andConditions.push({
      active: isActive,
    });
  }

  if (minRating) {
    const ratingNum = parseFloat(minRating);
    if (!isNaN(ratingNum)) {
      andConditions.push({ averageRating: { gte: ratingNum } });
    }
  }

  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      AND: Object.entries(filterData).map(([key, value]) => ({
        [key]: { equals: value, mode: 'insensitive' },
      })),
    });
  }

  const whereCondition: Prisma.ClinicWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const [data, total] = await Promise.all([
    prisma.clinic.findMany({
      where: whereCondition,
      skip,
      take: limit,
      orderBy: sortBy && sortOrder ? { [sortBy]: sortOrder } : { createdAt: 'desc' },
      select: CLINIC_SELECT,
    }),
    prisma.clinic.count({ where: whereCondition }),
  ]);

  return {
    meta: { page, limit, total },
    data,
  };
};
const getClinicStats = async (): Promise<IClinicStats> => {
  const [activeCount, inactiveCount] = await Promise.all([
    // Count based on the 'active' boolean in Doctor model
    prisma.clinic.count({
      where: { active: true },
    }),

    // Count based on 'active' boolean being false
    prisma.clinic.count({
      where: { active: false },
    }),
  ]);

  return {
    total: activeCount + inactiveCount,
    active: activeCount,
    inactive: inactiveCount,
  };
};
export const getClinicById = async (userId: string): Promise<IClinicResponse> => {
  if (!userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'userid is required');
  }
  // Fetch Clinic info
  const clinic = await prisma.clinic.findUnique({
    where: { userId },
    select: CLINIC_SELECT,
  });

  if (!clinic) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Clinic not found');
  }

  return clinic;
};

const updateClinic = async (
  userId: string,
  clinicData: IUpdateClinicRequest,
): Promise<IClinicResponse> => {
  // Prepare user update data

  const userData: any = {};
  if (clinicData.user) {
    if (clinicData.user.password) {
      userData.password = await bcrypt.hash(clinicData.user.password, 10);
    }
    if (clinicData.user.name) userData.name = clinicData.user.name;
    if (clinicData.user.deactivate) userData.deactivate = clinicData.user.deactivate;
    if (clinicData.user.email) userData.email = clinicData.user.email;
    if (clinicData.user.emailVerified !== undefined)
      userData.emailVerified = clinicData.user.emailVerified;
    if (clinicData.user.image) userData.image = clinicData.user.image;
  }

  // Check if the user exists
  const existingUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!existingUser) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found!');
  }

  const clinic = await prisma.clinic.upsert({
    where: { userId },
    create: {
      userId,
      address: clinicData.address ?? '',
      district: clinicData.district ?? '',
      city: clinicData.city ?? '',
      country: clinicData.country ?? 'Bangladesh',
      phoneNumber: clinicData.phoneNumber ?? '',
      establishedYear: clinicData.establishedYear,
      description: clinicData.description,
      active: clinicData?.active,
      openingHour: clinicData.openingHour,
      website: clinicData.website,
    },
    update: {
      address: clinicData.address,
      district: clinicData.district,
      city: clinicData.city,
      active: clinicData?.active,
      country: clinicData.country,
      website: clinicData.website,
      phoneNumber: clinicData.phoneNumber,
      description: clinicData.description,
      openingHour: clinicData.openingHour,
      establishedYear: clinicData.establishedYear,

      user: {
        update: {
          deactivate: clinicData.user?.deactivate,
          name: clinicData.user?.name,
          image: clinicData.user?.image,
        },
      },
    },
    select: CLINIC_SELECT,
  });
  if (Object.keys(userData).length > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: userData,
    });
  }

  return clinic;
};

const deleteClinic = async (userId: string): Promise<IClinicResponse> => {
  // 1️⃣ Check if Clinic exists
  const existingClinic = await prisma.clinic.findUnique({
    where: { userId },
    select: { id: true, userId: true },
  });

  if (!existingClinic) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Clinic not found');
  }

  // 2️⃣ Soft delete: update user.active to false
  const clinic = await prisma.clinic.update({
    where: { userId },
    data: {
      active: false,
    },
    select: CLINIC_SELECT,
  });

  return clinic;
};

export const ClinicService = {
  createClinic,
  getClinics,
  getClinicStats,
  getClinicById,
  updateClinic,
  deleteClinic,
};
