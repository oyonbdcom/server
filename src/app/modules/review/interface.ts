import { ReviewStatus } from '@prisma/client';
import z from 'zod';
import {
  createFeedbackSchema,
  createReviewSchema,
  updateFeedbackStatusSchema,
  updateReviewSchema,
} from './zodValidation';

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
export type IFeedbackResponse = {
  id: string;
  rating: number;
  comment?: string | null;

  status: 'PENDING' | 'APPROVED' | 'REJECTED';

  createdAt: Date;

  patient: {
    id: string;
    name: string;
    image?: string | null;
  };
};
export interface IReviewResponse {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date | string;
  status: ReviewStatus;
  doctorId?: string;

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
// system feedback
export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>['body'];
export type UpdateFeedbackStatusInput = z.infer<typeof updateFeedbackStatusSchema>['body'];
export const ReviewFilterableFields = ['searchTerm', 'rating', 'doctorId', 'status'];
