import express from 'express';
import { protect } from '../../../middlewares/authMiddleware';
import { authLimiter, otpLimiter } from '../../../middlewares/rateMiddleware';
import { zodValidate } from '../../../middlewares/zodValidation';
import { AuthController } from './controllers';
import { AuthValidation } from './zodValidation';

const routes = express.Router();

routes.post('/register', zodValidate(AuthValidation.registerSchema), AuthController.register);

routes.post('/login', authLimiter, zodValidate(AuthValidation.loginSchema), AuthController.login);

routes.post(
  '/send-otp',
  otpLimiter,
  zodValidate(AuthValidation.sendOtpSchema),
  AuthController.sendOtp,
);

// forget password verify with otp
routes.post(
  '/verify-otp',

  zodValidate(AuthValidation.verifyOtpSchema),
  AuthController.verifyOtpForExistingUser,
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
