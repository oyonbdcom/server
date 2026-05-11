import { z } from 'zod';

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

export const ReviewZodValidation = {
  createFeedbackSchema,
  updateFeedbackStatusSchema,
};
