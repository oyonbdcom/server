import httpStatus from 'http-status';
import { paginationFields } from '../../../constants/pagination';
import pick from '../../../helper/pick';

import { catchAsync } from '../../../shared/catchAsync';
import { sendResponse } from '../../../shared/sendResponse';
import ApiError from '../../../utils/apiError';

import { IMembershipResponse } from './interface';
import { MembershipService } from './service';

const createMembership = catchAsync(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'userid is required');
  }
  const result = await MembershipService.createMembership(userId, req.body);
  sendResponse<IMembershipResponse>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Membership created successfully',

    data: result || null,
  });
});
const getMembershipsBySlug = catchAsync(async (req, res) => {
  const slug = req.params.slug as string;

  // পেজিনেশন এবং ফিল্টারিং অপশন পিক করা
  const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder']);

  const result = await MembershipService.getMembershipsBySlug(slug, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'মেম্বারশিপ ডাটা সফলভাবে পাওয়া গিয়েছে',
    meta: result.meta,
    data: result.data,
  });
});
const getDiagnosticMemberDoctors = catchAsync(async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'আপনি লগইন করা নেই');
  }

  // ✅ pagination
  const paginationOptions = pick(req.query, paginationFields);

  // ✅ filters (সব একসাথে)
  const filters = pick(req.query, ['searchTerm', 'diagId', 'doctorId']);

  const result = await MembershipService.getDiagnosticMemberDoctors(
    userId,
    filters,
    paginationOptions,
  );

  sendResponse<IMembershipResponse[]>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'আপনার তৈরি করা মেম্বারশিপগুলো সফলভাবে পাওয়া গেছে',
    meta: result?.meta,
    data: result?.data,
  });
});

//update membership
const updateMemberships = catchAsync(async (req, res) => {
  const { membershipId } = req.params as { membershipId: string };

  const result = await MembershipService.updateMembership(membershipId, req?.body);

  sendResponse<IMembershipResponse>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Memberships retrieved successfully',
    data: result || null,
  });
});

const deleteMembership = catchAsync(async (req, res) => {
  const { membershipId } = req.params as { membershipId: string };

  const id = req.user?.id;
  if (!id) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
  }
  await MembershipService.deleteMembership(membershipId, id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Membership deleted successfully',
    data: null,
  });
});

export const MembershipController = {
  createMembership,
  getDiagnosticMemberDoctors,
  updateMemberships,
  getMembershipsBySlug,
  deleteMembership,
};
