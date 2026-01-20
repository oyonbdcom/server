import { ReviewStatus, ReviewTargetType } from '@prisma/client';
import z from 'zod';
import { createReviewSchema, updateReviewSchema } from './zodValidation';

export interface IReviewer {
  id: string;
  name: string;
  image: string | null;
}

export interface IReviewReply {
  id: string;
  content: string;
  reviewId: string;
  repliedById: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface IReviewResponse {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date | string;
  status: ReviewStatus;
  targetId?: string; // Optional if not always selected
  targetType?: ReviewTargetType; // Optional if not always selected

  // Relations from your 'select' clause
  reviewer: IReviewer;
  reviewReply: IReviewReply | null;
}
export type IReviewStatsResponse = {
  totalReviews: number;
  averageRating: string;
  pending: number;
  approved: number;
  rejected: number;
  replyCount: number;
  replyRate: number;
  ratingBreakdown: Record<number, number>;
};
export type CreateReviewInput = z.infer<typeof createReviewSchema>['body'];
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>['body'];

export const ReviewFilterableFields = ['searchTerm', 'rating', 'targetType', 'status'];
