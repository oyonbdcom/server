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
const createAppointmentForGuest = catchAsync(async (req, res) => {
  const appointmentData = req.body;

  // 2. Call service with both payload and existing user ID
  const result = await AppointmentService.createAppointmentForGuest(appointmentData);

  const { refreshToken, accessToken, appointment, user } = result;

  // 3. Set Refresh Token in HTTP-only cookie for security
  const cookieOptions = {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: true, // Prevents CSRF
  };

  res.cookie('refreshToken', refreshToken, cookieOptions);

  // 4. Send response including the appointment details and access token
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Appointment booked successfully',
    data: {
      accessToken,
      user,
      appointment,
    },
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
  createAppointmentForRegisteredUser,
  createAppointmentForGuest,
  updateAppointment,
};
