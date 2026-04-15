import httpStatus from 'http-status';

import { Prisma, UserRole } from '@prisma/client';
import { IOptions, paginationCalculator } from '../../../helper/pagination';

import { IGenericResponse } from '../../../interface/common';
import prisma from '../../../prisma/client';
import ApiError from '../../../utils/apiError';
import { IUserResponse } from './interface';

// current logged in   user
const getCurrentUser = async (userId: string): Promise<IUserResponse> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      phoneNumber: true,
      image: true,
      role: true,
      isDefaultPassword: true,
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  return user;
};

// for admin
const getUsers = async (
  filter: { searchTerm?: string; role?: string; isActive?: string },
  options: IOptions,
): Promise<IGenericResponse<IUserResponse[]>> => {
  const { page, limit, skip, sortBy, sortOrder } = paginationCalculator(options);
  const { searchTerm, ...filterData } = filter;

  const andConditions: Prisma.UserWhereInput[] = [];

  // --- Search Logic ---
  if (searchTerm) {
    andConditions.push({
      OR: [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { phoneNumber: { contains: searchTerm, mode: 'insensitive' } },
      ],
    });
  }

  // --- Filter Logic ---
  Object.entries(filterData).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;

    if (key === 'isActive') {
      const isDeactivated = value === 'false'; // যদি isActive false হয়, তারমানে deactivate true
      andConditions.push({ deactivate: isDeactivated });
    }

    if (key === 'role') {
      andConditions.push({ role: value as UserRole });
    }
  });

  const whereCondition: Prisma.UserWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  // --- Execute Query ---
  const result = await prisma.user.findMany({
    where: whereCondition,
    skip,
    take: limit,
    orderBy: { [sortBy]: sortOrder },
    select: {
      id: true,
      name: true,
      phoneNumber: true,
      image: true,
      role: true,
      deactivate: true,
      manager: {
        select: {
          area: {
            select: {
              id: true,
              name: true,
              district: {
                select: { name: true },
              },
            },
          },
        },
      },
    },
  });

  const total = await prisma.user.count({ where: whereCondition });
  const totalPage = Math.ceil(total / limit);
  return {
    meta: { page, limit, total, totalPage },
    data: result as unknown as IUserResponse[],
  };
};

// for admin
const getAllManagers = async (
  filter: { searchTerm?: string; areaId?: string },
  options: IOptions,
) => {
  const { page, limit, skip, sortBy, sortOrder } = paginationCalculator(options);
  const { searchTerm, areaId } = filter;

  const andConditions: Prisma.ManagerWhereInput[] = [];

  // --- Search Logic (User টেবিলের ডাটার ওপর ভিত্তি করে) ---
  if (searchTerm) {
    andConditions.push({
      user: {
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { phoneNumber: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
    });
  }

  // --- Filter Logic (Area-ভিত্তিক ফিল্টার যদি প্রয়োজন হয়) ---
  if (areaId) {
    andConditions.push({
      areaId: areaId,
    });
  }

  const whereCondition: Prisma.ManagerWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  // --- Execute Query ---
  const result = await prisma.manager.findMany({
    where: whereCondition,
    skip,
    take: limit,
    orderBy:
      sortBy === 'name'
        ? { user: { name: sortOrder } } // যদি ইউজার নেম দিয়ে সর্ট করতে চান
        : { createdAt: sortOrder },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          image: true,
          deactivate: true,
        },
      },
      area: {
        include: {
          district: true,
          _count: {
            select: {
              clinics: true,
              doctors: true,
            },
          },
        },
      },
    },
  });

  const total = await prisma.manager.count({ where: whereCondition });
  const totalPage = Math.ceil(total / limit);
  return {
    meta: { page, limit, total, totalPage },
    data: result,
  };
};

// for admin
const getUserById = async (id: string): Promise<IUserResponse> => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      phoneNumber: true,

      image: true,
      role: true,
      deactivate: true,

      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  return user;
};

// for admin
const updateUserRole = async (
  id: string,
  payload: {
    role?: UserRole;
    assignedAreaId?: string | null;
    deactivate?: boolean;
  },
): Promise<IUserResponse> => {
  return await prisma.$transaction(async (tx) => {
    // ১. ইউজার বিদ্যমান আছে কি না যাচাই
    const isUserExist = await tx.user.findUnique({
      where: { id },
    });

    if (!isUserExist) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }
    if (isUserExist.role === 'ADMIN') {
      if (id === isUserExist?.id && payload.deactivate === true) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'আপনি নিজেকে ডিঅ্যাক্টিভেট করতে পারবেন না');
      }
    }

    const updateData: any = {};
    if (payload.role) updateData.role = payload.role;
    if (payload.deactivate !== undefined) updateData.deactivate = payload.deactivate;

    await tx.user.update({
      where: { id },
      data: updateData,
    });

    // ৪. ম্যানেজার লজিক হ্যান্ডেল করা (মডেল রিলেশন বজায় রাখা)
    // যদি রোল ম্যানেজার থাকে অথবা নতুন করে ম্যানেজার করা হয়
    const currentRole = payload.role || isUserExist.role;

    if (currentRole === 'MANAGER' && payload.assignedAreaId) {
      await tx.manager.upsert({
        where: { userId: id },
        update: { areaId: payload.assignedAreaId },
        create: {
          userId: id,
          areaId: payload.assignedAreaId,
        },
      });
    } else if (payload.role && payload.role !== 'MANAGER') {
      // যদি রোল পরিবর্তন করে অন্য কিছু দেওয়া হয়, তবে ম্যানেজার ডাটা রিমুভ করা
      const managerExist = await tx.manager.findUnique({ where: { userId: id } });
      if (managerExist) {
        await tx.manager.delete({ where: { userId: id } });
      }
    }

    // ৫. ফাইনাল ডাটা রিটার্ন (ম্যানেজার এবং এরিয়া ইনফরমেশন সহ)
    const result = await tx.user.findUnique({
      where: { id },
      include: {
        manager: {
          include: {
            area: {
              include: {
                district: true,
              },
            },
          },
        },
      },
    });

    return result as unknown as IUserResponse;
  });
};

// for admin
const deleteUser = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Delete user
  await prisma.user.update({
    where: { id: user.id },
    data: {
      deactivate: true,
    },
  });

  return { message: 'User deleted successfully' };
};

export const UserService = {
  getUsers,
  getUserById,
  updateUserRole,
  getAllManagers,
  getCurrentUser,
  deleteUser,
};
