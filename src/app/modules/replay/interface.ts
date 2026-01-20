import z from 'zod';
import { createReviewSchema, updateReviewSchema } from './zodValidation';

export interface IReviewResponse {
  id: string;
  reviewerId: string;
  targetId: string;
  rating: number;
  targetType: 'CLINIC' | 'DOCTOR';
  comment?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateReviewInput = z.infer<typeof createReviewSchema>['body'];
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>['body'];

export const ReviewFilterableFields = ['searchTerm', 'rating', 'targetType'];
