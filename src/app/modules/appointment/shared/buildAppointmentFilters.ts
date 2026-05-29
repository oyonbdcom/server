import { AppointmentStatus, Prisma } from '@prisma/client';
import { bdEndOfDay, bdStartOfDay } from '../../../../utils/timezone';

interface IAppointmentFilters {
  searchTerm?: string;
  date?: string;
  status?: AppointmentStatus;
  doctorId?: string;
  diagId?: string;
  area?: string;
}

export const buildAppointmentFilters = (
  filters: IAppointmentFilters,
): Prisma.AppointmentWhereInput => {
  const andConditions: Prisma.AppointmentWhereInput[] = [];

  const { searchTerm, date, status, doctorId, diagId, area } = filters;

  if (status) {
    andConditions.push({
      status,
    });
  }

  if (doctorId) {
    andConditions.push({
      doctorId,
    });
  }

  if (diagId) {
    andConditions.push({
      diagId,
    });
  }

  if (area) {
    andConditions.push({
      diagnostic: {
        area: {
          slug: area,
        },
      },
    });
  }

  if (date) {
    andConditions.push({
      appointmentDate: {
        gte: bdStartOfDay(date),
        lte: bdEndOfDay(date),
      },
    });
  }

  if (searchTerm) {
    andConditions.push({
      OR: [
        {
          patientName: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },

        {
          contactNumber: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },

        {
          doctor: {
            user: {
              name: {
                contains: searchTerm,
                mode: 'insensitive',
              },
            },
          },
        },
      ],
    });
  }

  return andConditions.length > 0
    ? {
        AND: andConditions,
      }
    : {};
};
