import { AppointmentSource, AppointmentStatus, Prisma, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import httpStatus from 'http-status';
import { JwtPayload } from 'jsonwebtoken';
import config from '../../../config/config';
import { IOptions, paginationCalculator } from '../../../helper';
import prisma from '../../../prisma/client';
import ApiError from '../../../utils/apiError';
import { sendPushNotification } from '../../../utils/notification.utils';
import { IGenericResponse } from './../../../interface/common';

import { bdEndOfDay, bdNow, bdStartOfDay } from '../../../utils/timezone';
import {
  appointmentPopulate,
  generateTokens,
  normalizePhone,
  resolvePatientUser,
} from './constant';
import {
  IAppointmentCreateInput,
  IAppointmentResponse,
  IAppointmentStats,
  IAppointmentUpdateInput,
} from './interface';

interface IGetAppointmentsFilters {
  searchTerm?: string;
  date?: string;
  status?: AppointmentStatus;
  doctorId?: string;
  emergency?: string;
  clinicId?: string;
  area?: string;
}

const getPatientAppointments = async (userId: string, options: IOptions) => {
  const { page, limit, skip } = paginationCalculator(options);

  const todayStart = bdStartOfDay(new Date());
  const todayEnd = bdEndOfDay(new Date());
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    include: {
      patient: {
        select: { id: true },
      },
    },
  });
  // =====================================================
  // 1. PAGINATED DATA (UI ONLY)
  // =====================================================
  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        patientId: user?.patient?.id,
      },
      select: {
        doctor: {
          select: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        clinic: {
          select: {
            user: {
              select: {
                name: true,
              },
            },
            address: true,
          },
        },
        patientName: true,
        appointmentDate: true,
        doctorId: true,
        clinicId: true,
        serialNumber: true,
        medicalRecords: true,
        id: true,
        ptAge: true,
        priority: true,
        type: true,
        status: true,
        createdAt: true,
      },
      skip,
      take: limit,
      orderBy: {
        appointmentDate: 'desc',
      },
    }),

    prisma.appointment.count({
      where: { patientId: user?.patient?.id },
    }),
  ]);

  // =====================================================
  // 2. FULL TODAY QUEUE (LOGIC ONLY)
  // =====================================================
  const todayQueue = await prisma.appointment.findMany({
    where: {
      appointmentDate: {
        gte: todayStart,
        lte: todayEnd,
      },
      status: 'SCHEDULED',
    },
    select: {
      doctor: {
        select: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
      doctorId: true,
      clinicId: true,
      serialNumber: true,
    },
    orderBy: {
      serialNumber: 'asc',
    },
  });

  // =====================================================
  // 3. COMPLETED POINTERS (PER QUEUE)
  // =====================================================
  const completed = await prisma.appointment.findMany({
    where: {
      appointmentDate: {
        gte: todayStart,
        lte: todayEnd,
      },
      status: 'COMPLETED',
    },
    select: {
      doctor: {
        select: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
      doctorId: true,
      clinicId: true,
      serialNumber: true,
    },
    orderBy: {
      serialNumber: 'desc',
    },
  });

  const queueMap = new Map<string, number>();

  for (const c of completed) {
    const key = `${c.doctorId}-${c.clinicId}`;
    if (!queueMap.has(key)) {
      queueMap.set(key, c.serialNumber);
    }
  }

  // =====================================================
  // 4. BUILD RESPONSE WITH ETA
  // =====================================================
  const enriched = appointments
    .map((appt) => {
      const key = `${appt.doctorId}-${appt.clinicId}`;

      const currentSerial = queueMap.get(key) || 0;

      const isTodayQueue = appt.appointmentDate >= todayStart && appt.appointmentDate <= todayEnd;

      let position = null;

      if (isTodayQueue && appt.status === 'SCHEDULED') {
        const queue = todayQueue.filter(
          (q) => q.doctorId === appt.doctorId && q.clinicId === appt.clinicId,
        );

        const ahead = queue.filter(
          (q) => q.serialNumber > currentSerial && q.serialNumber < appt.serialNumber,
        );

        position = ahead.length;
      }

      return {
        ...appt,
        runningSerial: appt.status === 'SCHEDULED' ? currentSerial : null,

        position,

        isTodayQueue: isTodayQueue && appt.status === 'SCHEDULED',
      };
    })

    // =========================
    // SORT TODAY QUEUE FIRST
    // =========================
    .sort((a, b) => {
      // today's queued appointments first
      if (a.isTodayQueue && !b.isTodayQueue) return -1;
      if (!a.isTodayQueue && b.isTodayQueue) return 1;

      // then latest created
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  // =====================================================
  // 5. RETURN
  // =====================================================
  return {
    meta: {
      total,
      page,
      limit,
      totalPage: Math.ceil(total / limit),
    },

    data: enriched,

    queueMap: Object.fromEntries(queueMap),
  };
};

const getMyAppointments = async (
  user: JwtPayload,
  filters: IGetAppointmentsFilters,
  options: IOptions,
): Promise<IGenericResponse<IAppointmentResponse[], IAppointmentStats>> => {
  const { searchTerm, date, status, doctorId, clinicId, area } = filters;

  const { page, limit, skip, sortBy, sortOrder } = paginationCalculator(options);

  const andConditions: Prisma.AppointmentWhereInput[] = [];

  // =====================================================
  // ROLE BASED SCOPING
  // =====================================================

  switch (user.role) {
    // -----------------------------------------
    // PATIENT
    // -----------------------------------------
    // case UserRole.PATIENT: {
    //   const where: Prisma.AppointmentWhereInput = {
    //     patientId: patient.id,

    //     appointmentDate: {
    //       gte: todayStart,
    //       lte: todayEnd,
    //     },
    //   };

    //   if (doctorId) where.doctorId = doctorId;
    //   if (clinicId) where.clinicId = clinicId;

    //   const todayAppointments = await prisma.appointment.count({
    //     where,
    //   });
    //   const patient = await prisma.patient.findUnique({
    //     where: {
    //       userId: user.id,
    //     },
    //     select: {
    //       id: true,
    //     },
    //   });

    //   if (!patient) {
    //     throw new ApiError(httpStatus.NOT_FOUND, 'Patient profile not found');
    //   }

    //   andConditions.push({
    //     patientId: patient.id,
    //   });

    //   break;
    // }

    // -----------------------------------------
    // DIAGNOSTIC MANAGER
    // -----------------------------------------
    case UserRole.DIAGNOSTIC_MANAGER: {
      const clinic = await prisma.clinic.findUnique({
        where: {
          userId: user.id,
        },
        select: {
          id: true,
        },
      });

      if (!clinic) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Clinic profile not found');
      }

      andConditions.push({
        clinicId: clinic.id,
      });

      break;
    }

    // -----------------------------------------
    // AREA MANAGER
    // -----------------------------------------
    case UserRole.AREA_MANAGER: {
      const manager = await prisma.manager.findUnique({
        where: {
          userId: user.id,
        },

        select: {
          areaId: true,
        },
      });

      if (!manager) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Manager profile not found');
      }

      andConditions.push({
        clinic: {
          areaId: manager.areaId,
        },
      });
      if (filters?.emergency) {
        andConditions.push({
          type: 'EMERGENCY',
        });
      }

      break;
    }

    // -----------------------------------------
    // STAFF
    // -----------------------------------------
    case UserRole.STAFF: {
      const staff = await prisma.staff.findUnique({
        where: {
          userId: user.id,
        },

        select: {
          clinicId: true,
          assignedDoctorId: true,
          staffType: true,
        },
      });

      if (!staff) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Staff profile not found');
      }

      // =====================================================
      // RECEPTIONIST
      // only own created appointments
      // =====================================================

      andConditions.push({
        createdById: user.id,
      });

      // =====================================================
      // COORDINATOR
      // own appointments + assigned doctor appointments
      // =====================================================

      break;
    }

    // -----------------------------------------
    // ADMIN
    // -----------------------------------------
    case UserRole.ADMIN:
    default:
      break;
  }

  // =====================================================
  // FILTERS
  // =====================================================

  // status
  if (status) {
    andConditions.push({
      status,
    });
  }

  // doctor
  if (doctorId) {
    andConditions.push({
      doctorId,
    });
  }

  // clinic
  if (clinicId) {
    andConditions.push({
      clinicId,
    });
  }

  // area
  if (area) {
    andConditions.push({
      clinic: {
        area: {
          slug: area,
        },
      },
    });
  }

  // search
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

        {
          clinic: {
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

  // date
  if (date) {
    andConditions.push({
      appointmentDate: {
        gte: bdStartOfDay(date),
        lte: bdEndOfDay(date),
      },
    });
  }

  // =====================================================
  // FINAL WHERE
  // =====================================================

  const whereConditions: Prisma.AppointmentWhereInput =
    andConditions.length > 0
      ? {
          AND: andConditions,
        }
      : {};

  // =====================================================
  // QUERY
  // =====================================================

  const [result, total, todayAppointments, pending, scheduled, completed, cancelled] =
    await Promise.all([
      prisma.appointment.findMany({
        where: whereConditions,

        skip,
        take: limit,

        orderBy: sortBy && sortOrder ? { [sortBy]: sortOrder } : { appointmentDate: 'desc' },

        include: appointmentPopulate,
      }),

      prisma.appointment.count({
        where: whereConditions,
      }),
      prisma.appointment.count({
        where: {
          ...whereConditions,

          appointmentDate: {
            gte: bdStartOfDay(date),
            lte: bdEndOfDay(date),
          },
        },
      }),
      prisma.appointment.count({
        where: {
          ...whereConditions,
          status: AppointmentStatus.PENDING,
        },
      }),

      prisma.appointment.count({
        where: {
          ...whereConditions,
          status: AppointmentStatus.SCHEDULED,
        },
      }),

      prisma.appointment.count({
        where: {
          ...whereConditions,
          status: AppointmentStatus.COMPLETED,
        },
      }),

      prisma.appointment.count({
        where: {
          ...whereConditions,
          status: AppointmentStatus.CANCELLED,
        },
      }),
    ]);

  return {
    meta: {
      total,
      page,
      limit,
      totalPage: Math.ceil(total / limit),
    },

    data: result as unknown as IAppointmentResponse[],

    stats: {
      total,
      todayAppointments,
      pending,
      scheduled,
      completed,
      cancelled,
    },
  };
};

const getCoordinatorDashboard = async (
  userId: string,
  filter: { status?: AppointmentStatus; search?: string },
  options: IOptions,
) => {
  const { page, limit, skip } = paginationCalculator(options);

  // =====================================================
  // STAFF
  // =====================================================

  const staff = await prisma.staff.findUnique({
    where: { userId },
    include: {
      assignedDoctor: {
        include: {
          user: true,
          department: true,
        },
      },
    },
  });

  if (!staff) throw new ApiError(httpStatus.NOT_FOUND, 'Staff not found');

  if (staff.staffType !== 'COORDINATOR') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Access denied');
  }

  if (!staff.assignedDoctorId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'No doctor assigned');
  }

  // =====================================================
  // DATE RANGE (TODAY)
  // =====================================================

  const start = bdStartOfDay(new Date());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  // =====================================================
  // BASE FILTER (REUSABLE)
  // =====================================================

  const baseWhere: Prisma.AppointmentWhereInput = {
    doctorId: staff.assignedDoctorId,
    appointmentDate: {
      gte: start,
      lt: end,
    },
  };

  // =====================================================
  // SEARCH FILTER
  // =====================================================

  const search = filter?.search?.trim();

  const normalizedSearch = search ? normalizePhone(search) : '';

  const searchFilter: Prisma.AppointmentWhereInput = search
    ? {
        phoneNumber: {
          contains: normalizedSearch,
        },
      }
    : {};
  // =====================================================
  // STATUS FILTER (DEFAULT = SCHEDULED)
  // =====================================================

  const statusFilter: Prisma.AppointmentWhereInput = {
    status: filter?.status || 'SCHEDULED',
  };

  // =====================================================
  // FINAL WHERE
  // =====================================================

  const whereConditions: Prisma.AppointmentWhereInput = {
    ...baseWhere,
    ...statusFilter,
    ...searchFilter,
  };

  // =====================================================
  // STATS BASE (same date only)
  // =====================================================

  const statsWhere = baseWhere;

  // =====================================================
  // QUERY
  // =====================================================

  const [appointments, total, scheduled, completed, cancelled] = await Promise.all([
    prisma.appointment.findMany({
      where: whereConditions,
      skip,
      take: limit,
      include: {
        doctor: {
          include: {
            user: true,
            department: true,
          },
        },
        patient: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: [{ priority: 'desc' }, { serialNumber: 'asc' }],
    }),

    prisma.appointment.count({
      where: whereConditions,
    }),

    prisma.appointment.count({
      where: { ...statsWhere, status: 'SCHEDULED' },
    }),

    prisma.appointment.count({
      where: { ...statsWhere, status: 'COMPLETED' },
    }),

    prisma.appointment.count({
      where: { ...statsWhere, status: 'CANCELLED' },
    }),
  ]);

  // =====================================================
  // RETURN
  // =====================================================

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },

    data: {
      doctor: {
        id: staff.assignedDoctor?.id,
        name: staff.assignedDoctor?.user?.name,
        department: staff.assignedDoctor?.department?.name,
      },
      appointments,
    },

    stats: {
      total,
      scheduled,
      completed,
      cancelled,
      todayAppointments: total,
    },
  };
};
// const getManagerAreaAppointments = async (
//   userId: string,
//   filters: any,
//   options: IOptions,
// ): Promise<IGenericResponse<any[]>> => {
//   const manager = await prisma.manager.findUnique({
//     where: {
//       userId,
//     },

