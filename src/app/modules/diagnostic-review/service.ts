import { Prisma, UserRole } from '@prisma/client';
import httpStatus from 'http-status';
import { JwtPayload } from 'jsonwebtoken';
import { IOptions, paginationCalculator } from '../../../helper/pagination';
import { IGenericResponse } from '../../../interface/common';
import prisma from '../../../prisma/client';
import ApiError from '../../../utils/apiError';

import { CreateReviewInput, IReviewResponse, UpdateReviewInput } from './interface';
import { recallRating } from './utils';

const createReview = async (
  userId: string,
  payload: CreateReviewInput, // নিশ্চিত করুন এখানে doctorId আছে
): Promise<IReviewResponse | undefined> => {
  const { diagId, rating, comment } = payload;

  // 1. IDENTITY CHECK: রিভিউ দাতা ইউজারকে খুঁজে বের করা
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found.');
  }
  if (!diagId) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Diagnostic not found.');
  }

  // Security: শুধুমাত্র PATIENT রা রিভিউ দিতে পারবে
  if (user.role !== 'PATIENT') {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'Access Denied: Only Patients are allowed to submit reviews.',
    );
  }

  // 2. DUPLICATE CHECK: স্কিমার @@unique([reviewerId, doctorId]) অনুযায়ী চেক
  const existingReview = await prisma.diagnosticReview.findUnique({
    where: {
      reviewerId_diagId: {
        reviewerId: user.id,
        diagId,
      },
    },
  });

  if (existingReview) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Duplicate Review: You have already submitted a review for this doctor.',
    );
  }

  // 3. EXECUTE TRANSACTION
  const result = await prisma.$transaction(async (tx) => {
    const newReview = await tx.diagnosticReview.create({
      data: {
        rating,
        comment,
        status: 'APPROVED', // বা আপনার ডিফল্ট স্ট্যাটাস
        reviewer: {
          connect: { id: user.id },
        },
        diagnostic: {
          connect: { id: diagId },
        },
      },
      include: {
        reviewer: {
          select: {
            name: true,
            image: true,
            patient: {
              select: {
                gender: true,
              },
            },
          },
        },
        diagnostic: {
          select: {
            user: {
              select: { name: true },
            },
          },
        },
      },
    });

    // ৪. রেটিং আপডেট (শুধুমাত্র ডাক্তাররের জন্য)
    // যেহেতু এখন শুধু ডাক্তার, তাই targetType পাঠানোর প্রয়োজন নেই যদি আপনার ফাংশনটি আপডেট করেন
    await recallRating(diagId, tx);

    return newReview;
  });

  return result as unknown as IReviewResponse;
};

// doctor review replay
const replyToReview = async (diagReviewId: string, userId: string, content: string) => {
  const review = await prisma.diagnosticReview.findUnique({
    where: { id: diagReviewId },
    include: {
      reviewer: {
        select: {
          name: true,
          role: true,
        },
      },
      reply: true,
    },
  });

  if (!review) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Review not found');
  }

  const result = await prisma.diagnosticReviewReply.upsert({
    where: { diagReviewId },
    update: {
      content,
    },
    create: {
      content,
      diagReviewId,
      repliedById: userId,
    },
  });

  return result;
};

const getDiagnosticReviews = async (
  targetId: string,
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
  const andConditions: Prisma.DiagnosticReviewWhereInput[] = [
    { diagId: targetId },

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

  const whereCondition: Prisma.DiagnosticReviewWhereInput = { AND: andConditions };

  const [reviews, total] = await Promise.all([
    prisma.diagnosticReview.findMany({
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
        reply: true,
      },
    }),
    prisma.diagnosticReview.count({ where: whereCondition }),
  ]);

  return {
    meta: { page, limit, total },
    data: reviews as unknown as IReviewResponse[],
  };
};
const getDiagnosticProfileReviews = async (
  userId: string,
  filter: {
    searchTerm?: string;
    rating?: string | number;
    status?: string;
  },
  options: IOptions,
): Promise<IGenericResponse<IReviewResponse[]>> => {
  const { page, limit, skip, sortBy, sortOrder } = paginationCalculator(options);
  const { searchTerm, rating, status } = filter;

  // ১. ইউজার ও ডায়াগনস্টিক আইডি খুঁজে বের করা
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { diagnostic: { select: { id: true } } },
  });

  if (!user?.diagnostic?.id) {
    throw new ApiError(httpStatus.NOT_FOUND, 'ডায়াগনস্টিক প্রোফাইল পাওয়া যায়নি!');
  }

  // ২. ফিল্টার কন্ডিশন তৈরি
  const andConditions: Prisma.DiagnosticReviewWhereInput[] = [
    { diagId: 'cmq3f9acp000aueq4b9t3li1h' },
  ];

  if (rating && rating !== 'all') {
    andConditions.push({ rating: Number(rating) });
  }

  if (searchTerm) {
    andConditions.push({
      OR: [
        { comment: { contains: searchTerm, mode: 'insensitive' } },
        { reviewer: { name: { contains: searchTerm, mode: 'insensitive' } } },
      ],
    });
  }

  const whereCondition: Prisma.DiagnosticReviewWhereInput = { AND: andConditions };

  // ৩. ডাটাবেজ কুয়েরি
  const [reviews, total] = await Promise.all([
    prisma.diagnosticReview.findMany({
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
        reviewer: { select: { name: true, image: true, id: true } },
        reply: true,
      },
    }),
    prisma.diagnosticReview.count({ where: whereCondition }),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
    data: reviews as unknown as IReviewResponse[],
  };
};
const updateReview = async (
  reviewId: string,
  data: UpdateReviewInput,
  user: JwtPayload,
): Promise<any> => {
  return await prisma.$transaction(async (tx) => {
    // ১. রিভিউটি খুঁজে বের করা এবং প্রয়োজনীয় ডাটা ইনক্লুড করা
    const existing = await tx.diagnosticReview.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        reviewerId: true,
        diagId: true,
      },
    });

    if (!existing || !existing.diagId) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Review or associated doctor not found');
    }

    // ৩. RBAC: শুধুমাত্র রিভিউ দাতা বা এডমিন আপডেট করতে পারবে
    if (user.role !== UserRole?.DIAGNOSTIC && user.id !== existing.reviewerId) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Unauthorized to update this review');
    }

    // ৪. রিভিউ আপডেট করা
    const updatedReview = await tx.diagnosticReview.update({
      where: { id: reviewId },
      data: { ...data },
    });

    // ৫. রেটিং পুনরায় ক্যালকুলেট করা (নতুন doctorId এবং targetType সহ)
    // নিশ্চিত করুন আপনার recallRating ফাংশন ৩টি আর্গুমেন্ট নেয় (targetId, targetType, tx)
    await recallRating(existing.diagId, tx);

    return updatedReview;
  });
};

const deleteReview = async (reviewId: string) => {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.diagnosticReview.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        reviewerId: true,
        diagId: true,
      },
    });

    if (!existing?.diagId) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Diagnostic Review not found');
    }

    // 3️⃣ Delete review
    await tx.diagnosticReview.delete({
      where: { id: reviewId },
    });

    // 4️⃣ Recalculate 's rating
    await recallRating(existing?.diagId, tx);

    return;
  });
};

export const ReviewsService = {
  replyToReview,
  createReview,
  getDiagnosticProfileReviews,
  getDiagnosticReviews,
  updateReview,
  deleteReview,
};
