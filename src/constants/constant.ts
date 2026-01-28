import z from 'zod';

export const userRoleEnum = z.enum(['PATIENT', 'ADMIN', 'CLINIC', 'DOCTOR']);
export const nameRegex = /^[A-Za-z\u0980-\u09FF\s.]+$/;
// ফোন নম্বর: ইংরেজি (017...) এবং বাংলা (০১৭১...) উভয় সংখ্যা সাপোর্ট করবে
export const phoneRegex = /^(?:\+88|88)?(?:01[3-9]\d{8}|[০-৯]{11})$/;
