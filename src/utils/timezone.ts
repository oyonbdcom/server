// lib/time.ts
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

export const BD_TZ = 'Asia/Dhaka';

// current BD time
export const bdNow = () => dayjs().tz(BD_TZ);

export const bdStartOfDay = (date?: string | Date) => {
  if (!date) {
    return dayjs().tz(BD_TZ).startOf('day');
  }

  // 🔥 string হলে explicit format বলো
  if (typeof date === 'string') {
    return dayjs.tz(date, 'YYYY-MM-DD', BD_TZ).startOf('day');
  }

  return dayjs(date).tz(BD_TZ).startOf('day');
};

export const bdEndOfDay = (date?: string | Date) => {
  if (!date) {
    return dayjs().tz(BD_TZ).endOf('day');
  }

  if (typeof date === 'string') {
    return dayjs.tz(date, 'YYYY-MM-DD', BD_TZ).endOf('day');
  }

  return dayjs(date).tz(BD_TZ).endOf('day');
};
