import httpStatus from 'http-status';

import { paginationFields } from '../../../constants/pagination';
import pick from '../../../helper/pick';
import { catchAsync } from '../../../shared/catchAsync';
import { sendResponse } from '../../../shared/sendResponse';
import ApiError from '../../../utils/apiError';
import { DoctorFilterableFields } from './constant';
import { IDoctorResponse } from './interface';
import { DoctorService } from './service';

const createDoctor = catchAsync(async (req, res) => {
  const result = await DoctorService.createDoctor(req.body);
  sendResponse<IDoctorResponse>(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Doctors retrieved successfully',

    data: result || null,
  });
});

// add to area
const addDoctorToArea = catchAsync(async (req, res) => {
  const userId = req.user?.id;
  const { doctorId } = req.body;
  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'You are not authorized');
  }

  const result = await DoctorService.addDoctorToArea(doctorId, userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Doctor added to your area successfully!',
    data: result,
  });
});

// remove from area
const removeDoctorFromArea = catchAsync(async (req, res) => {
  const { doctorId } = req.body;
  const user = req.user;
  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'You are not authorized');
  }
  const result = await DoctorService.removeDoctorFromArea(doctorId, user?.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'ডাক্তারকে আপনার এরিয়া থেকে সফলভাবে রিমুভ করা হয়েছে!',
    data: result,
  });
});

const getDoctors = catchAsync(async (req, res) => {
  const paginationOptions = pick(req.query, paginationFields);

  const filter = pick(req.query, DoctorFilterableFields);
  const userId = req.user?.id;
  const result = await DoctorService.getDoctors(filter, paginationOptions, userId);

  sendResponse<IDoctorResponse[]>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Doctors retrieved successfully',
    meta: result?.meta || null,
    data: result?.data || null,
  });
});
const getAllDoctorForManager = catchAsync(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
  }
  const result = await DoctorService.getAllDoctorForManager(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'ক্লিনিক লিস্ট সফলভাবে পাওয়া গেছে',
    data: result,
  });
});

const getDoctorById = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };

  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'userid is required');
  }
  const result = await DoctorService.getDoctorById(id);

  sendResponse<IDoctorResponse>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Doctors retrieved successfully',
    data: result,
  });
});
// const getDoctorStats = catchAsync(async (req, res) => {
//   const result = await DoctorService.getDoctorStats();

//   sendResponse<IDoctorStats>(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: 'Doctors statics retrieved successfully',
//     data: result,
//   });
// });

const updateDoctor = catchAsync(async (req, res) => {
  const { doctorId } = req.params as { doctorId: string };

  const result = await DoctorService.updateDoctor(doctorId, req.body);
  sendResponse<IDoctorResponse>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Doctor updated successfully',
    data: result,
  });
});

// const deleteDoctor = catchAsync(async (req, res) => {
//   const { userId } = req?.params as { userId: string };
//   if (!userId) {
//     throw new ApiError(httpStatus.BAD_REQUEST, 'userid is required');
//   }
//   const deletedDoctor = await DoctorService.deleteDoctor(userId);

//   sendResponse<IDoctorResponse>(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: 'Doctor deleted successfully',
//     data: deletedDoctor,
//   });
// });

export const DoctorController = {
  createDoctor,
  getDoctors,
  getAllDoctorForManager,
  getDoctorById,
  updateDoctor,
  addDoctorToArea,
  removeDoctorFromArea,
};
