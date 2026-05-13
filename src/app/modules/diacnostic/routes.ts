import { UserRole } from '@prisma/client';
import express from 'express';
import { protect, restrictTo } from '../../../middlewares/authMiddleware';
import { zodValidate } from '../../../middlewares/zodValidation';
import { DiagnosticController } from './controllers';
import { DiagnosticZodValidation } from './zodValidation';

const router = express.Router();

router.post(
  '/',
  protect,
  restrictTo(UserRole.AREA_MANAGER),
  zodValidate(DiagnosticZodValidation.createDiagnosticSchema),
  DiagnosticController.createDiagnostic,
);

router.get('/', DiagnosticController.getDiagnostics);
router.get(
  '/statistics',
  protect,
  restrictTo('ADMIN', UserRole.DIAGNOSTIC_MANAGER),
  DiagnosticController.getDiagnosticManagerStats,
);

router.get('/single', protect, DiagnosticController.getSingleDiagnostic);
router.get(
  '/area-diagnostic',
  protect,
  restrictTo(UserRole.AREA_MANAGER),
  DiagnosticController.getAllAreaDiagnostics,
);
router.patch(
  '/:digId',
  protect,
  restrictTo('ADMIN', UserRole.DIAGNOSTIC_MANAGER, UserRole.AREA_MANAGER),
  DiagnosticController.updateDiagnostic,
);

router.delete(
  '/:digId',
  protect,
  restrictTo(UserRole.AREA_MANAGER, UserRole.ADMIN),
  DiagnosticController.deleteDiagnostic,
);

export const DiagnosticRoutes = router;
