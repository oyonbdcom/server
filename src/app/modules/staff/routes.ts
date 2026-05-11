import { UserRole } from '@prisma/client';
import express from 'express';
import { protect, restrictTo } from '../../../middlewares/authMiddleware';
import { StaffController } from './controllers';

const router = express.Router();

router.post(
  '/',
  protect,
  restrictTo('ADMIN', UserRole.DIAGNOSTIC_MANAGER),
  // zodValidate(ClinicZodValidation.createClinicSchema),
  StaffController.createStaff,
);

export const StaffRoutes = router;
