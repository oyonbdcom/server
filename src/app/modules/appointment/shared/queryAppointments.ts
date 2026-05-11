import { Prisma } from '@prisma/client';
import { paginationCalculator } from '../../../../helper';
import prisma from '../../../../prisma/client';
import { appointmentPopulate } from '../constant';
export const queryAppointments = async (where: Prisma.AppointmentWhereInput, options: any) => {
  const { page, limit, skip, sortBy, sortOrder } = paginationCalculator(options);

  const [data, total] = await Promise.all([
    prisma.appointment.findMany({
      where,

      skip,
      take: limit,

      orderBy:
        sortBy && sortOrder
          ? {
              [sortBy]: sortOrder,
            }
          : {
              appointmentDate: 'desc',
            },

      include: appointmentPopulate,
    }),

    prisma.appointment.count({
      where,
    }),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },

    data,
  };
};
