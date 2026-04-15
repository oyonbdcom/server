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
    district?: string;
    area?: string;
  },
  options: IOptions,
): Promise<IGenericResponse<IAppointmentResponse[], IAppointmentStats>> => {
  const { status, date, doctorId, district, area } = filters;
  const { page, limit, skip, sortBy, sortOrder } = paginationCalculator(options);

  const where: Prisma.AppointmentWhereInput = {};

  // ১. Scoping by Role
  if (user?.role === 'PATIENT') {
    where.patientId = user?.id;
  } else if (user?.role === 'DOCTOR') {
    where.doctorId = user?.id;
  } else if (user?.role === 'CLINIC') {
    where.clinicId = user?.id;
  }

  // ২. ডক্টর ফিল্টার
  if (doctorId) {
    where.doctorId = doctorId;
  }

  if (user?.role === 'ADMIN') {
    if (area) {
      where.clinic = {
        clinic: {
          area: {
            slug: area,
            ...(district && {
              district: {
                slug: district,
              },
            }),
          },
        },
      };
    } else if (district) {
      where.clinic = {
        clinic: {
          area: {
            district: {
              slug: district,
            },
          },
        },
      };
    }
  }

  // ৪. তারিখ ফিল্টার
  if (date) {
    const todayStart = bdStartOfDay(date).toDate();
    const todayEnd = bdEndOfDay(date).toDate();
    where.appointmentDate = {
      gte: todayStart,
      lte: todayEnd,
    };
  }

  // ৫. স্ট্যাটাস ফিল্টার (শুধুমাত্র মেইন ডাটার জন্য)
  const dataWhere = { ...where };
  if (status) {
    dataWhere.status = status;
  }

  // ৬. Parallel Execution
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

const getManagerAreaAppointments = async (
  userId: string,
  filters: any,
  options: IOptions,
): Promise<IGenericResponse<any[]>> => {
  const { limit, page, skip } = paginationCalculator(options);
  const { searchTerm, status, startDate, endDate, clinicId, doctorId } = filters;
  console.log(filters);
  const manager = await prisma.manager.findUnique({
    where: { userId },
    select: { areaId: true },
  });
  console.log(doctorId);
  if (!manager) {
    throw new ApiError(httpStatus.NOT_FOUND, 'ম্যানেজার প্রোফাইল পাওয়া যায়নি!');
  }

  // এখানে টাইপ ডিফাইন করে দিন
  const andConditions: Prisma.AppointmentWhereInput[] = [];

  // ১. এরিয়া ফিল্টার
  andConditions.push({
    membership: {
      clinic: {
        areaId: manager.areaId,
      },
    },
  });

  // ২. সার্চ কন্ডিশন
  if (searchTerm) {
    const searchMode = 'insensitive';

    andConditions.push({
      OR: [
        { patientName: { contains: searchTerm, mode: searchMode } },
        { code: { contains: searchTerm, mode: searchMode } },
        { phoneNumber: { contains: searchTerm, mode: searchMode } },
        {
          doctor: {
            name: { contains: searchTerm, mode: searchMode },
          },
        },
        {
          membership: {
            clinic: {
              name: { contains: searchTerm, mode: searchMode },
            },
          },
        },
      ],
    });
  }

  // ৩. স্ট্যাটাস ফিল্টার
  if (status) {
    andConditions.push({ status: status });
  }

  // ৪. নির্দিষ্ট ক্লিনিক ফিল্টার
  // clinic filter
  if (clinicId) {
    andConditions.push({
      membership: {
        clinicId: clinicId,
      },
    });
  }

  // doctor filter
  if (doctorId) {
    andConditions.push({
      membership: {
        doctorId: doctorId,
      },
    });
  }

  // ৫. তারিখ রেঞ্জ ফিল্টার
  if (startDate && endDate) {
    andConditions.push({
      appointmentDate: {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      },
    });
  }

  const whereConditions: Prisma.AppointmentWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.appointment.findMany({
    where: whereConditions,
    skip,
    take: limit,
    orderBy:
      options.sortBy && options.sortOrder
        ? { [options.sortBy]: options.sortOrder }
        : { createdAt: 'desc' },
    include: {
      doctor: {
        select: {
          name: true,
          image: true,
          doctor: { select: { specialization: true } },
        },
      },
      patient: {
        select: { name: true, image: true },
      },
      membership: {
        // ড্রয়ারে ক্লিনিক নাম দেখানোর জন্য এটি প্রয়োজন হতে পারে
        include: {
          clinic: true,
        },
      },
    },
  });

  const total = await prisma.appointment.count({
    where: whereConditions,
  });
  const totalPage = Math.ceil((total || 0) / limit);
  return {
    meta: { total, page, limit, totalPage },
    data: result,
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
      select: { name: true, clinic: { select: { address: true } } },
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

    doc.fontSize(10).fillColor('#555').text(`${clinicAddress} |  `, { align: 'center' });
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

export const createAppointment = async (
  payload: IAppointmentCreateInput & { otp: string },
  authUser?: JwtPayload,
): Promise<any> => {
  const result = await prisma.$transaction(async (tx) => {
    console.log('createAppointment', payload);
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
          },
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
        doctor: { connect: { id: payload.doctorId } },
        clinic: { connect: { id: payload.clinicId } },
        patient: { connect: { id: targetUser?.id } },

        // যদি আপনার পেলোডে membershipId থাকে তবে এটি অবশ্যই দিন

        membership: { connect: { id: payload.membershipId } },
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
        },
      });
    }
    if (newAppointment) {
      sendPushNotification(
        newAppointment.clinicId,
        'নতুন বুকিং! 🏥',
        `${newAppointment.patientName} একটি নতুন অ্যাপয়েন্টমেন্ট বুক করেছেন`,
      ).catch((err) => console.error('Notification Error:', err));
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
        membershipId: payload?.membershipId,
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
    const siteName = config.site.siteName || 'susthio';
    const siteLink = config.origin || 'https://susthio.com';
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

// Update Appointment Reason/Date (Update)
const updateAppointment = async (
  id: string,
  payload: Partial<IAppointmentUpdateInput>,
): Promise<IAppointmentResponse> => {
  if (!id) throw new ApiError(httpStatus.BAD_REQUEST, 'Appointment ID is required');

  // ১. বর্তমান ডাটা চেক করা
  const isExist = await prisma.appointment.findUnique({
    where: { id },
  });

  if (!isExist) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Appointment not found');
  }

  // ৪. ডাটা আপডেট করা
  const updatedResult = await prisma.appointment.update({
    where: { id },
    data: payload,
    include: {
      doctor: { select: { name: true } },
      clinic: { select: { name: true } },
      membership: { include: { clinic: { select: { name: true } } } },
    },
  });

  // ৫. SMS নোটিফিকেশন লজিক
  const shouldSendSMS = isExist.status === 'PENDING' && updatedResult.status === 'SCHEDULED';

  if (shouldSendSMS && updatedResult.phoneNumber) {
    // সাইলেন্টলি রান করবে যাতে ইউজার রেসপন্স স্লো না হয়
    (async () => {
      try {
        const doctorName = updatedResult.doctor?.name || 'Doctor';
        const serial = updatedResult.serialNumber || 'Confirming';
        const message = `SusthiO: Your appointment with Dr. ${doctorName} is confirmed. Serial: ${serial}. Check details on our website.`;

        // await sendSMS(updatedResult.phoneNumber, message);
      } catch (error) {
        console.error('SMS Error:', error);
      }
    })();
  }

  return updatedResult as unknown as IAppointmentResponse;
};

export const AppointmentService = {
  getMyAppointments,
  getManagerAreaAppointments,
  exportDailyPdf,

  createAppointment,
  createAppointmentForAdmin,
  updateAppointment,
};
