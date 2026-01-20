// src/app/utils/notification.utils.ts
import admin from 'firebase-admin';
import prisma from '../prisma/client';

export const sendPushNotification = async (userId: string, title: string, body: string) => {
  // 1. Get all devices for this user (Clinic Owner)
  const devices = await prisma.deviceToken.findMany({
    where: { userId },
  });

  if (devices.length === 0) return;

  const tokens = devices.map((d) => d.token);

  const message = {
    notification: { title, body },
    tokens: tokens,
  };

  try {
    // 2. Send via Firebase
    const response = await admin.messaging().sendEachForMulticast(message);

    // 3. Cleanup: If Firebase says a token is invalid, delete it from our DB
    response.responses.forEach(async (resp, idx) => {
      if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
        await prisma.deviceToken.delete({ where: { token: tokens[idx] } });
      }
    });
  } catch (error) {
    console.error('FCM Send Error:', error);
  }
};
