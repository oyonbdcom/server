import httpStatus from 'http-status';

import { paginationFields } from '../../../constants/pagination';
import pick from '../../../helper/pick';
import { catchAsync } from '../../../shared/catchAsync';
import { sendResponse } from '../../../shared/sendResponse';
import ApiError from '../../../utils/apiError';
import { DiagnosticFilterableFields } from './constant';
import { IDiagnosticManagerStats, IDiagnosticResponse } from './interface';
import { DiagnosticService } from './service';

const createDiagnostic = catchAsync(async (req, res) => {
  const userId = (req as any).user.id;
  const result = await DiagnosticService.createDiagnostic(req.body, userId);
  sendResponse<IDiagnosticResponse>(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Clinic created successfully',

    data: result || null,
  });
});

const getDiagnostics = catchAsync(async (req, res) => {
  const paginationOptions = pick(req.query, paginationFields);

  const filter = pick(req.query, DiagnosticFilterableFields);

  const result = await DiagnosticService.getDiagnostics(filter, paginationOptions);

  sendResponse<IDiagnosticResponse[]>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Clinics retrieved successfully',
    meta: result?.meta || undefined,
    data: result?.data || null,
  });
});

const getAllAreaDiagnostics = catchAsync(async (req, res) => {
  const paginationOptions = pick(req.query, paginationFields);
  const filter = pick(req.query, DiagnosticFilterableFields);

  const userId = (req as any).user.id;

  const result = await DiagnosticService.getAllAreaDiagnostics(filter, paginationOptions, userId);

  sendResponse<IDiagnosticResponse[]>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'আপনার এরিয়ার ক্লিনিকগুলো সফলভাবে আনা হয়েছে',
    meta: result?.meta || undefined,
    data: result?.data || null,
  });
});

const getDiagnosticManagerStats = catchAsync(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
  }
  const result = await DiagnosticService.getDiagnosticManagerStats(userId);

  sendResponse<IDiagnosticManagerStats>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Clinic statics retrieved successfully',
    data: result,
  });
});

const getSingleDiagnostic = catchAsync(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
  }
  const result = await DiagnosticService.getSingleDiagnostic(userId);

  sendResponse<IDiagnosticResponse>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Diagnostic retrieved successfully',

    data: result,
  });
});

// update
const updateDiagnostic = catchAsync(async (req, res) => {
  const clinicId = req.params.clinicId as string;

  const result = await DiagnosticService.updateDiagnostic(clinicId, req.body);
  sendResponse<IDiagnosticResponse>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Doctor updated successfully',
    data: result,
  });
});

const deleteDiagnostic = catchAsync(async (req, res) => {
  const clinicId = req.params.clinicId as string;
  const user = req.user;
  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'UNAUTHORIZED');
  }
  const deletedDoctor = await DiagnosticService.deleteDiagnostic(clinicId, user);

  sendResponse<IDiagnosticResponse>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Doctor deleted successfully',
    data: deletedDoctor,
  });
});

export const DiagnosticController = {
  createDiagnostic,
  getDiagnostics,

  getDiagnosticManagerStats,
  deleteDiagnostic,
  getSingleDiagnostic,

  getAllAreaDiagnostics,
  updateDiagnostic,
};
