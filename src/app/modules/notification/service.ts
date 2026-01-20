import prisma from '../../../prisma/client';

const saveTokenToDB = async (payload: { userId: string; token: string; platform?: string }) => {
  const result = await prisma.deviceToken.upsert({
    where: {
      token: payload.token,
    },
    update: {
      userId: payload.userId,
      platform: payload.platform,
    },
    create: {
      userId: payload.userId,
      token: payload.token,
      platform: payload.platform,
    },
  });

  return result;
};

export const DeviceTokenService = {
  saveTokenToDB,
};
