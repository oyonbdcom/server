// controllers/FavoriteDoctorController.ts
import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import { paginationFields } from '../../../constants/pagination';
import pick from '../../../helper/pick';
import { catchAsync } from '../../../shared/catchAsync';
import { sendResponse } from '../../../shared/sendResponse';
import ApiError from '../../../utils/apiError';
import { FavoriteDoctorService } from './service';

// Add favorite doctor
export const addFavoriteDoctor = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { doctorId, patientId } = req.body;
  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
  }
  const favorite = await FavoriteDoctorService.addFavoriteDoctor(userId, doctorId, patientId);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Doctor added to favorites',
    data: favorite,
  });
});

// Get user favorites
export const getUserFavorites = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    const paginationOptions = pick(req.query, paginationFields);
    if (!userId) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
    }
    const result = await FavoriteDoctorService.getUserFavorites(userId, paginationOptions);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Favorite doctors fetched successfully',
      meta: result.meta,
      data: result.data,
    });
  },
);

// Remove favorite doctor
export const removeFavoriteDoctor = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    const { doctorId } = req.params as { doctorId: string };

    if (!userId) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
    }
    await FavoriteDoctorService.removeFavoriteDoctor(userId, doctorId);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Doctor removed from favorites',
      data: null,
    });
  },
);

export const FavoriteDoctorController = {
  addFavoriteDoctor,
  getUserFavorites,
  removeFavoriteDoctor,
};
