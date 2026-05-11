// lib/time.ts
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

export const BD_TZ = 'Asia/Dhaka';

// current BD time
export const bdNow = () => dayjs().tz(BD_TZ).toDate();

export const bdStartOfDay = (date?: string | Date): Date => {
  return dayjs
    .tz(date || new Date(), BD_TZ)
    .startOf('day')
    .toDate();
};

export const bdEndOfDay = (date?: string | Date): Date => {
  return dayjs
    .tz(date || new Date(), BD_TZ)
    .endOf('day')
    .toDate();
};
