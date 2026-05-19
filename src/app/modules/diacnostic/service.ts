import { Prisma, UserRole } from '@prisma/client';
import httpStatus from 'http-status';

import bcrypt from 'bcrypt';
import { IOptions, paginationCalculator } from '../../../helper/pagination';
import { IGenericResponse } from '../../../interface/common';
import prisma from '../../../prisma/client';
import ApiError from '../../../utils/apiError';
import { DIAGNOSTIC_SELECT, IDiagnosticFilterRequest } from './constant';
import {
  ICreateDiagnosticRequest,
  IDiagnosticManagerStats,
  IDiagnosticResponse,
  IUpdateDiagnosticRequest,
} from './interface';

const createDiagnostic = async (
  DiagnosticData: ICreateDiagnosticRequest,
  userId: string,
): Promise<IDiagnosticResponse | null> => {
  const defaultPassword = 'Password@123';

  // ১. নাম এবং ফোন নম্বর চেক করা
  if (!DiagnosticData.user?.name || !DiagnosticData.user?.phoneNumber) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'ক্লিনিকের নাম এবং ফোন নম্বর প্রদান করা বাধ্যতামূলক!',
    );
  }

  const managerProfile = await prisma.manager.findUnique({
    where: { userId },
    select: { areaId: true },
  });

  if (!managerProfile || !managerProfile.areaId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'ম্যানেজারের এরিয়া তথ্য পাওয়া যায়নি!');
  }

  // ৩. পাসওয়ার্ড হ্যাশ করা
  const hashedPassword = await bcrypt.hash(DiagnosticData.user?.password || defaultPassword, 10);

  // ৪. ডাটাবেজে ক্লিনিক তৈরি (Transaction ব্যবহার করা নিরাপদ)
  const Diagnostic = await prisma.clinic.create({
    data: {
      slug: DiagnosticData.slug,
      address: DiagnosticData.address,

      area: {
        connect: {
          id: managerProfile.areaId,
        },
      },

      user: {
        create: {
          name: DiagnosticData.user.name,
          phoneNumber: DiagnosticData.user.phoneNumber,
          password: hashedPassword,
          role: UserRole.DIAGNOSTIC_MANAGER,
          image: DiagnosticData.user.image,
          isDefaultPassword: !DiagnosticData.user.password,
        },
      },
    },
    select: DIAGNOSTIC_SELECT,
  });

  if (!Diagnostic) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'ক্লিনিক প্রোফাইল তৈরি করতে সমস্যা হয়েছে',
    );
  }

  return Diagnostic as unknown as IDiagnosticResponse;
};

