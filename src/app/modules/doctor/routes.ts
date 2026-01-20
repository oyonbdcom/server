import express from 'express';
import { protect, restrictTo } from '../../../middlewares/authMiddleware';
import { zodValidate } from '../../../middlewares/zodValidation';
import { DoctorController } from './controllers';
import { DoctorZodValidation } from './zodValidation';

const router = express.Router();

router.post(
  '/',
  zodValidate(DoctorZodValidation.createDoctorSchema),
  protect,
  restrictTo('ADMIN'),
  DoctorController.createDoctor,
);
router.get('/', DoctorController.getDoctors);

router.get('/statistics', protect, restrictTo('ADMIN'), DoctorController.getDoctorStats);
router.get('/:id', DoctorController.getDoctorById);

router.patch(
  '/:userId',
  zodValidate(DoctorZodValidation.updateDoctorSchema),
  protect,
  restrictTo('ADMIN', 'DOCTOR'),
  DoctorController.updateDoctor,
);
// soft inactive  user
router.delete('/:userId', protect, restrictTo('ADMIN'), DoctorController.deleteDoctor);

export const DoctorRoutes = router;
