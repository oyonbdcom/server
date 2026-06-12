import { UserRole } from '@prisma/client';
import express from 'express';
import { protect, restrictTo } from '../../../middlewares/authMiddleware';
import { zodValidate } from '../../../middlewares/zodValidation';
import { DoctorController } from './controllers';
import { DoctorZodValidation } from './zodValidation';

const router = express.Router();

// ==========================================
// 1. PUBLIC ROUTES (কোনো অথেন্টিকেশন লাগবে না)
// ==========================================
router.get('/', DoctorController.getAllDoctors);

// ==========================================
// 2. DOCTOR SPECIFIC AUTHENTICATED ROUTES
// ==========================================
router.get('/profile', protect, restrictTo(UserRole.DOCTOR), DoctorController.getDoctorById);

router.get(
  '/appointment-stats',
  protect,
  restrictTo('ADMIN', UserRole.DOCTOR),
  DoctorController.getDoctorAppointmentStats,
);

// ==========================================
// 3. AREA MANAGER & DIAGNOSTIC ROUTES
// ==========================================
router.post(
  '/',
  zodValidate(DoctorZodValidation.createDoctorSchema),
  protect,
  restrictTo(UserRole.AREA_MANAGER),
  DoctorController.createDoctor,
);

router.post(
  '/add-to-area',
  protect,
  restrictTo(UserRole.AREA_MANAGER),
  DoctorController.addDoctorToArea,
);
router.post(
  '/remove-from-area',
  protect,
  restrictTo(UserRole.AREA_MANAGER, UserRole.DIAGNOSTIC),
  DoctorController.removeDoctorFromArea,
);
router.get(
  '/area-doctors-name',
  protect,
  restrictTo(UserRole.AREA_MANAGER),
  DoctorController.getAreaManagerDoctorsName,
);
router.get(
  '/area-diagnostic',
  protect,
  restrictTo(UserRole.AREA_MANAGER, UserRole.DIAGNOSTIC, UserRole.STAFF),
  DoctorController.getAreaAndDiagnosticDoctors,
);
router.get(
  '/directory',
  protect,
  restrictTo(UserRole.AREA_MANAGER, UserRole.DIAGNOSTIC),
  DoctorController.getDoctorDirectory,
);
router.get(
  '/diagnostic-doctors-name',
  protect,
  restrictTo(UserRole.DIAGNOSTIC, UserRole.STAFF),
  DoctorController.getDiagnosticDoctorsName,
);
router.get('/:slug', DoctorController.getDoctorBySlug);
// ==========================================
// 4. UPDATE & DELETE (Sensitive Actions)
// ==========================================
router.patch(
  '/:doctorId',
  zodValidate(DoctorZodValidation.updateDoctorSchema),
  protect,
  restrictTo(UserRole.ADMIN, UserRole.AREA_MANAGER, UserRole.DOCTOR),
  DoctorController.updateDoctor,
);

router.delete(
  '/:userId',
  protect,
  restrictTo(UserRole.AREA_MANAGER),
  DoctorController.deleteDoctor,
);

export const DoctorRoutes = router;
