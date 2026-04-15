import httpStatus from 'http-status';

import { catchAsync } from '../../../shared/catchAsync';
import { sendResponse } from '../../../shared/sendResponse';

import ApiError from '../../../utils/apiError';
import { SummaryService } from './service';

const getManagerSummary = catchAsync(async (req, res) => {
  const user = req.user;
  if (!user?.id) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
  }
  const result = await SummaryService.getManagerSummary(user?.id);

  sendResponse<any>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Appointments retrieved successfully',

    data: result || null,
  });
});

export const AppointmentsController = {
  getManagerSummary,
};
