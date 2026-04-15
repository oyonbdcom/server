import { UserRole } from '@prisma/client';
import express from 'express';
import { protect, restrictTo } from '../../../middlewares/authMiddleware';
import { zodValidate } from '../../../middlewares/zodValidation';
import { ScheduleController } from './controllers';
import { ScheduleZodValidation } from './zodValidation';

const router = express.Router();

// User routes
router.post(
  '/',
  protect,
  zodValidate(ScheduleZodValidation.createScheduleSchema),
  ScheduleController.createSchedule,
);

router.patch(
  '/:id',
  protect,
  restrictTo('CLINIC', UserRole?.MANAGER),
  zodValidate(ScheduleZodValidation.updateScheduleSchema),
  ScheduleController.updateSchedule,
);
router.delete(
  '/:id',
  protect,
  restrictTo('CLINIC', UserRole?.MANAGER),
  ScheduleController.deleteSchedule,
);

export const ScheduleRoutes = router;