//     select: {
//       areaId: true,
//     },
//   });

//   if (!manager) {
//     throw new ApiError(404, 'Manager not found');
//   }

//   const where: Prisma.AppointmentWhereInput = {
//     AND: [
//       {
//         clinic: {
//           areaId: manager.areaId,
//         },
//       },

//       buildAppointmentFilters(filters),
//     ],
//   };

//   const result = await queryAppointments(where, options);

//   const stats = await getAppointmentStats(where);
//   console.log({ stats });
//   return {
//     ...result,
//     stats,
//   };
// };

export const createAppointment = async (
  payload: IAppointmentCreateInput & { otp: string },
  authUser?: JwtPayload,
): Promise<any> => {
  const result = await prisma.$transaction(async (tx) => {
    // 1️⃣ OTP VALIDATION
    const otpRecord = await tx.otp.findUnique({
      where: {
        phoneNumber: payload.phoneNumber,
      },
    });

    if (!otpRecord || otpRecord.otp !== payload.otp) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'ওটিপি কোডটি সঠিক নয়।');
    }

    if (new Date() > otpRecord.otpExpires) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'ওটিপি কোডটির মেয়াদ শেষ হয়ে গেছে।');
    }

    // 2️⃣ CHECK DOCTOR
    const doctor = await tx.doctor.findUnique({
      where: {
        id: payload.doctorId,
      },
    });

    if (!doctor) {
      throw new ApiError(httpStatus.NOT_FOUND, 'ডাক্তার পাওয়া যায়নি');
    }

    // 3️⃣ CHECK CLINIC
    const clinic = await tx.clinic.findUnique({
      where: {
        id: payload.clinicId,
      },
    });

    if (!clinic) {
      throw new ApiError(httpStatus.NOT_FOUND, 'ডায়াগনস্টিক সেন্টার পাওয়া যায়নি');
    }

    // 4️⃣ CHECK MEMBERSHIP
    const membership = await tx.membership.findUnique({
      where: {
        id: payload.membershipId,
      },
    });

    if (!membership) {
      throw new ApiError(httpStatus.NOT_FOUND, 'মেম্বারশিপ পাওয়া যায়নি');
    }

    // membership validation
    if (membership.doctorId !== payload.doctorId || membership.clinicId !== payload.clinicId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'ডাক্তার এবং ক্লিনিকের মেম্বারশিপ সঠিক নয়');
    }

    // 5️⃣ DUPLICATE CHECK
    const todayStart = bdStartOfDay(new Date());
    const todayEnd = bdEndOfDay(new Date());

    const alreadyExists = await tx.appointment.findFirst({
      where: {
        phoneNumber: payload.phoneNumber,
        doctorId: payload.doctorId,
        patientName: payload.patientName,
        ptAge: String(payload.ptAge),

        appointmentDate: {
          gte: todayStart,
          lte: todayEnd,
        },

        status: {
          in: ['PENDING', 'SCHEDULED'],
        },
      },
    });

    if (alreadyExists) {
      throw new ApiError(
        httpStatus.CONFLICT,
        `${payload.patientName}-এর জন্য আজকে ইতিমধ্যে বুকিং আছে।`,
      );
    }

    // 6️⃣ USER + PATIENT HANDLE
    let targetUser: any = null;
    let isNew = false;

    // LOGGED IN USER
    if (authUser) {
      targetUser = await tx.user.findUnique({
        where: {
          id: authUser.id,
        },
        include: {
          patient: true,
        },
      });

      if (!targetUser) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid user');
      }

      if (targetUser.role !== 'PATIENT') {
        throw new ApiError(httpStatus.FORBIDDEN, 'শুধুমাত্র পেশেন্ট বুকিং করতে পারবে');
      }

      // 🔥 CREATE PATIENT PROFILE IF NOT EXISTS
      if (!targetUser.patient) {
        const patientProfile = await tx.patient.create({
          data: {
            userId: targetUser.id,
            age: Number(payload.ptAge) || null,
            address: payload.address || null,
          },
        });

        targetUser.patient = patientProfile;
      }
    }

    // GUEST USER
    else {
      targetUser = await tx.user.findUnique({
        where: {
          phoneNumber: payload.phoneNumber,
        },
        include: {
          patient: true,
        },
      });

      // যদি অন্য role এর user হয়
      if (targetUser && targetUser.role !== 'PATIENT') {
        throw new ApiError(httpStatus.FORBIDDEN, 'এই নম্বরটি অন্য একাউন্টে ব্যবহার করা হয়েছে');
      }

      // NEW USER
      if (!targetUser) {
        isNew = true;

        const hashedPassword = await bcrypt.hash(config.default_password || 'Password@123', 12);

        targetUser = await tx.user.create({
          data: {
            name: payload.patientName,
            phoneNumber: payload.phoneNumber,
            role: 'PATIENT',
            password: hashedPassword,
            isDefaultPassword: true,

            patient: {
              create: {
                age: Number(payload.ptAge) || null,
                address: payload.address || null,
              },
            },
          },

          include: {
            patient: true,
          },
        });
      }

      // EXISTING USER BUT NO PATIENT PROFILE
      if (!targetUser.patient) {
        const patientProfile = await tx.patient.create({
          data: {
            userId: targetUser.id,
            age: Number(payload.ptAge) || null,
            address: payload.address || null,
          },
        });

        targetUser.patient = patientProfile;
      }
    }

    const counter = await tx.appointmentCounter.upsert({
      where: {
        doctorId_clinicId_date: {
          doctorId: payload?.doctorId,
          clinicId: payload?.clinicId,
          date: todayStart,
        },
      },
      update: {
        lastSerial: { increment: 1 },
      },
      create: {
        doctorId: payload?.doctorId,
        clinicId: payload?.clinicId,
        date: todayStart,
        lastSerial: 1,
      },
    });

    const serialNumber = counter.lastSerial;

    // 8️⃣ CREATE APPOINTMENT
    const newAppointment = await tx.appointment.create({
      data: {
        patientName: payload.patientName,
        ptAge: String(payload.ptAge),
        phoneNumber: payload.phoneNumber,
        address: payload.address || null,
        note: payload.note || null,

        appointmentDate: bdNow(),

        status: 'SCHEDULED',

        serialNumber,

        source: 'PLATFORM',

        doctor: {
          connect: {
            id: payload.doctorId,
          },
        },

        clinic: {
          connect: {
            id: payload.clinicId,
          },
        },

        membership: {
          connect: {
            id: payload.membershipId,
          },
        },

        patient: {
          connect: {
            id: targetUser.patient.id,
          },
        },

        createdBy: authUser
          ? {
              connect: {
                id: authUser.id,
              },
            }
          : undefined,
      },

      include: {
        doctor: {
          include: {
            user: true,
          },
        },

        clinic: true,

        patient: {
          include: {
            user: true,
          },
        },

        membership: true,
      },
    });

    // 9️⃣ DELETE OTP
    await tx.otp.delete({
      where: {
        phoneNumber: payload.phoneNumber,
      },
    });

    // 🔟 TOKEN FOR GUEST USER
    let tokens = null;

    if (!authUser) {
      tokens = generateTokens(targetUser);

      await tx.user.update({
        where: {
          id: targetUser.id,
        },

        data: {
          refreshToken: tokens.refreshToken,
        },
      });
    }

    // 1️⃣1️⃣ SEND NOTIFICATION
    sendPushNotification(
      newAppointment.clinicId,
      'নতুন বুকিং! 🏥',
      `${newAppointment.patientName} সিরিয়াল নং ${serialNumber}`,
    ).catch((err) => console.error(err));

    // 1️⃣2️⃣ RETURN
    return {
      ...(tokens && {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      }),

      user: {
        id: targetUser.id,
        name: targetUser.name,
        role: targetUser.role,
      },

      appointment: newAppointment,

      serialNumber,

      isNewUser: isNew,
    };
  });

  return result;
};

