import { Prisma, UserRole } from '@prisma/client';
import httpStatus from 'http-status';

import bcrypt from 'bcrypt';
import { IOptions, paginationCalculator } from '../../../helper/pagination';
import { IGenericResponse } from '../../../interface/common';
import prisma from '../../../prisma/client';
import ApiError from '../../../utils/apiError';
import { createSlug } from '../../../utils/createSlug';
import { CLINIC_SELECT, IClinicFilterRequest } from './constant';
import {
  IClinicResponse,
  IClinicStats,
  ICreateClinicRequest,
  IUpdateClinicRequest,
} from './interface';

const createClinic = async (clinicData: ICreateClinicRequest): Promise<IClinicResponse | null> => {
  const defaultPassword = 'Password@123';

  // ১. স্ল্যাগ তৈরি করা (নাম থেকে)
  if (!clinicData.user?.name) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'ক্লিনিকের নাম প্রদান করা বাধ্যতামূলক!');
  }
  const slug = createSlug(clinicData.user.name);

  // ২. পাসওয়ার্ড হ্যাশিং
  const hashedPassword = await bcrypt.hash(clinicData.user?.password || defaultPassword, 10);

  // ৩. ডাটাবেজে ক্লিনিক তৈরি
  const clinic = await prisma.clinic.create({
    data: {
      user: {
        create: {
          name: clinicData.user.name,
          email: clinicData.user.email,
          password: hashedPassword,
          role: UserRole.CLINIC,
          image: clinicData.user.image,
        },
      },
      // স্ল্যাগ এখানে যুক্ত করা হলো
      slug: slug,

      phoneNumber: clinicData.phoneNumber,
      active: clinicData?.active ?? false,
      description: clinicData?.description,
      openingHour: clinicData?.openingHour,
      address: clinicData?.address,
      establishedYear: clinicData?.establishedYear,
      district: clinicData.district,
      city: clinicData.city,
      country: clinicData.country ?? 'Bangladesh',
    },
    select: CLINIC_SELECT,
  });

  if (!clinic) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'ক্লিনিক প্রোফাইল তৈরি করতে সমস্যা হয়েছে');
  }

  return clinic;
};

