import { Router } from 'express';
import { zodValidate } from '../../../middlewares/zodValidation';

import { protect, restrictTo } from '../../../middlewares/authMiddleware';
import { WalletController } from './controllers';
import { WalletZodValidation } from './zodValidation';

const router = Router();

router.post(
  '/',
  protect,
  restrictTo('DIAGNOSTIC'),
  zodValidate(WalletZodValidation.createWalletLedgerSchema),

  WalletController.createEntry,
); // নতুন ট্রানজ্যাকশন
router.get('/:diagId', WalletController.getHistory); // হিস্ট্রি দেখা
router.patch('/:id/status', WalletController.updateStatus); // স্ট্যাটাস আপডেট (যেমন: PENDING -> COMPLETED)

export const WalletLedgerRoutes = router;