/**
 * Diagnostic Staff-এর জন্য অ্যাপয়েন্টমেন্ট তৈরি
 * এখানে clinicId ফ্রন্টএন্ড থেকে আসবে না, স্টাফের অ্যাকাউন্ট থেকে সার্ভারে বের করা হবে।
 */
const createAppointmentByDiagnosticStaff = async (payload: any, staffUserId: string) => {
  const { patientName, phoneNumber, ptAge, doctorId, address, note, membershipId } = payload;

  const user = await prisma.user.findUnique({
    where: { id: staffUserId },
    select: {
      role: true,
      clinic: {
        select: { id: true },
      },
      staff: {
        select: { clinicId: true },
      },
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const clinicId = user.role === UserRole.STAFF ? user.staff?.clinicId : user.clinic?.id;

  if (!clinicId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'আপনি কোনো ক্লিনিকের সাথে যুক্ত নন');
  }

  const todayStart = bdStartOfDay(new Date());
  const todayEnd = bdEndOfDay(new Date());

  const defaultPassword = config.default_password || 'Password@123';

  const hashedPassword = await bcrypt.hash(defaultPassword, 12);

  return prisma.$transaction(async (tx) => {
    // Duplicate check
    const existingAppointment = await tx.appointment.findFirst({
      where: {
        phoneNumber,
        doctorId,
        clinicId,
        appointmentDate: {
          gte: todayStart,
          lte: todayEnd,
        },
        status: {
          in: [AppointmentStatus.PENDING, AppointmentStatus.SCHEDULED],
        },
      },
      select: {
        serialNumber: true,
      },
    });

    if (existingAppointment) {
      throw new ApiError(
        httpStatus.CONFLICT,
        `আজকে এই নম্বর দিয়ে বুকিং আছে। সিরিয়াল: ${existingAppointment.serialNumber}`,
      );
    }

    // Patient resolve
    const patientData = await resolvePatientUser({
      tx,
      phoneNumber,
      patientName,
      address,
      ptAge,
      hashedPassword,
    });

    // Serial generation
    const counter = await tx.appointmentCounter.upsert({
      where: {
        doctorId_clinicId_date: {
          doctorId,
          clinicId,
          date: todayStart,
        },
      },
      update: {
        lastSerial: { increment: 1 },
      },
      create: {
        doctorId,
        clinicId,
        date: todayStart,
        lastSerial: 1,
      },
    });

    const appointment = await tx.appointment.create({
      data: {
        patientName,
        ptAge: String(ptAge || ''),
        phoneNumber,
        address,
        serialNumber: counter.lastSerial,
        appointmentDate: bdNow(),
        status: AppointmentStatus.SCHEDULED,
        source: AppointmentSource.STAFF,
        doctorId,
        clinicId,
        patientId: patientData.patientId,
        createdById: staffUserId,
        note: note || 'Diagnostic Entry',
        membershipId,
      },
    });

    return {
      appointment,
      isNewUser: patientData.isNewUser,
      defaultPassword: patientData.isNewUser ? defaultPassword : null,
    };
  });
};

// emergency
const requestEmergency = async (appointmentId: string) => {
  return prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.findUnique({
      where: {
        id: appointmentId,
      },
    });

    if (!appointment) {
      throw new ApiError(404, 'Appointment not found');
    }
    if (appointment?.isEmRequest) {
      throw new ApiError(404, 'One time send emergency request');
    }

    // already requested
    if (appointment.priority > 0) {
      return appointment;
    }

    // highest priority
    const highestPriorityAppointment = await tx.appointment.findFirst({
      where: {
        doctorId: appointment.doctorId,
        priority: {
          gt: 0,
        },

        status: 'SCHEDULED',
      },

      orderBy: {
        priority: 'desc',
      },
    });

    const nextPriority = highestPriorityAppointment ? highestPriorityAppointment.priority - 1 : 999;

    return tx.appointment.update({
      where: {
        id: appointmentId,
      },

      data: {
        type: 'EMERGENCY',
        isEmRequest: true,
        priority: nextPriority,
      },
    });
  });
};

