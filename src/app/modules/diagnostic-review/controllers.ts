import httpStatus from 'http-status';

import { paginationFields } from '../../../constants/pagination';
import pick from '../../../helper/pick';
import { catchAsync } from '../../../shared/catchAsync';
import { sendResponse } from '../../../shared/sendResponse';
import ApiError from '../../../utils/apiError';
import { IReviewResponse, ReviewFilterableFields } from './interface';
import { ReviewsService } from './service';

// ======================================================
// CREATE REVIEW
// ======================================================
const createReviews = catchAsync(async (req, res) => {
  const user = req.user;
  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'unauthorized');
  }
  const result = await ReviewsService.createReview(user?.id, req.body);
  sendResponse<IReviewResponse>(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: ' review created successfully',
    data: result,
  });
});

const replyToReview = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  const { content } = req.body;
  const user = (req as any).user;

  const result = await ReviewsService.replyToReview(id, user.id, content);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Reply posted successfully',
    data: result,
  });
});

const getDiagnosticReviews = catchAsync(async (req, res) => {
  // 1. Extract path parameters
  const { doctorId } = req.params as { doctorId: string };

  // 2. Extract query filters and pagination options
  const filters = pick(req.query, ReviewFilterableFields);
  const options = pick(req.query, paginationFields);

  // 3. Call the service
  const result = await ReviewsService.getDiagnosticReviews(doctorId, filters, options);

  // 4. Send standard response
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Reviews fetched successfully',
    meta: result.meta,
    data: result.data,
  });
});
const getDiagnosticProfileReviews = catchAsync(async (req, res) => {
  // 1. Extract path parameters
  const userId = req.user?.id as string;

  // 2. Extract query filters and pagination options
  const filters = pick(req.query, ReviewFilterableFields);
  const options = pick(req.query, paginationFields);

  // 3. Call the service
  const result = await ReviewsService.getDiagnosticProfileReviews(userId, filters, options);

  // 4. Send standard response
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Reviews fetched successfully',
    meta: result.meta,
    data: result.data,
  });
});

// ======================================================
// UPDATE REVIEW
// ======================================================
const updateReview = catchAsync(async (req, res) => {
  const { reviewId } = req.params as { reviewId: string };

  const user = req.user;
  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'unauthorized');
  }

  const updated = await ReviewsService.updateReview(reviewId, req.body, user);

  sendResponse<IReviewResponse>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Review updated successfully',
    data: updated,
  });
});
// ======================================================
// DELETE REVIEW
// ======================================================
const deleteReview = catchAsync(async (req, res) => {
  const { reviewId } = req.params as { reviewId: string };

  const result = await ReviewsService.deleteReview(reviewId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: ' review deleted successfully',
    data: result,
  });
});

export const ReviewsController = {
  replyToReview,
  createReviews,
  getDiagnosticProfileReviews,
  getDiagnosticReviews,
  updateReview,

  deleteReview,
};
