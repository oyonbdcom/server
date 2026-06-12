import { UserRole } from '@prisma/client';
import express from 'express';
import { protect, restrictTo } from '../../../middlewares/authMiddleware';
import { zodValidate } from '../../../middlewares/zodValidation';
import { ReviewsController } from './controllers';
import { DiagnosticReviewZodValidation } from './zodValidation';

const router = express.Router();

router.post(
  '/',
  protect,
  zodValidate(DiagnosticReviewZodValidation.createReviewSchema),
  ReviewsController.createReviews,
);

router.post(
  '/:id/reply',
  protect,
  restrictTo(UserRole?.ADMIN, UserRole?.DIAGNOSTIC, UserRole?.AREA_MANAGER),
  ReviewsController.replyToReview,
);

router.get(
  '/profile',
  protect,
  restrictTo(UserRole.DIAGNOSTIC),
  ReviewsController.getDiagnosticProfileReviews,
);
router.get('/:digId', ReviewsController.getDiagnosticReviews);

router.patch(
  '/:reviewId',
  protect,
  restrictTo(UserRole?.ADMIN, UserRole?.PATIENT, UserRole?.DIAGNOSTIC, UserRole?.AREA_MANAGER),
  zodValidate(DiagnosticReviewZodValidation.updateReviewSchema),
  ReviewsController.updateReview,
);

router.delete(
  '/:reviewId',
  protect,
  restrictTo(UserRole?.ADMIN, UserRole?.PATIENT, UserRole?.AREA_MANAGER),
  ReviewsController.deleteReview,
);

export const DiagnosticReviewsRoutes = router;
