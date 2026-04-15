import { UserRole } from '@prisma/client';
import express from 'express';
import { protect, protectOptional, restrictTo } from '../../../middlewares/authMiddleware';
import { zodValidate } from '../../../middlewares/zodValidation';
import { AppointmentsController } from './controllers';
import { AppointmentZodValidation } from './zodValidation';

const router = express.Router();

// User routes

router.post(
  '/',
  protectOptional,
  zodValidate(AppointmentZodValidation.CreateAppointmentSchema),
  AppointmentsController.createAppointment,
);
router.post(
  '/admin',

  zodValidate(AppointmentZodValidation.CreateAppointmentSchema),
  AppointmentsController.createAppointmentForAdmin,
);
router.get(
  '/manager-appointments',
  protect,
  restrictTo(UserRole.MANAGER),
  AppointmentsController.getManagerAreaAppointments,
);

// Admin routes
router.get(
  '/',
  protect,
  restrictTo('CLINIC', 'ADMIN', 'PATIENT'),
  AppointmentsController.getMyAppointments,
);
router.get('/export', protect, AppointmentsController.exportDoctorDailyPdf);
router.get(
  '/:aptId',
  protect,
  restrictTo('ADMIN', 'CLINIC'),
  AppointmentsController.getMyAppointments,
);
router.patch(
  '/:aptId',
  protect,
  restrictTo('ADMIN', 'CLINIC', 'MANAGER'),
  zodValidate(AppointmentZodValidation.UpdateAppointmentSchema),
  AppointmentsController.updateAppointment,
);

export const AppointmentsRoutes = router;
