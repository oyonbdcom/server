import {
  AppointmentStatus,
  DoctorSessionStatus,
  EmergencyType,
  Prisma,
  UserRole,
} from '@prisma/client';

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
import {
  appointmentPopulate,
  normalizePhone,
  notifyCoordinator,
  resolvePatientUser,
  updateDiagnosticAnalytics,
} from './constant';
import { IAppointmentCreateInput, IAppointmentResponse, IAppointmentStats } from './interface';

interface IGetAppointmentsFilters {
  searchTerm?: string;
  date?: string;
  status?: AppointmentStatus;
  doctorId?: string;
  isEmergency?: string;

  diagId?: string;
  area?: string;
}

const getPatientAppointments = async (userId: string, options: IOptions) => {
  const { page, limit, skip } = paginationCalculator(options);

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
        diagId: true,
        serialNumber: true,
        consultationFee: true,
        contactNumber: true,
        paymentStatus: true,
        status: true,
        transactionId: true,
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
        diagnostic: {
          select: {
            user: { select: { name: true } },
            area: { select: { name: true } },
          },
        },
        emergency: {
          select: {
            id: true,
            status: true,
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

  return {
    meta: {
      total,
      page,
      limit,
      totalPage: Math.ceil(total / limit),
    },
    data: appointments,
  };
};

// doctor dashbaord
const getDoctorDashboardAppointments = async (
  user: JwtPayload,
  filters: IGetAppointmentsFilters,
  options: IOptions,
): Promise<IGenericResponse<IAppointmentResponse[], IAppointmentStats>> => {
  const { date, diagId } = filters;
  const { page, limit, skip, sortBy, sortOrder } = paginationCalculator(options);

  const andConditions: Prisma.AppointmentWhereInput[] = [];

  // ১. প্রথমেই ডাক্তারের আইডি নিশ্চিত করা (Security: ডাক্তার যেন অন্য কারো ডাটা না দেখে)
  const doctor = await prisma.doctor.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  if (!doctor) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Doctor profile not found');
  }

  // ডাক্তারের নিজস্ব আইডি দিয়ে ফিল্টার বাধ্যতামূলক
  andConditions.push({ doctorId: doctor.id });

  if (diagId) andConditions.push({ diagId });

  if (date) {
    andConditions.push({
      appointmentDate: {
        gte: bdStartOfDay(date),
        lte: bdEndOfDay(date),
      },
    });
  }

  const whereConditions: Prisma.AppointmentWhereInput = { AND: andConditions };

  // ৩. কোয়েরি রান করা (Promise.all ব্যবহার করে পারফরম্যান্স বাড়ানো)
  const [result, total, todayAppointments, pending, scheduled, completed, cancelled] =
    await Promise.all([
      prisma.appointment.findMany({
        where: whereConditions,
        skip,
        take: limit,
        orderBy: [{ isEmergency: 'desc' }, { appointmentDate: 'desc' }],
        include: appointmentPopulate,
      }),
      prisma.appointment.count({ where: whereConditions }),
      prisma.appointment.count({
        where: {
          ...whereConditions,
          appointmentDate: { gte: bdStartOfDay(new Date()), lte: bdEndOfDay(new Date()) },
        },
      }),
      prisma.appointment.count({
        where: { ...whereConditions, status: AppointmentStatus.PENDING },
      }),
      prisma.appointment.count({
        where: { ...whereConditions, status: AppointmentStatus.SCHEDULED },
      }),
      prisma.appointment.count({
        where: { ...whereConditions, status: AppointmentStatus.COMPLETED },
      }),
      prisma.appointment.count({
        where: { ...whereConditions, status: AppointmentStatus.CANCELLED },
      }),
    ]);

  return {
    meta: { total, page, limit, totalPage: Math.ceil(total / limit) },
    data: result as unknown as IAppointmentResponse[],
    stats: { total, todayAppointments, pending, scheduled, completed, cancelled },
  };
};

const getAreaManagerAppointments = async (
  user: JwtPayload,
  filters: IGetAppointmentsFilters,
  options: IOptions,
): Promise<IGenericResponse<IAppointmentResponse[], IAppointmentStats>> => {
  const { date, status, doctorId, diagId, isEmergency } = filters;
  const { page, limit, skip, sortBy, sortOrder } = paginationCalculator(options);

  // ১. এরিয়া ম্যানেজার ভ্যালিডেশন (সরাসরি ডেটাবেজ চেক)
  const manager = await prisma.manager.findUnique({
    where: { userId: user.id },
    select: { areaId: true },
  });

  if (!manager) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Manager profile not found');
  }

  // ২. ফিল্টার কন্ডিশন তৈরি
  const andConditions: Prisma.AppointmentWhereInput[] = [];

  // এরিয়া বা ইমার্জেন্সি কন্ডিশন
  if (isEmergency) {
    andConditions.push({ isEmergency: true });
  } else {
    andConditions.push({ diagnostic: { areaId: manager.areaId } });
  }

  // অন্যান্য ডাইনামিক ফিল্টার
  if (status) andConditions.push({ status });
  if (doctorId) andConditions.push({ doctorId });
  if (diagId) andConditions.push({ diagId });

  if (date) {
    andConditions.push({
      appointmentDate: { gte: bdStartOfDay(date), lte: bdEndOfDay(date) },
    });
  }

  const whereConditions: Prisma.AppointmentWhereInput = { AND: andConditions };

  // ৩. কোয়েরি এক্সিকিউশন
  const [result, statsData] = await Promise.all([
    prisma.appointment.findMany({
      where: whereConditions,
      skip,
      take: limit,
      orderBy: sortBy && sortOrder ? { [sortBy]: sortOrder } : { appointmentDate: 'desc' },
      include: appointmentPopulate,
    }),
    // সব স্ট্যাটাস একসাথে কাউন্ট করার জন্য groupBy ব্যবহার করুন (অত্যন্ত দ্রুত)
    prisma.appointment.groupBy({
      by: ['status'],
      where: whereConditions,
      _count: { status: true },
    }),
  ]);

  // ৪. টোটাল অ্যাপয়েন্টমেন্ট কাউন্ট (meta এর জন্য)
  const total = await prisma.appointment.count({ where: whereConditions });

  // ৫. স্ট্যাটাস ফরম্যাটিং
  const stats = {
    total,

    pending: statsData.find((s) => s.status === 'PENDING')?._count.status || 0,
    scheduled: statsData.find((s) => s.status === 'SCHEDULED')?._count.status || 0,
    completed: statsData.find((s) => s.status === 'COMPLETED')?._count.status || 0,
    cancelled: statsData.find((s) => s.status === 'CANCELLED')?._count.status || 0,
  };

  return {
    meta: { total, page, limit, totalPage: Math.ceil(total / limit) },
    data: result as unknown as IAppointmentResponse[],
    stats,
  };
};

