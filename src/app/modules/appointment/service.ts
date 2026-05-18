import {
  AppointmentStatus,
  DoctorSessionStatus,
  EmergencyType,
  Prisma,
  UserRole,
} from '@prisma/client';
import bcrypt from 'bcrypt';

import httpStatus from 'http-status';
import { JwtPayload } from 'jsonwebtoken';
import config from '../../../config/config';
import { IOptions, paginationCalculator } from '../../../helper';
import prisma from '../../../prisma/client';
import ApiError from '../../../utils/apiError';
import {
  sendBatchNotification,
  updateLiveSessionInFirestore,
} from '../../../utils/notification.utils';
import { bdEndOfDay, bdStartOfDay } from '../../../utils/timezone';
import { IGenericResponse } from './../../../interface/common';
import { appointmentPopulate, getAttendanceStatus, normalizePhone } from './constant';
import { IAppointmentCreateInput, IAppointmentResponse, IAppointmentStats } from './interface';

interface IGetAppointmentsFilters {
  searchTerm?: string;
  date?: string;
  status?: AppointmentStatus;
  doctorId?: string;
  isEmergency?: string;

  clinicId?: string;
  area?: string;
}

const getPatientAppointments = async (userId: string, options: IOptions) => {
  const { page, limit, skip } = paginationCalculator(options);

  const todayStart = bdStartOfDay(new Date());
  const todayEnd = bdEndOfDay(new Date());

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  // ============================================
  // APPOINTMENTS
  // ============================================
  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where: { createdById: user?.id },
      select: {
        id: true,
        patientName: true,
        age: true,
        appointmentDate: true,
        doctorId: true,
        clinicId: true,
        serialNumber: true,
        status: true,
        createdAt: true,
        doctor: {
          select: {
            user: { select: { name: true } },
            department: {
              select: { name: true },
            },
          },
        },
        isEmergency: true,
        clinic: {
          select: {
            user: { select: { name: true } },
            area: { select: { name: true } },
          },
        },
        emergency: {
          select: {
            id: true,
            type: true,
            paymentStatus: true,

            status: true,
            transactionId: true,
          },
        },
        medicalRecords: true,
      },
      skip,
      take: limit,
      orderBy: { appointmentDate: 'desc' },
    }),
    prisma.appointment.count({
      where: { createdById: user?.id },
    }),
  ]);

  // ============================================
  // STEP 1: GROUP ONLY TODAY + SCHEDULED
  // ============================================
  const todayScheduled = appointments.filter((appt) => {
    const d = new Date(appt.appointmentDate);
    return appt.status === 'SCHEDULED' && d >= todayStart && d <= todayEnd;
  });

  // ============================================
  // STEP 2: UNIQUE KEYS
  // ============================================
  const uniqueKeys = Array.from(new Set(todayScheduled.map((a) => `${a.doctorId}-${a.clinicId}`)));

  // ============================================
  // STEP 3: COMPLETED ROWS AND DOCTOR SESSIONS (আপডেট করা হয়েছে 💡)
  // ============================================
  const orCondition = uniqueKeys.map((key) => {
    const [doctorId, clinicId] = key.split('-');
    return { doctorId, clinicId };
  });

  const [completedRows, doctorSessions] =
    uniqueKeys.length > 0
      ? await Promise.all([
          // ১. কমপ্লিটেড অ্যাপয়েন্টমেন্ট আনা
          prisma.appointment.findMany({
            where: {
              status: 'COMPLETED',
              appointmentDate: { gte: todayStart, lte: todayEnd },
              OR: orCondition,
            },
            select: { doctorId: true, clinicId: true, serialNumber: true },
            orderBy: { serialNumber: 'desc' },
          }),
          // ২. 💡 একই কন্ডিশনে ডক্টরদের আজকের সেশনগুলো তুলে আনা
          prisma.doctorSession.findMany({
            where: {
              OR: orCondition,
            },
            select: {
              id: true,
              doctorId: true,
              clinicId: true,
              status: true, // ACTIVE, PAUSED, ENDED ইত্যাদি পেতে
            },
          }),
        ])
      : [[], []];

  // ============================================
  // RUNNING SERIAL MAP
  // ============================================
  const runningSerialMap = new Map<string, number>();
  for (const item of completedRows) {
    const key = `${item.doctorId}-${item.clinicId}`;
    if (!runningSerialMap.has(key)) {
      runningSerialMap.set(key, item.serialNumber);
    }
  }

  // ============================================
  // 💡 DOCTOR SESSION MAP তৈরি (নতুন যোগ করা হয়েছে)
  // ============================================
  const sessionMap = new Map<string, any>();
  for (const session of doctorSessions) {
    const key = `${session.doctorId}-${session.clinicId}`;
    // যেহেতু desc অর্ডারে এনেছি, প্রথমটাই সর্বশেষ/লাইভ সেশন হবে
    if (!sessionMap.has(key)) {
      sessionMap.set(key, session);
    }
  }

  // ============================================
  // STEP 5: ENRICH (আপডেট করা হয়েছে 💡)
  // ============================================
  const enriched = appointments.map((appt) => {
    const isToday =
      new Date(appt.appointmentDate) >= todayStart && new Date(appt.appointmentDate) <= todayEnd;
    const key = `${appt.doctorId}-${appt.clinicId}`;

    const lastCompleted = runningSerialMap.get(key) ?? 0;
    const runningSerial = isToday && appt.status === 'SCHEDULED' ? lastCompleted + 1 : null;

    const attendanceStatus =
      appt.status === 'SCHEDULED'
        ? getAttendanceStatus(appt.serialNumber, runningSerial)
        : appt.status === 'COMPLETED'
          ? 'PRESENT'
          : 'UNKNOWN';

    // 💡 ম্যাপ থেকে বর্তমান অ্যাপয়েন্টমেন্টের সেশন ডাটা খুঁজে বের করা
    const currentSession = sessionMap.get(key) || null;

    return {
      ...appt,
      runningSerial,
      attendanceStatus,
      doctorSession: currentSession, // 💡 এটি ফ্রন্টএন্ডে সেশন স্ট্যাটাস দেখাবে
    };
  });

  return {
    meta: {
      total,
      page,
      limit,
      totalPage: Math.ceil(total / limit),
    },
    data: enriched,
  };
};
const getMyAppointments = async (
  user: JwtPayload,
  filters: IGetAppointmentsFilters,
  options: IOptions,
): Promise<IGenericResponse<IAppointmentResponse[], IAppointmentStats>> => {
  const { searchTerm, date, status, doctorId, clinicId, area, isEmergency } = filters;

  const { page, limit, skip, sortBy, sortOrder } = paginationCalculator(options);

  const andConditions: Prisma.AppointmentWhereInput[] = [];

  // =====================================================
  // ROLE BASED SCOPING
  // =====================================================

  switch (user.role) {
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
        where: { userId: user.id },
        select: { areaId: true },
      });

      if (!manager) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Manager profile not found');
      }

      // ১. এরিয়া ম্যানেজারের এরিয়ার কন্ডিশন
      const areaCondition = {
        clinic: {
          areaId: manager.areaId,
        },
      };

      if (isEmergency) {
        andConditions.push({
          isEmergency: true,
        });
      } else {
        andConditions.push(areaCondition);
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
  // STAFF VALIDATION
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
  let doctorSession = await prisma.doctorSession.findFirst({
    where: {
      doctorId: staff.assignedDoctorId,
      clinicId: staff.clinicId,
    },

    orderBy: {
      startedAt: 'desc',
    },
  });

  // =====================================================
  // AUTO CREATE SESSION
  // =====================================================
  if (!doctorSession) {
    doctorSession = await prisma.doctorSession.create({
      data: {
        doctorId: staff.assignedDoctorId,
        clinicId: staff.clinicId,

        startedAt: new Date(),
      },
    });
  }

  // =====================================================
  // DATE RANGE (TODAY)
  // =====================================================
  const start = bdStartOfDay(new Date());
  const end = bdEndOfDay(new Date());

  // =====================================================
  // BASE WHERE
  // =====================================================
  const baseWhere: Prisma.AppointmentWhereInput = {
    doctorId: staff.assignedDoctorId,
    appointmentDate: {
      gte: start,
      lte: end,
    },
    status: 'SCHEDULED',
  };

  // =====================================================
  // SEARCH FILTER
  // =====================================================
  const search = filter?.search?.trim();
  const normalizedSearch = search ? normalizePhone(search) : undefined;

  const searchFilter: Prisma.AppointmentWhereInput = search
    ? {
        OR: [
          {
            contactNumber: { contains: normalizedSearch, mode: 'insensitive' },
          },
        ],
      }
    : {};

  // =====================================================
  // STATUS FILTER
  // =====================================================
  const statusFilter: Prisma.AppointmentWhereInput = filter?.status
    ? { status: filter.status }
    : {};

  // =====================================================
  // FINAL WHERE
  // =====================================================
  const whereConditions: Prisma.AppointmentWhereInput = {
    ...baseWhere,
    ...searchFilter,
    ...statusFilter,
  };

  // =====================================================
  // MAIN QUERY
  // =====================================================
  const [appointments, total, scheduled, completed, cancelled] = await Promise.all([
    prisma.appointment.findMany({
      where: whereConditions,

      skip,
      take: limit,

      select: {
        doctor: {
          select: {
            user: {
              select: { name: true },
            },
            department: true,
          },
        },
        contactNumber: true,
        age: true,
        patientName: true,
        appointmentDate: true,
        serialNumber: true,
        doctorId: true,
        address: true,
        id: true,
        // clinic: {
        //   select: {
        //     user: {
        //       select: {
        //         name: true,
        //       },
        //     },
        //   },
        // },

        // 🔥 NEW EMERGENCY STRUCTURE FIX
        emergency: {
          where: {
            status: 'PENDING',
          },
          select: {
            id: true,
            type: true,
            status: true,
            createdAt: true,
          },
        },

        createdBy: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    }),

    prisma.appointment.count({ where: whereConditions }),

    prisma.appointment.count({
      where: { ...baseWhere, status: 'SCHEDULED' },
    }),

    prisma.appointment.count({
      where: { ...baseWhere, status: 'COMPLETED' },
    }),

    prisma.appointment.count({
      where: { ...baseWhere, status: 'CANCELLED' },
    }),
  ]);

  const enriched = appointments.sort((a, b) => {
    const aEmergency = a.emergency?.status === 'PENDING' ? 1 : 0;
    const bEmergency = b.emergency?.status === 'PENDING' ? 1 : 0;

    // 1️⃣ Emergency first
    if (aEmergency !== bEmergency) {
      return bEmergency - aEmergency;
    }

    // 2️⃣ If both emergency → oldest emergency first
    if (aEmergency && bEmergency) {
      return (
        new Date(a.emergency!.createdAt).getTime() - new Date(b.emergency!.createdAt).getTime()
      );
    }

    // 3️⃣ fallback → serial order
    return a.serialNumber - b.serialNumber;
  });
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
      doctorSession,
      appointments: enriched,
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

const createAppointment = async (payload: IAppointmentCreateInput, authUser: JwtPayload) => {
  if (!authUser?.id) {
    throw new ApiError(401, 'Please login first');
  }
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    include: { patient: true },
  });

  if (!user || !user.patient) {
    throw new ApiError(404, 'User or Patient profile not found');
  }
  const appointmentDate = new Date(payload.appointmentDate);
  const dayStart = bdStartOfDay(appointmentDate);
  const dayEnd = bdEndOfDay(appointmentDate);

  if (payload?.clinicId && !payload?.isEmergency) {
    // ট্রানজেকশন শুরু
    const result = await prisma.$transaction(async (tx) => {
      // ১. মেম্বারশিপ চেক
      const membership = await tx.membership.findFirst({
        where: {
          doctorId: payload.doctorId,
          clinicId: payload.clinicId,
          id: payload.membershipId,
        },
      });

      if (!membership) throw new ApiError(404, 'Invalid doctor-clinic membership');

      // ২. ইউজার ও পেশেন্ট প্রোফাইল চেক

      // ৩. ডেট ক্যালকুলেশন

      // ৪. ডুপ্লিকেট চেক
      const exists = await tx.appointment.findFirst({
        where: {
          patientName: payload?.patientName?.trim(),
          age: Number(payload?.ptAge),
          doctorId: payload.doctorId,
          clinicId: payload?.clinicId,
          appointmentDate: { gte: dayStart, lte: dayEnd },
          status: { in: ['SCHEDULED', 'PENDING'] },
        },
      });

      if (exists) throw new ApiError(409, 'You already booked an appointment today');

      // ৫. সিরিয়াল আপডেট
      const counter = await tx.appointmentCounter.upsert({
        where: {
          doctorId_clinicId_date: {
            doctorId: membership.doctorId,
            clinicId: membership.clinicId,
            date: dayStart,
          },
        },
        update: { lastSerial: { increment: 1 } },
        create: {
          doctorId: membership.doctorId,
          clinicId: membership.clinicId,
          date: dayStart,
          lastSerial: 1,
        },
      });

      // ৬. অ্যাপয়েন্টমেন্ট তৈরি
      const appointment = await tx.appointment.create({
        data: {
          appointmentDate,
          patientName: payload.patientName.trim(),
          age: Number(payload.ptAge),
          contactNumber: payload.phoneNumber,
          serialNumber: counter.lastSerial,
          status: 'SCHEDULED',
          doctorId: payload.doctorId,
          clinicId: payload.clinicId,
          membershipId: payload.membershipId,
          createdById: user.id,
        },
        include: {
          doctor: { include: { user: true } }, // ডক্টরের নাম পাওয়ার জন্য
          clinic: true,
        },
      });

      return { appointment, serialNumber: counter.lastSerial, userId: user.id };
    });

    // =================================================
    // ৭. COORDINATOR-কে নোটিফিকেশন পাঠানো (💡 Background Logic)
    // =================================================

    // ওই ডক্টর এবং ক্লিনিকের সাথে যুক্ত কো-অর্ডিনেটরদের খুঁজে বের করা
    const coordinators = await prisma.staff.findMany({
      where: {
        assignedDoctorId: payload.doctorId,
        clinicId: payload.clinicId,
        staffType: 'COORDINATOR',
      },
      select: {
        user: {
          select: {
            deviceTokens: { select: { token: true } },
          },
        },
      },
    });

    const tokens = coordinators.flatMap((c) => c.user.deviceTokens.map((dt) => dt.token));

    if (tokens.length > 0) {
      const title = 'নতুন অ্যাপয়েন্টমেন্ট বুকিং';
      const body = `${result.appointment.patientName} সিরিয়াল ${result.serialNumber}-এ বুকিং করেছেন।`;

      // ফায়ারবেস ব্যাচ নোটিফিকেশন
      sendBatchNotification(tokens, title, body);
    }

    return result;
  } else {
    const doctor = await prisma.doctor.findUnique({
      where: {
        id: payload?.doctorId,
      },
    });
    if (!doctor) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Doctor profile not found');
    }
    const exists = await prisma.appointment.findFirst({
      where: {
        patientName: payload?.patientName?.trim(),
        age: Number(payload?.ptAge),
        doctorId: payload.doctorId,

        appointmentDate: { gte: dayStart, lte: dayEnd },

        emergency: {
          status: 'PENDING',
        },
      },
    });

    if (exists) throw new ApiError(409, 'You already booked an appointment today');

    const appointment = await prisma.appointment.create({
      data: {
        appointmentDate,
        patientName: payload.patientName.trim(),
        age: Number(payload.ptAge),
        contactNumber: payload.phoneNumber,
        serialNumber: 0,
        status: 'SCHEDULED',
        isEmergency: true,
        doctorId: payload.doctorId,
        clinicId: payload.clinicId || null,
        createdById: user.id,
        membershipId: payload.membershipId || null,

        emergency: {
          create: {
            type: payload.emergencyType || 'PLATFORM',
            status: 'PENDING',
            transactionId: payload.transactionId || null,
            consultationFee: payload?.consultationFee,
            paymentMethod: payload?.paymentMethod,
            paymentStatus: payload.transactionId ? 'PAID' : 'PENDING',
            createdById: user.id,
          },
        },
      },
      include: {
        doctor: { include: { user: true } },
        clinic: true,
        emergency: true,
      },
    });
    return appointment;
  }
};
/**
 * Diagnostic Staff-এর জন্য অ্যাপয়েন্টমেন্ট তৈরি
 * এখানে clinicId ফ্রন্টএন্ড থেকে আসবে না, স্টাফের অ্যাকাউন্ট থেকে সার্ভারে বের করা হবে।
 */
