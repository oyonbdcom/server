import express from 'express';
import { protect, protectOptional, restrictTo } from '../../../middlewares/authMiddleware';
import { otpLimiter } from '../../../middlewares/rateMiddleware';
import { zodValidate } from '../../../middlewares/zodValidation';
import { AppointmentsController } from './controllers';
import { AppointmentZodValidation } from './zodValidation';

const router = express.Router();

// User routes
router.post('/send-otp', otpLimiter, AppointmentsController.sendBookingOtp);

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
router.post(
  '/logged',
  protect,
  zodValidate(AppointmentZodValidation.CreateAppointmentSchema),
  AppointmentsController.createAppointmentForRegisteredUser,
);

// Admin routes
router.get('/', protect, restrictTo('CLINIC', 'PATIENT'), AppointmentsController.getMyAppointments);
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
  restrictTo('ADMIN', 'CLINIC'),
  zodValidate(AppointmentZodValidation.UpdateAppointmentSchema),
  AppointmentsController.updateAppointment,
);

export const AppointmentsRoutes = router;
