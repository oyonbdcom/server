export interface IFavoriteDoctorResponse {
  id: string;
  userId: string;
  doctorId: string;
  patientId: string;
  createdAt: Date;
}
// Interface for creating a new favorite doctor entry
export interface ICreateFavoriteDoctor {
  userId: string;
  doctorId: string;
  patientId: string;
}

// Interface for updating an existing favorite doctor entry
export interface IUpdateFavoriteDoctor {
  userId?: string;
  doctorId?: string;
  patientId?: string;
}
