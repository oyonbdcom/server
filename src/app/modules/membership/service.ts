import httpStatus from 'http-status';
import { IGenericResponse } from '../../../interface/common';

import { Prisma } from '@prisma/client';
import { IOptions, paginationCalculator } from '../../../helper/pagination';
import prisma from '../../../prisma/client';
import ApiError from '../../../utils/apiError';
import { CreateMembershipInput, IMembershipResponse } from './interface';

// current logged in   user
export const createMembership = async (
  userId: string,
  payload: CreateMembershipInput,
): Promise<IMembershipResponse> => {
  const { doctorId, fee, clinicId, discount } = payload;

  // ১. মেম্বারশিপ চেক: এই ডাক্তার কি ইতিমধ্যে এই ক্লিনিকে যুক্ত?
  // (One Doctor, One Clinic Validation)
  const isExistingMembership = await prisma.membership.findUnique({
    where: {
      doctorId_clinicId: {
        doctorId,
        clinicId,
      },
    },
  });

  if (isExistingMembership) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'এই চিকিৎসক ইতিমধ্যে এই ক্লিনিকে মেম্বার হিসেবে যুক্ত আছেন!',
    );
  }

  // ২. মেম্বারশিপ তৈরি
  try {
    const membership = await prisma.membership.create({
      data: {
        doctorId,
        clinicId,
        createdById: userId,
        fee: Number(fee),
        discount: Number(discount),
      },
      include: {
        doctor: {
          include: {
            user: { select: { name: true } },
          },
        },
        clinic: { select: { name: true } },
      },
    });

    return membership;
  } catch (error) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'মেম্বারশিপ তৈরি করার সময় একটি টেকনিক্যাল সমস্যা হয়েছে।',
    );
  }
};

// ১. মেম্বারশিপ লিস্ট দেখা
export const getMyMemberships = async (
  userId: string,
  filters: {
    searchTerm?: string;
    clinicId?: string;
    doctorId?: string;
  },
  options: IOptions,
): Promise<IGenericResponse<IMembershipResponse[]>> => {
  const { page, limit, skip, sortBy, sortOrder } = paginationCalculator(options);

  const { searchTerm, clinicId, doctorId } = filters;

  // ✅ base condition
  const andConditions: Prisma.MembershipWhereInput[] = [{ createdById: userId }];

  // 🔍 Search
  if (searchTerm) {
    andConditions.push({
      OR: [
        { clinic: { name: { contains: searchTerm, mode: 'insensitive' } } },
        {
          doctor: {
            user: {
              name: { contains: searchTerm, mode: 'insensitive' },
            },
          },
        },
        {
          doctor: {
            department: {
              name: { contains: searchTerm, mode: 'insensitive' },
            },
          },
        },
        {
          doctor: {
            specialization: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
        },
      ],
    });
  }

  // ✅ Clinic Filter
  if (clinicId) {
    andConditions.push({
      clinicId: clinicId,
    });
  }

  // ✅ Doctor Filter
  if (doctorId) {
    andConditions.push({
      doctorId: doctorId,
    });
  }

  const whereConditions: Prisma.MembershipWhereInput = {
    AND: andConditions,
  };

  // 🔥 Query
  const [memberships, total] = await Promise.all([
    prisma.membership.findMany({
      where: whereConditions,
      include: {
        doctor: {
          select: {
            id: true,
            specialization: true,
            position: true,
            hospital: true,
            department: { select: { name: true } },
            user: {
              select: { name: true, phoneNumber: true, image: true },
            },
          },
        },
        clinic: {
          select: { name: true, address: true },
        },
        schedules: true,
      },
      skip,
      take: limit,
      orderBy: sortBy && sortOrder ? { [sortBy]: sortOrder } : { createdAt: 'desc' },
    }),

    prisma.membership.count({ where: whereConditions }),
  ]);

  const totalPage = Math.ceil(total / limit);

  return {
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPage,
    },
    data: memberships as unknown as IMembershipResponse[],
  };
};
const getMyDoctors = async ({ userId }: { userId: string }) => {
  // ১. ইউজারের ক্লিনিক প্রোফাইল খুঁজে বের করা
  const existingClinic = await prisma.clinic.findUnique({
    where: { userId },
  });

  if (!existingClinic) {
    throw new ApiError(httpStatus.NOT_FOUND, 'ক্লিনিক প্রোফাইল পাওয়া যায়নি!');
  }

  // ২. যেহেতু ডুপ্লিকেট নেই, সরাসরি মেম্বারশিপ থেকে ডাটা আনা
  const memberships = await prisma.membership.findMany({
    where: {
      active: true,
      clinicId: existingClinic.id,
    },
    select: {
      doctor: {
        select: {
          id: true,
          department: true,
          user: {
            select: {
              name: true,
              id: true,
              image: true,
            },
          },
        },
      },
    },
  });

  // ৩. রেজাল্ট ম্যাপিং
  return memberships.map((item) => ({
    id: item.doctor.id,
    name: item.doctor.user?.name || 'অজানা চিকিৎসক',
    department: item.doctor.department || 'জেনারেল',
    image: item.doctor.user?.image || null,
    userId: item.doctor.user.id,
  }));
};

// ২. মেম্বারশিপ আপডেট করা
const updateMembership = async (
  membershipId: string,
  payload: Partial<CreateMembershipInput>,
): Promise<IMembershipResponse> => {
  const membershipToUpdate = await prisma.membership.findUnique({
    where: { id: membershipId },
  });
  console.log(payload);
  if (!membershipToUpdate) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      'সদস্যপদটি খুঁজে পাওয়া যায়নি অথবা আপনার এটি পরিবর্তন করার অনুমতি নেই',
    );
  }

  return await prisma.membership.update({
    where: { id: membershipId },
    data: payload,
    include: { doctor: { include: { user: true } } },
  });
};

// ৩. মেম্বারশিপ ডিলিট করা
const deleteMembership = async (membershipId: string, userId: string) => {
  await prisma.membership.delete({
    where: { id: membershipId },
  });

  return { message: 'সফলভাবে সদস্যপদ থেকে অপসারিত করা হয়েছে' };
};

export const MembershipService = {
  createMembership,
  getMyMemberships,
  updateMembership,
  getMyDoctors,
  deleteMembership,
};
