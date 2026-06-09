import { Prisma, UserRole } from '@prisma/client';
import httpStatus from 'http-status';

import bcrypt from 'bcrypt';
import dayjs from 'dayjs';
import { IOptions, paginationCalculator } from '../../../helper/pagination';
import { IGenericResponse } from '../../../interface/common';
import prisma from '../../../prisma/client';
import ApiError from '../../../utils/apiError';
import { bdEndOfDay, bdStartOfDay } from '../../../utils/timezone';
import { DIAGNOSTIC_SELECT, IDiagnosticFilterRequest } from './constant';
import {
  ICreateDiagnosticRequest,
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
  const Diagnostic = await prisma.diagnostic.create({
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
          role: UserRole.DIAGNOSTIC,
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

  const andConditions: Prisma.DiagnosticWhereInput[] = [];

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

  const whereCondition: Prisma.DiagnosticWhereInput = { AND: andConditions };

  // ডাটাবেজ কোয়েরি
  const [data, total] = await Promise.all([
    prisma.diagnostic.findMany({
      where: whereCondition,
      skip,
      take: limit,
      orderBy: sortBy && sortOrder ? { [sortBy]: sortOrder } : { createdAt: 'desc' },
      select: DIAGNOSTIC_SELECT,
    }),
    prisma.diagnostic.count({ where: whereCondition }),
  ]);
  const totalPage = Math.ceil(total / limit);
  return {
    meta: { page, limit, total, totalPage },
    data: data as unknown as IDiagnosticResponse[],
  };
};

// manager dashboard stats
const getDiagnosticManagerStats = async (diagId: string, startDate?: any, endDate?: any) => {
  // ১. ডেট রেঞ্জ ক্যালকুলেশন (ফিল্টার কার্যকর করা)
  const end = bdEndOfDay(endDate);
  const start = bdStartOfDay(startDate);

  const diagnostic = await prisma.diagnostic.findUnique({
    where: { userId: diagId },
    select: { id: true, balance: true },
  });

  if (!diagnostic) {
    throw new ApiError(404, 'Diagnostic profile not found');
  }

  // ২. ফিল্টার করা অ্যানালিটিক্স রেকর্ড আনা
  const records = await prisma.diagnosticAnalytics.findMany({
    where: {
      diagId: diagnostic.id,
      date: { gte: start, lte: end },
    },
    orderBy: { date: 'asc' }, // গ্রাফের জন্য তারিখ অনুযায়ী সাজানো
    select: {
      totalBookings: true,
      completedCount: true,
      cancelledCount: true,
      platformBookings: true,
      doctorStats: true,
      staffStats: true,
      date: true,
    },
  });

  // ৩. এগ্রিগেশন লজিক
  let totalBookings = 0;
  let completedCount = 0;
  let cancelledCount = 0;
  let platformBookings = 0;

  const docStatsMap: Record<string, number> = {};
  const staffStatsMap: Record<string, number> = {};

  // চার্ট ডাটা ম্যাপ করা
  const chartData = records.map((row) => ({
    date: dayjs(row.date).format('D/M'),
    bookings: row.totalBookings,
  }));

  records.forEach((row) => {
    totalBookings += row.totalBookings;
    completedCount += row.completedCount;
    cancelledCount += row.cancelledCount;
    platformBookings += row.platformBookings;

    const dStats = (row.doctorStats as Record<string, number>) || {};
    Object.entries(dStats).forEach(([id, count]) => {
      docStatsMap[id] = (docStatsMap[id] || 0) + Number(count);
    });

    const sStats = (row.staffStats as Record<string, number>) || {};
    Object.entries(sStats).forEach(([id, count]) => {
      staffStatsMap[id] = (staffStatsMap[id] || 0) + Number(count);
    });
  });

  // ৪. ডক্টর এবং স্টাফ ইনফো ফেচ করা
  const docIds = Object.keys(docStatsMap);
  const staffIds = Object.keys(staffStatsMap);

  const [doctors, staffs] = await Promise.all([
    docIds.length > 0
      ? prisma.doctor.findMany({
          where: { id: { in: docIds } },
          select: {
            id: true,
            user: { select: { name: true } },
            department: { select: { name: true } },
          },
        })
      : [],
    staffIds.length > 0
      ? prisma.staff.findMany({
          where: { id: { in: staffIds } },
          select: {
            id: true,
            userId: true,
            user: { select: { name: true, role: true } },
          },
        })
      : [],
  ]);

  return {
    summary: {
      totalBookings,
      completedCount,
      cancelledCount,
      platformBookings,
      staffManualBookings: totalBookings - platformBookings,
    },
    doctorPerformance: doctors.map((doc) => ({
      doctorId: doc.id,
      name: doc.user?.name,
      specialty: doc.department?.name,
      appointmentCount: docStatsMap[doc.id] || 0,
    })),
    walletBalance: diagnostic?.balance,
    staffPerformance: staffs.map((staff) => ({
      staffId: staff.id,
      name: staff.user?.name,
      role: staff.user?.role,
      appointmentCount: staffStatsMap[staff.id] || 0,
    })),
    chartData,
  };
};

const getDiagnosticByIdentifier = async (identifier: string): Promise<IDiagnosticResponse> => {
  const diagnostic = await prisma.diagnostic.findFirst({
    where: {
      OR: [{ slug: identifier }, { userId: identifier }],
    },
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

  if (!diagnostic) {
    throw new ApiError(404, 'Diagnostic dddd not found');
  }

  return diagnostic as unknown as IDiagnosticResponse;
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

  const andConditions: Prisma.DiagnosticWhereInput[] = [];

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

  const whereCondition: Prisma.DiagnosticWhereInput =
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

    const total = await prisma.diagnostic.count({
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

  const diagnostics = await prisma.diagnostic.findMany({
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
    data: diagnostics as unknown as IDiagnosticResponse[],
  };
};

const updateDiagnostic = async (
  diagnosticId: string, // এটি মূলত Diagnostic টেবিলের ID
  diagnosticData: IUpdateDiagnosticRequest,
): Promise<IDiagnosticResponse> => {
  const existingDiagnostic = await prisma.diagnostic.findUnique({
    where: { id: diagnosticId },
    include: { user: true },
  });

  if (!existingDiagnostic) {
    throw new ApiError(httpStatus.NOT_FOUND, 'ক্লিনিক খুঁজে পাওয়া যায়নি!');
  }

  // ২. ইউজার আপডেট ডাটা তৈরি
  const userData: any = {};
  if (diagnosticData.user) {
    if (diagnosticData.user.name) userData.name = diagnosticData.user.name;
    if (diagnosticData.user.phoneNumber) userData.phoneNumber = diagnosticData.user.phoneNumber;
    if (diagnosticData.user.image) userData.image = diagnosticData.user.image;
    if (diagnosticData.user.deactivate !== undefined)
      userData.deactivate = diagnosticData.user.deactivate;

    if (diagnosticData.user.password) {
      userData.password = await bcrypt.hash(diagnosticData.user.password, 10);
    }
  }

  // ৩. আপডেট অপারেশন
  const updatedDiagnostic = await prisma.diagnostic.update({
    where: { id: diagnosticId },
    data: {
      slug: diagnosticData.slug,
      address: diagnosticData.address,
      website: diagnosticData?.website,
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
  const DiagnosticData = await prisma.diagnostic.findUnique({
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

  getDiagnosticByIdentifier,

  getDiagnosticManagerStats,
  updateDiagnostic,
  getAllAreaDiagnostics,
  deleteDiagnostic,
};
