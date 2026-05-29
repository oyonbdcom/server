import { UserRole } from '@prisma/client';
import express from 'express';
import { protect, restrictTo } from '../../../middlewares/authMiddleware';
import { zodValidate } from '../../../middlewares/zodValidation';
import { ReviewsController } from './controllers';
import { DoctorReviewZodValidation } from './zodValidation';

const router = express.Router();

router.post(
  '/',
  protect,
  zodValidate(DoctorReviewZodValidation.createReviewSchema),
  ReviewsController.createReviews,
);

router.post(
  '/:id/reply',
  protect,
  restrictTo(UserRole?.ADMIN, UserRole?.DIAGNOSTIC, UserRole?.AREA_MANAGER),
  ReviewsController.replyToReview,
);
router.get(
  '/manager-area-reviews',
  protect,
  restrictTo(UserRole.AREA_MANAGER),
  ReviewsController.getReviewsByManagerArea,
);

router.get('/:doctorId', ReviewsController.getSingleTargetReviews);

router.patch(
  '/:reviewId',
  protect,
  restrictTo(UserRole?.ADMIN, UserRole?.PATIENT, UserRole?.AREA_MANAGER),
  zodValidate(DoctorReviewZodValidation.updateReviewSchema),
  ReviewsController.updateReview,
);

router.delete(
  '/:reviewId',
  protect,
  restrictTo(UserRole?.ADMIN, UserRole?.PATIENT, UserRole?.AREA_MANAGER),
  ReviewsController.deleteReview,
);

export const DoctorReviewsRoutes = router;
