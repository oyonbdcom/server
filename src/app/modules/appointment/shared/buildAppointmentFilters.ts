import { AppointmentStatus, Prisma } from '@prisma/client';
import { bdEndOfDay, bdStartOfDay } from '../../../../utils/timezone';

interface IAppointmentFilters {
  searchTerm?: string;
  date?: string;
  status?: AppointmentStatus;
  doctorId?: string;
  clinicId?: string;
  area?: string;
}

export const buildAppointmentFilters = (
  filters: IAppointmentFilters,
): Prisma.AppointmentWhereInput => {
  const andConditions: Prisma.AppointmentWhereInput[] = [];

  const { searchTerm, date, status, doctorId, clinicId, area } = filters;

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

  if (clinicId) {
    andConditions.push({
      clinicId,
    });
  }

  if (area) {
    andConditions.push({
      clinic: {
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
          phoneNumber: {
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
