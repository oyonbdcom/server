import express from 'express';
import { protect, restrictTo } from '../../../middlewares/authMiddleware';
import { zodValidate } from '../../../middlewares/zodValidation';
import { DeviceTokenController } from './controllers';
import { NotificationZodValidation } from './zodValidation';

const router = express.Router();

router.post(
  '/register',
  protect,
  restrictTo('CLINIC'),
  zodValidate(NotificationZodValidation.registerDeviceSchema),
  DeviceTokenController.createDeviceToken,
);

export const DeviceTokenRoutes = router;
