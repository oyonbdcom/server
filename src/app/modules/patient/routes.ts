import express from 'express';
import { protect, restrictTo } from '../../../middlewares/authMiddleware';
import { uploadSingle } from '../../../middlewares/fileMiddleware';
import { PatientController } from './controllers';

const router = express.Router();

/**
 * @route   GET /api/v1/patients/:id
 * @desc    Get single patient details (Flattened)
 * @access  Private (Admin, Doctor, or the Patient themselves)
 */
router.get(
  '/me',
  protect,
  // Doctors can view records, Admins manage all, Patients view their own
  restrictTo('ADMIN', 'DOCTOR', 'PATIENT'),
  PatientController.getPatientByUserId,
);

/**
 * @route   PATCH /api/v1/patients/:userId
 * @desc    Update patient profile or status
 * @access  Private (Admin or the Patient themselves)
 */
router.patch(
  '/:id',
  uploadSingle,
  protect,
  restrictTo('PATIENT', 'ADMIN'),
  // zodValidate(PatientZodValidation.updatePatientSchema),
  PatientController.updatePatient,
);

export const PatientRoutes = router;
