import { z } from 'zod';

const ReviewTargetType = z.enum(['DOCTOR', 'CLINIC']);
const ReviewStatus = z.enum(['PENDING', 'APPROVED', 'REJECTED']);

export const reviewSchema = z.object({
  reviewerId: z.string().cuid('Invalid cuid format'),
  targetId: z.string().cuid(),
  targetType: ReviewTargetType,
  rating: z.number().int().min(1).max(5).default(1),
  comment: z.string().optional().nullable(),
  status: ReviewStatus.default('PENDING'),
});

export const createReviewSchema = z.object({
  body: reviewSchema,
});

export const updateReviewSchema = z.object({
  body: reviewSchema.partial(),
});

export const ReviewZodValidation = {
  createReviewSchema,
  updateReviewSchema,
};
