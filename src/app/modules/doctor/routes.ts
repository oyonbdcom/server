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
  restrictTo('MANAGER'),
  DoctorController.createDoctor,
);

// add to area
router.post(
  '/add-to-area',
  protect,
  restrictTo(UserRole.MANAGER),
  DoctorController.addDoctorToArea,
);

//remove to area
router.post(
  '/remove-from-area',
  protect,
  restrictTo(UserRole.MANAGER, UserRole.CLINIC),
  DoctorController.removeDoctorFromArea,
);

router.get('/', protectOptional, DoctorController.getDoctors);

// router.get('/statistics', protect, restrictTo('ADMIN'), DoctorController.getDoctorStats);
router.get('/manager-all', protect, restrictTo(UserRole.MANAGER), DoctorController.getAllDoctorForManager);
router.get('/:id', DoctorController.getDoctorById);

router.patch(
  '/:doctorId',
  zodValidate(DoctorZodValidation.updateDoctorSchema),
  protect,
  restrictTo('ADMIN', 'MANAGER'),
  DoctorController.updateDoctor,
);
// soft inactive  user
// router.delete('/:userId', protect, restrictTo('ADMIN'), DoctorController.deleteDoctor);

export const DoctorRoutes = router;
