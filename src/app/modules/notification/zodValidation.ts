import z from 'zod';

// --- DEVICE TOKEN SCHEMA ---
export const registerDeviceSchema = z.object({
  body: z.object({
    userId: z.string().cuid({ message: 'Invalid User ID' }),
    token: z.string().min(10, 'FCM Token is required'),
    platform: z.enum(['android', 'ios', 'web']).optional(),
  }),
});

export const NotificationZodValidation = {
  registerDeviceSchema,
};
