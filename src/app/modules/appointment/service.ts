import { AppointmentSource, AppointmentStatus, Prisma, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import httpStatus from 'http-status';
import { JwtPayload } from 'jsonwebtoken';
import path from 'path';
import PDFDocument from 'pdfkit';
import config from '../../../config/config';
import { IOptions, paginationCalculator } from '../../../helper';
import prisma from '../../../prisma/client';
import ApiError from '../../../utils/apiError';
import { sendPushNotification } from '../../../utils/notification.utils';
import { IGenericResponse } from './../../../interface/common';

import { bdEndOfDay, bdNow, bdStartOfDay } from '../../../utils/timezone';
import { appointmentPopulate, generateTokens, resolvePatientUser } from './constant';
import {
  IAppointmentCreateInput,
  IAppointmentResponse,
  IAppointmentStats,
  IAppointmentUpdateInput,
} from './interface';
import { buildAppointmentFilters } from './shared/buildAppointmentFilters';
import { getAppointmentStats } from './shared/getAppointmentStats';
import { queryAppointments } from './shared/queryAppointments';

interface IGetAppointmentsFilters {
  searchTerm?: string;
  date?: string;
  status?: AppointmentStatus;
  doctorId?: string;
  clinicId?: string;
  area?: string;
}

const getMyAppointments = async (
  user: JwtPayload,
  filters: IGetAppointmentsFilters,
  options: IOptions,
): Promise<IGenericResponse<IAppointmentResponse[], IAppointmentStats>> => {
  const { searchTerm, date, status, doctorId, clinicId, area } = filters;
  console.log(clinicId);
  const { page, limit, skip, sortBy, sortOrder } = paginationCalculator(options);

  const andConditions: Prisma.AppointmentWhereInput[] = [];

  // =====================================================
  // ROLE BASED SCOPING
  // =====================================================

  switch (user.role) {
    // -----------------------------------------
    // PATIENT
    // -----------------------------------------
    case UserRole.PATIENT: {
      const patient = await prisma.patient.findUnique({
        where: {
          userId: user.id,
        },
        select: {
          id: true,
        },
      });

      if (!patient) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Patient profile not found');
      }

      andConditions.push({
        patientId: patient.id,
      });

      break;
    }

    // -----------------------------------------
    // DOCTOR
    // -----------------------------------------

    // -----------------------------------------
    // DIAGNOSTIC MANAGER
    // -----------------------------------------
    case UserRole.DIAGNOSTIC_MANAGER: {
      const clinic = await prisma.clinic.findUnique({
        where: {
          userId: user.id,
        },
        select: {
          id: true,
        },
      });

      if (!clinic) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Clinic profile not found');
      }

      andConditions.push({
        clinicId: clinic.id,
      });

      break;
    }

    // -----------------------------------------
    // AREA MANAGER
    // -----------------------------------------
    case UserRole.AREA_MANAGER: {
      const manager = await prisma.manager.findUnique({
        where: {
          userId: user.id,
        },

        select: {
          areaId: true,
        },
      });

      if (!manager) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Manager profile not found');
      }

      andConditions.push({
        clinic: {
          areaId: manager.areaId,
        },
      });

      break;
    }

    // -----------------------------------------
    // STAFF
    // -----------------------------------------
    case UserRole.STAFF: {
      const staff = await prisma.staff.findUnique({
        where: {
          userId: user.id,
        },

        select: {
          clinicId: true,
          assignedDoctorId: true,
        },
      });

      if (!staff) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Staff profile not found');
      }

      // clinic scoped
      andConditions.push({
        clinicId: staff.clinicId,
      });

      // assigned doctor only
      if (staff.assignedDoctorId) {
        andConditions.push({
          doctorId: staff.assignedDoctorId,
        });
      }

      break;
    }

    // -----------------------------------------
    // ADMIN
    // -----------------------------------------
    case UserRole.ADMIN:
    default:
      break;
  }

  // =====================================================
  // FILTERS
  // =====================================================

  // status
  if (status) {
    andConditions.push({
      status,
    });
  }

  // doctor
  if (doctorId) {
    andConditions.push({
      doctorId,
    });
  }

  // clinic
  if (clinicId) {
    andConditions.push({
      clinicId,
    });
  }

  // area
  if (area) {
    andConditions.push({
      clinic: {
        area: {
          slug: area,
        },
      },
    });
  }

  // search
  if (searchTerm) {
    andConditions.push({
      OR: [
        {
          patientName: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },

        {
          phoneNumber: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },

        {
          doctor: {
            user: {
              name: {
                contains: searchTerm,
                mode: 'insensitive',
              },
            },
          },
        },

        {
          clinic: {
            user: {
              name: {
                contains: searchTerm,
                mode: 'insensitive',
              },
            },
          },
        },
      ],
    });
  }

  // date
  if (date) {
    andConditions.push({
      appointmentDate: {
        gte: bdStartOfDay(date),
        lte: bdEndOfDay(date),
      },
    });
  }

  // =====================================================
  // FINAL WHERE
  // =====================================================

  const whereConditions: Prisma.AppointmentWhereInput =
    andConditions.length > 0
      ? {
          AND: andConditions,
        }
      : {};

  // =====================================================
  // QUERY
  // =====================================================

  const [result, total, pending, scheduled, completed, cancelled] = await Promise.all([
    prisma.appointment.findMany({
      where: whereConditions,

      skip,
      take: limit,

      orderBy: sortBy && sortOrder ? { [sortBy]: sortOrder } : { appointmentDate: 'desc' },

      include: appointmentPopulate,
    }),

    prisma.appointment.count({
      where: whereConditions,
    }),

    prisma.appointment.count({
      where: {
        ...whereConditions,
        status: AppointmentStatus.PENDING,
      },
    }),

    prisma.appointment.count({
      where: {
        ...whereConditions,
        status: AppointmentStatus.SCHEDULED,
      },
    }),

    prisma.appointment.count({
      where: {
        ...whereConditions,
        status: AppointmentStatus.COMPLETED,
      },
    }),

    prisma.appointment.count({
      where: {
        ...whereConditions,
        status: AppointmentStatus.CANCELLED,
      },
    }),
  ]);

  return {
    meta: {
      total,
      page,
      limit,
      totalPage: Math.ceil(total / limit),
    },

    data: result as unknown as IAppointmentResponse[],

    stats: {
      total,
      pending,
      scheduled,
      completed,
      cancelled,
    },
  };
};