const createAppointmentByDiagnosticStaff = async (payload: any, staffUserId: string) => {
  const { patientName, phoneNumber, ptAge, doctorId, address, membershipId } = payload;

  // ================= STAFF & CLINIC INFO =================
  const staffUser = await prisma.user.findUnique({
    where: { id: staffUserId },
    select: {
      role: true,
      id: true,
      clinic: { select: { id: true } },
      staff: { select: { clinicId: true } },
    },
  });

  if (!staffUser) throw new ApiError(httpStatus.NOT_FOUND, 'User not found');

  const clinicId =
    staffUser.role === UserRole.STAFF ? staffUser.staff?.clinicId : staffUser.clinic?.id;
  if (!clinicId) throw new ApiError(httpStatus.FORBIDDEN, 'আপনি কোনো ক্লিনিকের সাথে যুক্ত নন');

  // ================= DATE =================
  const appointmentDate = new Date(payload.appointmentDate || new Date());
  const dayStart = bdStartOfDay(appointmentDate);
  const dayEnd = bdEndOfDay(appointmentDate);

  // সাকসেসফুল ট্রানজেকশন শেষে নোটিফিকেশন পাঠানোর জন্য রেজাল্ট স্টোর করা
  const result = await prisma.$transaction(async (tx) => {
    // ১. পাসওয়ার্ড হ্যাশিং
    const hashedPassword = await bcrypt.hash(config.default_password || 'Password@123', 12);

    // ২. ইউজার তৈরি বা খুঁজে বের করা
    // ১. ইউজার খুঁজে বের করা বা তৈরি করা
    let patientUser = await tx.user.findUnique({
      where: { phoneNumber },
    });

    let patient;

    if (!patientUser) {
      // ২. যদি ইউজার না থাকে, তবে নতুন ইউজার তৈরি করবে
      patientUser = await tx.user.create({
        data: {
          name: patientName.trim(),
          phoneNumber,
          password: hashedPassword,
          role: UserRole.PATIENT,
        },
      });

      // ৩. এবং তার জন্য একটি নতুন পেশেন্ট প্রোফাইল তৈরি করবে
      patient = await tx.patient.create({
        data: {
          userId: patientUser.id,
          age: Number(ptAge),
          address: address || null,
        },
      });
    }

    // ৪. ডুপ্লিকেট চেক
    const existingAppointment = await tx.appointment.findFirst({
      where: {
        patientName: patientName.trim(),
        age: Number(ptAge),
        doctorId,
        clinicId,
        appointmentDate: { gte: dayStart, lte: dayEnd },
        status: { in: ['SCHEDULED', 'PENDING'] },
      },
    });

    if (existingAppointment) {
      throw new ApiError(
        httpStatus.CONFLICT,
        `ইতোমধ্যে অ্যাপয়েন্টমেন্ট আছে। সিরিয়াল: ${existingAppointment.serialNumber}`,
      );
    }

    // ৫. সিরিয়াল জেনারেশন
    const counter = await tx.appointmentCounter.upsert({
      where: { doctorId_clinicId_date: { doctorId, clinicId, date: dayStart } },
      update: { lastSerial: { increment: 1 } },
      create: { doctorId, clinicId, date: dayStart, lastSerial: 1 },
    });

    // ৬. অ্যাপয়েন্টমেন্ট তৈরি
    return await tx.appointment.create({
      data: {
        appointmentDate,
        patientName: patientName.trim(),
        age: Number(ptAge),
        address: address || null,
        contactNumber: phoneNumber,
        serialNumber: counter.lastSerial,
        status: 'SCHEDULED',
        doctorId,
        clinicId,
        source: 'STAFF',
        membershipId: membershipId || undefined,
        createdById: staffUser.id,
      },
      include: { doctor: true, clinic: true },
    });
  });

  // =================================================
  // ৭. COORDINATOR-কে নোটিফিকেশন পাঠানো (💡 Logic)
  // =================================================

  // ওই ডক্টরের ওই ক্লিনিকের কো-অর্ডিনেটরদের খুঁজে বের করা
  const coordinators = await prisma.staff.findMany({
    where: {
      assignedDoctorId: doctorId,
      clinicId: clinicId,
      staffType: 'COORDINATOR',
    },
    select: {
      userId: true,
      user: {
        select: {
          deviceTokens: { select: { token: true } },
        },
      },
    },
  });

  const coordinatorTokens = coordinators.flatMap((c) => c.user.deviceTokens.map((dt) => dt.token));

  if (coordinatorTokens.length > 0) {
    const title = 'নতুন অ্যাপয়েন্টমেন্ট';
    const body = `${result.patientName} (সিরিয়াল: ${result.serialNumber}) আজ অ্যাপয়েন্টমেন্ট নিয়েছেন।`;

    // একবারে সব কো-অর্ডিনেটরকে নোটিফিকেশন পাঠানো
    sendBatchNotification(coordinatorTokens, title, body);
  }

  return result;
};

