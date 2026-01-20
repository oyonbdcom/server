import { Prisma, UserRole } from '@prisma/client';
import httpStatus from 'http-status';

import bcrypt from 'bcrypt';
import { IOptions, paginationCalculator } from '../../../helper/pagination';
import { IGenericResponse } from '../../../interface/common';
import prisma from '../../../prisma/client';
import ApiError from '../../../utils/apiError';

import { DOCTOR_SELECT } from './constant';
import { IDoctorResponse, IDoctorStats } from './interface';
import { CreateDoctorInput, UpdateDoctorInput } from './zodValidation';

const createDoctor = async (doctorData: CreateDoctorInput): Promise<IDoctorResponse | null> => {
  const defaultPassword = 'Password@123';
  const hashedPassword = await bcrypt.hash(doctorData.user?.password || defaultPassword, 10);

  const doctor = await prisma.doctor.create({
    data: {
      user: {
        create: {
          name: doctorData.user?.name,
          email: doctorData.user?.email,
          password: hashedPassword,
          role: UserRole.DOCTOR,
          emailVerified: doctorData.user?.emailVerified ?? false,
          image: doctorData.user?.image,
        },
      },
      department: doctorData.department,
      specialization: doctorData.specialization,
      hospital: doctorData.hospital,
      position: doctorData.position,
      bio: doctorData.bio,
      gender: doctorData.gender,
      district: doctorData.district,
      city: doctorData.city,
      country: doctorData.country ?? 'Bangladesh',
      education: doctorData.education,
    },
    select: DOCTOR_SELECT,
  });
  if (!doctor) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create doctor');
  }
  return doctor as IDoctorResponse;
};

const getDoctors = async (
  filter: {
    searchTerm?: string;
    department?: string;
    specialization?: string;
    district?: string;
    city?: string;
    minRating?: string;
    active?: string;
    gender?: 'MALE' | 'FEMALE';
  },
  options: IOptions,
): Promise<IGenericResponse<IDoctorResponse[]>> => {
  const { page, limit, skip, sortBy, sortOrder } = paginationCalculator(options);
  const { searchTerm, active, minRating, gender, ...filterData } = filter;

  const andConditions: Prisma.DoctorWhereInput[] = [];

  // 1. 🔍 Global Search (OR Condition)
  if (searchTerm) {
    andConditions.push({
      OR: [
        { user: { name: { contains: searchTerm, mode: 'insensitive' } } },
        { department: { contains: searchTerm, mode: 'insensitive' } },
        { specialization: { contains: searchTerm, mode: 'insensitive' } },
        { district: { contains: searchTerm, mode: 'insensitive' } }, // Changed from equals to contains
        { city: { contains: searchTerm, mode: 'insensitive' } },
      ],
    });
  }

  // 2. 🟢 Active/Deactivate Status (Corrected Logic)
  if (active !== undefined && active !== null && active !== '') {
    const isActive = active === 'true';
    // If user wants active doctors, deactivate must be false
    andConditions.push({
      user: {
        deactivate: !isActive,
      },
    });
  }

  // 3. ⭐ Rating Filter
  if (minRating) {
    const ratingNum = parseFloat(minRating);
    if (!isNaN(ratingNum)) {
      andConditions.push({ averageRating: { gte: ratingNum } });
    }
  }

  // 4. 🚻 Gender Filter
  if (gender) {
    andConditions.push({ gender });
  }

  // 5. 📍 Specific Filters (Department, District, etc.)
  if (Object.keys(filterData).length > 0) {
    const specificFilters = Object.entries(filterData)
      .filter(([_, value]) => value !== undefined && value !== '')
      .map(([key, value]) => ({
        [key]: { equals: value, mode: 'insensitive' },
      }));

    if (specificFilters.length > 0) {
      andConditions.push({ AND: specificFilters });
    }
  }

  const whereCondition: Prisma.DoctorWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  // 6. 🚀 Database Query
  const [data, total] = await Promise.all([
    prisma.doctor.findMany({
      where: whereCondition,
      skip,
      take: limit,
      orderBy: sortBy && sortOrder ? { [sortBy]: sortOrder } : { createdAt: 'desc' },
      select: DOCTOR_SELECT,
    }),
    prisma.doctor.count({ where: whereCondition }),
  ]);

  const totalPage = Math.ceil(total / limit);

  return {
    meta: { page, limit, total, totalPage },
    data: data as IDoctorResponse[],
  };
};
const getDoctorStats = async (): Promise<IDoctorStats> => {
  const [activeCount, inactiveCount, departmentStats] = await Promise.all([
    // Count based on the 'active' boolean in Doctor model
    prisma.doctor.count({
      where: { active: true },
    }),

    // Count based on 'active' boolean being false
    prisma.doctor.count({
      where: { active: false },
    }),

    // Grouping by department
    prisma.doctor.groupBy({
      by: ['department'],
      _count: {
        id: true,
      },
      // Since department is String (required) in schema,
      // we just filter for non-empty strings if needed
      where: {
        department: { not: '' },
      },
    }),
  ]);

  return {
    total: activeCount + inactiveCount,
    active: activeCount,
    inactive: inactiveCount,
    departments: departmentStats.map((d) => ({
      name: d.department, // No 'as string' needed now as it's required in schema
      count: d._count.id,
    })),
  };
};

const getDoctorById = async (userId: string): Promise<IDoctorResponse> => {
  if (!userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'userid is required');
  }

  // Fetch doctor info
  const doctor = await prisma.doctor.findUnique({
    where: { userId },
    select: DOCTOR_SELECT,
  });

  if (!doctor) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Doctor not found');
  }
  return doctor as IDoctorResponse;
};

const updateDoctor = async (
  userId: string,
  doctorData: UpdateDoctorInput,
): Promise<IDoctorResponse | null> => {
  if (!userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User ID is required');
  }

  // 1. Verify existence
  const existingDoctor = await prisma.doctor.findUnique({
    where: { userId },
  });

  if (!existingDoctor) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Doctor profile not found!');
  }

  const { user, ...restDoctorData } = doctorData;

  const userUpdateData = doctorData.user
    ? {
        name: doctorData.user.name,
        email: doctorData.user.email,
        image: doctorData.user.image,
        password: doctorData.user.password
          ? await bcrypt.hash(doctorData.user.password, 12)
          : undefined,
      }
    : {};

  // Clean undefined values so they don't overwrite DB with nothing
  const finalUserUpdate = Object.fromEntries(
    Object.entries(userUpdateData).filter(([_, v]) => v !== undefined),
  );

  const updatedDoctor = await prisma.doctor.update({
    where: { userId },
    data: {
      ...restDoctorData,
      user: Object.keys(finalUserUpdate).length > 0 ? { update: finalUserUpdate } : undefined,
    },
    select: DOCTOR_SELECT,
  });

  return updatedDoctor as IDoctorResponse;
};

const deleteDoctor = async (userId: string): Promise<IDoctorResponse> => {
  // 1️⃣ Check if doctor exists
  const existingDoctor = await prisma.doctor.findUnique({
    where: { userId },
    select: { id: true, userId: true },
  });

  if (!existingDoctor) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Doctor not found');
  }

  // 2️⃣ Soft delete: update user.active to false
  const doctor = await prisma.doctor.update({
    where: { userId },
    data: {
      active: false,
    },
    select: DOCTOR_SELECT,
  });

  return doctor as IDoctorResponse;
};

export const DoctorService = {
  createDoctor,
  getDoctors,
  getDoctorStats,
  getDoctorById,
  updateDoctor,
  deleteDoctor,
};
