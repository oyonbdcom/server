import { Request, Response } from 'express';

import httpStatus from 'http-status';

import { catchAsync } from '../../../shared/catchAsync';
import { sendResponse } from '../../../shared/sendResponse';
import ApiError from '../../../utils/apiError';
import { MedicalHistoryService } from './service';

// Add medical history
const addMedicalHistory = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const data = req.body;
  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
  }

  const history = await MedicalHistoryService.addMedicalHistory(data);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Medical history added successfully',
    data: history,
  });
});

// Update medical history
// const updateMedicalHistory = catchAsync(async (req: Request, res: Response) => {
//   const user = req.user;
//   const { historyId } = req.params;
//   const data = req.body;
//   if (!user) {
//     throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
//   }
//   const updated = await MedicalHistoryService.updateMedicalHistory(historyId, data, user);

//   sendResponse(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: 'Medical history updated successfully',
//     data: updated,
//   });
// });

// Delete medical history
// const removeMedicalHistory = catchAsync(async (req: Request, res: Response) => {
//   const user = req.user;
//   const { historyId } = req.params;

//   if (!user) {
//     throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
//   }
//   await MedicalHistoryService.removeMedicalHistory(historyId, user);

//   sendResponse(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: 'Medical history deleted successfully',
//     data: null,
//   });
// });

// Export in the requested format
export const MedicalHistoryController = {
  addMedicalHistory,

  // updateMedicalHistory,
  // removeMedicalHistory,
};