const getDiagnostics = async (
  filter: IDiagnosticFilterRequest,
  options: IOptions,
): Promise<IGenericResponse<IDiagnosticResponse[]>> => {
  const { page, limit, skip, sortBy, sortOrder } = paginationCalculator(options);

  // ১. ডিস্ট্রিক্ট এবং এরিয়া ডিস্ট্রাকচার করুন
  const { searchTerm, deactivate, district, area } = filter;

  const andConditions: Prisma.ClinicWhereInput[] = [];

  // সার্চ টার্ম লজিক
  if (searchTerm) {
    andConditions.push({
      OR: [
        { user: { name: { contains: searchTerm, mode: 'insensitive' } } },
        { user: { phoneNumber: { contains: searchTerm, mode: 'insensitive' } } },
      ],
    });
  }

  // স্ট্যাটাস ফিল্টার
  if (deactivate !== undefined) {
    const isDeactivated = deactivate === 'true';
    andConditions.push({
      user: {
        deactivate: isDeactivated,
      },
    });
  }

  // ২. ডিস্ট্রিক্ট ফিল্টার (Relation: Diagnostic -> area -> district)
  if (district) {
    andConditions.push({
      area: {
        district: {
          slug: district, // অথবা name: district
        },
      },
    });
  }

  // ৩. এরিয়া ফিল্টার (Relation: Diagnostic -> area)
  if (area) {
    andConditions.push({
      area: {
        slug: area, // অথবা name: area
      },
    });
  }

  const whereCondition: Prisma.ClinicWhereInput = { AND: andConditions };

  // ডাটাবেজ কোয়েরি
  const [data, total] = await Promise.all([
    prisma.clinic.findMany({
      where: whereCondition,
      skip,
      take: limit,
      orderBy: sortBy && sortOrder ? { [sortBy]: sortOrder } : { createdAt: 'desc' },
      select: DIAGNOSTIC_SELECT,
    }),
    prisma.clinic.count({ where: whereCondition }),
  ]);
  const totalPage = Math.ceil(total / limit);
  return {
    meta: { page, limit, total, totalPage },
    data: data as unknown as IDiagnosticResponse[],
  };
};
const getDiagnosticBySlug = async (slug: string): Promise<IDiagnosticResponse | null> => {
  if (!slug || slug.length > 100) {
    throw new Error('Invalid slug format.');
  }

  const result = await prisma.clinic.findUnique({
    where: {
      slug: slug.trim(),
    },

    select: {
      id: true,

      slug: true,
      address: true,
      user: {
        select: {
          name: true,
        },
      },
      memberships: {
        select: {
          doctor: {
            select: {
              department: {
                select: {
                  name: true,
                },
              },
              id: true,
              averageRating: true,
              slug: true,
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
          clinic: {
            select: {
              id: true,
            },
          },
          schedules: true,
          fee: true,
          discount: true,
        },
      },
      area: true,
      website: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
      areaId: true,
    },
  });

  return result as any;
};

const staffRoleLabels = {
  COORDINATOR: 'কো-অর্ডিনেটর',
  RECEPTIONIST: 'রিসেপশনিস্ট',
  ASSISTANT: 'সহকারী',
} as const;

const getTodayRange = () => {
  const today = new Date();

  return {
    startOfDay: new Date(today.getFullYear(), today.getMonth(), today.getDate()),

    endOfDay: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1),
  };
};

// create staff

interface ICreateStaffPayload {
  DiagnosticId: string;
  user: {
    name: string;
    phoneNumber: string;
    password: string;
    image?: string;
  };
  staffType: 'COORDINATOR' | 'RECEPTIONIST' | 'STAFF';
  assignedDoctorId?: string;
}

// manager dashboard stats
const getDiagnosticManagerStats = async (userId: string): Promise<IDiagnosticManagerStats> => {
  const { startOfDay, endOfDay } = getTodayRange();
  const diagnostic = await prisma.clinic.findUnique({
    where: {
      userId,
    },

    select: {
      id: true,
      user: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!diagnostic) {
    throw new Error('ক্লিনিক পাওয়া যায়নি');
  }

  const diagId = diagnostic.id;
  // COMMON APPOINTMENT FILTER
  const appointmentDiagnosticWhere = {
    clinicId: diagId,
  };

  const [totalDoctors, todayAppointments, completedAppointments, totalStaffs, staffs] =
    await Promise.all([
      // TOTAL ACTIVE DOCTORS
      prisma.membership.count({
        where: {
          clinicId: diagId,
        },
      }),

      // TODAY APPOINTMENTS
      prisma.appointment.count({
        where: {
          ...appointmentDiagnosticWhere,

          createdAt: {
            gte: startOfDay,
            lt: endOfDay,
          },
        },
      }),

      // COMPLETED APPOINTMENTS
      prisma.appointment.count({
        where: {
          ...appointmentDiagnosticWhere,
          status: 'COMPLETED',
        },
      }),

      // TOTAL STAFFS
      prisma.staff.count({
        where: {
          clinicId: diagId,
        },
      }),

      // STAFF ACTIVITIES
      prisma.staff.findMany({
        where: {
          clinicId: diagId,
        },

        take: 5,

        orderBy: {
          createdAt: 'desc',
        },

        select: {
          id: true,
          staffType: true,

          user: {
            select: {
              name: true,

              _count: {
                select: {
                  createdAppointments: true,
                },
              },
            },
          },

          assignedDoctor: {
            select: {
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
    ]);

  return {
    totalDoctors,

    todayAppointments,

    completedAppointments,

    totalStaffs,

    staffActivities: staffs.map((staff) => ({
      id: staff.id,

      name: staff.user.name,

      role: staffRoleLabels[staff.staffType] || 'স্টাফ',

      assignedDoctor: staff.assignedDoctor?.user?.name || null,

      totalBookings: staff.user._count.createdAppointments,
    })),
  };
};

const getSingleDiagnostic = async (userId: string): Promise<IDiagnosticResponse> => {
  const Diagnostic = await prisma.clinic.findUnique({
    where: { userId },

    include: {
      user: {
        select: {
          id: true,
          name: true,
          phoneNumber: true,
          image: true,
          deactivate: true,
        },
      },

      area: {
        select: {
          name: true,
          id: true,
          slug: true,
          district: {
            select: { name: true, slug: true, id: true },
          },
        },
      },
    },
  });

  if (!Diagnostic) {
    throw new ApiError(404, 'Diagnostic not found');
  }

  return Diagnostic as unknown as IDiagnosticResponse;
};

const getAllAreaDiagnostics = async (
  filter: IDiagnosticFilterRequest,
  options: IOptions,
  userId: string,
): Promise<IGenericResponse<IDiagnosticResponse[]>> => {
  // =====================================================
  // FILTERS
  // =====================================================

  const { searchTerm, deactivate } = filter;

  // =====================================================
  // MANAGER CHECK
  // =====================================================

  const managerProfile = await prisma.manager.findUnique({
    where: {
      userId,
    },

    select: {
      areaId: true,
    },
  });

  if (!managerProfile?.areaId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'আপনার কোনো এরিয়া অ্যাসাইন করা নেই!');
  }

  // =====================================================
  // WHERE CONDITIONS
  // =====================================================

  const andConditions: Prisma.ClinicWhereInput[] = [];

  // Area Scope
  andConditions.push({
    areaId: managerProfile.areaId,
  });

  // Search
  if (searchTerm) {
    andConditions.push({
      OR: [
        {
          user: {
            name: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
        },

        {
          user: {
            phoneNumber: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
        },
      ],
    });
  }

  // Deactivate Filter
  if (deactivate !== undefined) {
    andConditions.push({
      user: {
        deactivate: deactivate === 'true',
      },
    });
  }

  const whereCondition: Prisma.ClinicWhereInput =
    andConditions.length > 0
      ? {
          AND: andConditions,
        }
      : {};

  // =====================================================
  // OPTIONAL PAGINATION
  // =====================================================

  const shouldPaginate = !!options?.page && !!options?.limit;

  let pagination: {
    skip?: number;
    take?: number;
  } = {};

  let meta:
    | {
        page: number;
        limit: number;
        total: number;
        totalPage: number;
      }
    | undefined;

  if (shouldPaginate) {
    const { page, limit, skip, sortBy, sortOrder } = paginationCalculator(options);

    pagination = {
      skip,
      take: limit,
    };

    const total = await prisma.clinic.count({
      where: whereCondition,
    });

    meta = {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    };
  }

  // =====================================================
  // QUERY
  // =====================================================

  const Diagnostics = await prisma.clinic.findMany({
    where: whereCondition,

    ...pagination,

    orderBy:
      options?.sortBy && options?.sortOrder
        ? {
            [options.sortBy]: options.sortOrder,
          }
        : {
            createdAt: 'desc',
          },

    select: DIAGNOSTIC_SELECT,
  });

  // =====================================================
  // RETURN
  // =====================================================

  return {
    meta,
    data: Diagnostics as unknown as IDiagnosticResponse[],
  };
};

const updateDiagnostic = async (
  DiagnosticId: string, // এটি মূলত Diagnostic টেবিলের ID
  DiagnosticData: IUpdateDiagnosticRequest,
): Promise<IDiagnosticResponse> => {
  // ১. ক্লিনিক প্রোফাইল আছে কি না চেক করা (User সহ)
  const existingDiagnostic = await prisma.clinic.findUnique({
    where: { id: DiagnosticId },
    include: { user: true },
  });

  if (!existingDiagnostic) {
    throw new ApiError(httpStatus.NOT_FOUND, 'ক্লিনিক খুঁজে পাওয়া যায়নি!');
  }

  // ২. ইউজার আপডেট ডাটা তৈরি
  const userData: any = {};
  if (DiagnosticData.user) {
    if (DiagnosticData.user.name) userData.name = DiagnosticData.user.name;
    if (DiagnosticData.user.phoneNumber) userData.phoneNumber = DiagnosticData.user.phoneNumber;
    if (DiagnosticData.user.image) userData.image = DiagnosticData.user.image;
    if (DiagnosticData.user.deactivate !== undefined)
      userData.deactivate = DiagnosticData.user.deactivate;

    if (DiagnosticData.user.password) {
      userData.password = await bcrypt.hash(DiagnosticData.user.password, 10);
    }
  }

  // ৩. আপডেট অপারেশন
  const updatedDiagnostic = await prisma.clinic.update({
    where: { id: DiagnosticId },
    data: {
      slug: DiagnosticData.slug,
      address: DiagnosticData.address,
      website: DiagnosticData?.website,
      areaId: userData?.areaId,
      user: {
        update: userData,
      },
    },
    select: DIAGNOSTIC_SELECT,
  });

  return updatedDiagnostic as unknown as IDiagnosticResponse;
};

const deleteDiagnostic = async (id: string, user: { id: string; role: string }): Promise<any> => {
  // ১. ক্লিনিক খুঁজে বের করা (area সহ)
  const DiagnosticData = await prisma.clinic.findUnique({
    where: { id },
    select: {
      userId: true,
      areaId: true,
    },
  });

  if (!DiagnosticData) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Diagnostic not found');
  }

  // ২. যদি ADMIN হয় → সরাসরি delete
  if (user.role === 'ADMIN') {
    return await prisma.user.delete({
      where: { id: DiagnosticData.userId },
    });
  }

  // ৩. যদি MANAGER হয় → area match check
  if (user.role === 'MANAGER') {
    const manager = await prisma.manager.findUnique({
      where: { userId: user.id },
      select: { areaId: true },
    });

    if (!manager?.areaId) {
      throw new ApiError(httpStatus.FORBIDDEN, 'আপনার কোনো এরিয়া নেই');
    }

    // ❌ অন্য area's Diagnostic delete করতে পারবে না
    if (manager.areaId !== DiagnosticData.areaId) {
      throw new ApiError(httpStatus.FORBIDDEN, 'আপনি এই ক্লিনিক ডিলিট করতে পারবেন না');
    }

    return await prisma.user.delete({
      where: { id: DiagnosticData.userId },
    });
  }

  // ৪. অন্য role হলে block
  throw new ApiError(httpStatus.FORBIDDEN, 'আপনার এই কাজের অনুমতি নেই');
};

export const DiagnosticService = {
  createDiagnostic,
  getDiagnostics,
  getDiagnosticBySlug,
  getSingleDiagnostic,

  getDiagnosticManagerStats,
  updateDiagnostic,
  getAllAreaDiagnostics,
  deleteDiagnostic,
};
