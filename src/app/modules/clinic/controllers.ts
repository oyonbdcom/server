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
  const userId = (req as any).user.id;
  const result = await ClinicService.createClinic(req.body, userId);
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

const getClinicsForManager = catchAsync(async (req, res) => {
  const paginationOptions = pick(req.query, paginationFields);
  const filter = pick(req.query, ClinicFilterableFields);

  const userId = (req as any).user.id;

  const result = await ClinicService.getClinicsForManager(filter, paginationOptions, userId);

  sendResponse<IClinicResponse[]>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'আপনার এরিয়ার ক্লিনিকগুলো সফলভাবে আনা হয়েছে',
    meta: result?.meta || null,
    data: result?.data || null,
  });
});

const getAllClinicsForManager = catchAsync(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
  }
  const result = await ClinicService.getAllClinicsForManager(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'ক্লিনিক লিস্ট সফলভাবে পাওয়া গেছে',
    data: result,
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

// const getClinicById = catchAsync(async (req, res) => {
//   const slug = req.params.slug as string;

//   const result = await ClinicService.getClinicById(slug);

//   sendResponse<IClinicResponse>(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: 'Clinics retrieved successfully',

//     data: result,
//   });
// });

// update
const updateClinic = catchAsync(async (req, res) => {
  const clinicId = req.params.clinicId as string;

  const result = await ClinicService.updateClinic(clinicId, req.body);
  sendResponse<IClinicResponse>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Doctor updated successfully',
    data: result,
  });
});

const deleteClinic = catchAsync(async (req, res) => {
  const clinicId = req.params.clinicId as string;
  const user = req.user;
  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'UNAUTHORIZED');
  }
  const deletedDoctor = await ClinicService.deleteClinic(clinicId, user);

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
  getAllClinicsForManager,
  getClinicsForManager,
  updateClinic,
};