const completeAppointment = async (appointmentId: string) => {
  return prisma.appointment.update({
    where: {
      id: appointmentId,
    },

    data: {
      status: 'COMPLETED',
      priority: 0,
    },
  });
};

const rejectEmergency = async (appointmentId: string) => {
  return prisma.appointment.update({
    where: {
      id: appointmentId,
    },

    data: {
      priority: 0,
      type: 'NORMAL',
    },
  });
};
const acceptEmergencyAppointment = async (appointmentId: string) => {
  return prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new ApiError(404, 'Appointment not found');
    }

    const todayStart = bdStartOfDay(new Date());
    const todayEnd = bdEndOfDay(new Date());

    // LAST COMPLETED
    const lastCompleted = await tx.appointment.findFirst({
      where: {
        doctorId: appointment.doctorId,
        status: 'COMPLETED',
        appointmentDate: {
          gte: todayStart,
          lte: todayEnd,
        },
      },

      orderBy: {
        serialNumber: 'desc',
      },
    });

    // INSERT POSITION
    const newSerial = (lastCompleted?.serialNumber || 0) + 1;

    // SHIFT QUEUE
    await tx.appointment.updateMany({
      where: {
        doctorId: appointment.doctorId,

        appointmentDate: {
          gte: todayStart,
          lte: todayEnd,
        },

        status: 'SCHEDULED',

        serialNumber: {
          gte: newSerial,
        },
      },

      data: {
        serialNumber: {
          increment: 1,
        },
      },
    });

    // INSERT EMERGENCY
    await tx.appointment.update({
      where: {
        id: appointmentId,
      },

      data: {
        status: 'SCHEDULED',
        type: 'EMERGENCY',
        serialNumber: newSerial,
      },
    });

    return true;
  });
};
// Update Appointment Reason/Date (Update)
const updateAppointment = async (
  id: string,
  payload: Partial<IAppointmentUpdateInput>,
): Promise<IAppointmentResponse> => {
  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Appointment ID is required');
  }
  console.log(payload);
  // 1️⃣ Check appointment
  const isExist = await prisma.appointment.findUnique({
    where: { id },
    include: {
      doctor: {
        include: {
          user: true,
        },
      },
      clinic: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!isExist) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Appointment not found');
  }

  // 2️⃣ Update
  const updatedResult = await prisma.appointment.update({
    where: { id },
    data: {
      ...payload,
    },
    include: {
      doctor: {
        include: {
          user: true,
        },
      },
      clinic: {
        include: {
          user: true,
        },
      },
      membership: {
        include: {
          clinic: {
            include: {
              user: true,
            },
          },
        },
      },
      patient: {
        include: {
          user: true,
        },
      },
    },
  });

  // 3️⃣ Status transition check
  const shouldSendSMS = isExist.status === 'PENDING' && updatedResult.status === 'SCHEDULED';

  // 4️⃣ SMS (non-blocking)
  if (shouldSendSMS && updatedResult.phoneNumber) {
    setImmediate(async () => {
      try {
        const doctorName = updatedResult.doctor?.user?.name || 'Doctor';

        const serial = updatedResult.serialNumber;

        const message = `SusthiO: Your appointment with Dr. ${doctorName} is confirmed. Serial: ${serial}.`;

        // await sendSMS(updatedResult.phoneNumber, message);
      } catch (err) {
        console.error('SMS Error:', err);
      }
    });
  }

  return updatedResult as unknown as IAppointmentResponse;
};

export const AppointmentService = {
  getMyAppointments,
  createAppointment,
  acceptEmergencyAppointment,
  createAppointmentByDiagnosticStaff,
  getCoordinatorDashboard,
  requestEmergency,
  completeAppointment,
  rejectEmergency,
  getPatientAppointments,
  updateAppointment,
};
