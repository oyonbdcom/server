import { Prisma, UserRole } from '@prisma/client';
import httpStatus from 'http-status';
import { JwtPayload } from 'jsonwebtoken';
import { IOptions, paginationCalculator } from '../../../helper/pagination';
import { IGenericResponse } from '../../../interface/common';
import prisma from '../../../prisma/client';
import ApiError from '../../../utils/apiError';

import {
  CreateReviewInput,
  IFeedbackResponse,
  IReviewResponse,
  UpdateReviewInput,
} from './interface';
import { recallRating } from './utils copy';

const createReview = async (
  userId: string,
  payload: CreateReviewInput, // নিশ্চিত করুন এখানে doctorId আছে
): Promise<IReviewResponse | undefined> => {
  const { doctorId, rating, comment } = payload;

  // 1. IDENTITY CHECK: রিভিউ দাতা ইউজারকে খুঁজে বের করা
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found.');
  }
  if (!doctorId) {
    throw new ApiError(httpStatus.NOT_FOUND, 'doctorId not found.');
  }

  // Security: শুধুমাত্র PATIENT রা রিভিউ দিতে পারবে
  if (user.role !== 'PATIENT') {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'Access Denied: Only Patients are allowed to submit reviews.',
    );
  }

  // 2. DUPLICATE CHECK: স্কিমার @@unique([reviewerId, doctorId]) অনুযায়ী চেক
  const existingReview = await prisma.review.findUnique({
    where: {
      reviewerId_doctorId: {
        reviewerId: user.id,
        doctorId: doctorId,
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
    const newReview = await tx.review.create({
      data: {
        rating,
        comment,
        status: 'APPROVED', // বা আপনার ডিফল্ট স্ট্যাটাস
        reviewer: {
          connect: { id: user.id },
        },
        doctor: {
          connect: { id: doctorId }, // সরাসরি Doctor মডেলের সাথে কানেক্ট
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
        doctor: {
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
    await recallRating(doctorId, tx);

    return newReview;
  });

  return result as unknown as IReviewResponse;
};

// system feedback
const createFeedback = async (
  userId: string,
  payload: any,
): Promise<IFeedbackResponse | undefined> => {
  const { rating, comment } = payload;

  // 1️⃣ USER CHECK
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, name: true, image: true },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found.');
  }

  // 🔐 Only PATIENT allowed
  if (user.role !== 'PATIENT') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Access Denied: Only Patients can submit feedback.');
  }

  // 2️⃣ DUPLICATE CHECK (if @@unique([patientId]) used)
  const existingFeedback = await prisma.feedback.findUnique({
    where: {
      patientId: user.id,
    },
  });

  if (existingFeedback) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'You have already submitted feedback.');
  }

  // 3️⃣ CREATE FEEDBACK
  const result = await prisma.feedback.create({
    data: {
      rating,
      comment,
      status: 'PENDING', // admin approve করবে
      patient: {
        connect: { id: user.id },
      },
    },
    include: {
      patient: {
        select: {
          id: true,
          name: true,
          image: true,
          patient: {
            select: {
              gender: true,
            },
          },
        },
      },
    },
  });

  return result as unknown as IFeedbackResponse;
};
const getFeedbacks = async () => {
  const result = await prisma.feedback.findMany({});

  return result;
};

// doctor review replay
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
      reply: true,
    },
  });

  if (!review) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Review not found');
  }

  // 2. Security: Check if user owns the Doctor or Clinic profile being reviewed
  // We compare the userId from the JWT with the userId associated with the Doctor/Clinic

  // 3. Upsert Logic: If reply exists, update it; otherwise, create it.
  // This is better for UX than throwing an error on "Duplicate Reply"
  const result = await prisma.reviewReply.upsert({
    where: { reviewId },
    update: {
      content,
    },
    create: {
      content,
      reviewId,
      repliedById: userId,
    },
  });

  return result;
};

