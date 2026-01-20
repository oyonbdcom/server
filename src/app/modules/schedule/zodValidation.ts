/* eslint-disable prefer-const */
import { z } from 'zod';

const timeRegex = /^(0?[1-9]|1[0-2]):[0-5][0-9]\s(AM|PM)$/;

const timeToMinutes = (time: string) => {
  const [hourMin, period] = time.split(' ');
  let [hours, minutes] = hourMin.split(':').map(Number);
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

// 1. Base shape for reuse
const scheduleBaseShape = z.object({
  membershipId: z.string().cuid(),
  days: z.array(z.string()).min(1, 'Please select at least one day'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
});

const timeRefinement = (data: { startTime?: string; endTime?: string }) => {
  if (!data.startTime || !data.endTime) return true;
  return timeToMinutes(data.endTime) > timeToMinutes(data.startTime);
};

const timeErrorConfig = {
  message: 'End time must be later than start time',
  path: ['endTime'],
};

// 2. Create Schema wrapped in 'body'
export const createScheduleSchema = z.object({
  body: scheduleBaseShape.refine(timeRefinement, timeErrorConfig),
});

// 3. Update Schema wrapped in 'body'
export const updateScheduleSchema = z.object({
  body: scheduleBaseShape
    .partial()
    .extend({
      // For updates, the ID usually comes from the URL params,
      // but if you want it in the body:
      id: z.string().cuid().optional(),
    })
    .refine(timeRefinement, timeErrorConfig),
});

export const scheduleSchema = z.object({
  body: z.object({
    id: z.string().cuid(),
    membershipId: z.string().cuid(),
    days: z.array(z.string()).min(1, 'Please select at least one day'),
    startTime: z.string().regex(timeRegex, 'Invalid start time format'),
    endTime: z.string().regex(timeRegex, 'Invalid end time format'),
    createdAt: z.string().or(z.date()),
    updatedAt: z.string().or(z.date()),
  }),
});

export const ScheduleZodValidation = {
  scheduleSchema,
  createScheduleSchema,
  updateScheduleSchema,
};
