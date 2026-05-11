import express from 'express';
import { protect } from '../../../middlewares/authMiddleware';
import { FeedbackController } from './controllers';

const router = express.Router();

router.post(
  '/',
  protect,
  // zodValidate(ReviewZodValidation.createFeedbackSchema),
  FeedbackController.createFeedback,
);
router.get('/', FeedbackController.getFeedbacks);

export const FeedbackRoutes = router;
