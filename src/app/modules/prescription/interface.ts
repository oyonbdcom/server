export interface IPrescriptionResponse {
  id: string;
  doctorId: string;
  patientId: string;
  appointmentId?: string;
  image?: string;
  createdAt: Date;
  updatedAt: Date;
}
// Interface for creating a new prescription
export interface ICreatePrescription {
  doctorId: string;
  patientId: string;
  appointmentId?: string;
  image?: string;
}

// Interface for updating an existing prescription
export interface IUpdatePrescription {
  doctorId?: string;
  patientId?: string;
  appointmentId?: string;
  image?: string;
}
