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
// ======================================================
// GET ALL REVIEWS (By )
// ======================================================
const getAllReviews = catchAsync(async (req, res) => {
  const paginationOptions = pick(req.query, paginationFields);
  const filter = pick(req.query, ReviewFilterableFields);
  const user = req?.user;
  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
  }
  const result = await ReviewsService.getAllReviews(user, filter, paginationOptions);

  sendResponse<IReviewResponse[]>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: ' reviews retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});
const getSingleTargetReviews = catchAsync(async (req, res) => {
  // 1. Extract path parameters
  const { targetId } = req.params as { targetId: string };

  const { targetType } = req.query; // Or req.params depending on your route design

  // 2. Extract query filters and pagination options
  const filters = pick(req.query, ReviewFilterableFields);
  const options = pick(req.query, paginationFields);

  // 3. Call the service
  const result = await ReviewsService.getSingleTargetReviews(
    targetId,
    targetType as 'DOCTOR' | 'CLINIC',
    filters,
    options,
  );

  // 4. Send standard response
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Reviews fetched successfully',
    meta: result.meta,
    data: result.data,
  });
});

const getReviewStats = catchAsync(async (req, res) => {
  const filter = pick(req.query, ReviewFilterableFields);
  const user = req?.user;
  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
  }
  const result = await ReviewsService.getReviewStats(user, filter);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Review statistics fetched successfully',
    data: null,
    stats: result,
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
  const user = req.user;
  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'unauthorized');
  }
  const result = await ReviewsService.deleteReview(reviewId, user);

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
  getAllReviews,
  getReviewStats,
  getSingleTargetReviews,
  updateReview,
  deleteReview,
};
