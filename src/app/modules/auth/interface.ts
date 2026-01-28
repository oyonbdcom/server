import { UserRole } from '@prisma/client';

export type ILoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    phoneNumber: string;
    image: string | null;
    role: UserRole;
  };
};
