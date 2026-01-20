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

router.get('/', protect, restrictTo('ADMIN'), ReviewsController.getAllReviews);
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
  restrictTo('ADMIN', 'PATIENT'),
  ReviewsController.deleteReview,
);

export const ReviewsRoutes = router;
