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
  IClinicStats,
  ICreateClinicRequest,
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
      name: clinicData.user.name,
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
          role: UserRole.CLINIC,
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
        { name: { contains: searchTerm, mode: 'insensitive' } },
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
const getClinicStats = async (): Promise<IClinicStats> => {
  const [activeCount, inactiveCount] = await Promise.all([
    // Count based on the 'active' boolean in Doctor model
    prisma.clinic.count({
      where: { user: { deactivate: false } },
    }),
    prisma.clinic.count({
      where: { user: { deactivate: true } },
    }),

    // Count based on 'active' boolean being false
  ]);

  return {
    total: activeCount + inactiveCount,
    active: activeCount,
    inactive: inactiveCount,
  };
};

const getClinicsForManager = async (
  filter: IClinicFilterRequest,
  options: IOptions,
  userId: string,
): Promise<IGenericResponse<IClinicResponse[]>> => {
  const { page, limit, skip, sortBy, sortOrder } = paginationCalculator(options);
  const { searchTerm, deactivate, minRating } = filter;

  const andConditions: Prisma.ClinicWhereInput[] = [];

  const managerProfile = await prisma.manager.findUnique({
    where: { userId: userId },
    select: { areaId: true },
  });

  if (!managerProfile || !managerProfile.areaId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'আপনার কোনো এরিয়া অ্যাসাইন করা নেই!');
  }

  andConditions.push({
    areaId: managerProfile.areaId,
  });

  // ৩. সার্চ টার্ম (নাম বা ফোন নম্বর দিয়ে খোঁজা)
  if (searchTerm) {
    andConditions.push({
      OR: [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { user: { name: { contains: searchTerm, mode: 'insensitive' } } },
        { user: { phoneNumber: { contains: searchTerm, mode: 'insensitive' } } },
      ],
    });
  }

  // ৪. স্ট্যাটাস ফিল্টার
  if (deactivate !== undefined) {
    const isDeactivated = deactivate === 'true';
    andConditions.push({
      user: {
        deactivate: isDeactivated,
      },
    });
  }

  const whereCondition: Prisma.ClinicWhereInput = { AND: andConditions };

  // ডাটাবেজ কোয়েরি
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
const getAllClinicsForManager = async (userId: string): Promise<IClinicResponse[]> => {
  const manager = await prisma.manager.findUnique({
    where: { userId },
    select: {
      areaId: true,
    },
  });

  if (!manager?.areaId) {
    throw new ApiError(403, 'আপনার কোনো এরিয়া অ্যাসাইন করা নেই!');
  }

  const clinics = await prisma.clinic.findMany({
    where: {
      areaId: manager.areaId,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      user: {
        select: {
          image: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // flatten response (optional but clean for frontend)
  return clinics.map((c) => ({
    id: c.id,
    name: c.name,
    image: c.user?.image || null,
  })) as any;
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
      name: clinicData.user?.name,
      slug: clinicData.slug,
      address: clinicData.address,

      // নেস্টেড ইউজার আপডেট
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
  getAllClinicsForManager,
  getClinicStats,
  updateClinic,
  getClinicsForManager,
  deleteClinic,
};
