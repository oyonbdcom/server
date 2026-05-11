import { Prisma, UserRole } from '@prisma/client';
import httpStatus from 'http-status';

import bcrypt from 'bcrypt';
import { IOptions, paginationCalculator } from '../../../helper/pagination';
import { IGenericResponse } from '../../../interface/common';
import prisma from '../../../prisma/client';
import ApiError from '../../../utils/apiError';
import { CLINIC_SELECT, IClinicFilterRequest } from './constant';
import {
  IClinicResponse,
  ICreateClinicRequest,
  IDiagnosticManagerStats,
  IUpdateClinicRequest,
} from './interface';

const createClinic = async (
  clinicData: ICreateClinicRequest,
  userId: string,
): Promise<IClinicResponse | null> => {
  const defaultPassword = 'Password@123';

  // ১. নাম এবং ফোন নম্বর চেক করা
  if (!clinicData.user?.name || !clinicData.user?.phoneNumber) {
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
  const hashedPassword = await bcrypt.hash(clinicData.user?.password || defaultPassword, 10);

  // ৪. ডাটাবেজে ক্লিনিক তৈরি (Transaction ব্যবহার করা নিরাপদ)
  const clinic = await prisma.clinic.create({
    data: {
      slug: clinicData.slug,
      address: clinicData.address,

      area: {
        connect: {
          id: managerProfile.areaId,
        },
      },

      user: {
        create: {
          name: clinicData.user.name,
          phoneNumber: clinicData.user.phoneNumber,
          password: hashedPassword,
          role: UserRole.DIAGNOSTIC_MANAGER,
          image: clinicData.user.image,
          isDefaultPassword: !clinicData.user.password,
        },
      },
    },
    select: CLINIC_SELECT,
  });

  if (!clinic) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'ক্লিনিক প্রোফাইল তৈরি করতে সমস্যা হয়েছে',
    );
  }

  return clinic as unknown as IClinicResponse;
};

const getClinics = async (
  filter: IClinicFilterRequest,
  options: IOptions,
): Promise<IGenericResponse<IClinicResponse[]>> => {
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

  // ২. ডিস্ট্রিক্ট ফিল্টার (Relation: clinic -> area -> district)
  if (district) {
    andConditions.push({
      area: {
        district: {
          slug: district, // অথবা name: district
        },
      },
    });
  }

  // ৩. এরিয়া ফিল্টার (Relation: clinic -> area)
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
      select: CLINIC_SELECT,
    }),
    prisma.clinic.count({ where: whereCondition }),
  ]);
  const totalPage = Math.ceil(total / limit);
  return {
    meta: { page, limit, total, totalPage },
    data: data as unknown as IClinicResponse[],
  };
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
  clinicId: string;
  user: {
    name: string;
    phoneNumber: string;
    password: string;
    image?: string;
  };
  staffType: 'COORDINATOR' | 'RECEPTIONIST' | 'STAFF';
  assignedDoctorId?: string;
}

