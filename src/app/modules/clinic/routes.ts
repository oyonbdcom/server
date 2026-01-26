import express from 'express';
import { protect, restrictTo } from '../../../middlewares/authMiddleware';
import { zodValidate } from '../../../middlewares/zodValidation';
import { ClinicController } from './controllers';
import { ClinicZodValidation } from './zodValidation';

const router = express.Router();

router.post(
  '/',
  protect,
  restrictTo('ADMIN'),
  zodValidate(ClinicZodValidation.createClinicSchema),
  ClinicController.createClinic,
);
router.get(
  '/dashboard-stats',
  protect,
  restrictTo('CLINIC'),
  ClinicController.getClinicDashboardStats,
);
router.get('/', ClinicController.getClinics);
router.get('/statistics', protect, restrictTo('ADMIN'), ClinicController.getClinicStats);

router.get('/:slug', ClinicController.getClinicById);
router.patch('/:userId', protect, restrictTo('ADMIN', 'CLINIC'), ClinicController.updateClinic);

router.delete('/:clinicId', protect, restrictTo('ADMIN'), ClinicController.deleteClinic);

export const ClinicRoutes = router;
