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
  restrictTo('CLINIC'),
  MembershipController.getMyDoctors, // আপনার কন্ট্রোলারের সেই নতুন মেথড
);

// ২. সাধারণ মেম্বারশিপ লিস্ট (যেখানে সব ডাটা থাকে)
router.get('/', protect, restrictTo('CLINIC'), MembershipController.getClinicMemberships);

router.post(
  '/',
  protect,
  restrictTo('CLINIC'),
  zodValidate(ClinicMembershipZodValidation.createClinicMembershipSchema),
  MembershipController.createMembership,
);

router.patch(
  '/:membershipId',
  protect,
  restrictTo('CLINIC'),
  MembershipController.updateMemberships,
);

router.delete(
  '/:membershipId',
  protect,
  restrictTo('CLINIC'),
  MembershipController.deleteMembership,
);

export const MembershipRoutes = router;
