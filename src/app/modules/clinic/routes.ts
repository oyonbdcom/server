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
  restrictTo('ADMIN', UserRole.AREA_MANAGER),
  zodValidate(ClinicZodValidation.createClinicSchema),
  ClinicController.createClinic,
);
router.post(
  '/staff',
  protect,
  restrictTo('ADMIN', UserRole.DIAGNOSTIC_MANAGER),
  // zodValidate(ClinicZodValidation.createClinicSchema),
  ClinicController.createStaff,
);

router.get('/', ClinicController.getClinics);
router.get(
  '/statistics',
  protect,
  restrictTo('ADMIN', UserRole.DIAGNOSTIC_MANAGER),
  ClinicController.getDiagnosticManagerStats,
);

router.get(
  '/my-clinics',
  protect,
  restrictTo(UserRole.AREA_MANAGER),
  ClinicController.getAllAreaClinics,
);
router.get('/single', protect, ClinicController.getSingleClinic);
router.get(
  '/area-clinics',
  protect,
  restrictTo(UserRole.AREA_MANAGER),
  ClinicController.getAllAreaClinics,
);
router.patch(
  '/:clinicId',
  protect,
  restrictTo('ADMIN', UserRole.DIAGNOSTIC_MANAGER, UserRole.AREA_MANAGER),
  ClinicController.updateClinic,
);

router.delete(
  '/:clinicId',
  protect,
  restrictTo(UserRole.AREA_MANAGER, UserRole.ADMIN),
  ClinicController.deleteClinic,
);

export const ClinicRoutes = router;
