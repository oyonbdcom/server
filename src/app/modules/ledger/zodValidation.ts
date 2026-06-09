import { z } from 'zod';

// ১. Base Schema (সব ফিল্ডের সাধারণ নিয়ম)
const baseWalletLedgerSchema = z.object({
  amount: z.number().positive('Amount must be a positive number'),
  type: z.enum(['DEBIT', 'CREDIT']),
  source: z.enum(['PLATFORM', 'STAFF', 'RECHARGE']),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED']).default('COMPLETED'),
  referenceId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

// ২. CREATE Schema (সব ফিল্ড বাধ্যতামূলক)
const createWalletLedgerSchema = z.object({
  body: baseWalletLedgerSchema,
});

// ৩. UPDATE Schema (সব ফিল্ড অপশনাল)
const updateWalletLedgerSchema = z.object({
  body: baseWalletLedgerSchema.partial(),
});
export const WalletZodValidation = {
  createWalletLedgerSchema,
  updateWalletLedgerSchema,
};
