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
  restrictTo(UserRole.DIAGNOSTIC, UserRole.STAFF),
  // zodValidate(AppointmentZodValidation.CreateAppointmentSchema),
  AppointmentsController.createAppointmentByDiagnosticStaff,
);
// router.get(
//   '/manager-appointments',
//   protect,
//   restrictTo(UserRole.AREA_MANAGER),
//   AppointmentsController.getManagerAreaAppointments,
// );

// ***************
//     doctor dashboard appointments
// ******************
router.get(
  '/doctor-dashboard',
  protect,
  restrictTo(UserRole.DOCTOR),
  AppointmentsController.getDoctorDashboardAppointments,
);
//
router.get(
  '/area-manager',
  protect,
  restrictTo(UserRole.AREA_MANAGER),
  AppointmentsController.getAreaManagerAppointments,
);
router.get(
  '/diagnostic-dashboard',
  protect,
  restrictTo(UserRole.DIAGNOSTIC),
  AppointmentsController.getDiagnosticAppointments,
);
// router.get(
//   '/diagnostic-dashboard',
//   protect,
//   restrictTo(
//     UserRole.DIAGNOSTIC,
//     UserRole.DOCTOR,
//     UserRole.ADMIN,
//     UserRole.PATIENT,
//     UserRole.AREA_MANAGER,
//     UserRole?.STAFF,
//   ),
//   AppointmentsController.getDiagnosticAppointments,
// );
router.get(
  '/patient-appointments',
  protect,
  restrictTo(UserRole?.PATIENT),
  AppointmentsController.getPatientAppointments,
);
router.get(
  '/coordinator-dashboard',
  protect,
  restrictTo(UserRole.STAFF, UserRole.ADMIN),
  AppointmentsController.getCoordinatorDashboard,
);
router.get(
  '/receptionist',
  protect,
  restrictTo(UserRole.STAFF, UserRole.ADMIN),
  AppointmentsController.getReceptionistAppointments,
);
// ======================================================
// ROUTE
// ======================================================
router.patch(
  '/update-doctor-session',
  protect,
  restrictTo(UserRole?.STAFF),

  AppointmentsController.updateDoctorSession,
);
router.patch(
  '/:id/request-emergency',
  protect,
  restrictTo(UserRole.PATIENT, UserRole.STAFF),
  AppointmentsController.requestEmergency,
);

router.patch(
  '/:id/reject-emergency',
  protect,
  restrictTo(UserRole.PATIENT, UserRole.STAFF),
  AppointmentsController.rejectEmergency,
);

router.patch(
  '/:id/complete',
  protect,
  restrictTo(UserRole.PATIENT, UserRole.STAFF, UserRole.AREA_MANAGER),
  AppointmentsController.completeAppointment,
);
router.patch(
  '/:id/accept-emergency',
  protect,
  restrictTo(UserRole.AREA_MANAGER, UserRole?.STAFF),
  AppointmentsController.acceptEmergency,
);
router.patch(
  '/:aptId',
  protect,
  restrictTo(UserRole.DIAGNOSTIC, UserRole.ADMIN, UserRole.AREA_MANAGER, UserRole?.STAFF),
  zodValidate(AppointmentZodValidation.UpdateAppointmentSchema),
  AppointmentsController.updateAppointment,
);

export const AppointmentsRoutes = router;
