import { UserRole } from '@prisma/client';
import { z } from 'zod';

export const updateUserRoleSchema = z.object({
  body: {
    role: z.nativeEnum(UserRole, {
      error: () => ({ message: 'সঠিক রোল নির্বাচন করুন' }),
    }),
  },
});

export const UserZodValidation = {
  updateUserRoleSchema,
};
