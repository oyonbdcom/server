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
    message: 'Diagnostic created successfully',

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
    message: 'Diagnostics retrieved successfully',
    meta: result?.meta || undefined,
    data: result?.data || null,
  });
});
const getDiagnosticByIdentifier = catchAsync(async (req, res) => {
  const identifier = req.params?.identifier as string;

  // 1. Call the specific service method for a single record
  const result = await DiagnosticService.getDiagnosticByIdentifier(identifier);

  if (!result) {
    return sendResponse(res, {
      statusCode: httpStatus.NOT_FOUND,
      success: false,
      message: 'Diagnostic not found or is currently inactive',
      data: null,
    });
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Diagnostic retrieved successfully',
    data: result,
  });
});

// area manager
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
const getAllAreaDiagnosticsName = catchAsync(async (req, res) => {
  const userId = (req as any).user.id;

  const result = await DiagnosticService.getAllAreaDiagnosticsName(userId);

  sendResponse<IDiagnosticResponse[]>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'আপনার এরিয়ার ক্লিনিকগুলো সফলভাবে আনা হয়েছে',

    data: result || null,
  });
});

const getDiagnosticManagerStats = catchAsync(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
  }

  const filter = pick(req.query, DiagnosticFilterableFields);

  const result = await DiagnosticService.getDiagnosticManagerStats(
    userId,
    filter.startDate,
    filter.endDate,
  );

  sendResponse<IDiagnosticManagerStats>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Diagnostic statics retrieved successfully',
    data: result,
  });
});

// update
const updateDiagnostic = catchAsync(async (req, res) => {
  const diagId = req.params.diagId as string;

  const result = await DiagnosticService.updateDiagnostic(diagId, req.body);
  sendResponse<IDiagnosticResponse>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Doctor updated successfully',
    data: result,
  });
});

const deleteDiagnostic = catchAsync(async (req, res) => {
  const diagId = req.params.diagId as string;
  const user = req.user;
  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'UNAUTHORIZED');
  }
  const deletedDoctor = await DiagnosticService.deleteDiagnostic(diagId, user);

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
  getAllAreaDiagnosticsName,
  getDiagnosticManagerStats,
  deleteDiagnostic,
  getDiagnosticByIdentifier,
  getAllAreaDiagnostics,
  updateDiagnostic,
};
