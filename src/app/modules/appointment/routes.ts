import express from 'express';
import { protect, restrictTo } from '../../../middlewares/authMiddleware';
import { zodValidate } from '../../../middlewares/zodValidation';
import { AppointmentsController } from './controllers';
import { AppointmentZodValidation } from './zodValidation';

const router = express.Router();

// User routes
router.post('/send-otp', AppointmentsController.sendBookingOtp);

router.post(
  '/',

  zodValidate(AppointmentZodValidation.CreateAppointmentSchema),
  AppointmentsController.createAppointmentGuest,
);
router.post(
  '/logged',
  protect,
  zodValidate(AppointmentZodValidation.CreateAppointmentSchema),
  AppointmentsController.createAppointmentForRegisteredUser,
);

// Admin routes
router.get('/', protect, AppointmentsController.getMyAppointments);
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
