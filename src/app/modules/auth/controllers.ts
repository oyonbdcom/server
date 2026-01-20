// src/app/modules/auth/controllers/index.ts
import httpStatus from 'http-status';
import config from '../../../config/config';
import { catchAsync } from '../../../shared/catchAsync';
import { sendResponse } from '../../../shared/sendResponse';
import ApiError from '../../../utils/apiError';
import { IUserResponse } from '../user/interface';
import { AuthService } from './service';

// ==================== PUBLIC ROUTES ====================

const register = catchAsync(async (req, res) => {
  const userData = req.body;
  const result = await AuthService.register(userData);

  sendResponse<IUserResponse>(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'User registered successfully. Please check your email to verify your account.',
    data: result,
  });
});

const verifyEmail = catchAsync(async (req, res) => {
  const { token } = req.body;
  const result = await AuthService.verifyEmail(token);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Email verified successfully',
    data: result,
  });
});

const resendVerification = catchAsync(async (req, res) => {
  const { email } = req.body;
  const result = await AuthService.resendVerification(email);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Verification email sent successfully',
    data: result,
  });
});

const login = catchAsync(async (req, res) => {
  const result = await AuthService.login(req.body);

  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: config.env === 'production' ? 'none' : 'lax',
    maxAge: 365 * 24 * 60 * 60 * 1000,
    path: '/',
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User logged in successfully',
    data: {
      accessToken: result.accessToken,
      message: 'User logged in successfully',
      user: result.user,
    },
  });
});

const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;
  const result = await AuthService.forgotPassword(email);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Password reset instructions sent to your email',
    data: result,
  });
});

const resetPassword = catchAsync(async (req, res) => {
  const resetData = req.body;
  const result = await AuthService.resetPassword(resetData);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Password reset successful',
    data: result,
  });
});
const verifyOtp = catchAsync(async (req, res) => {
  const resetData = req.body;
  const result = await AuthService.verifyOtp(resetData);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Password reset successful',
    data: result,
  });
});

// ==================== PROTECTED ROUTES ====================

const refreshToken = catchAsync(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) throw new ApiError(httpStatus.UNAUTHORIZED, 'Refresh token is required');

  const result = await AuthService.refreshToken(refreshToken);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Access token refreshed successfully',
    data: { accessToken: result.accessToken },
  });
});

const logout = catchAsync(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) throw new ApiError(httpStatus.UNAUTHORIZED, 'Not authenticated');

  await AuthService.logout(userId);

  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: config.env === 'production' ? 'none' : 'lax',
    path: '/',
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Logged out successfully',
    data: null,
  });
});

const changePassword = catchAsync(async (req, res) => {
  const userId = req.user?.id;
  const { currentPassword, newPassword } = req.body;
  if (!userId) throw new ApiError(httpStatus.UNAUTHORIZED, 'Not authenticated');

  await AuthService.changePassword(userId, currentPassword, newPassword);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Password changed successfully',
    data: null,
  });
});

// ==================== EXPORT ====================

export const AuthController = {
  register,
  login,
  forgotPassword,
  resetPassword,
  refreshToken,
  verifyOtp,
  logout,
  changePassword,
  verifyEmail,
  resendVerification,
};
