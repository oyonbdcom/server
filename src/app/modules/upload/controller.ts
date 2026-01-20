import httpStatus from 'http-status';
import { catchAsync } from '../../../shared/catchAsync';
import { sendResponse } from '../../../shared/sendResponse';
import ApiError from '../../../utils/apiError';
import { IFile, IFiles } from './interface';

export const uploadSingleFile = catchAsync(async (req, res) => {
  if (!req.file) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'No file uploaded');
  }

  sendResponse<IFile>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User profile retrieved successfully',
    data: {
      url: req.file.path,
    },
  });
});

const uploadMultipleFiles = catchAsync(async (req, res) => {
  if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
    throw new ApiError(400, 'No files uploaded');
  }

  const urls = req.files.map((file: Express.Multer.File) => file.path);

  sendResponse<IFiles>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Files uploaded successfully',
    data: { urls },
  });
});

export const FileController = {
  uploadSingleFile,
  uploadMultipleFiles,
};
