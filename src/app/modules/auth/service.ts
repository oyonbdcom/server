// src/app/modules/auth/service.ts
import bcrypt from 'bcrypt';
import httpStatus from 'http-status';
import { JwtPayload, Secret } from 'jsonwebtoken';

import { UserRole } from '@prisma/client';
import config from '../../../config/config';
import { jwtTokenHelper } from '../../../helper/jwtHelper';
import prisma from '../../../prisma/client';
import ApiError from '../../../utils/apiError';
import { generatePatientId } from '../../../utils/common';
import { USER_SELECT } from '../user/constant';
import { IUserResponse } from '../user/interface';
import { ILoginResponse } from './interface';
import { RegisterRequest, ResetPasswordRequest } from './zodValidation';

// ---------------------- CONSTANTS ----------------------
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

// ---------------------- HELPERS ----------------------
const generateTokens = (user: IUserResponse) => {
  const payload = { userId: user.id, phoneNumber: user.phoneNumber, role: user.role };
  return {
    accessToken: jwtTokenHelper.accessToken(payload),
    refreshToken: jwtTokenHelper.refreshToken(payload),
  };
};

// ---------------------- AUTH SERVICES ----------------------
// ............. register , verify email or resend verification email .................
const register = async (data: RegisterRequest & { otp: string }): Promise<ILoginResponse> => {
  const { phoneNumber, password, name, role, otp } = data;

  // ================= OTP VERIFY =================
  const otpRecord = await prisma.otp.findUnique({
    where: { phoneNumber },
  });

  if (!otpRecord || otpRecord.otp !== otp) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'ভুল ওটিপি কোড।');
  }

  if (new Date() > otpRecord.otpExpires) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'ওটিপি কোডটির মেয়াদ শেষ হয়ে গেছে।');
  }

  // ================= EXISTING USER CHECK =================
  const existingUser = await prisma.user.findUnique({
    where: { phoneNumber },
  });

  if (existingUser) {
    throw new ApiError(httpStatus.CONFLICT, 'এই নম্বর দিয়ে ইতোমধ্যে অ্যাকাউন্ট তৈরি করা হয়েছে।');
  }

  // ================= HASH PASSWORD =================
  const hashedPassword = await bcrypt.hash(password, 12);

  // ================= TRANSACTION =================
  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        phoneNumber,
        password: hashedPassword,
        name: name ?? '',
        role: (role as UserRole) || 'PATIENT',

        isPhoneVerified: true,
      },

      select: USER_SELECT,
    });
    const newPatientId = await generatePatientId(tx);
    // ================= DEFAULT SELF PATIENT =================
    await tx.patient.create({
      data: {
        userId: newUser.id,
        patientId: newPatientId,
      },
    });

    // ================= DELETE OTP =================
    await tx.otp.delete({
      where: { phoneNumber },
    });

    return newUser;
  });

  // ================= AUTO LOGIN =================
  const tokens = generateTokens(user);

  // ================= SAVE REFRESH TOKEN =================
  await prisma.user.update({
    where: {
      id: user.id,
    },

    data: {
      refreshToken: tokens.refreshToken,
    },
  });

  // ================= RESPONSE =================
  return {
    accessToken: tokens.accessToken,

    refreshToken: tokens.refreshToken,

    user: {
      id: user.id,

      name: user.name,

      phoneNumber: user.phoneNumber,

      role: user.role,

      image: user.image,
    },
  };
};
// otp verify
const verifyOtpForExistingUser = async (payload: {
  phoneNumber: string;
  otp: string;
}): Promise<any> => {
  const { phoneNumber, otp } = payload;

  // ১. ইউজার ডাটাবেজে আছে কিনা নিশ্চিত করুন (যেহেতু বুকিং বা পাসওয়ার্ড রিসেট হচ্ছে)
  const user = await prisma.user.findUnique({
    where: { phoneNumber },
    select: { id: true, isPhoneVerified: true },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'এই ফোন নম্বরে কোনো অ্যাকাউন্ট খুঁজে পাওয়া যায়নি।');
  }

  // ২. Otp টেবিল থেকে রেকর্ডটি খুঁজে বের করা
  const otpRecord = await prisma.otp.findUnique({
    where: { phoneNumber },
  });

  // ৩. ওটিপি ম্যাচিং এবং এক্সপায়ারি চেক
  if (!otpRecord || otpRecord.otp !== otp) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'আপনার দেওয়া ওটিপি (OTP) কোডটি সঠিক নয়।');
  }

  if (new Date() > otpRecord.otpExpires) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'ওটিপি-র মেয়াদ শেষ হয়ে গেছে।');
  }

  // ৪. সাকসেস হলে বুকিং বা পাসওয়ার্ড রিসেটের অনুমতি দেওয়া
  // আপনি চাইলে এখানেই ইউজারের ফোন ভেরিফাইড হিসেবে আপডেট করতে পারেন
  await prisma.user.update({
    where: { phoneNumber },
    data: { isPhoneVerified: true },
  });

  // ৫. কাজ শেষ হলে ওটিপি মুছে ফেলা (যাতে একই ওটিপি ২বার ব্যবহার না হয়)
  await prisma.otp.delete({
    where: { phoneNumber },
  });

  return {
    success: true,
    message: 'ওটিপি সফলভাবে যাচাই করা হয়েছে।',
    userId: user.id, // বুকিং বা পরবর্তী ধাপের জন্য আইডি রিটার্ন করা ভালো
  };
};

