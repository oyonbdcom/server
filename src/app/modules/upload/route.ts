import express from 'express';
import { protect } from '../../../middlewares/authMiddleware';

import { uploadMultiple, uploadSingle } from '../../../middlewares/fileMiddleware';
import { FileController } from './controller';

const router = express.Router();

router.post('/single', uploadSingle, FileController.uploadSingleFile);

router.post('/multiple', protect, uploadMultiple, FileController.uploadMultipleFiles);

export const UploadRoutes = router;
