// src/config/index.ts
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

export default {
  env: process.env.NODE_ENV || 'development',
  origin: process.env.ORIGIN || 'http://localhost:3000',
  default_password: process.env.DEFAULT_PASSWORD,
  site: {
    siteName: process.env.SITE_NAME,
  },
  port: Number(process.env.PORT) || 4000,
  database_url: process.env.DATABASE_URL as string,
  jwt: {
    access_secret: process.env.JWT_ACCESS_SECRET as string,
    refresh_secret: process.env.JWT_REFRESH_SECRET as string,
    access_expires_in: process.env.ACCESS_TOKEN_EXPIRES_IN || '5m',
    refresh_expires_in: process.env.REFRESH_TOKEN_EXPIRES_IN || '365d',
  },
  bcrypt_salt_rounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 12,
  email_user: process.env.EMAIL_USER,
  email_password: process.env.EMAIL_PASSWORD,
  cloudinary: {
    cloudinary_name: process.env.CLOUDINARY_CLOUD_NAME,
    cloudinary_api_key: process.env.CLOUDINARY_API_KEY,
    cloudinary_api_secret: process.env.CLOUDINARY_API_SECRET,
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  sms: {
    sms_api_key: process.env.SMS_API_KEY,
    sender_id: '8809648906025',
  },
};