const createStaff = async (userId: string, payload: ICreateStaffPayload) => {
  console.log(payload);
  const { user, staffType, assignedDoctorId } = payload;

  const clinic = await prisma.clinic.findUnique({
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

  if (!clinic) {
    throw new Error('ক্লিনিক পাওয়া যায়নি');
  }

  const clinicId = clinic.id;

  // 2. CHECK PHONE ALREADY EXISTS
  const existingUser = await prisma.user.findUnique({
    where: { phoneNumber: user.phoneNumber },
  });

  if (existingUser) {
    throw new Error('এই ফোন নম্বর ইতিমধ্যে ব্যবহৃত হয়েছে');
  }

  // 3. HASH PASSWORD
  const hashedPassword = await bcrypt.hash(user.password, 10);

  // 4. CREATE USER + STAFF (TRANSACTION)
  const result = await prisma.$transaction(async (tx) => {
    // create user
    const createdUser = await tx.user.create({
      data: {
        name: user.name,
        phoneNumber: user.phoneNumber,
        password: hashedPassword,
        image: user.image,
        role: 'STAFF',
      },
    });

    // create staff
    const staff = await tx.staff.create({
      data: {
        userId: createdUser.id,
        clinicId,
        staffType: 'RECEPTIONIST',
        assignedDoctorId: assignedDoctorId || null,
      },

      include: {
        user: true,
        assignedDoctor: {
          include: {
            user: true,
          },
        },
      },
    });

    return staff;
  });

  return result;
};

// manager dashboard stats
const getDiagnosticManagerStats = async (userId: string): Promise<IDiagnosticManagerStats> => {
  const { startOfDay, endOfDay } = getTodayRange();
  const clinic = await prisma.clinic.findUnique({
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

  if (!clinic) {
    throw new Error('ক্লিনিক পাওয়া যায়নি');
  }

  const clinicId = clinic.id;
  // COMMON APPOINTMENT FILTER
  const appointmentClinicWhere = {
    clinicId,
  };

  const [totalDoctors, todayAppointments, completedAppointments, totalStaffs, staffs] =
    await Promise.all([
      // TOTAL ACTIVE DOCTORS
      prisma.membership.count({
        where: {
          clinicId,
        },
      }),

      // TODAY APPOINTMENTS
      prisma.appointment.count({
        where: {
          ...appointmentClinicWhere,

          createdAt: {
            gte: startOfDay,
            lt: endOfDay,
          },
        },
      }),

      // COMPLETED APPOINTMENTS
      prisma.appointment.count({
        where: {
          ...appointmentClinicWhere,
          status: 'COMPLETED',
        },
      }),

      // TOTAL STAFFS
      prisma.staff.count({
        where: {
          clinicId,
        },
      }),

      // STAFF ACTIVITIES
      prisma.staff.findMany({
        where: {
          clinicId,
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

const getSingleClinic = async (userId: string): Promise<IClinicResponse> => {
  const clinic = await prisma.clinic.findUnique({
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

  if (!clinic) {
    throw new ApiError(404, 'Clinic not found');
  }

  return clinic as unknown as IClinicResponse;
};

const getAllAreaClinics = async (
  filter: IClinicFilterRequest,
  options: IOptions,
  userId: string,
): Promise<IGenericResponse<IClinicResponse[]>> => {
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

  const clinics = await prisma.clinic.findMany({
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

    select: CLINIC_SELECT,
  });

  // =====================================================
  // RETURN
  // =====================================================

  return {
    meta,
    data: clinics as unknown as IClinicResponse[],
  };
};

const updateClinic = async (
  clinicId: string, // এটি মূলত Clinic টেবিলের ID
  clinicData: IUpdateClinicRequest,
): Promise<IClinicResponse> => {
  // ১. ক্লিনিক প্রোফাইল আছে কি না চেক করা (User সহ)
  const existingClinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    include: { user: true },
  });

  if (!existingClinic) {
    throw new ApiError(httpStatus.NOT_FOUND, 'ক্লিনিক খুঁজে পাওয়া যায়নি!');
  }

  // ২. ইউজার আপডেট ডাটা তৈরি
  const userData: any = {};
  if (clinicData.user) {
    if (clinicData.user.name) userData.name = clinicData.user.name;
    if (clinicData.user.phoneNumber) userData.phoneNumber = clinicData.user.phoneNumber;
    if (clinicData.user.image) userData.image = clinicData.user.image;
    if (clinicData.user.deactivate !== undefined) userData.deactivate = clinicData.user.deactivate;

    if (clinicData.user.password) {
      userData.password = await bcrypt.hash(clinicData.user.password, 10);
    }
  }

  // ৩. আপডেট অপারেশন
  const updatedClinic = await prisma.clinic.update({
    where: { id: clinicId },
    data: {
      slug: clinicData.slug,
      address: clinicData.address,
      website: clinicData?.website,
      areaId: userData?.areaId,
      user: {
        update: userData,
      },
    },
    select: CLINIC_SELECT,
  });

  return updatedClinic as unknown as IClinicResponse;
};

const deleteClinic = async (id: string, user: { id: string; role: string }): Promise<any> => {
  // ১. ক্লিনিক খুঁজে বের করা (area সহ)
  const clinicData = await prisma.clinic.findUnique({
    where: { id },
    select: {
      userId: true,
      areaId: true,
    },
  });

  if (!clinicData) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Clinic not found');
  }

  // ২. যদি ADMIN হয় → সরাসরি delete
  if (user.role === 'ADMIN') {
    return await prisma.user.delete({
      where: { id: clinicData.userId },
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

    // ❌ অন্য area's clinic delete করতে পারবে না
    if (manager.areaId !== clinicData.areaId) {
      throw new ApiError(httpStatus.FORBIDDEN, 'আপনি এই ক্লিনিক ডিলিট করতে পারবেন না');
    }

    return await prisma.user.delete({
      where: { id: clinicData.userId },
    });
  }

  // ৪. অন্য role হলে block
  throw new ApiError(httpStatus.FORBIDDEN, 'আপনার এই কাজের অনুমতি নেই');
};

export const ClinicService = {
  createClinic,
  getClinics,
  createStaff,
  getSingleClinic,

  getDiagnosticManagerStats,
  updateClinic,
  getAllAreaClinics,
  deleteClinic,
};
