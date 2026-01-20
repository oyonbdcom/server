import httpStatus from 'http-status';
import { paginationFields } from '../../../constants/pagination';
import pick from '../../../helper/pick';

import { catchAsync } from '../../../shared/catchAsync';
import { sendResponse } from '../../../shared/sendResponse';
import ApiError from '../../../utils/apiError';
import { IUserResponse, UserFilterableFields } from './interface';
import { UserService } from './service';

const getCurrentUser = catchAsync(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) throw new ApiError(httpStatus.UNAUTHORIZED, 'Not authenticated');

  const user = await UserService.getCurrentUser(userId);

  sendResponse<IUserResponse>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User profile retrieved successfully',
    data: user,
  });
});

const getUsers = catchAsync(async (req, res) => {
  const paginationOptions = pick(req.query, paginationFields);

  const filter = pick(req.query, UserFilterableFields);

  const result = await UserService.getUsers(filter, paginationOptions);

  sendResponse<IUserResponse[]>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Users retrieved successfully',
    meta: result?.meta || null,
    data: result?.data || null,
  });
});

const getUserById = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  const user = await UserService.getUserById(id);

  sendResponse<IUserResponse>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User retrieved successfully',
    data: user,
  });
});

const updateUserRole = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  const { role } = req.body;

  const updatedUser = await UserService.updateUserRole(id, role);

  sendResponse<IUserResponse>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User role updated successfully',
    data: updatedUser,
  });
});

const deleteUser = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  await UserService.deleteUser(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User deleted successfully',
    data: null,
  });
});

export const UserController = {
  getUsers,
  getUserById,
  updateUserRole,
  deleteUser,
  getCurrentUser,
};
