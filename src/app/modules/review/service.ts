import { Prisma, ReviewStatus } from '@prisma/client';
import httpStatus from 'http-status';
import { JwtPayload } from 'jsonwebtoken';
import { IOptions, paginationCalculator } from '../../../helper/pagination';
import { IGenericResponse } from '../../../interface/common';
import prisma from '../../../prisma/client';
import ApiError from '../../../utils/apiError';
import { recallRating } from '../replay/utils';
import {
  CreateReviewInput,
  IReviewResponse,
  IReviewStatsResponse,
  UpdateReviewInput,
} from './interface';

const createReview = async (
  userId: string,
  payload: CreateReviewInput,
): Promise<IReviewResponse | undefined> => {
  const { targetId, targetType } = payload;

  // 1. IDENTITY CHECK: Find the user writing the review
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found.');
  }

  // Security: Only Patients can write reviews
  if (user.role !== 'PATIENT') {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'Access Denied: Only Patients are allowed to submit reviews.',
    );
  }

  // 2. DUPLICATE CHECK: Use the unique constraint [reviewerId, targetId]
  const existingReview = await prisma.review.findUnique({
    where: {
      reviewerId_targetId: {
        reviewerId: user.id,
        targetId: targetId,
      },
    },
  });

  if (existingReview) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Duplicate Review: You have already submitted a review for this profile.',
    );
  }

  // 3. MAP DATA: Simplified for User-to-User relation
  // We no longer need to conditionally connect to 'doctor' or 'clinic' models inside the Review
  const reviewData: Prisma.ReviewCreateInput = {
    rating: payload.rating,
    comment: payload.comment,
    targetType: payload.targetType,
    status: 'APPROVED',
    reviewer: {
      connect: { id: user.id },
    },
    target: {
      connect: { id: targetId },
    },
  };

  // 4. EXECUTE TRANSACTION
  const result = await prisma.$transaction(async (tx) => {
    const newReview = await tx.review.create({
      data: reviewData,
      select: {
        id: true,
        rating: true,
        comment: true,
        reviewerId: true,
        targetId: true,
        targetType: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        reviewer: {
          select: {
            name: true,
            image: true,
            role: true,
            patient: {
              select: {
                gender: true,
                city: true,
              },
            },
          },
        },
        target: { select: { name: true, image: true } },
      },
    });

    // Recalculate average rating for the Doctor or Clinic
    await recallRating(targetId, targetType, tx);

    return newReview;
  });

  return result as unknown as IReviewResponse;
};

const replyToReview = async (reviewId: string, userId: string, content: string) => {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: {
      reviewer: {
        select: {
          name: true,
          role: true,
        },
      },
      reviewReply: true,
    },
  });

  if (!review) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Review not found');
  }

  // 2. Security: Check if user owns the Doctor or Clinic profile being reviewed
  // We compare the userId from the JWT with the userId associated with the Doctor/Clinic
  const isOwner = review.targetId === userId;

  if (!isOwner) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'Unauthorized: You can only reply to reviews on your own profile.',
    );
  }

  // 3. Upsert Logic: If reply exists, update it; otherwise, create it.
  // This is better for UX than throwing an error on "Duplicate Reply"
  const result = await prisma.reviewReply.upsert({
    where: { reviewId },
    update: {
      content,
      updatedAt: new Date(),
    },
    create: {
      content,
      reviewId,
      repliedById: userId,
    },
  });

  return result;
};

