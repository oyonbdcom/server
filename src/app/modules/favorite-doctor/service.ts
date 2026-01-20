import httpStatus from 'http-status';
import { IOptions, paginationCalculator } from '../../../helper/pagination';
import prisma from '../../../prisma/client';
import ApiError from '../../../utils/apiError';

export const addFavoriteDoctor = async (userId: string, doctorId: string, patientId: string) => {
  // Check if already exists
  const existing = await prisma.favoriteDoctor.findUnique({
    where: { userId_doctorId: { userId, doctorId } },
  });

  if (existing) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Doctor already in favorites');
  }

  // Create favorite doctor
  return await prisma.favoriteDoctor.create({
    data: { userId, doctorId, patientId },
    include: {
      doctor: true,
      patient: true,
    },
  });
};

export const getUserFavorites = async (userId: string, options: IOptions) => {
  const { page, limit, skip } = paginationCalculator(options);

  const favorites = await prisma.favoriteDoctor.findMany({
    where: { userId },
    include: {
      doctor: {
        select: { id: true, specialization: true, user: { select: { name: true, image: true } } },
      },
    },
    skip,
    take: limit,
    orderBy: { createdAt: 'desc' },
  });

  const total = await prisma.favoriteDoctor.count({ where: { userId } });

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    data: favorites,
  };
};

export const removeFavoriteDoctor = async (userId: string, doctorId: string) => {
  const existing = await prisma.favoriteDoctor.findUnique({
    where: { userId_doctorId: { userId, doctorId } },
  });

  if (!existing) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Favorite doctor not found');
  }

  return await prisma.favoriteDoctor.delete({
    where: { userId_doctorId: { userId, doctorId } },
  });
};
export const FavoriteDoctorService = {
  addFavoriteDoctor,
  getUserFavorites,
  removeFavoriteDoctor,
};
