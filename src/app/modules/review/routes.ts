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
  '/:id/reply',
  protect,
  restrictTo('ADMIN', 'CLINIC', 'DOCTOR'),
  ReviewsController.replyToReview,
);

router.get('/', protect, ReviewsController.getAllReviews);
router.get('/statistics', protect, ReviewsController.getReviewStats);
router.get('/:targetId', ReviewsController.getSingleTargetReviews);
router.patch(
  '/:reviewId',
  protect,
  restrictTo('ADMIN', 'PATIENT'),
  zodValidate(ReviewZodValidation.updateReviewSchema),
  ReviewsController.updateReview,
);

router.delete(
  '/:reviewId',
  protect,
  restrictTo('ADMIN', 'PATIENT', 'CLINIC'),
  ReviewsController.deleteReview,
);

export const ReviewsRoutes = router;
