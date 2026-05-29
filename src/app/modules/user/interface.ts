import { UserRole } from '@prisma/client';
import { IDiagnosticResponse } from '../diacnostic/interface';

export interface IUserResponse {
  id: string;
  name: string;
  phoneNumber: string;
  role: UserRole;
  image?: string | null;

  doctor?: any;
  patient?: any;
  diagnostic?: IDiagnosticResponse;
}

export const UserFilterableFields = ['searchTerm', 'role', 'emailVerified', 'active'];
