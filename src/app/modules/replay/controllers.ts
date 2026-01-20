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
  const result = await ReviewsService.createReview(req.body);

  sendResponse<IReviewResponse>(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: ' review created successfully',
    data: result,
  });
});

// ======================================================
// GET ALL REVIEWS (By )
// ======================================================
const getAllReviews = catchAsync(async (req, res) => {
  const paginationOptions = pick(req.query, paginationFields);
  const filter = pick(req.query, ReviewFilterableFields);

  const result = await ReviewsService.getAllReviews(filter, paginationOptions);

  sendResponse<IReviewResponse[]>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: ' reviews retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});
const getSingleTargetReviews = catchAsync(async (req, res) => {
  // 1. Extract the ID from params
  const { targetId } = req.params as { targetId: string };

  // 2. Extract the Type from query (e.g., /reviews/123?targetType=DOCTOR)
  // Or you can extract it from another param if your route is /reviews/:targetType/:targetId
  const targetType = req.query.targetType as 'DOCTOR' | 'CLINIC';

  // 3. Extract pagination options
  const paginationOptions = pick(req.query, paginationFields);

  // 4. Pass all required arguments to the service
  const result = await ReviewsService.getSingleTargetReviews(
    targetId,
    targetType,
    paginationOptions,
  );

  sendResponse<IReviewResponse[]>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `${targetType.toLowerCase()} reviews retrieved successfully`,
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
  createReviews,
  getAllReviews,
  getSingleTargetReviews,
  updateReview,
  deleteReview,
};
