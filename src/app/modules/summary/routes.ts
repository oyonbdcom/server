import { UserRole } from '@prisma/client';
import express from 'express';
import { protect, restrictTo } from '../../../middlewares/authMiddleware';
import { AppointmentsController } from './controllers';

const router = express.Router();

router.get(
  '/manager',
  protect,
  restrictTo(UserRole.AREA_MANAGER),
  AppointmentsController.getManagerSummary,
);

export const SummaryRoutes = router;
