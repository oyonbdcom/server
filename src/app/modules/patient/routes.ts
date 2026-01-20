import express from 'express';
import { protect, restrictTo } from '../../../middlewares/authMiddleware';
import { zodValidate } from '../../../middlewares/zodValidation';
import { PatientController } from './controllers';
import { PatientZodValidation } from './zodValidation';

const router = express.Router();

/**
 * @route   GET /api/v1/patients
 * @desc    Get all patients with filters & pagination
 * @access  Private (Admin Only)
 */
router.get('/', protect, restrictTo('ADMIN'), PatientController.getPatients);

router.get('/statistics', protect, restrictTo('ADMIN'), PatientController.getPatientStats);

/**
 * @route   GET /api/v1/patients/:id
 * @desc    Get single patient details (Flattened)
 * @access  Private (Admin, Doctor, or the Patient themselves)
 */
router.get(
  '/:id',
  protect,
  // Doctors can view records, Admins manage all, Patients view their own
  restrictTo('ADMIN', 'DOCTOR', 'PATIENT'),
  PatientController.getPatientById,
);

/**
 * @route   PATCH /api/v1/patients/:userId
 * @desc    Update patient profile or status
 * @access  Private (Admin or the Patient themselves)
 */
router.patch(
  '/:id',
  protect,
  restrictTo('PATIENT', 'ADMIN'),
  zodValidate(PatientZodValidation.updatePatientSchema),
  PatientController.updatePatient,
);

/**
 * @route   DELETE /api/v1/patients/:userId
 * @desc    Delete patient profile
 * @access  Private (Admin Only)
 */
router.delete('/:userId', protect, restrictTo('ADMIN'), PatientController.deletePatient);

export const PatientRoutes = router;
