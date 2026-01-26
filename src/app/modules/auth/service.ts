// src/app/modules/auth/service.ts
import bcrypt from 'bcrypt';
import httpStatus from 'http-status';
import { JwtPayload, Secret } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

import { UserRole } from '@prisma/client';
import config from '../../../config/config';
import { EmailService, sendVerificationEmail } from '../../../helper/email/send-email';
import { emailTemplates } from '../../../helper/email/templete';
import { jwtTokenHelper } from '../../../helper/jwtHelper';
import prisma from '../../../prisma/client';
import ApiError from '../../../utils/apiError';
import { createSlug } from '../../../utils/createSlug';
import { USER_SELECT } from '../user/constant';
import { IUserResponse } from '../user/interface';
import { CreateUserInput } from '../user/zodValidation';
import { ILoginResponse } from './interface';
import { LoginRequest, ResetPasswordRequest, VerifyOtpRequest } from './zodValidation';

// ---------------------- CONSTANTS ----------------------
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

// ---------------------- HELPERS ----------------------
const generateTokens = (user: IUserResponse) => {
  const payload = { userId: user.id, email: user.email, role: user.role };
  return {
    accessToken: jwtTokenHelper.accessToken(payload),
    refreshToken: jwtTokenHelper.refreshToken(payload),
  };
};

// ---------------------- AUTH SERVICES ----------------------
// ............. register , verify email or resend verification email .................
const register = async (data: CreateUserInput): Promise<IUserResponse> => {
  const { email, password, name, role } = data;

  // ১. ইউজার চেক
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerified: true, name: true },
  });

  if (existingUser?.emailVerified) {
    throw new ApiError(httpStatus.CONFLICT, 'এই ইমেইলটি ইতিমধ্যে নিবন্ধিত এবং ভেরিফাইড।');
  }

  const emailVerifiedToken = uuidv4();
  const emailVerifiedTokenExpires = new Date(Date.now() + 12 * 60 * 60 * 1000);

  // ২. আন-ভেরিফাইড ইউজার আপডেট
  if (existingUser && !existingUser.emailVerified) {
    const updatedUser = await prisma.user.update({
      where: { email },
      data: {
        emailVerifiedToken,
        emailVerifiedTokenExpires,
        name: name ?? existingUser.name,
      },
      select: USER_SELECT,
    });
    // await sendVerificationEmail(newUser.email, newUser.name, emailVerifiedToken);

    return updatedUser;
  }

  // ৩. পাসওয়ার্ড ভ্যালিডেশন ও হ্যাশিং
  if (!PASSWORD_REGEX.test(password)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'পাসওয়ার্ডের ফরম্যাট সঠিক নয়।');
  }
  const hashedPassword = await bcrypt.hash(password, 12);

  // ৪. ট্রানজেকশন: ইউজার + প্রোফাইল (স্ল্যাগ সহ)
  const newUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name ?? '',
        emailVerifiedToken,
        emailVerifiedTokenExpires,
        role: (role as UserRole) || 'PATIENT',
      },
      select: USER_SELECT,
    });

    // স্ল্যাগ জেনারেশন (নাম থেকে)
    const slug = createSlug(user.name);

    // রোল অনুযায়ী প্রোফাইল তৈরি
    switch (user.role) {
      case 'CLINIC':
        await tx.clinic.create({
          data: {
            userId: user.id,
            slug: slug,
          },
        });
        break;
      case 'DOCTOR':
        await tx.doctor.create({
          data: {
            userId: user.id,
            department: 'General',
            slug: slug,
          },
        });
        break;
      case 'PATIENT':
        await tx.patient.create({ data: { userId: user.id, slug: slug } });
        break;
    }

    return user;
  });

  // ৫. ভেরিফিকেশন ইমেইল পাঠানো
  await sendVerificationEmail(newUser.email, newUser.name, emailVerifiedToken);

  return newUser;
};
const verifyEmail = async (token: string) => {
  const user = await prisma.user.findFirst({
    where: {
      emailVerifiedToken: token,
      emailVerifiedTokenExpires: { gt: new Date() },
    },
  });

  if (!user) throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid or expired verification token');

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, emailVerifiedToken: null, emailVerifiedTokenExpires: null },
  });

  return { message: 'Email verified successfully' };
};

const resendVerification = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email }, select: USER_SELECT });
  if (!user) throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  if (user && user.emailVerified) {
    throw new ApiError(httpStatus.CONFLICT, 'Email already registered and verified. Please login.');
  }

  const emailVerifiedToken = uuidv4();
  const emailVerifiedTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedToken, emailVerifiedTokenExpires },
  });
  // email
  // const link = `${config.origin}/verify-email?token=${emailVerifiedToken}`;
  // const template = emailTemplates.verifyEmail(user.name, link);
  // await EmailService.sendEmail(user.email, template.subject, template.html, template.text);

  return { message: 'Verification email sent successfully' };
};

