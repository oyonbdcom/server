import express from 'express';
import { protect } from '../../../middlewares/authMiddleware';
import { zodValidate } from '../../../middlewares/zodValidation';
import { AuthController } from './controllers';
import { AuthValidation } from './zodValidation';

const routes = express.Router();

routes.post('/register', zodValidate(AuthValidation.registerSchema), AuthController.register);
routes.post(
  '/verify-email',
  zodValidate(AuthValidation.verifyEmailSchema),
  AuthController.verifyEmail,
);
routes.post(
  '/resend-verification',
  zodValidate(AuthValidation.resendVerificationSchema),
  AuthController.resendVerification,
);
routes.post('/login', zodValidate(AuthValidation.loginSchema), AuthController.login);

routes.post(
  '/forgot-password',
  zodValidate(AuthValidation.forgotPasswordSchema),
  AuthController.forgotPassword,
);
routes.post(
  '/reset-password',
  zodValidate(AuthValidation.resetPasswordSchema),
  AuthController.resetPassword,
);
routes.post('/verify-otp', zodValidate(AuthValidation.verifyOtpSchema), AuthController.verifyOtp);

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
