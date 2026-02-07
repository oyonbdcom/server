import { AppointmentStatus, Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import httpStatus from 'http-status';
import { JwtPayload } from 'jsonwebtoken';
import path from 'path';
import PDFDocument from 'pdfkit';
import config from '../../../config/config';
import { IOptions, paginationCalculator } from '../../../helper';
import prisma from '../../../prisma/client';
import ApiError from '../../../utils/apiError';
import { createSlug } from '../../../utils/createSlug';
import { sendPushNotification } from '../../../utils/notification.utils';
import { IGenericResponse } from './../../../interface/common';

import { sendSMS } from '../../../utils/sendSms';
import { bdEndOfDay, bdNow, bdStartOfDay } from '../../../utils/timezone';
import { appointmentPopulate, generateAppointmentCode, generateTokens } from './constant';
import {
  IAppointmentCreateInput,
  IAppointmentResponse,
  IAppointmentStats,
  IAppointmentUpdateInput,
} from './interface';

const getMyAppointments = async (
  user: JwtPayload | undefined,
  filters: {
    date?: string;
    status?: AppointmentStatus;
    doctorId?: string;
  },
  options: IOptions,
): Promise<IGenericResponse<IAppointmentResponse[], IAppointmentStats>> => {
  const { status, date, doctorId } = filters;
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

  if (doctorId) {
    where.doctorId = doctorId;
  }

  const todayStart = bdStartOfDay(date).toDate();
  const todayEnd = bdEndOfDay(date).toDate();

  // 3. Date Filtering
  if (date) {
    where.appointmentDate = {
      gte: todayStart,
      lte: todayEnd,
    };
  }

  // ৪. স্ট্যাটাস ফিল্টার (শুধুমাত্র মেইন ডাটার জন্য, স্ট্যাটস কাউন্টিং এর জন্য নয়)
  const dataWhere = { ...where };
  if (status) {
    dataWhere.status = status;
  }

  // ৫. Parallel Execution
  const [result, total, pendingCount, scheduledCount, completedCount, cancelledCount] =
    await Promise.all([
      prisma.appointment.findMany({
        where: dataWhere,
        skip,
        take: limit,
        orderBy: sortBy && sortOrder ? { [sortBy]: sortOrder } : { serialNumber: 'asc' },
        include: appointmentPopulate,
      }),
      prisma.appointment.count({ where }), // নির্দিষ্ট ফিল্টারে মোট সংখ্যা
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

const exportDailyPdf = async (
  userId: string,
  filters: {
    date?: string;
    status?: AppointmentStatus;
    doctorId?: string;
  },
): Promise<Buffer> => {
  const { status, date, doctorId } = filters;
  if (!date || !doctorId) {
    throw new Error('Date and Doctor ID are required to export the report.');
  }
  const targetDate = date ? new Date(date) : new Date();
  const todayStart = bdStartOfDay(targetDate).toDate();
  const todayEnd = bdEndOfDay(targetDate).toDate();

  // Fetching Names
  const [doctor, clinic] = await Promise.all([
    prisma.user.findUnique({ where: { id: doctorId }, select: { name: true } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, clinic: { select: { address: true, phoneNumber: true } } },
    }),
  ]);
  const statusFilter = status
    ? (status as AppointmentStatus) // If single status is passed
    : { in: ['PENDING', 'SCHEDULED'] as AppointmentStatus[] };
  const appointments = await prisma.appointment.findMany({
    where: {
      doctorId,
      appointmentDate: { gte: todayStart, lte: todayEnd },
      status: statusFilter,
    },
    orderBy: { serialNumber: 'asc' },
    select: {
      serialNumber: true,
      patientName: true,
      phoneNumber: true,
      address: true,
      refby: true,
    },
  });

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk) => chunks.push(chunk));

  const pdfBuffer: Buffer = await new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    const fontPath = path.join(__dirname, '../../../assets/NotoSansBengali_Condensed-Regular.ttf');
    doc.font(fontPath);

    // --- Header Section ---
    const clinicName = (clinic?.name || 'HEALTH CLINIC').toUpperCase();
    doc.fillColor('#1a2a3a').fontSize(22).text(clinicName, { align: 'center' });

    const clinicAddress = clinic?.clinic?.address || 'Address not provided';
    const clinicPhone = clinic?.clinic?.phoneNumber || 'No Contact Info';
    doc
      .fontSize(10)
      .fillColor('#555')
      .text(`${clinicAddress} | Support: ${clinicPhone}`, { align: 'center' });
    doc.moveDown(1.5);

    // Separator Line
    doc
      .moveTo(40, doc.y - 10)
      .lineTo(555, doc.y - 10)
      .strokeColor('#ccc')
      .lineWidth(0.5)
      .stroke();

    // Doctor Info
    doc
      .fillColor('#000')
      .fontSize(12)
      .text(`Doctor: Dr. ${doctor?.name || 'N/A'}`);
    doc.text(`Schedule Date: ${date}`, { align: 'left' });
    doc.moveDown(1);

    // --- Table Constants (Updated for 5 Columns) ---
    const tableTop = doc.y;
    // We redistributed widths to accommodate 'Ref By'
    const colWidths = { sl: 30, name: 130, phone: 100, address: 155, ref: 100 };
    const colPositions = {
      sl: 40,
      name: 40 + colWidths.sl,
      phone: 40 + colWidths.sl + colWidths.name,
      address: 40 + colWidths.sl + colWidths.name + colWidths.phone,
      ref: 40 + colWidths.sl + colWidths.name + colWidths.phone + colWidths.address,
    };
    const rowHeight = 25;
    const tableWidth = 515;

    // --- Draw Table Header ---
    doc.rect(40, tableTop, tableWidth, rowHeight).fill('#2c3e50');
    doc.fillColor('#ffffff').fontSize(10);
    doc.text('SL', colPositions.sl + 5, tableTop + 8);
    doc.text('Patient Name', colPositions.name + 5, tableTop + 8);
    doc.text('Phone', colPositions.phone + 5, tableTop + 8);
    doc.text('Address', colPositions.address + 5, tableTop + 8);
    doc.text('Ref. By', colPositions.ref + 5, tableTop + 8); // New Header

    let currentY = tableTop + rowHeight;
    const safeString = (val: any) => (val ? String(val) : '-');

    // --- Table Rows ---
    appointments.forEach((apt, index) => {
      if (index % 2 !== 0) doc.rect(40, currentY, tableWidth, rowHeight).fill('#f9f9f9');

      doc.fillColor('#000').fontSize(9);
      doc.text(safeString(apt.serialNumber), colPositions.sl + 5, currentY + 8);
      doc.text(safeString(apt.patientName), colPositions.name + 5, currentY + 8, {
        width: colWidths.name - 5,
        lineBreak: false,
      });
      doc.text(safeString(apt.phoneNumber), colPositions.phone + 5, currentY + 8);
      doc.text(safeString(apt.address), colPositions.address + 5, currentY + 8, {
        width: colWidths.address - 5,
        lineBreak: false,
      });
      doc.text(safeString(apt.refby), colPositions.ref + 5, currentY + 8, {
        width: colWidths.ref - 5,
        lineBreak: false,
      }); // New Row Data

      doc
        .moveTo(40, currentY + rowHeight)
        .lineTo(40 + tableWidth, currentY + rowHeight)
        .strokeColor('#ccc')
        .lineWidth(0.5)
        .stroke();
      currentY += rowHeight;

      if (currentY > 750) {
        doc.addPage();
        currentY = 50;
      }
    });

    // --- Draw Vertical Column Borders ---
    const verticalLines = [
      40,
      colPositions.name,
      colPositions.phone,
      colPositions.address,
      colPositions.ref, // Added line for Ref By
      40 + tableWidth,
    ];

    verticalLines.forEach((x) => {
      doc.moveTo(x, tableTop).lineTo(x, currentY).strokeColor('#2c3e50').lineWidth(0.5).stroke();
    });

    doc.end();
  });

  return pdfBuffer;
};

