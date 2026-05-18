import httpStatus from 'http-status';

import { catchAsync } from '../../../shared/catchAsync';
import { sendResponse } from '../../../shared/sendResponse';

import { JwtPayload } from 'jsonwebtoken';
import { paginationFields } from '../../../constants/pagination';
import pick from '../../../helper/pick';
import ApiError from '../../../utils/apiError';
import { AppointmentsFilterableFields } from './constant';
import { IAppointmentResponse, IAppointmentStats } from './interface';
import { AppointmentService } from './service';

const createAppointment = catchAsync(async (req, res) => {
  const appointmentData = req.body;
  const authUser = req.user as JwtPayload;

  const result = await AppointmentService.createAppointment(appointmentData, authUser);

  // 📤 Response (token optional)
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Appointment booked successfully',
    data: result,
  });
});

const createAppointmentByDiagnosticStaff = catchAsync(async (req, res) => {
  const appointmentData = req.body;
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
  }
  // 2. Call service with both payload and existing user ID
  const result = await AppointmentService.createAppointmentByDiagnosticStaff(
    appointmentData,
    userId,
  );

  // 4. Send response including the appointment details and access token
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Appointment booked successfully',
    data: result,
  });
});

const getPatientAppointments = catchAsync(async (req, res) => {
  const user = req.user as JwtPayload;

  const paginationOptions = pick(req.query, paginationFields);

  // =====================================================
  // SERVICE CALL
  // =====================================================
  const result = await AppointmentService.getPatientAppointments(user?.id, paginationOptions);

  // =====================================================
  // RESPONSE
  // =====================================================
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Appointments fetched successfully',
    data: result.data,
    meta: result.meta,
    //  queueMap: result.queueMap,
  });
});

const getMyAppointments = catchAsync(async (req, res) => {
  const user = req.user as JwtPayload;
  const paginationOptions = pick(req.query, paginationFields);

  const filters = pick(req.query, AppointmentsFilterableFields);

  const result = await AppointmentService.getMyAppointments(user, filters, paginationOptions);

  sendResponse<IAppointmentResponse[], IAppointmentStats>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Appointments retrieved successfully',
    meta: result?.meta || undefined,
    data: result?.data || null,
    stats: result?.stats,
  });
});

// manager appointments
const getCoordinatorDashboard = catchAsync(async (req, res) => {
  const user = (req as any).user;
  const paginationOptions = pick(req.query, paginationFields);

  const filters = pick(req.query, AppointmentsFilterableFields);

  const result = await AppointmentService.getCoordinatorDashboard(
    user.id,
    filters,
    paginationOptions,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,

    success: true,

    message: 'কোঅর্ডিনেটর ড্যাশবোর্ড সফলভাবে পাওয়া গেছে',

    meta: result.meta,

    data: result.data,

    stats: result.stats,
  });
});

// ======================================================
// CONTROLLER
// ======================================================

const requestEmergency = catchAsync(async (req, res) => {
  const user = req.user as JwtPayload;
  const result = await AppointmentService.requestEmergency(user?.id, req.params.id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Emergency request sent successfully',
    data: result,
  });
});

const acceptEmergency = catchAsync(async (req, res) => {
  const result = await AppointmentService.acceptEmergencyAppointment(req.params.id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Emergency request sent successfully',
    data: result,
  });
});

const rejectEmergency = catchAsync(async (req, res) => {
  const result = await AppointmentService.rejectEmergency(req.params.id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Emergency request rejected',
    data: result,
  });
});

const completeAppointment = catchAsync(async (req, res) => {
  const result = await AppointmentService.completeAppointment(req.params.id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Appointment completed successfully',
    data: result,
  });
});
const updateDoctorSession = catchAsync(async (req, res) => {
  const newStatus = req.body;
  console.log(newStatus);
  const user = req.user as JwtPayload;
  const result = await AppointmentService.updateDoctorSession(
    user.id as string,
    newStatus?.newStatus,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Doctor Session update successfully',
    data: result,
  });
});

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
  getPatientAppointments,
  getMyAppointments,
  rejectEmergency,
  requestEmergency,
  acceptEmergency,
  completeAppointment,
  createAppointmentByDiagnosticStaff,
  getCoordinatorDashboard,
  updateDoctorSession,
  createAppointment,
  updateAppointment,
};
