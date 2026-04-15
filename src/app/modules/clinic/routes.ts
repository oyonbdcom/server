import { UserRole } from '@prisma/client';
import express from 'express';
import { protect, restrictTo } from '../../../middlewares/authMiddleware';
import { zodValidate } from '../../../middlewares/zodValidation';
import { ClinicController } from './controllers';
import { ClinicZodValidation } from './zodValidation';

const router = express.Router();

router.post(
  '/',
  protect,
  restrictTo('ADMIN', 'MANAGER'),
  zodValidate(ClinicZodValidation.createClinicSchema),
  ClinicController.createClinic,
);

router.get('/', ClinicController.getClinics);
router.get('/statistics', protect, restrictTo('ADMIN'), ClinicController.getClinicStats);

router.get(
  '/my-clinics',
  protect,
  restrictTo(UserRole.MANAGER),
  ClinicController.getClinicsForManager,
);
router.get(
  '/manager-all',
  protect,
  restrictTo(UserRole.MANAGER),
  ClinicController.getAllClinicsForManager,
);
// router.get('/:slug', ClinicController.getClinicById);
router.patch(
  '/:clinicId',
  protect,
  restrictTo('ADMIN', 'CLINIC', 'MANAGER'),
  ClinicController.updateClinic,
);

router.delete(
  '/:clinicId',
  protect,
  restrictTo(UserRole.MANAGER, UserRole.ADMIN),
  ClinicController.deleteClinic,
);

export const ClinicRoutes = router;
