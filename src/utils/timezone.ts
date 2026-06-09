import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

export const BD_TZ = 'Asia/Dhaka';

// ১. এখনকার সঠিক বাংলাদেশ সময় পাওয়ার জন্য
export const bdNow = () => dayjs().tz(BD_TZ);

// ২. ডাটাবেজ কুয়েরির জন্য দিনের শুরু (যেমন: ৯ জুন ২০২৬ ০০:০০:০০)
export const bdStartOfDay = (date?: string | Date) => {
  return dayjs(date).tz(BD_TZ).startOf('day').toDate();
};

// ৩. ডাটাবেজ কুয়েরির জন্য দিনের শেষ (যেমন: ৯ জুন ২০২৬ ২৩:৫৯:৫৯)
export const bdEndOfDay = (date?: string | Date) => {
  return dayjs(date).tz(BD_TZ).endOf('day').toDate();
};

// ৪. ইউজারকে দেখানোর জন্য বা ইনপুটে দেওয়ার জন্য (YYYY-MM-DD স্ট্রিং)
export const getBdDateString = (date?: string | Date) => {
  return dayjs(date).tz(BD_TZ).format('YYYY-MM-DD');
};