// emergency
const requestEmergency = async (userId: string, appointmentId: string) => {
  return prisma.$transaction(async (tx) => {
    // ১. অ্যাপয়েন্টমেন্ট ডাটা বের করা
    const appointment = await tx.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        doctorId: true,
        clinicId: true,
        patientName: true,
      },
    });

    // CLINIC ID REQUIRED CHECK: এখানে চেক করা হচ্ছে অ্যাপয়েন্টমেন্ট আছে কি না এবং ক্লিনিক আইডি আছে কি না
    if (!appointment || !appointment.clinicId) {
      throw new ApiError(404, 'বৈধ অ্যাপয়েন্টমেন্ট বা ক্লিনিক আইডি খুঁজে পাওয়া যায়নি');
    }

    // ২. আগের ইমার্জেন্সি রিকোয়েস্ট চেক করা
    const existing = await tx.emergencyRequest.findUnique({
      where: { appointmentId },
    });

    if (existing) {
      throw new ApiError(
        400,
        'এই অ্যাপয়েন্টমেন্টের জন্য ইতিমধ্যে ইমার্জেন্সি রিকোয়েস্ট পাঠানো হয়েছে',
      );
    }

    // ৩. নতুন ইমার্জেন্সি রিকোয়েস্ট তৈরি করা
    const emergency = await tx.emergencyRequest.create({
      data: {
        appointmentId,
        type: EmergencyType.COORDINATOR,
        status: 'PENDING',
        createdById: userId,
      },
    });

    // ৪. কো-অর্ডিনেটর খুঁজে বের করা (এখানে clinicId এখন নিশ্চিতভাবেই string)
    const coordinators = await tx.staff.findMany({
      where: {
        assignedDoctorId: appointment.doctorId,
        clinicId: appointment.clinicId, // TypeScript এখন আর এরর দিবে না
        staffType: 'COORDINATOR',
      },
      select: {
        userId: true,
        user: {
          select: {
            deviceTokens: { select: { token: true } },
          },
        },
      },
    });

    // ৫. টোকেন সংগ্রহ এবং নোটিফিকেশন পাঠানো
    const coordinatorTokens = coordinators.flatMap((c) =>
      c.user.deviceTokens.map((dt) => dt.token),
    );

    if (coordinatorTokens.length > 0) {
      console.log(`Notification sending to: ${coordinatorTokens.length} tokens`);

      await sendBatchNotification(
        coordinatorTokens,
        'Emergency Alert! 🚨',
        `${appointment.patientName} এমার্জেন্সি সহায়তার অনুরোধ করেছেন।`,
      );
    }

    return emergency;
  });
};

