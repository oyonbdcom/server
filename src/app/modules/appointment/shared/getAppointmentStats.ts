import { AppointmentStatus, Prisma } from '@prisma/client';
import prisma from '../../../../prisma/client';
import { bdEndOfDay, bdStartOfDay } from '../../../../utils/timezone';

export const getAppointmentStats = async (where: Prisma.AppointmentWhereInput) => {
  const todayStart = bdStartOfDay(new Date());
  const todayEnd = bdEndOfDay(new Date());
  const [total, todayAppointments, pending, scheduled, completed, cancelled] = await Promise.all([
    prisma.appointment.count({
      where,
    }),
    prisma.appointment.count({
      where: {
        AND: [
          where,

          {
            appointmentDate: {
              gte: todayStart,
              lte: todayEnd,
            },
          },
        ],
      },
    }),
    prisma.appointment.count({
      where: {
        ...where,
        status: AppointmentStatus.PENDING,
      },
    }),

    prisma.appointment.count({
      where: {
        ...where,
        status: AppointmentStatus.SCHEDULED,
      },
    }),

    prisma.appointment.count({
      where: {
        ...where,
        status: AppointmentStatus.COMPLETED,
      },
    }),

    prisma.appointment.count({
      where: {
        ...where,
        status: AppointmentStatus.CANCELLED,
      },
    }),
  ]);

  return {
    total,
    todayAppointments,
    pending,
    scheduled,
    completed,
    cancelled,
  };
};
