import express from 'express';
import { AuthRoutes } from '../modules/auth/routes';
import { MembershipRoutes } from '../modules/membership/routes';

import { ClinicRoutes } from '../modules/clinic/routes';

import { AppointmentsRoutes } from '../modules/appointment/routes';
import { DoctorRoutes } from '../modules/doctor/routes';
import { FavoriteDoctorRoutes } from '../modules/favorite-doctor/routes';
import { MedicalHistoryRoutes } from '../modules/medical-history/routes';
import { DeviceTokenRoutes } from '../modules/notification/routes';
import { PatientRoutes } from '../modules/patient/routes';
import { ReviewsRoutes } from '../modules/review/routes';
import { ScheduleRoutes } from '../modules/schedule/routes';
import { UploadRoutes } from '../modules/upload/route';
import { UserRoutes } from '../modules/user/routes';

const router = express.Router();

const modulesRoute = [
  {
    path: '/auth',
    route: AuthRoutes,
  },
  {
    path: '/users',
    route: UserRoutes,
  },
  {
    path: '/doctors',
    route: DoctorRoutes,
  },
  {
    path: '/patient',
    route: PatientRoutes,
  },
  {
    path: '/favorite',
    route: FavoriteDoctorRoutes,
  },
  {
    path: '/reviews',
    route: ReviewsRoutes,
  },
  {
    path: '/medical-records',
    route: MedicalHistoryRoutes,
  },
  {
    path: '/clinics',
    route: ClinicRoutes,
  },

  {
    path: '/membership',
    route: MembershipRoutes,
  },
  {
    path: '/schedule',
    route: ScheduleRoutes,
  },
  {
    path: '/appointments',
    route: AppointmentsRoutes,
  },
  {
    path: '/upload',
    route: UploadRoutes,
  },
  {
    path: '/device-token',
    route: DeviceTokenRoutes,
  },
];
modulesRoute.forEach((route) => router.use(route.path, route.route));

export default router;