// ... existing imports
const sendBookingOtp = async (payload: IAppointmentCreateInput): Promise<any> => {
  const { phoneNumber, patientName, doctorId } = payload;

  // ৪. ওটিপি স্প্যাম প্রোটেকশন (১ মিনিট গ্যাপ)
  const existingOtp = await prisma.otp.findUnique({ where: { phoneNumber } });
  if (existingOtp) {
    const lastSent = new Date(existingOtp.updatedAt).getTime();
    if (Date.now() - lastSent < 60000) {
      throw new ApiError(httpStatus.TOO_MANY_REQUESTS, 'দয়া করে ১ মিনিট অপেক্ষা করুন।');
    }
  }

  // ৫. ওটিপি জেনারেট ও সেভ
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

  await prisma.otp.upsert({
    where: { phoneNumber },
    update: { otp, otpExpires, updatedAt: new Date() },
    create: { phoneNumber, otp, otpExpires },
  });

  // ৫. SMS পাঠানোর লজিক
  const message = `${config.site.siteName || 'Sasthik'}: Your verification code is ${otp}. Stay healthy with us!`;

  // await sendSMS(phoneNumber, message);

  return {
    success: true,
    message: 'আপনার মোবাইলে ৬ ডিজিটের ওটিপি পাঠানো হয়েছে।',
  };
};

