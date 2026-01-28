import httpStatus from 'http-status';
import { IUserResponse } from './../user/interface';

import { Prisma, UserRole } from '@prisma/client';
import { IOptions, paginationCalculator } from '../../../helper/pagination';

import { IGenericResponse } from '../../../interface/common';
import prisma from '../../../prisma/client';
import ApiError from '../../../utils/apiError';
// current logged in   user
const getCurrentUser = async (userId: string): Promise<IUserResponse> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      phoneNumber: true,
      isPhoneVerified: true,
      image: true,
      role: true,
      deactivate: true,
      lastLoginAt: true,
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  return user;
};

const getUsers = async (
  filter: { searchTerm?: string; role?: string; emailVerified?: string; isActive?: string },
  options: IOptions,
): Promise<IGenericResponse<IUserResponse[]>> => {
  const { page, limit, skip, sortBy, sortOrder } = paginationCalculator(options);
  const { searchTerm, ...filterData } = filter;

  const andConditions: Prisma.UserWhereInput[] = [];

  if (searchTerm) {
    andConditions.push({
      OR: [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { phoneNumber: { contains: searchTerm, mode: 'insensitive' } },
      ],
    });
  }

  Object.entries(filterData).forEach(([key, value]) => {
    if (!value) return;

    if (key === 'emailVerified' || key === 'active') {
      const parsedBool = value === 'true';

      if (key === 'emailVerified') {
        andConditions.push({ isPhoneVerified: parsedBool });
        return;
      }

      if (key === 'active') {
        if (parsedBool) {
          andConditions.push({ deactivate: parsedBool });
        }
      }
    }

    if (key === 'role') {
      andConditions.push({ role: value as UserRole });
      return;
    }
  });

  const whereCondition: Prisma.UserWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.user.findMany({
    where: whereCondition,
    skip,
    take: limit,
    orderBy: { [sortBy]: sortOrder },
    select: {
      id: true,
      name: true,
      phoneNumber: true,
      isPhoneVerified: true,
      image: true,
      role: true,
      deactivate: true,
      lastLoginAt: true,
    },
  });

  const total = await prisma.user.count({ where: whereCondition });

  return {
    meta: { page, limit, total },
    data: result,
  };
};

const getUserById = async (id: string): Promise<IUserResponse> => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      phoneNumber: true,
      isPhoneVerified: true,
      image: true,
      role: true,
      deactivate: true,

      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  return user;
};
const updateUserRole = async (id: string, role: UserRole): Promise<IUserResponse> => {
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: { role },
    select: {
      id: true,
      name: true,
      phoneNumber: true,
      isPhoneVerified: true,
      image: true,
      role: true,
      deactivate: true,
      lastLoginAt: true,
    },
  });

  return updatedUser;
};

const deleteUser = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Delete user
  await prisma.user.delete({
    where: { id },
  });

  return { message: 'User deleted successfully' };
};

export const UserService = {
  getUsers,
  getUserById,
  updateUserRole,

  getCurrentUser,
  deleteUser,
};