const getManagerAreaAppointments = async (
  userId: string,
  filters: any,
  options: IOptions,
): Promise<IGenericResponse<any[]>> => {
  const manager = await prisma.manager.findUnique({
    where: {
      userId,
    },

    select: {
      areaId: true,
    },
  });

  if (!manager) {
    throw new ApiError(404, 'Manager not found');
  }

  const where: Prisma.AppointmentWhereInput = {
    AND: [
      {
        clinic: {
          areaId: manager.areaId,
        },
      },

      buildAppointmentFilters(filters),
    ],
  };

  const result = await queryAppointments(where, options);

  const stats = await getAppointmentStats(where);
  console.log({ stats });
  return {
    ...result,
    stats,
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
  const todayStart = bdStartOfDay(targetDate);
  const todayEnd = bdEndOfDay(targetDate);

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
      createdBy: true,
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
      doc.text(safeString(apt.createdBy), colPositions.ref + 5, currentY + 8, {
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
    // 1️⃣ OTP VALIDATION
    const otpRecord = await tx.otp.findUnique({
      where: {
        phoneNumber: payload.phoneNumber,
      },
    });

    if (!otpRecord || otpRecord.otp !== payload.otp) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'ওটিপি কোডটি সঠিক নয়।');
    }

    if (new Date() > otpRecord.otpExpires) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'ওটিপি কোডটির মেয়াদ শেষ হয়ে গেছে।');
    }

    // 2️⃣ CHECK DOCTOR
    const doctor = await tx.doctor.findUnique({
      where: {
        id: payload.doctorId,
      },
    });

    if (!doctor) {
      throw new ApiError(httpStatus.NOT_FOUND, 'ডাক্তার পাওয়া যায়নি');
    }

    // 3️⃣ CHECK CLINIC
    const clinic = await tx.clinic.findUnique({
      where: {
        id: payload.clinicId,
      },
    });

    if (!clinic) {
      throw new ApiError(httpStatus.NOT_FOUND, 'ডায়াগনস্টিক সেন্টার পাওয়া যায়নি');
    }

    // 4️⃣ CHECK MEMBERSHIP
    const membership = await tx.membership.findUnique({
      where: {
        id: payload.membershipId,
      },
    });

    if (!membership) {
      throw new ApiError(httpStatus.NOT_FOUND, 'মেম্বারশিপ পাওয়া যায়নি');
    }

    // membership validation
    if (membership.doctorId !== payload.doctorId || membership.clinicId !== payload.clinicId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'ডাক্তার এবং ক্লিনিকের মেম্বারশিপ সঠিক নয়');
    }

    // 5️⃣ DUPLICATE CHECK
    const todayStart = bdStartOfDay(new Date());
    const todayEnd = bdEndOfDay(new Date());

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
        `${payload.patientName}-এর জন্য আজকে ইতিমধ্যে বুকিং আছে।`,
      );
    }

    // 6️⃣ USER + PATIENT HANDLE
    let targetUser: any = null;
    let isNew = false;

    // LOGGED IN USER
    if (authUser) {
      targetUser = await tx.user.findUnique({
        where: {
          id: authUser.id,
        },
        include: {
          patient: true,
        },
      });

      if (!targetUser) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid user');
      }

      if (targetUser.role !== 'PATIENT') {
        throw new ApiError(httpStatus.FORBIDDEN, 'শুধুমাত্র পেশেন্ট বুকিং করতে পারবে');
      }

      // 🔥 CREATE PATIENT PROFILE IF NOT EXISTS
      if (!targetUser.patient) {
        const patientProfile = await tx.patient.create({
          data: {
            userId: targetUser.id,
            age: Number(payload.ptAge) || null,
            address: payload.address || null,
          },
        });

        targetUser.patient = patientProfile;
      }
    }

    // GUEST USER
    else {
      targetUser = await tx.user.findUnique({
        where: {
          phoneNumber: payload.phoneNumber,
        },
        include: {
          patient: true,
        },
      });

      // যদি অন্য role এর user হয়
      if (targetUser && targetUser.role !== 'PATIENT') {
        throw new ApiError(httpStatus.FORBIDDEN, 'এই নম্বরটি অন্য একাউন্টে ব্যবহার করা হয়েছে');
      }

      // NEW USER
      if (!targetUser) {
        isNew = true;

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
                age: Number(payload.ptAge) || null,
                address: payload.address || null,
              },
            },
          },

          include: {
            patient: true,
          },
        });
      }

      // EXISTING USER BUT NO PATIENT PROFILE
      if (!targetUser.patient) {
        const patientProfile = await tx.patient.create({
          data: {
            userId: targetUser.id,
            age: Number(payload.ptAge) || null,
            address: payload.address || null,
          },
        });

        targetUser.patient = patientProfile;
      }
    }

    // 7️⃣ SERIAL NUMBER
    const todayDate = bdStartOfDay(new Date());

    const counter = await tx.appointmentCounter.upsert({
      where: {
        doctorId_clinicId_date: {
          doctorId: payload?.doctorId,
          clinicId: payload?.clinicId,
          date: todayStart,
        },
      },
      update: {
        lastSerial: { increment: 1 },
      },
      create: {
        doctorId: payload?.doctorId,
        clinicId: payload?.clinicId,
        date: todayStart,
        lastSerial: 1,
      },
    });

    const serialNumber = counter.lastSerial;

    // 8️⃣ CREATE APPOINTMENT
    const newAppointment = await tx.appointment.create({
      data: {
        patientName: payload.patientName,
        ptAge: String(payload.ptAge),
        phoneNumber: payload.phoneNumber,
        address: payload.address || null,
        note: payload.note || null,

        appointmentDate: bdNow(),

        status: 'PENDING',

        serialNumber,

        source: authUser ? 'PLATFORM' : 'PLATFORM',

        doctor: {
          connect: {
            id: payload.doctorId,
          },
        },

        clinic: {
          connect: {
            id: payload.clinicId,
          },
        },

        membership: {
          connect: {
            id: payload.membershipId,
          },
        },

        patient: {
          connect: {
            id: targetUser.patient.id,
          },
        },

        createdBy: authUser
          ? {
              connect: {
                id: authUser.id,
              },
            }
          : undefined,
      },

      include: {
        doctor: {
          include: {
            user: true,
          },
        },

        clinic: true,

        patient: {
          include: {
            user: true,
          },
        },

        membership: true,
      },
    });

    // 9️⃣ DELETE OTP
    await tx.otp.delete({
      where: {
        phoneNumber: payload.phoneNumber,
      },
    });

    // 🔟 TOKEN FOR GUEST USER
    let tokens = null;

    if (!authUser) {
      tokens = generateTokens(targetUser);

      await tx.user.update({
        where: {
          id: targetUser.id,
        },

        data: {
          refreshToken: tokens.refreshToken,
        },
      });
    }

    // 1️⃣1️⃣ SEND NOTIFICATION
    sendPushNotification(
      newAppointment.clinicId,
      'নতুন বুকিং! 🏥',
      `${newAppointment.patientName} সিরিয়াল নং ${serialNumber}`,
    ).catch((err) => console.error(err));

    // 1️⃣2️⃣ RETURN
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

      serialNumber,

      isNewUser: isNew,
    };
  });

  return result;
};