export const createAppointment = async (
  payload: IAppointmentCreateInput & { otp: string },
  authUser?: JwtPayload,
): Promise<any> => {
  const result = await prisma.$transaction(async (tx) => {
    // 1️⃣ OTP validation
    const otpRecord = await tx.otp.findUnique({
      where: { phoneNumber: payload.phoneNumber },
    });

    if (!otpRecord || otpRecord.otp !== payload.otp) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'ওটিপি কোডটি সঠিক নয়।');
    }

    if (new Date() > otpRecord.otpExpires) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'ওটিপি কোডটির মেয়াদ শেষ হয়ে গেছে।');
    }

    // 2️⃣ Duplicate booking check (same day, same patient & doctor)
    const todayStart = bdStartOfDay(new Date()).toDate();
    const todayEnd = bdEndOfDay(new Date()).toDate();

    const alreadyExists = await tx.appointment.findFirst({
      where: {
        phoneNumber: payload.phoneNumber,
        doctorId: payload.doctorId,
        patientName: payload.patientName,
        ptAge: String(payload.ptAge),
        appointmentDate: {
          gte: todayStart,
          lte: todayEnd,
        },
        status: {
          in: ['PENDING', 'SCHEDULED'],
        },
      },
    });

    if (alreadyExists) {
      throw new ApiError(
        httpStatus.CONFLICT,
        `${payload.patientName}-এর জন্য এই তারিখে ইতিমধ্যে বুকিং আছে।`,
      );
    }

    let targetUser = null;
    let isNew = false;

    // 3️⃣ Logged-in user
    if (authUser) {
      targetUser = await tx.user.findUnique({
        where: { id: authUser.id },
        include: { patient: true },
      });

      if (!targetUser) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid logged-in user');
      }

      if (targetUser.role !== 'PATIENT') {
        throw new ApiError(
          httpStatus.FORBIDDEN,
          'শুধুমাত্র পেশেন্ট অ্যাকাউন্ট দিয়ে বুকিং করা যাবে।',
        );
      }
    } else {
      // 4️⃣ Guest user flow
      targetUser = await tx.user.findUnique({
        where: { phoneNumber: payload.phoneNumber },
        include: { patient: true },
      });

      if (targetUser && targetUser.role !== 'PATIENT') {
        throw new ApiError(
          httpStatus.FORBIDDEN,
          'এই নম্বরটি চিকিৎসক বা অন্য রোলের জন্য নিবন্ধিত। শুধুমাত্র পেশেন্ট অ্যাকাউন্ট সম্ভব।',
        );
      }

      if (!targetUser) {
        isNew = true;
        const slug = createSlug(payload.patientName);
        const hashedPassword = await bcrypt.hash(config.default_password || 'Password@123', 12);

        targetUser = await tx.user.create({
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
      }
    }

    // 5️⃣ Create appointment (payload phone used always)
    const newAppointment = await tx.appointment.create({
      data: {
        patientName: payload.patientName,
        ptAge: String(payload.ptAge),
        phoneNumber: payload.phoneNumber,
        address: payload.address || null,
        appointmentDate: bdNow().toDate(),
        status: 'PENDING',
        code: generateAppointmentCode(6),
        note: payload.note || null,
        doctorId: payload.doctorId,
        clinicId: payload.clinicId,
        patientId: targetUser.id,
        discount: payload.discount || 0,
      },
    });

    // 6️⃣ OTP cleanup
    await tx.otp.delete({ where: { phoneNumber: payload.phoneNumber } });

    // 7️⃣ Generate token only for guest users
    let tokens = null;
    if (!authUser) {
      tokens = generateTokens(targetUser);

      await tx.user.update({
        where: { id: targetUser.id },
        data: {
          refreshToken: tokens.refreshToken,
          lastLoginAt: new Date(),
        },
      });
    }

    // 8️⃣ Return
    return {
      ...(tokens && {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      }),
      user: {
        id: targetUser.id,
        name: targetUser.name,
        role: targetUser.role,
      },
      appointment: newAppointment,
      isNewUser: isNew,
    };
  });

  return result;
};

