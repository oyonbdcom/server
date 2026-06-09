import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { catchAsync } from '../../../shared/catchAsync';
import { sendResponse } from '../../../shared/sendResponse';
import ApiError from '../../../utils/apiError';
import { WalletService } from './service';

// ১. নতুন ট্রানজ্যাকশন ক্রিয়েট
export const createEntry = catchAsync(async (req: Request, res: Response) => {
  const validatedData = req.body;
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
  }
  const result = await WalletService.createLedgerEntry(userId, validatedData);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Wallet entry created successfully',
    data: result,
  });
});

// ২. ট্রানজ্যাকশন হিস্ট্রি দেখা
export const getHistory = catchAsync(async (req: Request, res: Response) => {
  const diagId = req.params.diagId as string;
  const result = await WalletService.getLedgerByDiagId(diagId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Wallet history retrieved successfully',
    data: result,
  });
});

// ৩. ট্রানজ্যাকশন স্ট্যাটাস আপডেট
export const updateStatus = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { status } = req.body;
  const result = await WalletService.updateLedgerStatus(id, status);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Transaction status updated successfully',
    data: result,
  });
});
export const WalletController = {
  createEntry,
  getHistory,
  updateStatus,
};