const getSingleTargetReviews = async (
  doctorId: string,

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
    { doctorId },

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
        reply: true,
      },
    }),
    prisma.review.count({ where: whereCondition }),
  ]);

  return {
    meta: { page, limit, total },
    data: reviews as unknown as IReviewResponse[],
  };
};
const getReviewsByManagerArea = async (
  managerUserId: string,
  filter: {
    searchTerm?: string;
    departmentSlug?: string;
    doctorId?: string;
    rating?: string | number;
    status?: string;
  },
  options: IOptions,
) => {
  const { page, limit, skip, sortBy, sortOrder } = paginationCalculator(options);
  const { searchTerm, departmentSlug, doctorId, rating, status } = filter;

  // ১. ম্যানেজারের এরিয়া আইডি বের করা
  const manager = await prisma.manager.findUnique({
    where: { userId: managerUserId },
    select: { areaId: true },
  });

  if (!manager) throw new Error('Manager not found');

  // ২. ফিল্টার কন্ডিশন তৈরি করা
  const whereConditions: any = {
    // ম্যানেজারের এরিয়া ফিল্টার
    doctor: {
      areas: {
        some: { areaId: manager.areaId },
      },
    },
  };

  // ডাইনামিক ফিল্টার অ্যাড করা
  const andConditions = [];

  // ডাক্তার এর নাম দিয়ে সার্চ
  if (searchTerm) {
    andConditions.push({
      doctor: {
        OR: [
          {
            user: {
              name: {
                contains: searchTerm,
                mode: 'insensitive',
              },
            },
          },
          {
            slug: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
        ],
      },
    });
  }
  // ডিপার্টমেন্ট স্লাগ ফিল্টার
  if (departmentSlug) {
    andConditions.push({
      doctor: {
        department: { slug: departmentSlug },
      },
    });
  }

  // রেটিং ফিল্টার (সরাসরি নম্বর হিসেবে চেক করবে)
  if (rating) {
    andConditions.push({
      rating: Number(rating),
    });
  }

  // স্ট্যাটাস ফিল্টার (APPROVED, PENDING, REJECTED)
  if (status) {
    andConditions.push({
      status: status,
    });
  }
  if (doctorId) {
    andConditions.push({
      doctorId: doctorId,
    });
  }

  // যদি কোনো ফিল্টার থাকে তবেই whereConditions এ যোগ হবে
  if (andConditions.length > 0) {
    whereConditions.AND = andConditions;
  }

  // ৩. ডাটা এবং টোটাল কাউন্ট ফেচ করা
  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: whereConditions,
      skip,
      take: limit,
      include: {
        reviewer: { select: { name: true, image: true } },
        doctor: {
          select: {
            user: { select: { name: true } },
            specialization: true,
            department: { select: { name: true, slug: true } },
          },
        },
        reply: true,
      },
      orderBy: sortBy && sortOrder ? { [sortBy]: sortOrder } : { createdAt: 'desc' },
    }),
    prisma.review.count({ where: whereConditions }),
  ]);
  const totalPage = Math.ceil(total / limit);
  return {
    meta: { page, limit, total, totalPage },
    data: reviews,
  };
};

const updateReview = async (
  reviewId: string,
  data: UpdateReviewInput,
  user: JwtPayload,
): Promise<any> => {
  return await prisma.$transaction(async (tx) => {
    // ১. রিভিউটি খুঁজে বের করা এবং প্রয়োজনীয় ডাটা ইনক্লুড করা
    const existing = await tx.review.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        reviewerId: true,
        doctorId: true,
      },
    });

    if (!existing || !existing.doctorId) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Review or associated doctor not found');
    }

    // ৩. RBAC: শুধুমাত্র রিভিউ দাতা বা এডমিন আপডেট করতে পারবে
    if (user.role !== UserRole?.AREA_MANAGER && user.id !== existing.reviewerId) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Unauthorized to update this review');
    }

    // ৪. রিভিউ আপডেট করা
    const updatedReview = await tx.review.update({
      where: { id: reviewId },
      data: { ...data },
    });

    // ৫. রেটিং পুনরায় ক্যালকুলেট করা (নতুন doctorId এবং targetType সহ)
    // নিশ্চিত করুন আপনার recallRating ফাংশন ৩টি আর্গুমেন্ট নেয় (targetId, targetType, tx)
    await recallRating(existing.doctorId, tx);

    return updatedReview;
  });
};

const deleteReview = async (reviewId: string, user: JwtPayload) => {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.review.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        reviewerId: true,
        doctorId: true,
      },
    });

    if (!existing?.doctorId) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Review not found');
    }

    // 3️⃣ Delete review
    await tx.review.delete({
      where: { id: reviewId },
    });

    // 4️⃣ Recalculate 's rating
    await recallRating(existing?.doctorId, tx);

    return;
  });
};

export const ReviewsService = {
  replyToReview,
  createReview,
  getFeedbacks,
  createFeedback,
  getSingleTargetReviews,
  updateReview,
  deleteReview,
  getReviewsByManagerArea,
};
