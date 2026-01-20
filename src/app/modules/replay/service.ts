import { Prisma } from '@prisma/client';
import httpStatus from 'http-status';
import { JwtPayload } from 'jsonwebtoken';
import { IOptions, paginationCalculator } from '../../../helper/pagination';
import { IGenericResponse } from '../../../interface/common';
import prisma from '../../../prisma/client';
import ApiError from '../../../utils/apiError';
import { CreateReviewInput, IReviewResponse, UpdateReviewInput } from './interface';
import { recallRating } from './utils';

const createReview = async (payload: CreateReviewInput): Promise<IReviewResponse | undefined> => {
  const { targetId, targetType, reviewerId } = payload;

  const patient = await prisma.patient.findUnique({
    where: { userId: reviewerId },
  });

  if (!patient) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'Access Denied: Only registered patients are allowed to submit reviews.',
    );
  }

  // 2. ONE-TO-ONE CHECK: Check if this patient already reviewed this target
  const existingReview = await prisma.review.findFirst({
    where: {
      reviewerId: patient.id,
      targetId: targetId,
    },
  });

  if (existingReview) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Duplicate Review: You have already submitted a review for this profile.',
    );
  }

  // 3. Map Data for Prisma
  const reviewData: Prisma.ReviewCreateInput = {
    rating: payload.rating,
    comment: payload.comment,
    target: {
      connect: { id: targetId },
    },
    targetType: payload.targetType,
    status: 'APPROVED',
    reviewer: {
      connect: { id: patient.id },
    },

    ...(targetType === 'DOCTOR' && { doctor: { connect: { id: targetId } } }),
    ...(targetType === 'CLINIC' && { clinic: { connect: { id: targetId } } }),
  };

  // 4. Execute Transaction
  const result = await prisma.$transaction(async (tx) => {
    const newReview = await tx.review.create({
      data: reviewData,
      select: {
        id: true,
        rating: true,
        comment: true,
        reviewerId: true,
        targetId: true,
        createdAt: true,
        status: true,
        updatedAt: true,
        targetType: true,
        reviewer: {
          select: {
            name: true,
            image: true,
          },
        },
      },
    });
    await recallRating(targetId, targetType, tx);
    return newReview;
  });

  return result;
};
const getAllReviews = async (
  filter: {
    searchTerm?: string;
    rating?: string | number;
    targetType?: 'DOCTOR' | 'CLINIC';
  },
  options: IOptions,
): Promise<IGenericResponse<any>> => {
  const { page, limit, skip, sortBy, sortOrder } = paginationCalculator(options);
  const { searchTerm, rating, targetType } = filter;

  // 1. Initialize AND conditions
  const andConditions: Prisma.ReviewWhereInput[] = [];

  // 2. Filter by Rating
  if (rating) {
    andConditions.push({ rating: Number(rating) });
  }

  // 3. Filter by Target Type (Doctor vs Clinic)
  if (targetType) {
    andConditions.push({ targetType });
  }

  // 4. Search Logic (Comments or Reviewer Name)
  if (searchTerm) {
    andConditions.push({
      OR: [
        { comment: { contains: searchTerm, mode: 'insensitive' } },
        { reviewer: { name: { contains: searchTerm, mode: 'insensitive' } } },
      ],
    });
  }

  const whereCondition: Prisma.ReviewWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  // 5. Query
  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: whereCondition,
      skip,
      take: limit,
      orderBy: sortBy && sortOrder ? { [sortBy]: sortOrder } : { createdAt: 'desc' },
      select: {
        id: true,
        rating: true,
        comment: true,
        targetType: true,
        targetId: true,
        status: true,
        createdAt: true,
        reviewer: {
          select: {
            name: true,
            image: true,
          },
        },
        target: {
          select: { name: true, image: true },
        },
      },
    }),
    prisma.review.count({ where: whereCondition }),
  ]);

  return {
    meta: { page, limit, total },
    data: reviews,
  };
};
const getSingleTargetReviews = async (
  targetId: string,
  targetType: 'DOCTOR' | 'CLINIC',
  options: IOptions,
): Promise<IGenericResponse<IReviewResponse[]>> => {
  const { page, limit, skip, sortBy, sortOrder } = paginationCalculator(options);

  // Dynamic filter conditions
  const whereCondition: Prisma.ReviewWhereInput = {
    targetId,
    targetType,
    status: 'APPROVED',
  };

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: whereCondition,
      skip,
      take: limit,
      orderBy: sortBy && sortOrder ? { [sortBy]: sortOrder } : { createdAt: 'desc' },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        status: true,
        reviewer: {
          select: {
            name: true,
            image: true,
          },
        },
      },
    }),
    prisma.review.count({ where: whereCondition }),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
    },
    data: reviews as unknown as IReviewResponse[],
  };
};

const updateReview = async (reviewId: string, data: UpdateReviewInput, user: JwtPayload) => {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.review.findUnique({
      where: { id: reviewId },
      include: {
        reviewer: true,
      },
    });

    if (!existing) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Review not found');
    }

    // RBAC: Only Owner or Admin
    if (user.role !== 'ADMIN' && user.id !== existing.reviewer.id) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Unauthorized');
    }

    const { rating, comment, status } = data;
    const updateData: Partial<UpdateReviewInput> = { rating, comment, status };

    const updatedReview = await tx.review.update({
      where: { id: reviewId },
      data: updateData,
    });

    const wasApproved = existing.status === 'APPROVED';
    const isNowApproved = updatedReview.status === 'APPROVED';
    const ratingChanged = existing.rating !== updatedReview.rating;

    if (wasApproved || isNowApproved || (isNowApproved && ratingChanged)) {
      await recallRating(existing.targetId, existing.targetType, tx);
    }

    return updatedReview;
  });
};
const deleteReview = async (reviewId: string, user: JwtPayload) => {
  return await prisma.$transaction(async (tx) => {
    // 1️⃣ Find review and include patient → user
    const existing = await tx.review.findUnique({
      where: { id: reviewId },
      include: {
        reviewer: true,
      },
    });

    if (!existing) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Review not found');
    }

    // 2️⃣ Security: Only owner or admin can delete
    if (user.role !== 'ADMIN' && user.id !== existing.reviewer.id) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Unauthorized');
    }

    // 3️⃣ Delete review
    await tx.review.delete({
      where: { id: reviewId },
    });

    // 4️⃣ Recalculate 's rating
    await recallRating(existing.targetId, existing.targetType, tx);

    return;
  });
};

export const ReviewsService = {
  createReview,
  getAllReviews,
  getSingleTargetReviews,
  updateReview,
  deleteReview,
};
