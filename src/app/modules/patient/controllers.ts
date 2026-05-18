import httpStatus from 'http-status';
import { catchAsync } from '../../../shared/catchAsync';
import { sendResponse } from '../../../shared/sendResponse';
import ApiError from '../../../utils/apiError';
import { IPatientResponse } from './interface';
import { PatientService } from './service';

const getPatientByUserId = catchAsync(async (req, res) => {
  const userId = req?.user?.id;
  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
  }

  const result = await PatientService.getPatientByUserId(userId);

  sendResponse<IPatientResponse>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Patient retrieved successfully',
    data: result,
  });
});

const updatePatient = catchAsync(async (req, res) => {
  const requesterId = req?.user?.id; // Logged-in person

  if (!requesterId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'You are not authorized');
  }

  // result now takes the ID we decided on
  const result = await PatientService.updatePatient(requesterId, req.body);

  sendResponse<IPatientResponse>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Patient updated successfully',
    data: result as any,
  });
});

export const PatientController = {
  getPatientByUserId,
  updatePatient,
};
