import { UserRole } from '@prisma/client';

export interface IUserResponse {
  id: string;
  name: string;
  phoneNumber: string;
  role: UserRole;
  image?: string | null;
  lastActiveAt?: Date | null;
  lastLoginAt?: Date | null;

  doctor?: any;
  patient?: any;
  clinic?: any;
}

export const UserFilterableFields = ['searchTerm', 'role', 'emailVerified', 'active'];
