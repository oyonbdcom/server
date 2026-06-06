// src/app/modules/auth/controllers/index.ts
import httpStatus from 'http-status';
import config from '../../../config/config';
import { catchAsync } from '../../../shared/catchAsync';
import { sendResponse } from '../../../shared/sendResponse';
import ApiError from '../../../utils/apiError';
import { AuthService } from './service';

// ==================== PUBLIC ROUTES ====================

const register = catchAsync(async (req, res) => {
  const userData = req.body;
  const result = await AuthService.register(userData);
  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',

    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'User registered successfully. Please check your email to verify your account.',
    data: result,
  });
});

const login = catchAsync(async (req, res) => {
  const result = await AuthService.login(req.body);

  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User logged in successfully',
    data: {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    },
  });
});

const sendOtp = catchAsync(async (req, res) => {
  const { phoneNumber } = req.body;

  const result = await AuthService.sendOtp(phoneNumber);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Password reset instructions sent to your email',
    data: result,
  });
});
const verifyOtpForExistingUser = catchAsync(async (req, res) => {
  const payload = req.body;
  const result = await AuthService.verifyOtpForExistingUser(payload);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Password reset successful',
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
  const { oldPassword, newPassword } = req.body;

  if (!userId) throw new ApiError(httpStatus.UNAUTHORIZED, 'Not authenticated');

  // ১. পাসওয়ার্ড পরিবর্তন (AuthService এ refreshToken: null করা নিশ্চিত করুন)
  await AuthService.changePassword(userId, oldPassword, newPassword);

  // ২. কুকি ক্লিয়ার করা (যাতে আগের সেশনটি ব্রাউজার থেকে মুছে যায়)
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: config.env === 'production' ? 'none' : 'lax',
    path: '/',
  });

  // ৩. রেসপন্স পাঠানো
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'পাসওয়ার্ড সফলভাবে পরিবর্তিত হয়েছে। নিরাপত্তা নিশ্চিত করতে পুনরায় লগইন করুন।',
    data: null,
  });
});
// ==================== EXPORT ====================

export const AuthController = {
  register,
  login,
  sendOtp,
  verifyOtpForExistingUser,
  resetPassword,
  refreshToken,
  logout,
  changePassword,
};
