import httpStatus from 'http-status';
import { IGenericResponse } from './../../../interface/common';

import { AppointmentStatus, Prisma } from '@prisma/client';

import prisma from '../../../prisma/client';
import ApiError from '../../../utils/apiError';

import bcrypt from 'bcrypt';
import { JwtPayload } from 'jsonwebtoken';
import { IOptions, paginationCalculator } from '../../../helper';
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
  const [result, total, scheduledCount, completedCount, cancelledCount] = await Promise.all([
    prisma.appointment.findMany({
      where: dataWhere,
      skip,
      take: limit,
      orderBy: sortBy && sortOrder ? { [sortBy]: sortOrder } : { serialNumber: 'asc' },
      include: appointmentPopulate,
    }),
    prisma.appointment.count({ where }),
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
    },
  };
};
// 1. Updated Interface for the unified response
interface BookingAuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  appointment: IAppointmentResponse;
}

// ... existing imports

const createAppointmentForGuest = async (
  payload: IAppointmentCreateInput & {
    guest: { email: string; name: string; password?: string; phoneNumber?: string };
  },
): Promise<BookingAuthResponse> => {
  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // 1. Check if email already exists
    let user = await tx.user.findUnique({ where: { email: payload.guest.email } });
    if (user) {
      throw new ApiError(httpStatus.CONFLICT, 'Email already registered. Please login to book.');
    }

    // 2. Create User & Patient Profile
    const hashedPassword = await bcrypt.hash(payload.guest.password || 'Default123!', 10);
    user = await tx.user.create({
      data: {
        email: payload.guest.email,
        name: payload.guest.name,
        password: hashedPassword,
        role: 'PATIENT',
        patient: { create: { phoneNumber: payload?.guest?.phoneNumber } },
      },
    });

    // 3. Create Appointment (Added 'include' to access patient name for notification)
    const newAppointment = await tx.appointment.create({
      data: {
        appointmentDate: new Date(),
        status: 'SCHEDULED',
        code: generateAppointmentCode(6),
        doctor: { connect: { id: payload.doctorId } },
        patient: { connect: { id: user.id } },
        clinic: { connect: { id: payload.clinicId } },
      },
      include: {
        patient: { select: { name: true } },
      },
    });

    // 4. Generate Tokens
    const tokens = generateTokens(user);
    await tx.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken, lastLoginAt: new Date() },
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      appointment: newAppointment as any,
    };
  });

  // 5. Send Notification (Call outside transaction for better performance)
  if (result.appointment) {
    sendPushNotification(
      result.appointment.clinicId,
      'New Booking! 🏥',
      `New appointment from ${result.user.name}`,
    );
  }

  return result;
};

const createAppointmentForRegisteredUser = async (
  userId: string,
  payload: IAppointmentCreateInput,
): Promise<IAppointmentResponse> => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const existingAppointment = await prisma.appointment.findFirst({
    where: {
      patientId: userId,
      doctorId: payload.doctorId,
      appointmentDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
      status: { not: 'CANCELLED' },
    },
  });

  if (existingAppointment) {
    throw new ApiError(
      httpStatus.CONFLICT,
      'You already have an appointment with this doctor today.',
    );
  }
  const result = await prisma.$transaction(async (tx) => {
    let userWithPatient = await tx.user.findUnique({
      where: { id: userId },
      include: { patient: true },
    });

    if (!userWithPatient) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    if (!userWithPatient.patient) {
      const newPatient = await tx.patient.create({
        data: { userId: userId },
      });
      userWithPatient.patient = newPatient;
    }

    return await tx.appointment.create({
      data: {
        appointmentDate: new Date(),
        status: 'SCHEDULED',
        code: generateAppointmentCode(6),
        doctor: { connect: { id: payload.doctorId } },
        clinic: { connect: { id: payload.clinicId } },
        patient: { connect: { id: userWithPatient.id } },
      },
      include: appointmentPopulate,
    });
  });

  // Trigger Notification for Registered User
  if (result) {
    sendPushNotification(
      result.clinicId,
      'New Booking! 🏥',
      `New appointment from ${result.patient?.name || 'Registered User'}`,
    );
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
  createAppointmentForRegisteredUser,
  createAppointmentForGuest,
  updateAppointment,
};
