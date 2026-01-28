import httpStatus from 'http-status';

import { paginationFields } from '../../../constants/pagination';
import pick from '../../../helper/pick';
import { catchAsync } from '../../../shared/catchAsync';
import { sendResponse } from '../../../shared/sendResponse';
import ApiError from '../../../utils/apiError';
import { ClinicFilterableFields } from './constant';
import { IClinicResponse, IClinicStats } from './interface';
import { ClinicService } from './service';
const createClinic = catchAsync(async (req, res) => {
  const result = await ClinicService.createClinic(req.body);
  sendResponse<IClinicResponse>(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Clinic created successfully',

    data: result || null,
  });
});

const getClinics = catchAsync(async (req, res) => {
  const paginationOptions = pick(req.query, paginationFields);

  const filter = pick(req.query, ClinicFilterableFields);

  const result = await ClinicService.getClinics(filter, paginationOptions);

  sendResponse<IClinicResponse[]>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Clinics retrieved successfully',
    meta: result?.meta || null,
    data: result?.data || null,
  });
});
const getClinicStats = catchAsync(async (req, res) => {
  const result = await ClinicService.getClinicStats();

  sendResponse<IClinicStats>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Clinic statics retrieved successfully',
    data: result,
  });
});

const getClinicById = catchAsync(async (req, res) => {
  const slug = req.params.slug as string;
  const result = await ClinicService.getClinicById(slug);

  sendResponse<IClinicResponse>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Clinics retrieved successfully',

    data: result,
  });
});

// update
const updateClinic = catchAsync(async (req, res) => {
  const targetUserId = req.params.userId as string;
  const loggedInUserId = req.user?.id;
  const loggedInUserRole = req.user?.role;

  if (!targetUserId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User ID is required');
  }

  if (loggedInUserRole === 'CLINIC' && targetUserId !== loggedInUserId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Clinic can only update their own profile');
  }

  const result = await ClinicService.updateClinic(targetUserId, req.body);
  sendResponse<IClinicResponse>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Doctor updated successfully',
    data: result,
  });
});

const deleteClinic = catchAsync(async (req, res) => {
  const clinicId = req.params.clinicId as string;

  const deletedDoctor = await ClinicService.deleteClinic(clinicId);

  sendResponse<IClinicResponse>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Doctor deleted successfully',
    data: deletedDoctor,
  });
});

export const ClinicController = {
  createClinic,
  getClinics,
  getClinicStats,
  deleteClinic,
  getClinicById,
  updateClinic,
};