/**
 * Diagnostic Staff-এর জন্য অ্যাপয়েন্টমেন্ট তৈরি
 * এখানে clinicId ফ্রন্টএন্ড থেকে আসবে না, স্টাফের অ্যাকাউন্ট থেকে সার্ভারে বের করা হবে।
 */
const createAppointmentByDiagnosticStaff = async (payload: any, staffUserId: string) => {
  const { patientName, phoneNumber, ptAge, doctorId, address, note, membershipId } = payload;

  const user = await prisma.user.findUnique({
    where: { id: staffUserId },
    select: {
      role: true,
      clinic: {
        select: { id: true },
      },
      staff: {
        select: { clinicId: true },
      },
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const clinicId = user.role === UserRole.STAFF ? user.staff?.clinicId : user.clinic?.id;

  if (!clinicId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'আপনি কোনো ক্লিনিকের সাথে যুক্ত নন');
  }

  const todayStart = bdStartOfDay(new Date());
  const todayEnd = bdEndOfDay(new Date());

  const defaultPassword = config.default_password || 'Password@123';

  const hashedPassword = await bcrypt.hash(defaultPassword, 12);

  return prisma.$transaction(async (tx) => {
    // Duplicate check
    const existingAppointment = await tx.appointment.findFirst({
      where: {
        phoneNumber,
        doctorId,
        clinicId,
        appointmentDate: {
          gte: todayStart,
          lte: todayEnd,
        },
        status: {
          in: [AppointmentStatus.PENDING, AppointmentStatus.SCHEDULED],
        },
      },
      select: {
        serialNumber: true,
      },
    });

    if (existingAppointment) {
      throw new ApiError(
        httpStatus.CONFLICT,
        `আজকে এই নম্বর দিয়ে বুকিং আছে। সিরিয়াল: ${existingAppointment.serialNumber}`,
      );
    }

    // Patient resolve
    const patientData = await resolvePatientUser({
      tx,
      phoneNumber,
      patientName,
      address,
      ptAge,
      hashedPassword,
    });

    // Serial generation
    const counter = await tx.appointmentCounter.upsert({
      where: {
        doctorId_clinicId_date: {
          doctorId,
          clinicId,
          date: todayStart,
        },
      },
      update: {
        lastSerial: { increment: 1 },
      },
      create: {
        doctorId,
        clinicId,
        date: todayStart,
        lastSerial: 1,
      },
    });

    const appointment = await tx.appointment.create({
      data: {
        patientName,
        ptAge: String(ptAge || ''),
        phoneNumber,
        address,
        serialNumber: counter.lastSerial,
        appointmentDate: bdNow(),
        status: AppointmentStatus.SCHEDULED,
        source: AppointmentSource.STAFF,
        doctorId,
        clinicId,
        patientId: patientData.patientId,
        createdById: staffUserId,
        note: note || 'Diagnostic Entry',
        membershipId,
      },
    });

    return {
      appointment,
      isNewUser: patientData.isNewUser,
      defaultPassword: patientData.isNewUser ? defaultPassword : null,
    };
  });
};

// Update Appointment Reason/Date (Update)
const updateAppointment = async (
  id: string,
  payload: Partial<IAppointmentUpdateInput>,
): Promise<IAppointmentResponse> => {
  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Appointment ID is required');
  }

  // 1️⃣ Check appointment
  const isExist = await prisma.appointment.findUnique({
    where: { id },
    include: {
      doctor: {
        include: {
          user: true,
        },
      },
      clinic: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!isExist) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Appointment not found');
  }

  // 2️⃣ Update
  const updatedResult = await prisma.appointment.update({
    where: { id },
    data: {
      ...payload,
    },
    include: {
      doctor: {
        include: {
          user: true,
        },
      },
      clinic: {
        include: {
          user: true,
        },
      },
      membership: {
        include: {
          clinic: {
            include: {
              user: true,
            },
          },
        },
      },
      patient: {
        include: {
          user: true,
        },
      },
    },
  });

  // 3️⃣ Status transition check
  const shouldSendSMS = isExist.status === 'PENDING' && updatedResult.status === 'SCHEDULED';

  // 4️⃣ SMS (non-blocking)
  if (shouldSendSMS && updatedResult.phoneNumber) {
    setImmediate(async () => {
      try {
        const doctorName = updatedResult.doctor?.user?.name || 'Doctor';

        const serial = updatedResult.serialNumber;

        const message = `SusthiO: Your appointment with Dr. ${doctorName} is confirmed. Serial: ${serial}.`;

        // await sendSMS(updatedResult.phoneNumber, message);
      } catch (err) {
        console.error('SMS Error:', err);
      }
    });
  }

  return updatedResult as unknown as IAppointmentResponse;
};

export const AppointmentService = {
  getMyAppointments,
  getManagerAreaAppointments,
  exportDailyPdf,

  createAppointment,
  createAppointmentByDiagnosticStaff,
  updateAppointment,
};