const createAppointmentForAdmin = async (payload: IAppointmentCreateInput): Promise<any> => {
  const todayStart = bdStartOfDay(new Date()).toDate(); // BD 00:00 → UTC
  const todayEnd = bdEndOfDay(new Date()).toDate(); // BD 23:59 → UTC

  const { newAppointment, isNew } = await prisma.$transaction(async (tx) => {
    // 1️⃣ Duplicate booking check (BD date based)
    const alreadyExists = await tx.appointment.findFirst({
      where: {
        patientName: payload.patientName,
        ptAge: String(payload.ptAge),
        doctorId: payload.doctorId,
        appointmentDate: {
          gte: todayStart,
          lte: todayEnd,
        },
        status: {
          in: ['PENDING', 'SCHEDULED'],
        },
      },
    });

    if (alreadyExists) {
      throw new ApiError(
        httpStatus.CONFLICT,
        `${payload.patientName}-এর জন্য আজকে একটি বুকিং আছে।`,
      );
    }

    // 2️⃣ User check
    let targetUser = await tx.user.findUnique({
      where: { phoneNumber: payload.phoneNumber },
    });

    if (targetUser && targetUser.role !== 'PATIENT') {
      throw new ApiError(httpStatus.FORBIDDEN, 'এই নম্বরটি পেশেন্ট অ্যাকাউন্টের জন্য নয়।');
    }

    // 3️⃣ Create user if not exists
    let isNewUser = false;

    if (!targetUser) {
      isNewUser = true;

      const slug = createSlug(payload.patientName);
      const hashedPassword = await bcrypt.hash(config.default_password || 'Password@123', 12);

      targetUser = await tx.user.create({
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
      });
    }

    // 4️⃣ Create appointment (IMPORTANT PART)
    const appointment = await tx.appointment.create({
      data: {
        patientName: payload.patientName,
        ptAge: String(payload.ptAge),
        phoneNumber: payload.phoneNumber,
        address: payload.address || null,
        serialNumber: payload.serialNumber,
        appointmentDate: bdNow().toDate(),

        status: 'SCHEDULED',
        code: generateAppointmentCode(6),
        doctorId: payload.doctorId,
        clinicId: payload.clinicId,
        patientId: targetUser.id,
        discount: payload.discount || 0,
        refby: payload?.refby,
      },
      select: {
        serialNumber: true,
        doctor: {
          select: { name: true },
        },
      },
    });

    return { newAppointment: appointment, isNew: isNewUser };
  });

  try {
    const siteName = config.site.siteName || 'Sasthik';
    const siteLink = config.origin || 'https://sasthik.com';
    const appointmentNumber = newAppointment.serialNumber;
    const doctorName = newAppointment.doctor.name || 'your doctor'; // fallback if not provided

    let welcomeMessage = '';

    if (isNew) {
      // New patient
      welcomeMessage = `${siteName}: Your appointment with Dr. ${doctorName} is confirmed! 
ID: ${payload?.phoneNumber}, Pass: ${config.default_password || 'Password@123'} 
Serial: ${appointmentNumber}. Details: ${siteLink}/login`;
    } else {
      // Existing patient
      welcomeMessage = `${siteName}: Your appointment with Dr. ${doctorName} is confirmed.
Serial: ${appointmentNumber}. Details: ${siteLink}/auth/login`;
    }

    await sendSMS(payload?.phoneNumber, welcomeMessage);
  } catch (smsError) {
    console.error('Failed to send SMS:', smsError);
  }

  return newAppointment;
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
  data: Partial<IAppointmentUpdateInput>, // type-safe
): Promise<IAppointmentResponse> => {
  // 1️⃣ Validate ID
  if (!id) throw new ApiError(httpStatus.BAD_REQUEST, 'Appointment ID is required');

  // 2️⃣ Find existing appointment
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: appointmentPopulate,
  });

  if (!appointment) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Appointment not found');
  }

  // 3️⃣ Check if SMS needs to be sent
  const shouldSendSMS = appointment.status === 'PENDING' && data.status === 'SCHEDULED';

  // 4️⃣ Update appointment
  const updatedAppointment = await prisma.appointment.update({
    where: { id },
    data,
    include: appointmentPopulate,
  });

  // 5️⃣ Send SMS if required (async, but safe)
  if (shouldSendSMS && updatedAppointment.phoneNumber) {
    try {
      const siteName = config.site.siteName || 'Sasthik';
      const siteLink = config.origin || 'https://sasthik.com';
      const doctorName = updatedAppointment.doctor?.name || 'your doctor';
      const serialNumber = updatedAppointment.serialNumber ?? 'N/A';

      const welcomeMessage = `${siteName}: Your appointment with Dr. ${doctorName} is confirmed.
Serial: ${serialNumber}. Details: ${siteLink}/auth/login`;

      await sendSMS(updatedAppointment.phoneNumber, welcomeMessage);
    } catch (error) {
      console.error('Failed to send appointment SMS:', error);
    }
  }

  // 6️⃣ Return updated appointment
  return updatedAppointment as IAppointmentResponse;
};

export const AppointmentService = {
  getMyAppointments,
  sendBookingOtp,
  exportDailyPdf,
  createAppointmentForRegisteredUser,
  createAppointment,
  createAppointmentForAdmin,
  updateAppointment,
};
