import { z } from 'zod';

const ReviewStatus = z.enum(['PENDING', 'APPROVED', 'REJECTED']);

export const reviewSchema = z.object({
  diagId: z.string().cuid().optional(),
  rating: z.number().int().min(1).max(5).default(1),
  comment: z.string().optional().nullable(),
  status: ReviewStatus.default('PENDING'),
});

export const createReviewSchema = z.object({
  body: reviewSchema,
});

export const updateReviewSchema = z.object({
  body: reviewSchema.partial().optional(),
});

export const createFeedbackSchema = z.object({
  body: {
    rating: z.number().min(1, 'Minimum rating is 1').max(5, 'Maximum rating is 5'),

    comment: z.string().max(1000, 'Comment too long').optional().or(z.literal('')), // allow empty string
  },
});

export const updateFeedbackStatusSchema = z.object({
  body: {
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
  },
});

export const DiagnosticReviewZodValidation = {
  createReviewSchema,
  updateReviewSchema,
  createFeedbackSchema,
  updateFeedbackStatusSchema,
};