// AuthService.login
const login = async (payload: LoginRequest): Promise<ILoginResponse> => {
  const { email, password } = payload;

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      image: true,
      password: true,
      emailVerified: true,
      deactivate: true,
      refreshToken: true,
      lastLoginAt: true,
    },
  });

  if (!user || !(await bcrypt.compare(password, user.password!))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Incorrect  email or password!');
  }

  if (user.deactivate) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Your account is inactive .Please contact support');
  }
  // if (!user.emailVerified) {
  //   const emailVerifiedToken = uuidv4();
  //   const emailVerifiedTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  //   await prisma.user.update({
  //     where: { id: user.id },
  //     data: { emailVerifiedToken, emailVerifiedTokenExpires },
  //   });

  //   const link = `${config.origin}/verify-email?token=${emailVerifiedToken}`;
  //   const template = emailTemplates.verifyEmail(user.name, link);
  //   await EmailService.sendEmail(user.email, template.subject, template.html, template.text);
  //   throw new ApiError(
  //     httpStatus.FORBIDDEN,
  //     'Your email address is not verified. Please check your email to activate your account.',
  //   );
  // }

  const tokens = generateTokens(user);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: tokens.refreshToken, lastLoginAt: new Date() },
  });

  return {
    accessToken: tokens?.accessToken,
    refreshToken: tokens?.refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
};

const forgotPassword = async (email: string): Promise<any> => {
  const user = await prisma.user.findUnique({ where: { email } });

  // Security Tip: In production, you might want to return success
  // even if the user doesn't exist to prevent "email harvesting."
  if (!user) throw new ApiError(httpStatus.NOT_FOUND, 'This account does not exist');

  // 1. Generate 6-digit numeric OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // 2. Set shorter expiration (e.g., 10 minutes)
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

  // 3. Update User with OTP fields
  await prisma.user.update({
    where: { id: user.id },
    data: {
      otp: otp,
      otpExpires: otpExpires,
    },
  });

  // 4. Send Email with the Code
  const template = emailTemplates.passwordResetOtp(user.name, otp);
  await EmailService.sendEmail(user.email, template.subject, template.html, template.text);

  return { message: '6-digit OTP sent to your email' };
};

const verifyOtp = async (payload: VerifyOtpRequest): Promise<any> => {
  const user = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (!user.otp || user.otp !== payload.otp) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid OTP code');
  }

  const currentTime = new Date();
  if (user.otpExpires && currentTime > user.otpExpires) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'OTP has expired');
  }

  return {
    success: true,
    message: 'OTP verified successfully',
  };
};

const resetPassword = async (payload: ResetPasswordRequest): Promise<any> => {
  const user = await prisma.user.findUnique({ where: { email: payload.email } });

  if (!user || user.otp !== payload.otp) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid or expired OTP');
  }

  // Hash the new password
  const hashedPassword = await bcrypt.hash(payload.newPassword, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      otp: null,
      otpExpires: null,
    },
  });

  return { message: 'Password reset successful' };
};

//
const refreshToken = async (token: string) => {
  let verifiedToken: JwtPayload;
  try {
    verifiedToken = jwtTokenHelper.verifyToken(
      token,
      config.jwt.refresh_secret as Secret,
    ) as JwtPayload;
  } catch {
    throw new ApiError(httpStatus.FORBIDDEN, 'Invalid or expired refresh token');
  }

  const userId = verifiedToken.userId;
  if (!userId) throw new ApiError(httpStatus.FORBIDDEN, 'Invalid token payload');

  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user || user.refreshToken !== token)
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Refresh token mismatch or user not found');

  const tokens = generateTokens(user);

  return tokens;
};

const logout = async (userId: string) => {
  await prisma.user.update({ where: { id: userId }, data: { refreshToken: null } });
  return { success: true };
};

const changePassword = async (userId: string, currentPassword: string, newPassword: string) => {
  if (!PASSWORD_REGEX.test(newPassword)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'New password must be at least 8 characters long and include uppercase, lowercase, a number, and a special character',
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { password: true } });
  if (!user) throw new ApiError(httpStatus.NOT_FOUND, 'User not found');

  const isPasswordCorrect = await bcrypt.compare(currentPassword, user.password!);
  if (!isPasswordCorrect)
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Current password is incorrect');

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword, refreshToken: null },
  });

  // Optional: send email notification for password change
  return { message: 'Password changed successfully' };
};

export const AuthService = {
  login,
  register,
  forgotPassword,
  resetPassword,
  refreshToken,
  verifyOtp,
  logout,
  changePassword,
  verifyEmail,
  resendVerification,
};
