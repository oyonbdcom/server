import { UserRole } from '@prisma/client';
import express from 'express';
import { protect, restrictTo } from '../../../middlewares/authMiddleware';
import { zodValidate } from '../../../middlewares/zodValidation';
import { ReviewsController } from './controllers';
import { ReviewZodValidation } from './zodValidation';

const router = express.Router();

router.post(
  '/',
  protect,
  zodValidate(ReviewZodValidation.createReviewSchema),
  ReviewsController.createReviews,
);
router.post(
  '/feedback',
  protect,
  // zodValidate(ReviewZodValidation.createFeedbackSchema),
  ReviewsController.createFeedback,
);
router.get('/feedbacks', ReviewsController.getFeedbacks);
router.post(
  '/:id/reply',
  protect,
  restrictTo(UserRole?.ADMIN, UserRole?.DIAGNOSTIC_MANAGER, UserRole?.AREA_MANAGER),
  ReviewsController.replyToReview,
);
router.get(
  '/manager-area-reviews',
  protect,
  restrictTo(UserRole.AREA_MANAGER),
  ReviewsController.getReviewsByManagerArea,
);
// router.get('/', protect, ReviewsController.getAllReviews);
// router.get('/statistics', protect, ReviewsController.getReviewStats);

router.get('/:doctorId', ReviewsController.getSingleTargetReviews);

router.patch(
  '/:reviewId',
  protect,
  restrictTo(UserRole?.ADMIN, UserRole?.PATIENT, UserRole?.AREA_MANAGER),
  zodValidate(ReviewZodValidation.updateReviewSchema),
  ReviewsController.updateReview,
);

router.delete(
  '/:reviewId',
  protect,
  restrictTo(UserRole?.ADMIN, UserRole?.PATIENT, UserRole?.AREA_MANAGER),
  ReviewsController.deleteReview,
);

export const ReviewsRoutes = router;
