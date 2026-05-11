import httpStatus from 'http-status';
import prisma from '../../../prisma/client';
import ApiError from '../../../utils/apiError';

import { IFeedbackResponse } from './interface';

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
  const result = await prisma.feedback.findMany({
    where: {
      status: 'APPROVED',
    },
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      patient: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
  });

  return result;
};

export const FeedbackService = {
  getFeedbacks,
  createFeedback,
};
