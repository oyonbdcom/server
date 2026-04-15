import express from 'express';
import { protect, restrictTo } from '../../../middlewares/authMiddleware';
import { zodValidate } from '../../../middlewares/zodValidation';
import { SetupController } from './controllers';
import { SetupZodValidation } from './zodValidation';

const router = express.Router();

// --- District Routes ---
router.post(
  '/districts',
  protect,
  restrictTo('ADMIN'),
  zodValidate(SetupZodValidation.districtSchema), // Fixed: used districtSchema instead of department
  SetupController.createDistrict,
);

router.get('/districts', SetupController.getAllDistricts);

router.patch(
  '/districts/:id',
  protect,
  restrictTo('ADMIN'),
  zodValidate(SetupZodValidation.districtSchema),
  SetupController.updateDistrict,
);

router.delete('/districts/:id', protect, restrictTo('ADMIN'), SetupController.deleteDistrict);

// --- Area Routes ---
router.post(
  '/areas',
  protect,
  restrictTo('ADMIN'),
  zodValidate(SetupZodValidation.areaSchema),
  SetupController.createArea,
);

router.get('/areas', SetupController.getAllAreas);

router.patch(
  '/areas/:id',
  protect,
  restrictTo('ADMIN'),
  zodValidate(SetupZodValidation.areaSchema),
  SetupController.updateArea,
);

router.delete('/areas/:id', protect, restrictTo('ADMIN'), SetupController.deleteArea);

// --- Department Routes ---
router.post(
  '/departments',
  protect,
  restrictTo('ADMIN'),
  zodValidate(SetupZodValidation.departmentSchema),
  SetupController.createDepartment,
);

router.get('/departments', SetupController.getAllDepartments);

router.patch(
  '/departments/:id',
  protect,
  restrictTo('ADMIN'),
  zodValidate(SetupZodValidation.departmentSchema),
  SetupController.updateDepartment,
);

router.delete('/departments/:id', protect, restrictTo('ADMIN'), SetupController.deleteDepartment);

export const SetupRoutes = router;
