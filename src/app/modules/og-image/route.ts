import express from 'express';

import { OgImageController } from './controller';

const router = express.Router();

router.get('/', OgImageController.generateOGImage);

export const OrImageRoutes = router;