// AuthService.login
const login = async (payload: {
  phoneNumber: string;
  password: string;
}): Promise<ILoginResponse> => {
  const { phoneNumber, password } = payload;

  // ১. ইউজার খুঁজে বের করা (ফোন নম্বর দিয়ে)
  const user = await prisma.user.findUnique({
    where: { phoneNumber },
    select: {
      id: true,
      phoneNumber: true,
      name: true,
      role: true,
      image: true,
      password: true,
      isPhoneVerified: true, // ফোন ভেরিফিকেশন চেক করার জন্য
      deactivate: true,
    },
  });

  // ২. ইউজার এবং পাসওয়ার্ড চেক
  if (!user || !(await bcrypt.compare(password, user.password!))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'ফোন নম্বর অথবা পাসওয়ার্ড সঠিক নয়!');
  }

  // ৩. অ্যাকাউন্ট ডি-অ্যাক্টিভেট কি না চেক
  if (user.deactivate) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'আপনার অ্যাকাউন্টটি বর্তমানে বন্ধ আছে। অনুগ্রহ করে সাপোর্টে যোগাযোগ করুন।',
    );
  }

  // ৪. ফোন ভেরিফিকেশন চেক (যদি ভেরিফাইড না থাকে তবে লগইন করতে দিবে না)
  // if (!user.isPhoneVerified) {
  //   // এখানে আপনি চাইলে নতুন একটি ওটিপি জেনারেট করে SMS পাঠিয়ে দিতে পারেন
  //   // throw new ApiError(httpStatus.FORBIDDEN, 'আপনার মোবাইল নম্বরটি এখনো ভেরিফাই করা হয়নি। অনুগ্রহ করে ওটিপি দিয়ে ভেরিফাই করুন।');

  //   // নোট: ফ্রন্টএন্ড এই এরর দেখে ইউজারকে ওটিপি পেজে পাঠিয়ে দিবে
  //   throw new ApiError(httpStatus.UNAUTHORIZED, 'ভেরিফাই করা হয়নি');
  // }

  // ৫. টোকেন জেনারেশন
  const tokens = generateTokens(user);

  // ৬. ডাটাবেজ আপডেট (রিফ্রেশ টোকেন এবং লগইন টাইম)
  await prisma.user.update({
    where: { id: user.id },
    data: {
      refreshToken: tokens.refreshToken,
    },
  });

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: {
      id: user.id,
      name: user.name,
      phoneNumber: user.phoneNumber,
      role: user.role,
      image: user.image,
    },
  };
};

