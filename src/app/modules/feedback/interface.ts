import z from 'zod';
import { createFeedbackSchema, updateFeedbackStatusSchema } from './zodValidation';

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

// system feedback
export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>['body'];
export type UpdateFeedbackStatusInput = z.infer<typeof updateFeedbackStatusSchema>['body'];