const completeAppointment = async (appointmentId: string) => {
  return await prisma.$transaction(async (tx) => {
    // ১. অ্যাপয়েন্টমেন্ট আপডেট করা এবং প্রয়োজনীয় ডাটা সিলেক্ট করা
    const appointment = await tx.appointment.update({
      where: { id: appointmentId },
      data: { status: 'COMPLETED' },
      select: {
        doctorId: true,
        clinicId: true, // এটি Schema তে optional থাকতে পারে
        serialNumber: true,
      },
    });

    // ২. ইমার্জেন্সি কি না তা চেক করা
    const emergency = await tx.emergencyRequest.findFirst({
      where: { appointmentId: appointmentId },
    });

    // ৩. সিরিয়াল আপডেট লজিক
    // এখানে !emergency এবং clinicId এর অস্তিত্ব চেক করা হচ্ছে
    if (!emergency) {
      // ক্লিনিক আইডি চেক করা (যেহেতু এটি আপনার জন্য required)
      if (!appointment.clinicId) {
        throw new Error(`Clinic ID missing for appointment: ${appointmentId}`);
      }

      // এই পয়েন্টে আসার পর TypeScript জানে appointment.clinicId এখন string, null নয়।
      const currentSession = await tx.doctorSession.findFirst({
        where: {
          doctorId: appointment.doctorId,
          clinicId: appointment.clinicId, // আর এরর দিবে না
          status: 'ACTIVE',
        },
      });

      // নতুন সিরিয়াল নির্ধারণ
      const newRunningSerial = Math.max(
        currentSession?.runningSerial || 0,
        appointment.serialNumber,
      );

      // ডাটাবেজ আপডেট (DoctorSession)
      await tx.doctorSession.updateMany({
        where: {
          doctorId: appointment.doctorId,
          clinicId: appointment.clinicId,
          status: 'ACTIVE',
        },
        data: {
          runningSerial: newRunningSerial, // এখানে calculation করা ভ্যালু দেওয়া ভালো
        },
      });

      // ৪. Firestore-এ আপডেট পাঠানো
      await updateLiveSessionInFirestore(appointment.doctorId, appointment.clinicId, {
        runningSerial: newRunningSerial,
        status: 'ACTIVE',
      });

      console.log(`Normal appointment completed. Serial updated to: ${newRunningSerial}`);
    } else {
      console.log('Emergency appointment completed. Serial tracking remains unchanged.');
    }

    return appointment;
  });
};