// send otp
const sendOtp = async (phoneNumber: string): Promise<any> => {
  const existingOtp = await prisma.otp.findUnique({ where: { phoneNumber } });
  if (existingOtp && Date.now() - new Date(existingOtp.updatedAt).getTime() < 60000) {
    throw new ApiError(
      httpStatus.TOO_MANY_REQUESTS,
      'দয়া করে ১ মিনিট অপেক্ষা করে আবার চেষ্টা করুন।',
    );
  }
  // ১. ৬ ডিজিটের ওটিপি জেনারেশন
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // ৫ মিনিট মেয়াদ

  await prisma.otp.upsert({
    where: { phoneNumber },
    update: {
      otp: otp,
      otpExpires: otpExpires,
    },
    create: {
      phoneNumber,
      otp,
      otpExpires,
    },
  });

  // ৩. SMS সার্ভিস কল করা
  // const message = `আপনার ভেরিফিকেশন কোডটি হলো: ${otp}. এটি ৫ মিনিটের জন্য কার্যকর।`;
  // const smsResponse = await sendSMS(phoneNumber, message);

  // if (!smsResponse.success) {
  //   // যদি SMS পাঠানো ব্যর্থ হয়
  //   throw new ApiError(
  //     httpStatus.INTERNAL_SERVER_ERROR,
  //     'SMS পাঠাতে সমস্যা হয়েছে, আবার চেষ্টা করুন।',
  //   );
  // }

  return {
    success: true,
    message: 'আপনার মোবাইল নম্বরে ৬ ডিজিটের ওটিপি পাঠানো হয়েছে।',
  };
};

const resetPassword = async (payload: ResetPasswordRequest): Promise<any> => {
  const { phoneNumber, otp, newPassword } = payload;

  // ১. ইউজার খুঁজে বের করা (পাসওয়ার্ড রিসেট করতে হলে ইউজার থাকতে হবে)
  const user = await prisma.user.findUnique({
    where: { phoneNumber },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'এই ফোন নম্বরে কোনো অ্যাকাউন্ট পাওয়া যায়নি।');
  }

  // ৩. নতুন পাসওয়ার্ড হ্যাশ করা
  const hashedPassword = await bcrypt.hash(newPassword, 12);

  // ৪. ট্রানজেকশন (ইউজার পাসওয়ার্ড আপডেট এবং ওটিপি টেবিল থেকে ডাটা ডিলিট)
  await prisma.$transaction(async (tx) => {
    // পাসওয়ার্ড আপডেট
    await tx.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
      },
    });
  });

  return {
    success: true,
    message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে। এখন লগইন করুন।',
  };
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
const changePassword = async (userId: string, oldPassword: string, newPassword: string) => {
  // ১. নতুন পাসওয়ার্ড ভ্যালিডেশন
  if (!PASSWORD_REGEX.test(newPassword)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'পাসওয়ার্ড অন্তত ৮ অক্ষরের হতে হবে এবং বড় হাতের অক্ষর, ছোট হাতের অক্ষর, সংখ্যা ও স্পেশাল ক্যারেক্টার থাকতে হবে',
    );
  }

  // ২. ইউজার খুঁজে বের করা (অবশ্যই password ফিল্ডটি সিলেক্ট করতে হবে)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  });

  if (!user || !user.password) {
    throw new ApiError(httpStatus.NOT_FOUND, 'ইউজার বা পাসওয়ার্ড খুঁজে পাওয়া যায়নি');
  }

  // ৩. ইনপুট চেক (নিশ্চিত করা যে currentPassword খালি নয়)
  if (!oldPassword) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'বর্তমান পাসওয়ার্ডটি প্রদান করুন');
  }

  // ৪. পাসওয়ার্ড কম্পেয়ার (এখানেই আপনার এররটি হচ্ছিল)
  const isPasswordCorrect = await bcrypt.compare(oldPassword, user.password);

  if (!isPasswordCorrect) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'বর্তমান পাসওয়ার্ডটি সঠিক নয়');
  }

  // ৫. নতুন পাসওয়ার্ড হ্যাশ এবং আপডেট
  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
      refreshToken: null,
      isDefaultPassword: false, // ডিফল্ট পাসওয়ার্ড ফ্ল্যাগ বন্ধ করে দিন
    },
  });

  return { message: 'Password changed successfully' };
};

export const AuthService = {
  login,
  register,
  sendOtp,
  resetPassword,
  refreshToken,
  logout,
  verifyOtpForExistingUser,
  changePassword,
};
