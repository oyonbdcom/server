import httpStatus from 'http-status';

import { catchAsync } from '../../../shared/catchAsync';
import { sendResponse } from '../../../shared/sendResponse';
import { DeviceTokenService } from './service';

const createDeviceToken = catchAsync(async (req, res) => {
  const result = await DeviceTokenService.saveTokenToDB(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Device registered for notifications successfully',
    data: result,
  });
});

export const DeviceTokenController = {
  createDeviceToken,
};
