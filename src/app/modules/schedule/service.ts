import { Schedule } from '@prisma/client';
import httpStatus from 'http-status';
import prisma from '../../../prisma/client';
import ApiError from '../../../utils/apiError';

/**
 * Create a new schedule
 */
const createSchedule = async (data: any): Promise<Schedule> => {
  const isMembershipExist = await prisma.membership.findUnique({
    where: { id: data.membershipId },
  });

  if (!isMembershipExist) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Clinic Membership not found');
  }

  const result = await prisma.schedule.create({
    data,
  });

  return result;
};

/**
 * Update an existing schedule
 */
const updateSchedule = async (id: string, payload: Partial<Schedule>): Promise<Schedule> => {
  const isExist = await prisma.schedule.findUnique({
    where: { id },
  });

  if (!isExist) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Schedule not found');
  }

  const result = await prisma.schedule.update({
    where: { id },
    data: payload,
  });

  return result;
};

/**
 * Delete a schedule
 */
const deleteSchedule = async (id: string): Promise<Schedule> => {
  const isExist = await prisma.schedule.findUnique({
    where: { id },
  });

  if (!isExist) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Schedule not found');
  }

  const result = await prisma.schedule.delete({
    where: { id },
  });

  return result;
};

export const ScheduleService = {
  createSchedule,
  updateSchedule,
  deleteSchedule,
};
