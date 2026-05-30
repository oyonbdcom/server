import httpStatus from 'http-status';

import prisma from '../../../prisma/client';
import { catchAsync } from '../../../shared/catchAsync';
import { sendResponse } from '../../../shared/sendResponse';
import ApiError from '../../../utils/apiError';
import { StaffService } from './service';

const createStaff = catchAsync(async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
    }

    const result = await StaffService.createStaff(userId, req.body);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'স্টাফ তৈরি হয়েছে',
      data: result,
    });
  } catch (error) {
    console.error('CREATE STAFF ERROR:', error); // 🔥 THIS IS KEY
    throw error;
  }
});
const getAllStaff = catchAsync(async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
    }

    // 1. Find the diagnostic ID tied to this user
    const diagnostic = await prisma.diagnostic.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!diagnostic) {
      throw new ApiError(httpStatus.NOT_FOUND, 'ক্লিনিক পাওয়া যায়নি');
    }

    // 2. Fetch all staff matching the diagnostic ID
    const result = await StaffService.getAllStaffForDiagnostic(diagnostic.id);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'সকল স্টাফের তালিকা সফলভাবে আনা হয়েছে',
      data: result,
    });
  } catch (error) {
    console.error('GET ALL STAFF ERROR:', error);
    throw error;
  }
});

const updateStaff = catchAsync(async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
    }

    const { id: staffId } = req.params as { id: string };
    const result = await StaffService.updateStaff(staffId, req.body);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'স্টাফের তথ্য আপডেট করা হয়েছে',
      data: result,
    });
  } catch (error) {
    console.error('UPDATE STAFF ERROR:', error);
    throw error;
  }
});
const deleteStaff = catchAsync(async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
    }

    const { id: staffId } = req.params as { id: string };
    const result = await StaffService.deleteStaff(staffId);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'স্টাফ সফলভাবে মুছে ফেলা হয়েছে',
      data: result,
    });
  } catch (error) {
    console.error('DELETE STAFF ERROR:', error);
    throw error;
  }
});
export const StaffController = {
  createStaff,
  getAllStaff,
  updateStaff,
  deleteStaff,
};
