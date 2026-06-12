import { UserRole } from '@prisma/client';
import express from 'express';
import { protect, protectOptional, restrictTo } from '../../../middlewares/authMiddleware';
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
  restrictTo('ADMIN', UserRole.DIAGNOSTIC),
  DiagnosticController.getDiagnosticManagerStats,
);

router.get(
  '/area-diagnostics',
  protect,
  restrictTo(UserRole.AREA_MANAGER),
  DiagnosticController.getAllAreaDiagnostics,
);
router.get(
  '/area-diagnostics-name',
  protect,
  restrictTo(UserRole.AREA_MANAGER),
  DiagnosticController.getAllAreaDiagnosticsName,
);
router.get('/:identifier', protectOptional, DiagnosticController.getDiagnosticByIdentifier);

router.patch(
  '/:diagId',
  protect,
  restrictTo('ADMIN', UserRole.DIAGNOSTIC, UserRole.AREA_MANAGER),
  DiagnosticController.updateDiagnostic,
);

router.delete(
  '/:diagId',
  protect,
  restrictTo(UserRole.AREA_MANAGER, UserRole.ADMIN),
  DiagnosticController.deleteDiagnostic,
);

export const DiagnosticRoutes = router;
