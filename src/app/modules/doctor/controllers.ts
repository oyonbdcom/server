import httpStatus from 'http-status';

import { paginationFields } from '../../../constants/pagination';
import pick from '../../../helper/pick';
import { catchAsync } from '../../../shared/catchAsync';
import { sendResponse } from '../../../shared/sendResponse';
import ApiError from '../../../utils/apiError';
import { DoctorFilterableFields } from './constant';
import { IDoctorResponse, IDoctorStats } from './interface';
import { DoctorService } from './service';

const createDoctor = catchAsync(async (req, res) => {
  const result = await DoctorService.createDoctor(req.body);
  sendResponse<IDoctorResponse>(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Doctors retrieved successfully',

    data: result || null,
  });
});

const getDoctors = catchAsync(async (req, res) => {
  const paginationOptions = pick(req.query, paginationFields);

  const filter = pick(req.query, DoctorFilterableFields);

  const result = await DoctorService.getDoctors(filter, paginationOptions);

  sendResponse<IDoctorResponse[]>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Doctors retrieved successfully',
    meta: result?.meta || null,
    data: result?.data || null,
  });
});

const getDoctorById = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };

  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'userid is required');
  }
  const result = await DoctorService.getDoctorById(id);

  sendResponse<IDoctorResponse>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Doctors retrieved successfully',
    data: result,
  });
});
const getDoctorStats = catchAsync(async (req, res) => {
  const result = await DoctorService.getDoctorStats();

  sendResponse<IDoctorStats>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Doctors statics retrieved successfully',
    data: result,
  });
});

const updateDoctor = catchAsync(async (req, res) => {
  const { userId } = req.params as { userId: string };
  const loggedInUserId = req.user?.id;
  const loggedInUserRole = req.user?.role;

  if (!userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User ID is required');
  }

  if (loggedInUserRole === 'DOCTOR' && userId !== loggedInUserId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Doctors can only update their own profile');
  }

  const result = await DoctorService.updateDoctor(userId, req.body);
  sendResponse<IDoctorResponse>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Doctor updated successfully',
    data: result,
  });
});

const deleteDoctor = catchAsync(async (req, res) => {
  const { userId } = req?.params as { userId: string };
  if (!userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'userid is required');
  }
  const deletedDoctor = await DoctorService.deleteDoctor(userId);

  sendResponse<IDoctorResponse>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Doctor deleted successfully',
    data: deletedDoctor,
  });
});

export const DoctorController = {
  createDoctor,
  getDoctors,
  getDoctorStats,
  deleteDoctor,
  getDoctorById,
  updateDoctor,
};
