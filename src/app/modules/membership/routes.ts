import { UserRole } from '@prisma/client';
import express from 'express';
import { protect, restrictTo } from '../../../middlewares/authMiddleware';
import { zodValidate } from '../../../middlewares/zodValidation';
import { MembershipController } from './controllers';
import { diagnosticMembershipZodValidation } from './zodValidation';

const router = express.Router();
router.post(
  '/',
  protect,
  restrictTo(UserRole.AREA_MANAGER, UserRole.DIAGNOSTIC),
  zodValidate(diagnosticMembershipZodValidation.createMembershipSchema),
  MembershipController.createMembership,
);

router.get(
  '/diagnostic-doctors',
  protect,
  restrictTo(UserRole.DIAGNOSTIC),
  MembershipController.getDiagnosticMemberDoctors,
);
router.get('/slug/:slug', MembershipController.getMembershipsBySlug);

router.patch(
  '/:membershipId',
  protect,
  restrictTo(UserRole.DIAGNOSTIC, UserRole.AREA_MANAGER),
  MembershipController.updateMemberships,
);

router.delete(
  '/:membershipId',
  protect,
  restrictTo(UserRole.DIAGNOSTIC, UserRole.AREA_MANAGER),
  MembershipController.deleteMembership,
);

export const MembershipRoutes = router;