const getAllReviews = async (
  user: JwtPayload,
  filter: {
    searchTerm?: string;
    rating?: string | number;
    targetType?: 'DOCTOR' | 'CLINIC';
    status?: ReviewStatus;
  },
  options: IOptions,
): Promise<IGenericResponse<IReviewResponse[]>> => {
  const { page, limit, skip, sortBy, sortOrder } = paginationCalculator(options);
  const { searchTerm, rating, targetType, status } = filter;

  const andConditions: Prisma.ReviewWhereInput[] = [];

  // --- 🛡️ ROLE-BASED RESTRICTION ---
  if (user.role === 'ADMIN') {
    // Admin can see everything, but if they chose a targetType filter, apply it
    if (targetType) {
      andConditions.push({ targetType });
    }
  } else if (user.role === 'DOCTOR' || user.role === 'CLINIC') {
    // Doctors and Clinics are LOCKED to their own reviews
    // We ignore the targetType filter from the user and force their own role/id
    andConditions.push({
      targetId: user.id,
      targetType: user.role as 'DOCTOR' | 'CLINIC',
    });
  } else {
    // If a Patient or other role tries to access this, return empty or throw error
    throw new ApiError(httpStatus.FORBIDDEN, "You don't have access to these reviews");
  }

  // --- 🔍 REMAINING FILTERS ---
  if (rating && rating !== 'all') {
    andConditions.push({ rating: Number(rating) });
  }

  if (status) {
    andConditions.push({ status: status as ReviewStatus });
  }

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

  // --- 📊 DATA FETCHING ---
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
        createdAt: true,
        status: true,
        reviewer: {
          select: {
            name: true,
            image: true,
            id: true,
          },
        },
        target: { select: { name: true, image: true } },
        reviewReply: true,
      },
    }),
    prisma.review.count({ where: whereCondition }),
  ]);

  return {
    meta: { page, limit, total },
    data: reviews as unknown as IReviewResponse[],
  };
};
const getSingleTargetReviews = async (
  targetId: string,
  targetType: 'DOCTOR' | 'CLINIC',
  // 1. Add filter parameters to the signature
  filter: {
    searchTerm?: string;
    rating?: string | number;
    status?: string;
  },
  options: IOptions,
): Promise<IGenericResponse<IReviewResponse[]>> => {
  const { page, limit, skip, sortBy, sortOrder } = paginationCalculator(options);
  const { searchTerm, rating, status } = filter;

  // 2. Build dynamic AND conditions
  const andConditions: Prisma.ReviewWhereInput[] = [
    { targetId },
    { targetType },
    // Default to APPROVED if no status filter is provided
    { status: (status as any) || 'APPROVED' },
  ];

  // Filter by Rating
  if (rating && rating !== 'all') {
    andConditions.push({ rating: Number(rating) });
  }

  // Search by Comment or Reviewer Name
  if (searchTerm) {
    andConditions.push({
      OR: [
        { comment: { contains: searchTerm, mode: 'insensitive' } },
        { reviewer: { name: { contains: searchTerm, mode: 'insensitive' } } },
      ],
    });
  }

  const whereCondition: Prisma.ReviewWhereInput = { AND: andConditions };

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
            id: true,
          },
        },
        reviewReply: true,
      },
    }),
    prisma.review.count({ where: whereCondition }),
  ]);

  return {
    meta: { page, limit, total },
    data: reviews as unknown as IReviewResponse[],
  };
};
const getReviewStats = async (
  user: JwtPayload,
  filter: {
    searchTerm?: string;
    rating?: string | number;
    targetType?: 'DOCTOR' | 'CLINIC';
    status?: ReviewStatus;
  },
): Promise<IReviewStatsResponse> => {
  const { rating, targetType, status } = filter;
  const andConditions: Prisma.ReviewWhereInput[] = [];

  // --- 🛡️ ROLE-BASED RESTRICTION ---
  if (user.role === 'ADMIN') {
    if (targetType) andConditions.push({ targetType });
  } else if (user.role === 'DOCTOR' || user.role === 'CLINIC') {
    andConditions.push({
      targetId: user.id,
      targetType: user.role as 'DOCTOR' | 'CLINIC',
    });
  } else {
    throw new ApiError(httpStatus.FORBIDDEN, "You don't have access to these reviews");
  }

  // --- 🔍 REMAINING FILTERS ---
  if (rating && rating !== 'all') andConditions.push({ rating: Number(rating) });
  if (status) andConditions.push({ status: status as ReviewStatus });

  const whereCondition: Prisma.ReviewWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  // --- 📊 MULTI-QUERY EXECUTION ---
  const [statusStats, ratingStats, aggregateStats, replyCount] = await Promise.all([
    // Group by Status
    prisma.review.groupBy({
      by: ['status'],
      where: whereCondition,
      _count: { id: true },
    }),
    // Group by Rating for Breakdown
    prisma.review.groupBy({
      by: ['rating'],
      where: whereCondition,
      _count: { id: true },
    }),
    // Calculate Average Rating
    prisma.review.aggregate({
      where: whereCondition,
      _avg: { rating: true },
      _count: { id: true },
    }),
    // Count reviews that have a reply
    prisma.review.count({
      where: {
        ...whereCondition,
        reviewReply: { isNot: null }, // Only count if reviewReply exists
      },
    }),
  ]);

  // --- 🔄 TRANSFORMATION ---
  const statuses = statusStats.reduce(
    (acc: any, curr) => {
      acc[curr.status.toLowerCase()] = curr._count.id;
      return acc;
    },
    { pending: 0, approved: 0, rejected: 0 },
  );

  const ratings = ratingStats.reduce(
    (acc: any, curr) => {
      acc[curr.rating] = curr._count.id;
      return acc;
    },
    { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  );

  const totalReviews = aggregateStats._count.id;
  const averageRating = aggregateStats._avg.rating?.toFixed(1) || '0.0';

  // Calculate Reply Percentage
  const replyRate = totalReviews > 0 ? Math.round((replyCount / totalReviews) * 100) : 0;

  return {
    totalReviews,
    averageRating,
    replyCount,
    replyRate,
    ...statuses,
    ratingBreakdown: ratings,
  };
};
const updateReview = async (
  reviewId: string,
  data: UpdateReviewInput,
  user: JwtPayload,
): Promise<any> => {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.review.findUnique({
      where: { id: reviewId },
      include: {
        reviewer: {
          select: { name: true, id: true },
        },
      },
    });

    if (!existing) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Review not found');
    }

    // RBAC: Only Owner or Admin
    if (user.role !== 'ADMIN' && user.id !== existing.reviewer.id) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Unauthorized');
    }

    const updatedReview = await tx.review.update({
      where: { id: reviewId },
      data: { ...data },
    });

    await recallRating(existing.targetId, existing.targetType, tx);

    return updatedReview;
  });
};

const deleteReview = async (reviewId: string, user: JwtPayload) => {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.review.findUnique({
      where: { id: reviewId },
      include: {
        reviewer: { select: { name: true, id: true } },
      },
    });

    if (!existing) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Review not found');
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
  replyToReview,
  createReview,
  getAllReviews,
  getReviewStats,
  getSingleTargetReviews,
  updateReview,
  deleteReview,
};
