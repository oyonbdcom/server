import httpStatus from 'http-status';

import { catchAsync } from '../../../shared/catchAsync';
import { sendResponse } from '../../../shared/sendResponse';
import ApiError from '../../../utils/apiError';
import { StaffService } from './service';

const createStaff = catchAsync(async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
    }

    const result = await StaffService.createStaff(userId, req.body);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'স্টাফ তৈরি হয়েছে',
      data: result,
    });
  } catch (error) {
    console.error('CREATE STAFF ERROR:', error); // 🔥 THIS IS KEY
    throw error;
  }
});

export const StaffController = {
  createStaff,
};
