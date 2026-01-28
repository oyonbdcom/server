// src/app/modules/auth/service.ts
import bcrypt from 'bcrypt';
import httpStatus from 'http-status';
import { JwtPayload, Secret } from 'jsonwebtoken';

import { UserRole } from '@prisma/client';
import config from '../../../config/config';
import { jwtTokenHelper } from '../../../helper/jwtHelper';
import prisma from '../../../prisma/client';
import ApiError from '../../../utils/apiError';
import { createSlug } from '../../../utils/createSlug';
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
const register = async (data: RegisterRequest): Promise<IUserResponse> => {
  const { phoneNumber, password, name, role } = data;

  // ১. ইউজার অস্তিত্ব চেক (Existing User Check)
  const existingUser = await prisma.user.findUnique({
    where: { phoneNumber },
    select: { id: true, isPhoneVerified: true, name: true },
  });

  // যদি ইউজার ইতিমধ্যে থাকে এবং ভেরিফাইড হয়, তবে এরর দিন
  if (existingUser?.isPhoneVerified) {
    throw new ApiError(httpStatus.CONFLICT, 'এই ফোন নম্বরটি দিয়ে ইতিমধ্যে অ্যাকাউন্ট খোলা হয়েছে।');
  }

  // ২. ওটিপি ও পাসওয়ার্ড প্রসেসিং
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // ১০ মিনিট মেয়াদ

  if (!PASSWORD_REGEX.test(password)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'পাসওয়ার্ড অন্তত ৮ অক্ষরের হতে হবে এবং বড় হাতের অক্ষর, ছোট হাতের অক্ষর, সংখ্যা ও বিশেষ চিহ্ন থাকতে হবে।',
    );
  }
  const hashedPassword = await bcrypt.hash(password, 12);

  // ৩. ট্রানজেকশন শুরু (Atomic Operation)
  const user = await prisma.$transaction(async (tx) => {
    let targetUser;

    if (existingUser) {
      // ডুপ্লিকেট রিমুভ: ইউজার যদি আন-ভেরিফাইড থাকে, তবে তাকেই আপডেট করা হচ্ছে
      targetUser = await tx.user.update({
        where: { phoneNumber },
        data: {
          password: hashedPassword,
          name: name || existingUser.name,
          otp: otpCode,
          otpExpires: otpExpires,
          role: (role as UserRole) || 'PATIENT',
        },
        select: USER_SELECT,
      });
    } else {
      // একদম নতুন ইউজার তৈরি
      targetUser = await tx.user.create({
        data: {
          phoneNumber,
          password: hashedPassword,
          name: name ?? '',
          otp: otpCode,
          otpExpires: otpExpires,
          role: (role as UserRole) || 'PATIENT',
        },
        select: USER_SELECT,
      });

      // প্রোফাইল জেনারেশন (শুধুমাত্র নতুন ইউজারের জন্য স্ল্যাগ তৈরি)
      const slug = createSlug(targetUser.name || 'user');

      // রোল অনুযায়ী প্রোফাইল ডিস্ট্রিবিউশন
      const profileData = { userId: targetUser.id, slug };

      switch (targetUser.role) {
        case 'CLINIC':
          await tx.clinic.create({ data: profileData });
          break;
        case 'DOCTOR':
          await tx.doctor.create({
            data: { ...profileData, department: 'General' },
          });
          break;
        case 'PATIENT':
          await tx.patient.create({ data: profileData });
          break;
      }
    }

    return targetUser;
  });

  // ৪. ওটিপি পাঠানো (ব্যাকগ্রাউন্ড প্রসেস হতে পারে)
  // await sendSMS(user.phoneNumber, `আপনার ভেরিফিকেশন কোড: ${otpCode}`);

  return user;
};

