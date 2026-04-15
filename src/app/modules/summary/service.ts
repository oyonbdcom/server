import prisma from '../../../prisma/client';

export const SummaryService = {
  // 📊 Dashboard Summary
  async getManagerSummary(managerId: string) {
    const manager = await prisma.manager.findUnique({
      where: { userId: managerId },
      include: {
        area: true,
      },
    });

    if (!manager) {
      throw new Error('Manager not found');
    }

    const areaId = manager.areaId;

    // 🧑‍⚕️ Doctors in area
    const totalDoctors = await prisma.doctorArea.count({
      where: { areaId },
    });

    // 🏥 Clinics in area
    const totalClinics = await prisma.clinic.count({
      where: { areaId },
    });

    // 👨‍⚕️ Active memberships
    const totalMemberships = await prisma.membership.count({
      where: {
        clinic: {
          areaId,
        },
      },
    });

    // 📅 Appointments stats
    const totalAppointments = await prisma.appointment.count({
      where: {
        clinic: {
          clinic: {
            areaId,
          },
        },
      },
    });

    const completedAppointments = await prisma.appointment.count({
      where: {
        status: 'COMPLETED',
        clinic: {
          clinic: {
            areaId,
          },
        },
      },
    });

    const pendingAppointments = await prisma.appointment.count({
      where: {
        status: 'PENDING',
        clinic: {
          clinic: {
            areaId,
          },
        },
      },
    });

    // ⭐ Reviews
    const totalReviews = await prisma.review.count({
      where: {
        doctor: {
          areas: {
            some: {
              areaId,
            },
          },
        },
      },
    });

    return {
      area: manager.area.name,
      stats: {
        doctors: totalDoctors,
        clinics: totalClinics,
        memberships: totalMemberships,
        appointments: {
          total: totalAppointments,
          completed: completedAppointments,
          pending: pendingAppointments,
        },
        reviews: totalReviews,
      },
    };
  },
};
