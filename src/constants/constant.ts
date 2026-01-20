import z from 'zod';

export const userRoleEnum = z.enum(['PATIENT', 'ADMIN', 'CLINIC', 'DOCTOR']);
