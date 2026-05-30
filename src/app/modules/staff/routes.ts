import { UserRole } from '@prisma/client';
import express from 'express';
import { protect, restrictTo } from '../../../middlewares/authMiddleware';
import { StaffController } from './controllers';

const router = express.Router();

// CREATE STAFF
router.post(
  '/',
  protect,
  restrictTo('ADMIN', UserRole.DIAGNOSTIC),
  // zodValidate(StaffZodValidation.createStaffSchema),
  StaffController.createStaff,
);
router.get('/', protect, restrictTo('ADMIN', UserRole.DIAGNOSTIC), StaffController.getAllStaff);
// UPDATE STAFF
router.patch(
  '/:id',
  protect,
  restrictTo('ADMIN', UserRole.DIAGNOSTIC),
  // zodValidate(StaffZodValidation.updateStaffSchema), // Optional: Add Zod validation here later
  StaffController.updateStaff,
);

// DELETE STAFF
router.delete(
  '/:id',
  protect,
  restrictTo('ADMIN', UserRole.DIAGNOSTIC),
  StaffController.deleteStaff,
);

export const StaffRoutes = router;
