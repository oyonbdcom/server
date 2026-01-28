import express from 'express';
import { protect } from '../../../middlewares/authMiddleware';
import { zodValidate } from '../../../middlewares/zodValidation';
import { AuthController } from './controllers';
import { AuthValidation } from './zodValidation';

const routes = express.Router();

routes.post('/register', zodValidate(AuthValidation.registerSchema), AuthController.register);
routes.post('/verify-otp', zodValidate(AuthValidation.verifyOtpSchema), AuthController.verifyOtp);

routes.post('/login', zodValidate(AuthValidation.loginSchema), AuthController.login);

routes.post('/send-otp', zodValidate(AuthValidation.sendOtpSchema), AuthController.sendOtp);
routes.post(
  '/forgot-verify-otp',
  zodValidate(AuthValidation.verifyOtpSchema),
  AuthController.forgetVerifyOtp,
);
routes.post(
  '/reset-password',
  zodValidate(AuthValidation.resetPasswordSchema),
  AuthController.resetPassword,
);

/* =========================
   PROTECTED ROUTES
========================= */
routes.post('/refresh-token', AuthController.refreshToken);
routes.post('/logout', protect, AuthController.logout);
routes.post(
  '/change-password',
  protect,
  zodValidate(AuthValidation.changePasswordSchema),
  AuthController.changePassword,
);

export const AuthRoutes = routes;
