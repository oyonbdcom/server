import express from 'express';
import { protect, restrictTo } from '../../../middlewares/authMiddleware';
import { zodValidate } from '../../../middlewares/zodValidation';
import { UserController } from './controllers';
import { UserZodValidation } from './zodValidation';

const router = express.Router();

// User routes
router.get('/me', protect, UserController.getCurrentUser);

// Admin routes
router.get('/', protect, restrictTo('ADMIN'), UserController.getUsers);
router.get('/:id', protect, restrictTo('ADMIN'), UserController.getUserById);
router.patch(
  '/:id/role',
  protect,
  restrictTo('ADMIN'),
  zodValidate(UserZodValidation.updateUserRoleSchema),
  UserController.updateUserRole,
);
router.delete('/:id', protect, restrictTo('ADMIN'), UserController.deleteUser);

export const UserRoutes = router;
