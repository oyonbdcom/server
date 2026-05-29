import z from 'zod';
import { IDiagnosticResponse } from '../diacnostic/interface';
import { IDoctorResponse } from '../doctor/interface';
import { IScheduleResponse } from '../schedule/interface';
import { IUserResponse } from '../user/interface';
import { createMembershipSchema, updateDiagnosticMembershipSchema } from './zodValidation';

export interface IMemberDoctor {
  id: string;
  department: string;
  specialization: string | null;
  position: string | null;
  hospital: string | null;
  user: IUserResponse;
}

export interface IMembershipResponse {
  id: string;
  fee: number;

  discount: number;
  createdAt: Date;
  updatedAt: Date;
  doctor?: IDoctorResponse | null;
  diagnostic?: IDiagnosticResponse;
  schedules?: IScheduleResponse[];
}
export type CreateMembershipInput = z.infer<typeof createMembershipSchema>['body'];
export type UpdateMembershipInput = z.infer<typeof updateDiagnosticMembershipSchema>['body'];

export const MembershipFilterableFields = ['joinAt'];