const getClinics = async (
  filter: IClinicFilterRequest,
  options: IOptions,
): Promise<IGenericResponse<IClinicResponse[]>> => {
  const { page, limit, skip, sortBy, sortOrder } = paginationCalculator(options);
  const { searchTerm, active, minRating, ...filterData } = filter;

  const andConditions: Prisma.ClinicWhereInput[] = [];

  if (searchTerm) {
    andConditions.push({
      OR: [
        { user: { name: { contains: searchTerm, mode: 'insensitive' } } },
        { city: { contains: searchTerm, mode: 'insensitive' } },
        { district: { contains: searchTerm, mode: 'insensitive' } },
      ],
    });
  }

  if (active !== undefined && active !== null && active !== '') {
    const isActive = active === 'true';
    andConditions.push({
      active: isActive,
    });
  }

  if (minRating) {
    const ratingNum = parseFloat(minRating);
    if (!isNaN(ratingNum)) {
      andConditions.push({ averageRating: { gte: ratingNum } });
    }
  }

  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      AND: Object.entries(filterData).map(([key, value]) => ({
        [key]: { equals: value, mode: 'insensitive' },
      })),
    });
  }

  const whereCondition: Prisma.ClinicWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

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

  return {
    meta: { page, limit, total },
    data,
  };
};
const getClinicStats = async (): Promise<IClinicStats> => {
  const [activeCount, inactiveCount] = await Promise.all([
    // Count based on the 'active' boolean in Doctor model
    prisma.clinic.count({
      where: { active: true },
    }),

    // Count based on 'active' boolean being false
    prisma.clinic.count({
      where: { active: false },
    }),
  ]);

  return {
    total: activeCount + inactiveCount,
    active: activeCount,
    inactive: inactiveCount,
  };
};
export const getClinicById = async (identifier: string): Promise<IClinicResponse> => {
  if (!identifier) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'আইডি বা স্ল্যাগ প্রদান করা বাধ্যতামূলক');
  }

  // findFirst ব্যবহার করা হয়েছে যাতে OR কন্ডিশন কাজ করে
  const clinic = await prisma.clinic.findFirst({
    where: {
      OR: [
        { userId: identifier }, // চেক করবে এটা কি ইউজার আইডি?
        { slug: identifier }, // নাকি এটা ক্লিনিক স্ল্যাগ?
      ],
    },
    select: CLINIC_SELECT,
  });

  if (!clinic) {
    throw new ApiError(httpStatus.NOT_FOUND, 'ক্লিনিক খুঁজে পাওয়া যায়নি!');
  }

  return clinic as IClinicResponse;
};
const updateClinic = async (
  userId: string,
  clinicData: IUpdateClinicRequest,
): Promise<IClinicResponse> => {
  // ১. ইউজার আছে কি না আগে চেক করে নিন এবং বর্তমান নাম সংগ্রহ করুন
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { clinic: true },
  });

  if (!existingUser) {
    throw new ApiError(httpStatus.NOT_FOUND, 'ব্যবহারকারী খুঁজে পাওয়া যায়নি!');
  }

  // ২. স্ল্যাগ হ্যান্ডেলিং লজিক
  // যদি নতুন নাম পাঠানো হয় তবে সেটি থেকে স্ল্যাগ তৈরি হবে,
  // নতুবা আগের নাম বা আগের স্ল্যাগটিই থাকবে।
  const newName = clinicData.user?.name;
  const currentSlug = existingUser.clinic?.slug;
  const slug = newName ? createSlug(newName) : currentSlug;

  // ৩. ইউজার আপডেট ডাটা তৈরি (পাসওয়ার্ড হ্যাশিং সহ)
  const userData: any = {};
  if (clinicData.user) {
    if (clinicData.user.password) {
      userData.password = await bcrypt.hash(clinicData.user.password, 10);
    }
    if (clinicData.user.name) userData.name = clinicData.user.name;
    if (clinicData.user.deactivate !== undefined) userData.deactivate = clinicData.user.deactivate;
    if (clinicData.user.email) userData.email = clinicData.user.email;
    if (clinicData.user.image) userData.image = clinicData.user.image;
    if (clinicData.user.emailVerified !== undefined)
      userData.emailVerified = clinicData.user.emailVerified;
  }

  // ৪. Upsert অপারেশন (Slug সহ)
  const clinic = await prisma.clinic.upsert({
    where: { userId },
    create: {
      userId,
      address: clinicData.address ?? '',
      district: clinicData.district ?? '',
      city: clinicData.city ?? '',
      country: clinicData.country ?? 'Bangladesh',
      phoneNumber: clinicData.phoneNumber ?? '',
      establishedYear: clinicData.establishedYear,
      slug: slug || createSlug(existingUser.name), // নতুন স্ল্যাগ অথবা আগের নাম থেকে তৈরি স্ল্যাগ
      description: clinicData.description,
      active: clinicData?.active ?? false,
      openingHour: clinicData.openingHour,
      website: clinicData.website,
    },
    update: {
      address: clinicData.address,
      district: clinicData.district,
      city: clinicData.city,
      active: clinicData?.active,
      country: clinicData.country,
      website: clinicData.website,
      phoneNumber: clinicData.phoneNumber,
      description: clinicData.description,
      openingHour: clinicData.openingHour,
      establishedYear: clinicData.establishedYear,
      slug: slug, // এখানে আপডেট করা স্ল্যাগ বসবে
      user: {
        update: userData, // আলাদা করে নিচে আপডেট না করে এখানেই করা ভালো
      },
    },
    select: CLINIC_SELECT,
  });

  return clinic;
};

const deleteClinic = async (userId: string): Promise<IClinicResponse> => {
  // 1️⃣ Check if Clinic exists
  const existingClinic = await prisma.clinic.findUnique({
    where: { userId },
    select: { id: true, userId: true },
  });

  if (!existingClinic) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Clinic not found');
  }

  // 2️⃣ Soft delete: update user.active to false
  const clinic = await prisma.clinic.update({
    where: { userId },
    data: {
      active: false,
    },
    select: CLINIC_SELECT,
  });

  return clinic;
};

export const ClinicService = {
  createClinic,
  getClinics,
  getClinicStats,
  getClinicById,
  updateClinic,
  deleteClinic,
};
