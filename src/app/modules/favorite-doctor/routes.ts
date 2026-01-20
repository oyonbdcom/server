import express from 'express';
import { protect } from '../../../middlewares/authMiddleware';
import { FavoriteDoctorController } from './controllers';

const router = express.Router();

router.use(protect);

router.post('/create', FavoriteDoctorController.addFavoriteDoctor);
router.get('/', FavoriteDoctorController.getUserFavorites);
router.delete('/:doctorId', FavoriteDoctorController.removeFavoriteDoctor);

export const FavoriteDoctorRoutes = router;
