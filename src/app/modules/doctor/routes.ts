import { UserRole } from '@prisma/client';
import express from 'express';
import { protect, protectOptional, restrictTo } from '../../../middlewares/authMiddleware';
import { zodValidate } from '../../../middlewares/zodValidation';
import { DoctorController } from './controllers';
import { DoctorZodValidation } from './zodValidation';

const router = express.Router();

router.post(
  '/',
  zodValidate(DoctorZodValidation.createDoctorSchema),
  protect,
  restrictTo(UserRole.AREA_MANAGER),
  DoctorController.createDoctor,
);

// add to area
router.post(
  '/add-to-area',
  protect,
  restrictTo(UserRole.AREA_MANAGER),
  DoctorController.addDoctorToArea,
);

//remove to area
router.post(
  '/remove-from-area',
  protect,
  restrictTo(UserRole.AREA_MANAGER, UserRole.DIAGNOSTIC_MANAGER),
  DoctorController.removeDoctorFromArea,
);

router.get('/', protectOptional, DoctorController.getDoctors);

// router.get('/statistics', protect, restrictTo('ADMIN'), DoctorController.getDoctorStats);
router.get(
  '/accessible-doctors',
  protect,
  restrictTo(UserRole.AREA_MANAGER, UserRole.DIAGNOSTIC_MANAGER),
  DoctorController.getAccessibleDoctors,
);
router.get('/:id', DoctorController.getDoctorById);

router.patch(
  '/:doctorId',
  zodValidate(DoctorZodValidation.updateDoctorSchema),
  protect,
  restrictTo(UserRole.ADMIN, UserRole.AREA_MANAGER),
  DoctorController.updateDoctor,
);
// soft inactive  user
router.delete(
  '/:userId',
  protect,
  restrictTo(UserRole?.AREA_MANAGER),
  DoctorController.deleteDoctor,
);

export const DoctorRoutes = router;
