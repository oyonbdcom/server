import httpStatus from 'http-status';
import { paginationFields } from '../../../constants/pagination';
import pick from '../../../helper/pick';
import { catchAsync } from '../../../shared/catchAsync';
import { sendResponse } from '../../../shared/sendResponse';
import ApiError from '../../../utils/apiError';
import { IPatientResponse, IPatientStats, PatientFilterableFields } from './interface';
import { PatientService } from './service';

const getPatients = catchAsync(async (req, res) => {
  const paginationOptions = pick(req.query, paginationFields);

  const filter = pick(req.query, PatientFilterableFields);

  const result = await PatientService.getPatients(filter, paginationOptions);

  sendResponse<IPatientResponse[]>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Patients retrieved successfully',
    meta: result?.meta || null,
    data: result?.data || null,
  });
});
const getPatientStats = catchAsync(async (req, res) => {
  const result = await PatientService.getPatientStats();

  sendResponse<IPatientStats>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Patient statics retrieved successfully',
    data: result,
  });
});
const getPatientById = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };

  const result = await PatientService.getPatientById(id);

  sendResponse<IPatientResponse>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Patient retrieved successfully',
    data: result,
  });
});

const updatePatient = catchAsync(async (req, res) => {
  const requesterId = req?.user?.id; // Logged-in person
  const requesterRole = req?.user?.role; // Get role from auth middleware
  const { targetId } = req.params as { targetId: string };

  if (!requesterId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'You are not authorized');
  }

  // Determine which ID to use for the update
  // If ADMIN, use the ID from params. If PATIENT, use their own session ID.
  const idToUpdate = requesterRole === 'ADMIN' && targetId ? targetId : requesterId;

  // result now takes the ID we decided on
  const result = await PatientService.updatePatient(idToUpdate, req.body);

  sendResponse<IPatientResponse>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Patient updated successfully',
    data: result,
  });
});

const deletePatient = catchAsync(async (req, res) => {
  const { userId } = req.params as { userId: string };

  if (!userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'userid is required');
  }
  const deletedPatient = await PatientService.deletePatient(userId);

  sendResponse<IPatientResponse>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Patient deleted successfully',
    data: deletedPatient,
  });
});

export const PatientController = {
  getPatients,
  getPatientStats,
  deletePatient,
  getPatientById,
  updatePatient,
};
