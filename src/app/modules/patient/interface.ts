import z from 'zod';
import { updatePatientSchema } from './zodValidation';

import { Gender } from '@prisma/client';

export interface IPatientResponse {
  id: string;
  userId: string;
  name: string;
  phoneNumber: string;
  image: string | null;
  deactivate: boolean;
  age: number | null;
  gender: Gender | null;
  bloodGroup: string | null;
  address: string | null;
  district: string | null;
  city: string | null;
  country?: string | null;
  totalAppointments: number;
  latestAppointment: ILatestAppointment | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILatestAppointment {
  id: string;
  date: Date;
  status: string;
  doctorName?: string;
  clinicName?: string;
  medicalRecordsCount: number;
}
export interface IPatientStats {
  total: number;
  active: number;
  inactive: number;
}
// If you also need the Stats interface for the charts:

export type UpdatePatientInput = z.infer<typeof updatePatientSchema>['body'];

// export interface IPatientWithRelations {
//   appointments?: IAppointment[];
//   user: IUser;
//   prescriptions?: IPrescription[];
//   favoriteDoctors?: IFavoriteDoctor[];
//   medicalRecords?: IMedicalHistory[];
//   doctorReviews?: IDoctorReview[];
//   clinicReviews?: IClinicReview[];
// }
export const PatientFilterableFields = ['searchTerm', 'district', 'gender', 'active'];
