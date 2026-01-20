import { UserRole } from '@prisma/client';

export interface IUserResponse {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  image?: string | null;
  lastActiveAt?: Date | null;
  lastLoginAt?: Date | null;
  // Included relations (Optional based on your query)
  doctor?: any;
  patient?: any;
  clinic?: any;
}

export const UserFilterableFields = ['searchTerm', 'role', 'emailVerified', 'active'];
