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

    // 🏥 Diagnostic in area
    const totalDiagnostics = await prisma.diagnostic.count({
      where: { areaId },
    });

    // 👨‍⚕️ Active memberships
    const totalMemberships = await prisma.membership.count({
      where: {
        diagnostic: {
          areaId,
        },
      },
    });

    // 📅 Appointments stats
    const totalAppointments = await prisma.appointment.count({
      where: {
        diagnostic: {
          areaId,
        },
      },
    });

    const completedAppointments = await prisma.appointment.count({
      where: {
        status: 'COMPLETED',
        diagnostic: {
          areaId,
        },
      },
    });

    const pendingAppointments = await prisma.appointment.count({
      where: {
        status: 'PENDING',
        diagnostic: {
          areaId,
        },
      },
    });

    // ⭐ Reviews
    const totalReviews = await prisma.doctorReview.count({
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
        diagnostics: totalDiagnostics,
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
