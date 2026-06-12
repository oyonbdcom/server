import httpStatus from 'http-status';

import { paginationFields } from '../../../constants/pagination';
import pick from '../../../helper/pick';
import { catchAsync } from '../../../shared/catchAsync';
import { sendResponse } from '../../../shared/sendResponse';
import ApiError from '../../../utils/apiError';
import { DoctorFilterableFields } from './constant';
import { IDoctorAppointmentStats, IDoctorResponse } from './interface';
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

// add to area
const addDoctorToArea = catchAsync(async (req, res) => {
  const userId = req.user?.id;
  const { doctorId } = req.body;
  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'You are not authorized');
  }

  const result = await DoctorService.addDoctorToArea(doctorId, userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Doctor added to your area successfully!',
    data: result,
  });
});

// remove from area
const removeDoctorFromArea = catchAsync(async (req, res) => {
  const { doctorId } = req.body;
  const user = req.user;
  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'You are not authorized');
  }
  const result = await DoctorService.removeDoctorFromArea(doctorId, user?.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'ডাক্তারকে আপনার এরিয়া থেকে সফলভাবে রিমুভ করা হয়েছে!',
    data: result,
  });
});

const getAllDoctors = catchAsync(async (req, res) => {
  const paginationOptions = pick(req.query, paginationFields);

  const filter = pick(req.query, DoctorFilterableFields);
  const userId = req.user?.id;
  const result = await DoctorService.getAllDoctors(filter, paginationOptions, userId);

  sendResponse<IDoctorResponse[]>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Doctors retrieved successfully',
    meta: result?.meta || undefined,
    data: result?.data || null,
  });
});

const getAreaManagerDoctorsName = catchAsync(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
  }
  const result = await DoctorService.getAreaManagerDoctorsName(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'ডাক্তার লিস্ট সফলভাবে পাওয়া গেছে',
    data: result,
  });
});
const getDoctorDirectory = catchAsync(async (req, res) => {
  const paginationOptions = pick(req.query, paginationFields);

  const filter = pick(req.query, DoctorFilterableFields);
  const userId = req.user?.id;
  const result = await DoctorService.getDoctorDirectory(filter, paginationOptions, userId);

  sendResponse<IDoctorResponse[]>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Doctors retrieved successfully',
    meta: result?.meta || undefined,
    data: result?.data || null,
  });
});
const getDiagnosticDoctorsName = catchAsync(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
  }
  const result = await DoctorService.getDiagnosticDoctorsName(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'ডাক্তার লিস্ট সফলভাবে পাওয়া গেছে',
    data: result,
  });
});
const getAreaAndDiagnosticDoctors = catchAsync(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
  }
  const result = await DoctorService.getAreaAndDiagnosticDoctors(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'ডাক্তার লিস্ট সফলভাবে পাওয়া গেছে',
    data: result,
  });
});
// for doctor dashboard
const getDoctorById = catchAsync(async (req, res) => {
  const { id } = req.user as { id: string };

  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'userid is required');
  }
  const result = await DoctorService.getDoctorById(id);

  sendResponse<any>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Doctors retrieved successfully',
    data: result,
  });
});
const getDoctorBySlug = catchAsync(async (req, res) => {
  const { slug } = req.params as { slug: string };

  if (!slug) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'userid is required');
  }
  const result = await DoctorService.getDoctorById(slug);

  sendResponse<any>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Doctors retrieved successfully',
    data: result,
  });
});

// foc doctor dashboard

const getDoctorAppointmentStats = catchAsync(async (req, res) => {
  const doctorId = req?.user?.id as string;
  const diagId = req.query.diagId as string;

  const result = await DoctorService.getDoctorAppointmentStats(doctorId, diagId);

  sendResponse<IDoctorAppointmentStats>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Doctor appointment statistics retrieved successfully',
    data: result,
  });
});

const updateDoctor = catchAsync(async (req, res) => {
  const { doctorId } = req.params as { doctorId: string };

  const result = await DoctorService.updateDoctor(doctorId, req.body);
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
  getAllDoctors,
  getAreaManagerDoctorsName,
  getDoctorDirectory,
  getDiagnosticDoctorsName,
  getAreaAndDiagnosticDoctors,
  getDoctorAppointmentStats,
  getDoctorById,
  getDoctorBySlug,
  updateDoctor,
  deleteDoctor,
  addDoctorToArea,
  removeDoctorFromArea,
};
