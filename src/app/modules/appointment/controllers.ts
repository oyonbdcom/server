import httpStatus from 'http-status';

import { catchAsync } from '../../../shared/catchAsync';
import { sendResponse } from '../../../shared/sendResponse';

import { paginationFields } from '../../../constants/pagination';
import pick from '../../../helper/pick';
import ApiError from '../../../utils/apiError';
import { AppointmentsFilterableFields } from './constant';
import { IAppointmentResponse, IAppointmentStats } from './interface';
import { AppointmentService } from './service';

// Create Appointment
const sendBookingOtp = catchAsync(async (req, res) => {
  const payload = req.body;

  if (!payload) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'ফোন নম্বর প্রদান করা আবশ্যক');
  }

  const result = await AppointmentService.sendBookingOtp(payload);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: null,
  });
});
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
const createAppointmentForRegisteredUser = catchAsync(async (req, res) => {
  const appointmentData = req.body;
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
  }
  // 2. Call service with both payload and existing user ID
  const result = await AppointmentService.createAppointmentForRegisteredUser(
    userId,
    appointmentData,
  );

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
  createAppointmentForRegisteredUser,
  createAppointment,
  updateAppointment,
  exportDoctorDailyPdf,
  sendBookingOtp,
};