const rejectEmergency = async (appointmentId: string) => {
  const emergency = await prisma.emergencyRequest.findUnique({
    where: { appointmentId },
  });

  if (!emergency) {
    throw new Error('Emergency request not found');
  }

  return prisma.emergencyRequest.update({
    where: { appointmentId },
    data: {
      status: 'REJECTED',
    },
  });
};
const acceptEmergencyAppointment = async (appointmentId: string) => {
  return prisma.$transaction(async (tx) => {
    const appointment = await tx.emergencyRequest.findUnique({
      where: { appointmentId },
    });

    if (!appointment) {
      throw new ApiError(404, 'Appointment not found');
    }

    // INSERT EMERGENCY
    await tx.emergencyRequest.update({
      where: {
        appointmentId,
      },

      data: {
        status: 'ACCEPT',
      },
    });

    return true;
  });
};
// Update Appointment Reason/Date (Update)
const updateAppointment = async (
  id: string,
  payload: Partial<IAppointmentCreateInput>,
): Promise<IAppointmentResponse> => {
  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Appointment ID is required');
  }

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
      patientName: payload?.patientName,
      age: payload.ptAge,
      appointmentDate: payload?.appointmentDate,
      doctorId: payload?.doctorId,
      contactNumber: payload?.phoneNumber,
      address: payload?.address,
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
    },
  });

  // 3️⃣ Status transition check
  const shouldSendSMS = isExist.status === 'PENDING' && updatedResult.status === 'SCHEDULED';

  // 4️⃣ SMS (non-blocking)
  if (shouldSendSMS && updatedResult.contactNumber) {
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
const updateDoctorSession = async (
  userId: string,
  status: DoctorSessionStatus,
): Promise<IAppointmentResponse> => {
  if (!userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User ID is required');
  }

  // ১. স্টাফ এবং এসাইন করা ডক্টর খুঁজে বের করা
  const staff = await prisma.staff.findUnique({
    where: { userId },
  });

  if (!staff) throw new ApiError(httpStatus.NOT_FOUND, 'Staff not found');
  if (staff.staffType !== 'COORDINATOR') throw new ApiError(httpStatus.FORBIDDEN, 'Access denied');
  if (!staff.assignedDoctorId || !staff.clinicId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Doctor or Clinic not assigned to this staff');
  }

  // ২. বর্তমান সেশন খুঁজে বের করা
  const doctorSession = await prisma.doctorSession.findFirst({
    where: {
      doctorId: staff.assignedDoctorId,
      clinicId: staff.clinicId,
    },
    orderBy: { startedAt: 'desc' },
  });

  if (!doctorSession) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Doctor Session was not found');
  }

  // ৩. সেশন স্ট্যাটাস আপডেট করা
  // কন্ডিশন: যদি স্ট্যাটাস ENDED হয়, তবে runningSerial ০ হবে
  const isEnded = status === 'ENDED';

  const updatedSession = await prisma.doctorSession.update({
    where: { id: doctorSession.id },
    data: {
      status,
      ...(isEnded && { runningSerial: 0 }),
    },
  });

  // ৪. FIREBASE REALTIME UPDATE
  try {
    await updateLiveSessionInFirestore(staff.assignedDoctorId, staff.clinicId, {
      runningSerial: isEnded ? 0 : updatedSession.runningSerial || 0,
      status: status,
    });
  } catch (error) {
    console.error('Firebase Realtime Update Error:', error);
  }

  // ৫. পুশ নোটিফিকেশন লজিক
  const activeAppointments = await prisma.appointment.findMany({
    where: {
      doctorId: staff.assignedDoctorId,
      clinicId: staff.clinicId,
      status: 'SCHEDULED',
      appointmentDate: {
        gte: new Date(new Date().setHours(0, 0, 0, 0)),
        lte: new Date(new Date().setHours(23, 59, 59, 999)),
      },
    },
    include: {
      createdBy: {
        select: {
          deviceTokens: { select: { token: true } },
        },
      },
    },
  });

  // ডায়নামিক মেসেজ বডি
  let body = '';
  switch (status) {
    case 'ACTIVE':
      body = 'ডক্টর এখন রোগী দেখছেন।';
      break;
    case 'PAUSED':
      body = 'ডক্টর এখন সাময়িক বিরতিতে আছেন।';
      break;
    case 'ENDED':
      body = 'আজকের চেম্বার সেশন শেষ হয়েছে।';
      break;
    default:
      body = 'চেম্বার স্ট্যাটাস আপডেট করা হয়েছে।';
  }

  const tokens = activeAppointments.flatMap(
    (appt) => appt.createdBy?.deviceTokens?.map((dt) => dt.token) || [],
  );

  const uniqueTokens = [...new Set(tokens)];

  if (uniqueTokens.length > 0) {
    sendBatchNotification(uniqueTokens, 'چেম্বার আপডেট', body);
  }

  return updatedSession as unknown as IAppointmentResponse;
};
export const AppointmentService = {
  getMyAppointments,
  createAppointment,
  acceptEmergencyAppointment,
  createAppointmentByDiagnosticStaff,
  getCoordinatorDashboard,
  requestEmergency,
  completeAppointment,
  updateDoctorSession,
  rejectEmergency,
  getPatientAppointments,
  updateAppointment,
};
