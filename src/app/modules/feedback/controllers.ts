import httpStatus from 'http-status';

import { catchAsync } from '../../../shared/catchAsync';
import { sendResponse } from '../../../shared/sendResponse';
import ApiError from '../../../utils/apiError';
import { IFeedbackResponse } from './interface';
import { FeedbackService } from './service';

const createFeedback = catchAsync(async (req, res) => {
  const user = req.user;

  // 🔐 Auth check
  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
  }

  // 🔥 Service call
  const result = await FeedbackService.createFeedback(user.id, req.body);

  // ✅ Response
  sendResponse<IFeedbackResponse>(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Feedback submitted successfully',
    data: result,
  });
});

const getFeedbacks = catchAsync(async (req, res) => {
  const result = await FeedbackService.getFeedbacks();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Feedback fetched successfully',
    data: result,
  });
});

export const FeedbackController = {
  createFeedback,
  getFeedbacks,
};
