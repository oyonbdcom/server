import httpStatus from 'http-status';
import { catchAsync } from '../../../shared/catchAsync';
import { sendResponse } from '../../../shared/sendResponse';
import ApiError from '../../../utils/apiError';
import { IScheduleResponse } from './interface';
import { ScheduleService } from './service';

const createSchedule = catchAsync(async (req, res) => {
  const payload = req.body;

  // Logic: Create a new schedule linked to a membership
  const result = await ScheduleService.createSchedule(payload);

  sendResponse<IScheduleResponse>(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Schedule created successfully',
    data: result,
  });
});

const updateSchedule = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string }; // Get schedule ID from URL params
  const payload = req.body;

  if (!id) throw new ApiError(httpStatus.BAD_REQUEST, 'Schedule ID is required');

  // Logic: Update the specific schedule using its ID and the data payload
  const result = await ScheduleService.updateSchedule(id, payload);

  sendResponse<IScheduleResponse>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Schedule updated successfully',
    data: result,
  });
});

const deleteSchedule = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };

  if (!id) throw new ApiError(httpStatus.BAD_REQUEST, 'Schedule ID is required');

  await ScheduleService.deleteSchedule(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Schedule deleted successfully',
    data: null,
  });
});

export const ScheduleController = {
  createSchedule,
  updateSchedule,
  deleteSchedule,
};
