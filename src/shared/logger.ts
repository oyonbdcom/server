import path from 'path';
import type { Logform } from 'winston';
import { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const { combine, timestamp, label, printf, prettyPrint } = format;

const myFormat = printf((info: Logform.TransformableInfo) => {
  const date = new Date((info.timestamp as string) || new Date());
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();
  return `${date.toDateString()}  hour:${hour}  minute:${minute}  second:${second} [${
    info.label
  }] ${info.level}: ${info.message}`;
});

const infoLogger = createLogger({
  level: 'info',
  format: combine(label({ label: 'right meow!' }), timestamp(), prettyPrint(), myFormat),
  transports: [
    new transports.Console(),
    new DailyRotateFile({
      filename: path.join(process.cwd(), 'logs', 'winston', 'success', 'success-%DATE%.log'),
      level: 'info',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
    }),
  ],
});

const errorLogger = createLogger({
  level: 'error',
  format: combine(label({ label: 'right meow!' }), timestamp(), prettyPrint(), myFormat),
  transports: [
    new DailyRotateFile({
      filename: path.join(process.cwd(), 'logs', 'winston', 'error', 'error-%DATE%.log'),
      level: 'error',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
    }),
  ],
});

export { errorLogger, infoLogger };