// otp verify
const verifyOtp = async (payload: { phoneNumber: string; otp: string }): Promise<any> => {
  const { phoneNumber, otp } = payload;

  // ১. ইউজার খুঁজে বের করা
  const user = await prisma.user.findUnique({
    where: { phoneNumber },
    select: {
      id: true,
      otp: true,
      otpExpires: true,
      isPhoneVerified: true,
    },
  });

  // ২. ইউজার অস্তিত্ব চেক
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'এই ফোন নম্বরে কোনো ইউজার খুঁজে পাওয়া যায়নি।');
  }

  // ৪. ওটিপি ম্যাচিং এবং এক্সপায়ারি চেক
  if (!user.otp || user.otp !== otp) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'আপনার দেওয়া ওটিপি (OTP) কোডটি সঠিক নয়।');
  }

  const isExpired = user.otpExpires ? new Date() > user.otpExpires : true;
  if (isExpired) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'ওটিপি-র মেয়াদ শেষ হয়ে গেছে। দয়া করে আবার চেষ্টা করুন।',
    );
  }

  // ৫. ডাটাবেজ আপডেট (ওটিপি মুছে ফেলা এবং ভেরিফিকেশন কনফার্ম করা)
  await prisma.user.update({
    where: { phoneNumber },
    data: {
      isPhoneVerified: true,
      otp: null, // সিকিউরিটির জন্য ওটিপি মুছে ফেলা
      otpExpires: null, // এক্সপায়ারি রিসেট করা
    },
  });

  return {
    success: true,
    message: 'ফোন নম্বর সফলভাবে ভেরিফাই করা হয়েছে।',
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
  if (!user.isPhoneVerified) {
    // এখানে আপনি চাইলে নতুন একটি ওটিপি জেনারেট করে SMS পাঠিয়ে দিতে পারেন
    // throw new ApiError(httpStatus.FORBIDDEN, 'আপনার মোবাইল নম্বরটি এখনো ভেরিফাই করা হয়নি। অনুগ্রহ করে ওটিপি দিয়ে ভেরিফাই করুন।');

    // নোট: ফ্রন্টএন্ড এই এরর দেখে ইউজারকে ওটিপি পেজে পাঠিয়ে দিবে
    throw new ApiError(httpStatus.UNAUTHORIZED, 'ভেরিফাই করা হয়নি');
  }

  // ৫. টোকেন জেনারেশন
  const tokens = generateTokens(user);
  console.log(tokens);
  // ৬. ডাটাবেজ আপডেট (রিফ্রেশ টোকেন এবং লগইন টাইম)
  await prisma.user.update({
    where: { id: user.id },
    data: {
      refreshToken: tokens.refreshToken,
      lastLoginAt: new Date(),
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
  // ১. ইউজার খুঁজে বের করা
  const user = await prisma.user.findUnique({
    where: { phoneNumber },
    select: {
      id: true,
      phoneNumber: true,
      name: true,
      deactivate: true,
    },
  });

  // ২. ইউজার অস্তিত্ব চেক
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'এই মোবাইল নম্বরটি নিবন্ধিত নয়।');
  }

  // ৩. ডি-অ্যাক্টিভেশন চেক
  if (user.deactivate) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'আপনার অ্যাকাউন্টটি বর্তমানে বন্ধ আছে। সাপোর্টে যোগাযোগ করুন।',
    );
  }

  // ৪. ওটিপি এবং এক্সপায়ারি জেনারেশন
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // ফোনের জন্য ৫ মিনিট যথেষ্ট

  // ৫. ডাটাবেজ আপডেট
  await prisma.user.update({
    where: { id: user.id },
    data: {
      otp: otp,
      otpExpires: otpExpires,
    },
  });

  // ৬. SMS পাঠানো (সবচেয়ে গুরুত্বপূর্ণ অংশ)
  // এখানে আপনার SMS Service কল করতে হবে
  // await SMSService.sendOTP(user.phoneNumber, `আপনার ভেরিফিকেশন কোড: ${otp}`);
  console.log(`OTP for ${phoneNumber}: ${otp}`); // ডেভেলপমেন্টের জন্য

  return {
    success: true,
    message: 'আপনার মোবাইল নম্বরে ৬ ডিজিটের ওটিপি পাঠানো হয়েছে।',
  };
};

const forgetVerifyOtp = async (payload: { phoneNumber: string; otp: string }): Promise<any> => {
  const { phoneNumber, otp } = payload;

  // ১. ইউজার খুঁজে বের করা
  const user = await prisma.user.findUnique({
    where: { phoneNumber },
    select: {
      id: true,
      otp: true,
      otpExpires: true,
      isPhoneVerified: true,
    },
  });

  // ২. ইউজার অস্তিত্ব চেক
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'এই ফোন নম্বরে কোনো ইউজার খুঁজে পাওয়া যায়নি।');
  }

  // ৪. ওটিপি ম্যাচিং এবং এক্সপায়ারি চেক
  if (!user.otp || user.otp !== otp) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'আপনার দেওয়া ওটিপি (OTP) কোডটি সঠিক নয়।');
  }

  const isExpired = user.otpExpires ? new Date() > user.otpExpires : true;
  if (isExpired) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'ওটিপি-র মেয়াদ শেষ হয়ে গেছে। দয়া করে আবার চেষ্টা করুন।',
    );
  }

  // ৫. ডাটাবেজ আপডেট (ওটিপি মুছে ফেলা এবং ভেরিফিকেশন কনফার্ম করা)
  await prisma.user.update({
    where: { phoneNumber },
    data: {
      isPhoneVerified: true,
    },
  });

  return {
    success: true,
    message: 'ফোন নম্বর সফলভাবে ভেরিফাই করা হয়েছে।',
  };
};

const resetPassword = async (payload: ResetPasswordRequest): Promise<any> => {
  const { phoneNumber, otp, newPassword } = payload;

  // ১. ইউজার খুঁজে বের করা
  const user = await prisma.user.findUnique({
    where: { phoneNumber },
  });
  console.log(user, otp);
  // ২. ইউজার অস্তিত্ব এবং ওটিপি চেক
  if (!user || !user.otp || user.otp !== otp) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'ভুল ওটিপি কোড, আবার চেষ্টা করুন।');
  }

  // ৩. ওটিপি মেয়াদ শেষ হয়েছে কিনা চেক (Expiry Check)
  if (user.otpExpires && new Date() > new Date(user.otpExpires)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'ওটিপি কোডটির মেয়াদ শেষ হয়ে গেছে।');
  }

  // ৪. নতুন পাসওয়ার্ড হ্যাশ করা
  const hashedPassword = await bcrypt.hash(newPassword, 12); // ১০ এর বদলে ১২ রাউন্ড সিকিউরিটির জন্য ভালো

  // ৫. ডাটাবেজ আপডেট এবং ওটিপি ক্লিনআপ
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      otp: null,
      otpExpires: null,
    },
  });

  return {
    success: true,
    message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে।',
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
  verifyOtp,
  forgetVerifyOtp,
  logout,
  changePassword,
};
