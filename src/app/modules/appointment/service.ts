import bcrypt from 'bcrypt';
import httpStatus from 'http-status';
import { IGenericResponse } from './../../../interface/common';

import { AppointmentStatus, Prisma } from '@prisma/client';

import prisma from '../../../prisma/client';
import ApiError from '../../../utils/apiError';

import { JwtPayload } from 'jsonwebtoken';
import { IOptions, paginationCalculator } from '../../../helper';
import { createSlug } from '../../../utils/createSlug';
import { sendPushNotification } from '../../../utils/notification.utils';
import { appointmentPopulate, generateAppointmentCode, generateTokens } from './constant';
import { IAppointmentCreateInput, IAppointmentResponse, IAppointmentStats } from './interface';

const getMyAppointments = async (
  user: JwtPayload | undefined,
  filters: {
    date?: string;
    status?: AppointmentStatus;
  },
  options: IOptions,
): Promise<IGenericResponse<IAppointmentResponse[], IAppointmentStats>> => {
  const { status, date } = filters;
  const { page, limit, skip, sortBy, sortOrder } = paginationCalculator(options);

  const where: Prisma.AppointmentWhereInput = {};

  // 1. Scoping by Role
  if (user?.role === 'PATIENT') {
    where.patientId = user?.id;
  } else if (user?.role === 'DOCTOR') {
    where.doctorId = user?.id;
  } else if (user?.role === 'CLINIC') {
    where.clinicId = user?.id;
  }

  // 2. Date Filtering (applied to both data and stats)
  if (date) {
    where.appointmentDate = {
      gte: new Date(new Date(date).setUTCHours(0, 0, 0, 0)),
      lte: new Date(new Date(date).setUTCHours(23, 59, 59, 999)),
    };
  }

  // Define where clause for data (includes status filter)
  const dataWhere = { ...where };
  if (status) {
    dataWhere.status = status;
  }

  // 3. Parallel Execution for Data, Total, and Specific Stats
  const [result, total, pendingCount, scheduledCount, completedCount, cancelledCount] =
    await Promise.all([
      prisma.appointment.findMany({
        where: dataWhere,
        skip,
        take: limit,
        orderBy: sortBy && sortOrder ? { [sortBy]: sortOrder } : { serialNumber: 'asc' },
        include: appointmentPopulate,
      }),
      prisma.appointment.count({ where }),
      prisma.appointment.count({ where: { ...where, status: 'PENDING' } }),
      prisma.appointment.count({ where: { ...where, status: 'SCHEDULED' } }),
      prisma.appointment.count({ where: { ...where, status: 'COMPLETED' } }),
      prisma.appointment.count({ where: { ...where, status: 'CANCELLED' } }),
    ]);

  const totalPage = Math.ceil(total / limit);

  return {
    meta: {
      page,
      limit,
      total,
      totalPage,
    },
    data: result as unknown as IAppointmentResponse[],
    stats: {
      total,
      scheduled: scheduledCount,
      completed: completedCount,
      cancelled: cancelledCount,
      pending: pendingCount,
    },
  };
};

// ... existing imports
const sendBookingOtp = async (phoneNumber: string): Promise<any> => {
  // ১. ইউজার চেক করা (শুধুমাত্র দেখার জন্য যে সে অলরেডি ফুললি রেজিস্টার্ড কি না)
  const user = await prisma.user.findUnique({
    where: { phoneNumber },
    select: {
      isDefaultPassword: true,
      password: true,
    },
  });

  // ২. যদি ইউজার থাকে এবং সে ভেরিফাইড হয় (পাসওয়ার্ড সেট করা থাকে), তবেই লগইন করতে বলব
  if (user && !user.isDefaultPassword && user.password) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'আপনার মোবাইল নম্বরটি ইতিমধ্যে নিবন্ধিত। দয়া করে লগইন করুন।',
    );
  }

  // ৩. ওটিপি জেনারেট করা
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // ৫ মিনিট মেয়াদ

  // ৪. ওটিপি সেভ বা আপডেট করা (Upsert ব্যবহার করা হয়েছে যাতে ডুপ্লিকেট এরর না আসে)
  await prisma.otp.upsert({
    where: { phoneNumber },
    update: {
      otp,
      otpExpires,
    },
    create: {
      phoneNumber,
      otp,
      otpExpires,
    },
  });

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

