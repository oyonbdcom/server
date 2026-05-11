import { UserRole } from '@prisma/client';
import express from 'express';
import { protect, restrictTo } from '../../../middlewares/authMiddleware';
import { zodValidate } from '../../../middlewares/zodValidation';
import { MembershipController } from './controllers';
import { ClinicMembershipZodValidation } from './zodValidation';

const router = express.Router();

// ১. আপনার তৈরি করা নতুন এন্ডপয়েন্ট (Get My Doctors)
router.get(
  '/my-doctors',
  protect,
  restrictTo(UserRole.DIAGNOSTIC_MANAGER),
  MembershipController.getMyDoctors, // আপনার কন্ট্রোলারের সেই নতুন মেথড
);

// ২. সাধারণ মেম্বারশিপ লিস্ট (যেখানে সব ডাটা থাকে)
router.get(
  '/',
  protect,
  restrictTo(UserRole.DIAGNOSTIC_MANAGER, UserRole.AREA_MANAGER),
  MembershipController.getClinicMemberships,
);

router.post(
  '/',
  protect,
  restrictTo(UserRole.AREA_MANAGER, UserRole.DIAGNOSTIC_MANAGER),
  zodValidate(ClinicMembershipZodValidation.createMembershipSchema),
  MembershipController.createMembership,
);

router.patch(
  '/:membershipId',
  protect,
  restrictTo(UserRole.DIAGNOSTIC_MANAGER, UserRole.AREA_MANAGER),
  MembershipController.updateMemberships,
);

router.delete(
  '/:membershipId',
  protect,
  restrictTo(UserRole.DIAGNOSTIC_MANAGER, UserRole.AREA_MANAGER),
  MembershipController.deleteMembership,
);

export const MembershipRoutes = router;
