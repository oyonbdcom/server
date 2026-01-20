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

const getClinicMemberships = catchAsync(async (req, res) => {
  const userId = req.user?.id;
  const paginationOptions = pick(req.query, paginationFields);

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized ');
  }

  const result = await MembershipService.getClinicMemberships(userId, paginationOptions);

  sendResponse<IMembershipResponse[]>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Memberships retrieved successfully',
    data: result?.data || null,
  });
});
const updateMemberships = catchAsync(async (req, res) => {
  const userId = req.user?.id;
  const { membershipId } = req.params as { membershipId: string };

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized ');
  }

  const result = await MembershipService.updateMembership(userId, membershipId, req.body);

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
  getClinicMemberships,
  updateMemberships,
  deleteMembership,
};