const createAppointmentGuest = async (
  payload: IAppointmentCreateInput & { otp: string },
): Promise<any> => {
  const result = await prisma.$transaction(async (tx) => {
    // ১. ওটিপি ভেরিফিকেশন
    const otpRecord = await tx.otp.findUnique({
      where: { phoneNumber: payload.phoneNumber },
    });

    if (!otpRecord || otpRecord.otp !== payload.otp) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'ওটিপি কোডটি সঠিক নয়।');
    }

    if (new Date() > otpRecord.otpExpires) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'ওটিপি কোডটির মেয়াদ শেষ হয়ে গেছে।');
    }

    // ২. প্রি-চেক (Unique Constraint Error এড়াতে)
    const existingUser = await tx.user.findUnique({
      where: { phoneNumber: payload.phoneNumber },
    });

    if (existingUser) {
      throw new ApiError(
        httpStatus.CONFLICT,
        'এই নম্বরটি ইতিমধ্যে নিবন্ধিত। অনুগ্রহ করে লগইন করুন।',
      );
    }

    const slug = createSlug(payload.patientName);
    const hashedPassword = await bcrypt.hash('Default3@#', 12);

    // ৩. নতুন ইউজার ও পেশেন্ট প্রোফাইল তৈরি
    const newUser = await tx.user.create({
      data: {
        name: payload.patientName,
        phoneNumber: payload.phoneNumber,
        role: 'PATIENT',
        password: hashedPassword,
        isDefaultPassword: true,
        patient: {
          create: {
            address: payload.address || null,
            slug,
          },
        },
      },
      include: { patient: true },
    });

    // ৪. অ্যাপয়েন্টমেন্ট প্রসেসিং
    const appointmentDay = new Date(payload.appointmentDate);
    const startDate = new Date(appointmentDay.setUTCHours(0, 0, 0, 0));

    // ৫. অ্যাপয়েন্টমেন্ট তৈরি
    const newAppointment = await tx.appointment.create({
      data: {
        patientName: payload.patientName,
        ptAge: String(payload.ptAge),
        phoneNumber: payload.phoneNumber,
        address: payload.address || null,
        appointmentDate: startDate,
        status: 'PENDING',
        code: generateAppointmentCode(6),
        note: payload.note || null,
        doctorId: payload.doctorId,
        clinicId: payload.clinicId,
        patientId: newUser.id, // User ID হিসেবে ব্যবহার হচ্ছে
        discount: payload.discount,
      },
    });

    // ৬. ক্লিনআপ এবং টোকেন আপডেট
    await tx.otp.delete({ where: { phoneNumber: payload.phoneNumber } });

    const tokens = generateTokens(newUser);
    await tx.user.update({
      where: { id: newUser.id },
      data: {
        refreshToken: tokens.refreshToken,
        lastLoginAt: new Date(),
      },
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: newUser.id,
        name: newUser.name,
        role: newUser.role,
      },
      appointment: newAppointment,
    };
  });

  return result;
};

const createAppointmentForRegisteredUser = async (
  userId: string,
  payload: IAppointmentCreateInput,
): Promise<IAppointmentResponse> => {
  // ১. ইউজার এবং তার রোল চেক
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, name: true },
  });

  if (!user || user.role !== 'PATIENT') {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'শুধুমাত্র রোগীরাই (Patient) অ্যাপয়েন্টমেন্ট বুক করতে পারবেন।',
    );
  }

  // ২. তারিখ নির্ধারণ (পেলোড থেকে আসা তারিখ ব্যবহার করা উচিত, শুধু বর্তমান সময় নয়)
  const appointmentDate = new Date(payload.appointmentDate);
  const startOfDay = new Date(appointmentDate);
  startOfDay.setUTCHours(0, 0, 0, 0);

  const endOfDay = new Date(appointmentDate);
  endOfDay.setUTCHours(23, 59, 59, 999);

  // ৩. ডুপ্লিকেট বুকিং চেক (একই দিন, একই ডাক্তার, একই পেশেন্ট)
  const existingAppointment = await prisma.appointment.findFirst({
    where: {
      patientId: userId,
      doctorId: payload.doctorId,
      appointmentDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
      status: 'PENDING',
    },
  });

  if (existingAppointment?.patientName === payload.patientName) {
    throw new ApiError(
      httpStatus.CONFLICT,
      'এই চিকিৎসকের সাথে আপনার এই তারিখে ইতিমধ্যে একটি অ্যাপয়েন্টমেন্ট বুক করা আছে।',
    );
  }

  // ৪. ট্রানজ্যাকশন ব্যবহার করে অ্যাপয়েন্টমেন্ট তৈরি
  const result = await prisma.$transaction(async (tx) => {
    return await tx.appointment.create({
      data: {
        patientName: payload.patientName || user.name, // ইউজার নাম না দিলে প্রোফাইল নাম নিবে
        ptAge: String(payload.ptAge),
        phoneNumber: payload.phoneNumber,
        address: payload.address || null,
        appointmentDate: startOfDay,
        status: 'PENDING',
        code: generateAppointmentCode(6),
        note: payload.note || null,
        doctor: { connect: { id: payload.doctorId } },
        clinic: { connect: { id: payload.clinicId } },
        patient: { connect: { id: userId } },
        discount: payload.discount,
      },
      include: {
        doctor: { select: { name: true } },
        clinic: { select: { name: true } },
        patient: { select: { name: true } },
      },
    });
  });

  // ৫. নোটিফিকেশন (সাইলেন্টলি রান করবে)
  if (result) {
    sendPushNotification(
      result.clinicId,
      'নতুন বুকিং! 🏥',
      `${result.patientName} একটি নতুন অ্যাপয়েন্টমেন্ট বুক করেছেন`,
    ).catch((err) => console.error('Notification Error:', err));
  }

  return result as unknown as IAppointmentResponse;
};
// Update Appointment Reason/Date (Update)
const updateAppointment = async (
  id: string,

  data: any,
): Promise<IAppointmentResponse> => {
  // 1. Validate ID
  if (!id) throw new ApiError(httpStatus.BAD_REQUEST, 'Appointment ID is required');

  // 2. Auth Check: Verify ownership and existence in one query
  const appointment = await prisma.appointment.findUnique({
    where: { id },
  });

  if (!appointment) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Appointment not found');
  }

  // 3. Perform the status update
  // 3. Perform the status update
  const result = await prisma.appointment.update({
    where: { id },
    data,
    include: appointmentPopulate,
  });

  return result as unknown as IAppointmentResponse;
};

export const AppointmentService = {
  getMyAppointments,
  sendBookingOtp,
  createAppointmentForRegisteredUser,
  createAppointmentGuest,
  updateAppointment,
};
