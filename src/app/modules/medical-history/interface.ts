import z from 'zod';
import { createMedicalHistorySchema, updateMedicalHistorySchema } from './zodValidation';
export enum MedicalRecordsType {
  REPORT,
  PRESCRIPTION,
}

export interface IMedicalRecordResponse {
  id: string;
  name: string;
  description: string | null;
  date: Date;
  document: string | null;
  appointmentId: string;
}

export type IMedicalHistoryCreateInput = z.infer<typeof createMedicalHistorySchema>['body'];
export type IMedicalHistoryUpdateInput = z.infer<typeof updateMedicalHistorySchema>['body'];