const getDiagnosticAppointments = async (
  user: JwtPayload,
  filters: IGetAppointmentsFilters,
  options: IOptions,
): Promise<IGenericResponse<IAppointmentResponse[], IAppointmentStats>> => {
  const { date, status, doctorId } = filters;

  const { page, limit, skip, sortBy, sortOrder } = paginationCalculator(options);

  const andConditions: Prisma.AppointmentWhereInput[] = [];

  const diagnostic = await prisma.diagnostic.findUnique({
    where: {
      userId: user.id,
    },
    select: {
      id: true,
    },
  });

  if (!diagnostic) {
    throw new ApiError(httpStatus.NOT_FOUND, 'diagnostic profile not found');
  }

  andConditions.push({
    diagId: diagnostic.id,
  });

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
  const orderBy: Prisma.AppointmentOrderByWithRelationInput[] = [];

  if (sortBy && sortOrder) {
    orderBy.push({ [sortBy]: sortOrder } as Prisma.AppointmentOrderByWithRelationInput);
  } else {
    orderBy.push({ appointmentDate: 'desc' });
  }
  const [result, total, todayAppointments, pending, scheduled, completed, cancelled] =
    await Promise.all([
      prisma.appointment.findMany({
        where: whereConditions,

        skip,
        take: limit,

        orderBy,

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
const getReceptionistAppointments = async (
  user: JwtPayload,
  filters: IGetAppointmentsFilters,
  options: IOptions,
) => {
  const { date, status, doctorId } = filters;
  const { page, limit, skip, sortBy, sortOrder } = paginationCalculator(options);

  const andConditions: Prisma.AppointmentWhereInput[] = [];

  // =========================
  // STAFF INFO
  // =========================
  const staff = await prisma.staff.findUnique({
    where: { userId: user.id, staffType: 'RECEPTIONIST' },
    select: {
      diagId: true,
      staffType: true,
    },
  });

  if (!staff) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Staff profile not found');
  }

  andConditions.push({
    createdById: user.id,
  });

  // =========================
  // FILTERS
  // =========================
  if (status) {
    andConditions.push({ status });
  }

  if (doctorId) {
    andConditions.push({ doctorId });
  }

  const dateFilter = date
    ? {
        appointmentDate: {
          gte: bdStartOfDay(date),
          lte: bdEndOfDay(date),
        },
      }
    : null;

  if (dateFilter) {
    andConditions.push(dateFilter);
  }

  const whereConditions: Prisma.AppointmentWhereInput = andConditions.length
    ? { AND: andConditions }
    : {};

  // =========================
  // ORDER
  // =========================
  const orderBy: Prisma.AppointmentOrderByWithRelationInput[] =
    sortBy && sortOrder ? [{ [sortBy]: sortOrder } as any] : [{ appointmentDate: 'desc' }];

  // =========================
  // QUERY
  // =========================
  const [result, total] = await Promise.all([
    prisma.appointment.findMany({
      where: whereConditions,
      skip,
      take: limit,
      orderBy,
      include: appointmentPopulate,
    }),

    prisma.appointment.count({
      where: whereConditions,
    }),
  ]);

  // =========================
  // STATS (safe date handling)
  // =========================
  const todayFilter = date
    ? {
        appointmentDate: {
          gte: bdStartOfDay(date),
          lte: bdEndOfDay(date),
        },
      }
    : undefined;

  const baseWhere = whereConditions;

  const [todayAppointments, pending, scheduled, completed, cancelled] = await Promise.all([
    prisma.appointment.count({
      where: todayFilter ? { AND: [baseWhere, todayFilter] } : baseWhere,
    }),

    prisma.appointment.count({
      where: { AND: [baseWhere, { status: AppointmentStatus.PENDING }] },
    }),

    prisma.appointment.count({
      where: { AND: [baseWhere, { status: AppointmentStatus.SCHEDULED }] },
    }),

    prisma.appointment.count({
      where: { AND: [baseWhere, { status: AppointmentStatus.COMPLETED }] },
    }),

    prisma.appointment.count({
      where: { AND: [baseWhere, { status: AppointmentStatus.CANCELLED }] },
    }),
  ]);

  return {
    meta: {
      total,
      page,
      limit,
      totalPage: Math.ceil(total / limit),
    },
    data: result as any[],
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
// const getMyAppointments = async (
//   user: JwtPayload,
//   filters: IGetAppointmentsFilters,
//   options: IOptions,
// ): Promise<IGenericResponse<IAppointmentResponse[], IAppointmentStats>> => {
//   const { searchTerm, date, status, doctorId, diagId, area, isEmergency } = filters;

//   const { page, limit, skip, sortBy, sortOrder } = paginationCalculator(options);

//   const andConditions: Prisma.AppointmentWhereInput[] = [];

//   // =====================================================
//   // ROLE BASED SCOPING
//   // =====================================================

//   switch (user.role) {
//     // -----------------------------------------
//     // DIAGNOSTIC MANAGER
//     // -----------------------------------------
//     case UserRole.DIAGNOSTIC: {
//       const diagnostic = await prisma.diagnostic.findUnique({
//         where: {
//           userId: user.id,
//         },
//         select: {
//           id: true,
//         },
//       });

//       if (!diagnostic) {
//         throw new ApiError(httpStatus.NOT_FOUND, 'diagnostic profile not found');
//       }

//       andConditions.push({
//         diagId: diagnostic.id,
//       });

//       break;
//     }
//     case UserRole.DOCTOR: {
//       const doctor = await prisma.doctor.findUnique({
//         where: {
//           userId: user.id,
//         },
//         select: {
//           id: true,
//         },
//       });

//       if (!doctor) {
//         throw new ApiError(httpStatus.NOT_FOUND, 'diagnostic profile not found');
//       }

//       andConditions.push({
//         doctorId: doctor.id,
//       });

//       break;
//     }

//     // -----------------------------------------
//     // AREA MANAGER
//     // -----------------------------------------
//     case UserRole.AREA_MANAGER: {
//       const manager = await prisma.manager.findUnique({
//         where: { userId: user.id },
//         select: { areaId: true },
//       });

//       if (!manager) {
//         throw new ApiError(httpStatus.NOT_FOUND, 'Manager profile not found');
//       }

//       // ১. এরিয়া ম্যানেজারের এরিয়ার কন্ডিশন
//       const areaCondition = {
//         diagnostic: {
//           areaId: manager.areaId,
//         },
//       };

//       if (isEmergency) {
//         andConditions.push({
//           isEmergency: true,
//         });
//       } else {
//         andConditions.push(areaCondition);
//       }

//       break;
//     }

//     // -----------------------------------------
//     // STAFF
//     // -----------------------------------------
//     case UserRole.STAFF: {
//       const staff = await prisma.staff.findUnique({
//         where: {
//           userId: user.id,
//         },

//         select: {
//           diagId: true,
//           assignedDoctorId: true,
//           staffType: true,
//         },
//       });

//       if (!staff) {
//         throw new ApiError(httpStatus.NOT_FOUND, 'Staff profile not found');
//       }

//       // =====================================================
//       // RECEPTIONIST
//       // only own created appointments
//       // =====================================================

//       andConditions.push({
//         createdById: user.id,
//       });

//       // =====================================================
//       // COORDINATOR
//       // own appointments + assigned doctor appointments
//       // =====================================================

//       break;
//     }

//     // -----------------------------------------
//     // ADMIN
//     // -----------------------------------------
//     case UserRole.ADMIN:
//     default:
//       break;
//   }

//   // =====================================================
//   // FILTERS
//   // =====================================================

//   // status
//   if (status) {
//     andConditions.push({
//       status,
//     });
//   }

//   // doctor
//   if (doctorId) {
//     andConditions.push({
//       doctorId,
//     });
//   }

//   // diagnostic
//   if (diagId) {
//     andConditions.push({
//       diagId,
//     });
//   }

//   // area
//   if (area) {
//     andConditions.push({
//       diagnostic: {
//         area: {
//           slug: area,
//         },
//       },
//     });
//   }

//   // search
//   if (searchTerm) {
//     andConditions.push({
//       OR: [
//         {
//           patientName: {
//             contains: searchTerm,
//             mode: 'insensitive',
//           },
//         },

//         {
//           contactNumber: {
//             contains: searchTerm,
//             mode: 'insensitive',
//           },
//         },

//         {
//           doctor: {
//             user: {
//               name: {
//                 contains: searchTerm,
//                 mode: 'insensitive',
//               },
//             },
//           },
//         },

//         {
//           diagnostic: {
//             user: {
//               name: {
//                 contains: searchTerm,
//                 mode: 'insensitive',
//               },
//             },
//           },
//         },
//       ],
//     });
//   }

//   // date
//   if (date) {
//     andConditions.push({
//       appointmentDate: {
//         gte: bdStartOfDay(date),
//         lte: bdEndOfDay(date),
//       },
//     });
//   }

//   // =====================================================
//   // FINAL WHERE
//   // =====================================================

//   const whereConditions: Prisma.AppointmentWhereInput =
//     andConditions.length > 0
//       ? {
//           AND: andConditions,
//         }
//       : {};

//   // =====================================================
//   // QUERY
//   // =====================================================
//   const orderBy: Prisma.AppointmentOrderByWithRelationInput[] = [];

//   if (user?.role === 'DOCTOR') {
//     orderBy.push({ isEmergency: 'desc' });
//   }

//   if (sortBy && sortOrder) {
//     orderBy.push({ [sortBy]: sortOrder } as Prisma.AppointmentOrderByWithRelationInput);
//   } else {
//     orderBy.push({ appointmentDate: 'desc' });
//   }
//   const [result, total, todayAppointments, pending, scheduled, completed, cancelled] =
//     await Promise.all([
//       prisma.appointment.findMany({
//         where: whereConditions,

//         skip,
//         take: limit,

//         orderBy,

//         include: appointmentPopulate,
//       }),

//       prisma.appointment.count({
//         where: whereConditions,
//       }),
//       prisma.appointment.count({
//         where: {
//           ...whereConditions,

//           appointmentDate: {
//             gte: bdStartOfDay(date),
//             lte: bdEndOfDay(date),
//           },
//         },
//       }),
//       prisma.appointment.count({
//         where: {
//           ...whereConditions,
//           status: AppointmentStatus.PENDING,
//         },
//       }),

//       prisma.appointment.count({
//         where: {
//           ...whereConditions,
//           status: AppointmentStatus.SCHEDULED,
//         },
//       }),

//       prisma.appointment.count({
//         where: {
//           ...whereConditions,
//           status: AppointmentStatus.COMPLETED,
//         },
//       }),

//       prisma.appointment.count({
//         where: {
//           ...whereConditions,
//           status: AppointmentStatus.CANCELLED,
//         },
//       }),
//     ]);

//   return {
//     meta: {
//       total,
//       page,
//       limit,
//       totalPage: Math.ceil(total / limit),
//     },

//     data: result as unknown as IAppointmentResponse[],

//     stats: {
//       total,
//       todayAppointments,
//       pending,
//       scheduled,
//       completed,
//       cancelled,
//     },
//   };
// };

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
      diagId: staff.diagId,
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
        diagId: staff.diagId,

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
        paymentStatus: true,
        patientName: true,
        appointmentDate: true,
        serialNumber: true,
        doctorId: true,
        address: true,
        id: true,

        emergency: {
          select: {
            id: true,
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

  // ডাটা ফেচ হওয়ার পর:
  const sortedAppointments = [...appointments].sort((a, b) => {
    const statusA = a.emergency?.status || 'NONE';
    const statusB = b.emergency?.status || 'NONE';

    // ১. ইমার্জেন্সি পেন্ডিং (সর্বোচ্চ অগ্রাধিকার)
    if (statusA === 'PENDING' && statusB !== 'PENDING') return -1;
    if (statusA !== 'PENDING' && statusB === 'PENDING') return 1;

    // ২. ইমার্জেন্সি এক্সেপ্টেড (দ্বিতীয় অগ্রাধিকার)
    const isAcceptedA = statusA === 'ACCEPT';
    const isAcceptedB = statusB === 'ACCEPT';

    if (isAcceptedA && !isAcceptedB) {
      // যদি B পেন্ডিং না হয় (কারণ পেন্ডিং চেক আগেই হয়েছে), তবে A উপরে থাকবে
      if (statusB !== 'PENDING') return -1;
    }
    if (!isAcceptedA && isAcceptedB) {
      if (statusA !== 'PENDING') return 1;
    }

    // ৩. যাদের ইমার্জেন্সি নেই (NONE) অথবা রিজেক্টেড (REJECTED)
    // তারা তাদের সিরিয়াল নাম্বার অনুযায়ী পজিশন পাবে
    return (a.serialNumber || 0) - (b.serialNumber || 0);
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
      appointments: sortedAppointments,
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

  const dayStart = bdStartOfDay(payload.appointmentDate);
  const dayEnd = bdEndOfDay(payload.appointmentDate);

  // ট্রানজেকশন শুরু
  const result = await prisma.$transaction(async (tx) => {
    // ১. মেম্বারশিপ চেক
    const membership = await tx.membership.findFirst({
      where: {
        doctorId: payload.doctorId,
        diagId: payload.diagId,
        id: payload.membershipId,
      },
    });

    if (!membership) throw new ApiError(404, 'Invalid doctor-diagnostic membership');

    const exists = await tx.appointment.findFirst({
      where: {
        patientName: payload?.patientName?.trim(),
        age: Number(payload?.ptAge),
        doctorId: payload.doctorId,
        diagId: payload?.diagId,
        appointmentDate: { gte: dayStart, lte: dayEnd },
        status: { in: ['SCHEDULED', 'PENDING'] },
      },
    });

    if (exists) throw new ApiError(409, 'You already booked an appointment today');

    // ২. সিরিয়াল আপডেট
    const counter = await tx.appointmentCounter.upsert({
      where: {
        doctorId_diagId_date: {
          doctorId: membership.doctorId,
          diagId: membership.diagId,
          date: dayStart,
        },
      },
      update: { lastSerial: { increment: 1 } },
      create: {
        doctorId: membership.doctorId,
        diagId: membership.diagId,
        date: dayStart,
        lastSerial: 1,
      },
    });

    // ৩. অ্যাপয়েন্টমেন্ট তৈরি
    const appointment = await tx.appointment.create({
      data: {
        appointmentDate: dayStart,
        patientName: payload.patientName.trim(),
        age: Number(payload.ptAge),
        contactNumber: payload.phoneNumber,
        serialNumber: counter.lastSerial,
        status: 'SCHEDULED',
        doctorId: payload.doctorId,
        diagId: payload.diagId,
        membershipId: payload.membershipId,
        createdById: user.id,
      },
      include: {
        doctor: { include: { user: true } },
        diagnostic: true,
      },
    });

    await updateDiagnosticAnalytics(
      tx,
      payload?.diagId,
      payload?.doctorId,
      undefined,
      dayStart,
      'PLATFORM',
    );
    return { appointment, serialNumber: counter.lastSerial, userId: user.id };
  });

  // =================================================
  // ৫. COORDINATOR-কে নোটিফিকেশন পাঠানো
  // =================================================
  const coordinators = await prisma.staff.findMany({
    where: {
      assignedDoctorId: payload.doctorId,
      diagId: payload.diagId,
      staffType: 'COORDINATOR',
    },
    select: { user: { select: { deviceTokens: { select: { token: true } } } } },
  });

  const tokens = coordinators.flatMap((c) => c.user.deviceTokens.map((dt) => dt.token));

  if (tokens.length > 0) {
    const title = 'নতুন অ্যাপয়েন্টমেন্ট বুকিং';
    const body = `${result.appointment.patientName} সিরিয়াল ${result.serialNumber}-এ বুকিং করেছেন।`;
    sendBatchNotification(tokens, title, body);
  }

  return result;
};
// normal user for create appoitment
const emergencyCreateAppointment = async (
  payload: IAppointmentCreateInput,
  authUser: JwtPayload,
) => {
  if (!authUser?.id) {
    throw new ApiError(401, 'Please login first');
  }
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    include: { patient: true },
  });

  // Logic for patients continues here...
  if (!user || !user.patient) {
    throw new ApiError(404, 'User or Patient profile not found');
  }
  const appointmentDate = new Date(payload.appointmentDate);
  const dayStart = bdStartOfDay(appointmentDate);
  const dayEnd = bdEndOfDay(appointmentDate);

  if (payload?.diagId && !payload?.isEmergency) {
    // ট্রানজেকশন শুরু
    const result = await prisma.$transaction(async (tx) => {
      // ১. মেম্বারশিপ চেক
      const membership = await tx.membership.findFirst({
        where: {
          doctorId: payload.doctorId,
          diagId: payload.diagId,
          id: payload.membershipId,
        },
      });

      if (!membership) throw new ApiError(404, 'Invalid doctor-diagnostic membership');

      const exists = await tx.appointment.findFirst({
        where: {
          patientName: payload?.patientName?.trim(),
          age: Number(payload?.ptAge),
          doctorId: payload.doctorId,
          diagId: payload?.diagId,
          appointmentDate: { gte: dayStart, lte: dayEnd },
          status: { in: ['SCHEDULED', 'PENDING'] },
        },
      });

      if (exists) throw new ApiError(409, 'You already booked an appointment today');

      // ৫. সিরিয়াল আপডেট
      const counter = await tx.appointmentCounter.upsert({
        where: {
          doctorId_diagId_date: {
            doctorId: membership.doctorId,
            diagId: membership.diagId,
            date: dayStart,
          },
        },
        update: { lastSerial: { increment: 1 } },
        create: {
          doctorId: membership.doctorId,
          diagId: membership.diagId,
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
          diagId: payload.diagId,
          membershipId: payload.membershipId,
          createdById: user.id,
        },
        include: {
          doctor: { include: { user: true } }, // ডক্টরের নাম পাওয়ার জন্য
          diagnostic: true,
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
        diagId: payload.diagId,
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
        diagId: payload.diagId || null,
        createdById: user.id,
        membershipId: payload.membershipId || null,
        transactionId: payload.transactionId || null,
        consultationFee: payload?.consultationFee,
        paymentMethod: payload?.paymentMethod,
        paymentStatus: payload.transactionId ? 'PAID' : 'PENDING',
        emergency: {
          create: {
            type: payload.emergencyType || 'PLATFORM',
            status: 'PENDING',
          },
        },
      },
      include: {
        doctor: { include: { user: true } },
        diagnostic: true,
        emergency: true,
      },
    });
    return appointment;
  }
};
/**
 * Diagnostic Staff-এর জন্য অ্যাপয়েন্টমেন্ট তৈরি
 * এখানে diagnosticId ফ্রন্টএন্ড থেকে আসবে না, স্টাফের অ্যাকাউন্ট থেকে সার্ভারে বের করা হবে।
 */
const createAppointmentByDiagnosticStaff = async (payload: any, staffUserId: string) => {
  const { patientName, phoneNumber, ptAge, doctorId, address, membershipId } = payload;

  // ================= STAFF & diagnostic INFO =================
  const staffUser = await prisma.user.findUnique({
    where: { id: staffUserId },
    select: {
      role: true,
      id: true,
      diagnostic: { select: { id: true } },
      staff: { select: { diagId: true, id: true } },
    },
  });

  if (!staffUser) throw new ApiError(httpStatus.NOT_FOUND, 'User not found');

  const diagId =
    staffUser.role === UserRole.STAFF ? staffUser.staff?.diagId : staffUser.diagnostic?.id;
  if (!diagId) throw new ApiError(httpStatus.FORBIDDEN, 'আপনি কোনো ক্লিনিকের সাথে যুক্ত নন');

  // ================= DATE =================

  const dayStart = bdStartOfDay(payload.appointmentDate || new Date());
  const dayEnd = bdEndOfDay(payload.appointmentDate || new Date());

  // সাকসেসফুল ট্রানজেকশন শেষে নোটিফিকেশন পাঠানোর জন্য রেজাল্ট স্টোর করা
  const result = await prisma.$transaction(async (tx) => {
    await resolvePatientUser({ tx, phoneNumber, patientName, address, ptAge });

    // ৪. ডুপ্লিকেট চেক
    const existingAppointment = await tx.appointment.findFirst({
      where: {
        patientName: patientName.trim(),
        age: Number(ptAge),
        doctorId,
        diagId,
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
      where: { doctorId_diagId_date: { doctorId, diagId, date: dayStart } },
      update: { lastSerial: { increment: 1 } },
      create: { doctorId, diagId, date: dayStart, lastSerial: 1 },
    });

    // ৬. অ্যাপয়েন্টমেন্ট তৈরি
    const appt = await tx.appointment.create({
      data: {
        appointmentDate: dayStart,
        patientName: patientName.trim(),
        age: 0,
        address: address || null,
        contactNumber: phoneNumber,
        serialNumber: counter.lastSerial,
        status: 'SCHEDULED',
        doctorId,
        diagId,
        source: 'STAFF',
        membershipId: membershipId || undefined,
        createdById: staffUser.id,
      },
      include: { doctor: true, diagnostic: true },
    });
    await updateDiagnosticAnalytics(
      tx,
      diagId,
      doctorId,
      staffUser.staff?.id || staffUser?.id || 'SYSTEM',
      dayStart,
      'STAFF',
    );
    return appt;
  });

  await notifyCoordinator({ result, doctorId, diagId });

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
        diagId: true,
        patientName: true,
      },
    });

    // diagnostic ID REQUIRED CHECK: এখানে চেক করা হচ্ছে অ্যাপয়েন্টমেন্ট আছে কি না এবং ক্লিনিক আইডি আছে কি না
    if (!appointment || !appointment.diagId) {
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
      },
    });

    // ৪. কো-অর্ডিনেটর খুঁজে বের করা (এখানে diagnosticId এখন নিশ্চিতভাবেই string)
    const coordinators = await tx.staff.findMany({
      where: {
        assignedDoctorId: appointment.doctorId,
        diagId: appointment.diagId, // TypeScript এখন আর এরর দিবে না
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
    // ১. অ্যাপয়েন্টমেন্ট আপডেট এবং ডাটা ফেচ
    const appointment = await tx.appointment.update({
      where: { id: appointmentId },
      data: { status: 'COMPLETED' },
      select: {
        doctorId: true,
        diagId: true,
        serialNumber: true,
        source: true, // PLATFORM বা STAFF
      },
    });

    if (!appointment.diagId) {
      throw new Error(`Diagnostic ID missing for appointment: ${appointmentId}`);
    }

    // ২. ব্যালেন্স কমানোর লজিক
    const deduction = appointment.source === 'PLATFORM' ? 100 : 5;
    await tx.diagnostic.update({
      where: { id: appointment.diagId },
      data: {
        balance: { decrement: deduction },
      },
    });

    // ৩. Wallet Ledger এন্ট্রি (Transaction History)
    await tx.walletLedger.create({
      data: {
        diagId: appointment.diagId,
        amount: deduction,
        type: 'DEBIT',
        source: appointment.source, // 'PLATFORM' বা 'STAFF'
        referenceId: appointmentId,
        description: `${appointment.source} booking fee deduction`,
      },
    });

    // ৪. DiagnosticAnalytics আপডেট
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await tx.diagnosticAnalytics.update({
      where: {
        diagId_date: {
          diagId: appointment.diagId,
          date: today,
        },
      },
      data: {
        completedCount: { increment: 1 },
        // এখানে সোর্স অনুযায়ী আলাদা ফিল্ড ইনক্রিমেন্ট করছি (আপনার স্কিমা অনুযায়ী)
        platformBookings: appointment.source === 'PLATFORM' ? { increment: 1 } : undefined,
      },
    });

    // ৫. ইমার্জেন্সি চেক এবং সিরিয়াল আপডেট
    const emergency = await tx.emergencyRequest.findFirst({
      where: { appointmentId: appointmentId },
    });

    if (!emergency) {
      await tx.doctorSession.updateMany({
        where: {
          doctorId: appointment.doctorId,
          diagId: appointment.diagId,
          status: 'ACTIVE',
        },
        data: { runningSerial: appointment.serialNumber },
      });

      await updateLiveSessionInFirestore(appointment.doctorId, appointment.diagId, {
        runningSerial: appointment.serialNumber,
        status: 'ACTIVE',
      });
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
      diagnostic: {
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
      appointmentDate: bdStartOfDay(payload?.appointmentDate),
      doctorId: payload?.doctorId,
      contactNumber: payload?.phoneNumber,
      address: payload?.address,
      paymentStatus: payload?.paymentStatus,
    },
    include: {
      doctor: {
        select: {
          user: {
            select: {
              name: true,
              id: true,
            },
          },
          department: {
            select: {
              name: true,
            },
          },
        },
      },
      emergency: true,
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

        const message = `${config.site?.siteName}: Your appointment with Dr. ${doctorName} is confirmed. Serial: ${serial}.`;

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
  if (!staff.assignedDoctorId || !staff.diagId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Doctor or diagnostic not assigned to this staff');
  }

  // ২. বর্তমান সেশন খুঁজে বের করা
  const doctorSession = await prisma.doctorSession.findFirst({
    where: {
      doctorId: staff.assignedDoctorId,
      diagId: staff.diagId,
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
    await updateLiveSessionInFirestore(staff.assignedDoctorId, staff.diagId, {
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
      diagId: staff.diagId,
      status: 'SCHEDULED',
      appointmentDate: {
        gte: bdStartOfDay(new Date()),
        lte: bdEndOfDay(new Date()),
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
  getDoctorDashboardAppointments,
  getAreaManagerAppointments,
  getDiagnosticAppointments,
  getReceptionistAppointments,
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
