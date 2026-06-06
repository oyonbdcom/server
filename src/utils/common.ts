export const phoneRegex = /^(?:\+88|88)?(01[3-9]\d{8})$/;

export const banglaRegex = /^[ঀ-৿\s.,।/()\-]+$/;
export const generatePatientId = async (tx: any) => {
  const count = await tx.patient.count();

  return `PAT-${String(count + 1).padStart(5, '0')}`;
};
