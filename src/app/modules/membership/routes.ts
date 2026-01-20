import express from 'express';
import { protect, restrictTo } from '../../../middlewares/authMiddleware';
import { zodValidate } from '../../../middlewares/zodValidation';
import { MembershipController } from './controllers';
import { ClinicMembershipZodValidation } from './zodValidation';

const router = express.Router();

router.post(
  '/',
  protect,
  restrictTo('CLINIC'),
  zodValidate(ClinicMembershipZodValidation.createClinicMembershipSchema),
  MembershipController.createMembership,
);
router.get('/', protect, restrictTo('CLINIC'), MembershipController.getClinicMemberships);
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
