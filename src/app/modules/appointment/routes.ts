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
  '/staff-apt-create',
  protect,
  restrictTo(UserRole.DIAGNOSTIC_MANAGER, UserRole.STAFF),
  // zodValidate(AppointmentZodValidation.CreateAppointmentSchema),
  AppointmentsController.createAppointmentByDiagnosticStaff,
);
router.get(
  '/manager-appointments',
  protect,
  restrictTo(UserRole.AREA_MANAGER),
  AppointmentsController.getManagerAreaAppointments,
);

// Admin routes
router.get(
  '/',
  protect,
  restrictTo(UserRole.DIAGNOSTIC_MANAGER, UserRole.ADMIN, UserRole.PATIENT, UserRole.AREA_MANAGER),
  AppointmentsController.getMyAppointments,
);
router.get('/export', protect, AppointmentsController.exportDoctorDailyPdf);
router.get(
  '/:aptId',
  protect,
  restrictTo(UserRole.DIAGNOSTIC_MANAGER, UserRole.ADMIN),
  AppointmentsController.getMyAppointments,
);
router.patch(
  '/:aptId',
  protect,
  restrictTo(UserRole.DIAGNOSTIC_MANAGER, UserRole.ADMIN, UserRole.AREA_MANAGER),
  zodValidate(AppointmentZodValidation.UpdateAppointmentSchema),
  AppointmentsController.updateAppointment,
);

export const AppointmentsRoutes = router;
