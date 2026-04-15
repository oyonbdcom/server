import httpStatus from 'http-status';

import { catchAsync } from '../../../shared/catchAsync';
import { sendResponse } from '../../../shared/sendResponse';

import { paginationFields } from '../../../constants/pagination';
import pick from '../../../helper/pick';
import ApiError from '../../../utils/apiError';
import { AppointmentsFilterableFields } from './constant';
import { IAppointmentResponse, IAppointmentStats } from './interface';
import { AppointmentService } from './service';

const createAppointment = catchAsync(async (req, res) => {
  const appointmentData = req.body;
  const authUser = req.user;

  const result = await AppointmentService.createAppointment(appointmentData, authUser);

  const { refreshToken, accessToken, appointment, user } = result;

  // Prevents CSRF };

  // 🍪 Only set cookie if refreshToken exists (guest user)
  if (refreshToken) {
    const cookieOptions = {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: true,
    };

    res.cookie('refreshToken', refreshToken, cookieOptions);
  }

  // 📤 Response (token optional)
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Appointment booked successfully',
    data: {
      ...(accessToken && { accessToken }),
      user,
      appointment,
    },
  });
});

const createAppointmentForAdmin = catchAsync(async (req, res) => {
  const appointmentData = req.body;

  // 2. Call service with both payload and existing user ID
  const result = await AppointmentService.createAppointmentForAdmin(appointmentData);

  // 4. Send response including the appointment details and access token
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Appointment booked successfully',
    data: result,
  });
});

const getMyAppointments = catchAsync(async (req, res) => {
  const user = req.user;
  const paginationOptions = pick(req.query, paginationFields);

  const filters = pick(req.query, AppointmentsFilterableFields);

  const result = await AppointmentService.getMyAppointments(user, filters, paginationOptions);

  sendResponse<IAppointmentResponse[], IAppointmentStats>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Appointments retrieved successfully',
    meta: result?.meta || null,
    data: result?.data || null,
    stats: result?.stats,
  });
});

// manager appointments
const getManagerAreaAppointments = catchAsync(async (req, res) => {
  const user = (req as any).user;
  const filters = pick(req.query, AppointmentsFilterableFields);
  const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder']);

  const result = await AppointmentService.getManagerAreaAppointments(user.id, filters, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'এরিয়া অ্যাপয়েন্টমেন্ট সফলভাবে পাওয়া গেছে',
    meta: result.meta,
    data: result.data,
  });
});

// export data
const exportDoctorDailyPdf = catchAsync(async (req, res) => {
  const filters = pick(req.query, AppointmentsFilterableFields);
  const userId = req.user?.id;

  // 2. Your existing validation handles the 'undefined' case
  if (!userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'doctorId is required');
  }

  // 3. TS is now happy because doctorId is guaranteed to be a string here
  const pdfBuffer = await AppointmentService.exportDailyPdf(userId, filters);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="doctor-opd-list.pdf"');
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Appointment updated successfully',
    data: pdfBuffer,
  });
});

// Reschedule/Update Appointment
const updateAppointment = catchAsync(async (req, res) => {
  const aptId = req.params.aptId as string;

  const updateData = req.body;
  if (!aptId) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not fount');
  }
  const result = await AppointmentService.updateAppointment(aptId, updateData);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Appointment updated successfully',
    data: result,
  });
});

export const AppointmentsController = {
  getMyAppointments,
  createAppointmentForAdmin,
  getManagerAreaAppointments,
  createAppointment,
  updateAppointment,
  exportDoctorDailyPdf,
};
