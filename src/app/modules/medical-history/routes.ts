import express from 'express';
import { protect, restrictTo } from '../../../middlewares/authMiddleware';
import { zodValidate } from '../../../middlewares/zodValidation';
import { MedicalHistoryController } from './controllers';
import { MedicalHistoryZodValidation } from './zodValidation';

const router = express.Router();

router.post(
  '/',
  protect,
  restrictTo('PATIENT'),
  zodValidate(MedicalHistoryZodValidation.createMedicalHistorySchema),
  MedicalHistoryController.addMedicalHistory,
);
// router.get('/', protect, restrictTo('PATIENT'), MedicalHistoryController.getUserMedicalHistories);
// router.patch(
//   '/:historyId',
//   protect,
//   restrictTo('PATIENT'),
//   zodValidate(MedicalHistoryZodValidation.updateMedicalHistorySchema),
//   MedicalHistoryController.updateMedicalHistory,
// );
// router.delete(
//   '/:historyId',
//   protect,
//   restrictTo('PATIENT'),
//   MedicalHistoryController.removeMedicalHistory,
// );

export const MedicalHistoryRoutes = router;
