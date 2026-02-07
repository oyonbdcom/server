import httpStatus from 'http-status';
import { IGenericResponse } from '../../../interface/common';

import { IOptions, paginationCalculator } from '../../../helper/pagination';
import prisma from '../../../prisma/client';
import ApiError from '../../../utils/apiError';
import { CreateMembershipInput, IMembershipResponse } from './interface';

// current logged in   user
export const createMembership = async (
  userId: string,
  payload: CreateMembershipInput,
): Promise<IMembershipResponse> => {
  const { doctorId, fee, maxAppointments, discount } = payload;

  // ১. ক্লিনিক প্রোফাইল চেক
  const exitingClinic = await prisma.clinic.findFirst({
    where: { userId },
  });

  if (!exitingClinic) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'অনুগ্রহ করে আগে আপনার ক্লিনিক প্রোফাইল সেটআপ সম্পন্ন করুন!',
    );
  }

  // ২. ডুপ্লিকেট মেম্বারশিপ চেক
  const existingMembership = await prisma.membership.findFirst({
    where: {
      doctorId,
      clinicId: exitingClinic.id, // Optional chaining সরিয়ে দেওয়া হয়েছে কারণ উপরে চেক করা হয়েছে
    },
    select: { id: true },
  });

  if (existingMembership) {
    throw new ApiError(
      httpStatus.CONFLICT,
      'এই চিকিৎসক ইতিমধ্যে আপনার ক্লিনিকে মেম্বার হিসেবে যুক্ত আছেন।',
    );
  }

  // ৩. মেম্বারশিপ তৈরি
  try {
    const membership = await prisma.membership.create({
      data: {
        doctorId,
        clinicId: exitingClinic.id,
        fee,
        maxAppointments,
        discount,
      },
    });

    return membership;
  } catch (error) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'সদস্যপদ যুক্ত করার সময় একটি ত্রুটি ঘটেছে, পুনরায় চেষ্টা করুন।',
    );
  }
};

// ১. মেম্বারশিপ লিস্ট দেখা
export const getClinicMemberships = async (
  userId: string,
  options: IOptions,
): Promise<IGenericResponse<IMembershipResponse[]> | null> => {
  const { page, limit, skip, sortBy, sortOrder } = paginationCalculator(options);

  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { clinic: { select: { id: true } } },
  });

  if (!existingUser) {
    throw new ApiError(httpStatus.NOT_FOUND, 'ব্যবহারকারী খুঁজে পাওয়া যায়নি');
  }

  if (!existingUser.clinic) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'এই ব্যবহারকারীর কোনো ক্লিনিক প্রোফাইল নেই');
  }

  const clinicId = existingUser.clinic.id;

  const memberships = await prisma.membership.findMany({
    where: { clinicId },
    include: {
      doctor: {
        select: {
          id: true,
          userId: true,
          specialization: true,
          department: true,
          position: true,
          hospital: true,
          user: { select: { name: true, phoneNumber: true, image: true, id: true, role: true } },
        },
      },
      schedules: true,
    },
    skip,
    take: limit,
    orderBy: sortBy && sortOrder ? { [sortBy]: sortOrder } : { createdAt: 'desc' },
  });

  const total = await prisma.membership.count({ where: { clinicId } });

  return {
    meta: { page: Number(page), limit: Number(limit), total },
    data: memberships,
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
  userId: string,
  membershipId: string,
  payload: Partial<CreateMembershipInput>,
): Promise<IMembershipResponse> => {
  const existingClinic = await prisma.clinic.findFirst({
    where: { userId },
    select: { id: true },
  });

  if (!existingClinic) {
    throw new ApiError(httpStatus.FORBIDDEN, 'আপনার ক্লিনিক প্রোফাইলটি পাওয়া যায়নি');
  }

  const membershipToUpdate = await prisma.membership.findUnique({
    where: { id: membershipId, clinicId: existingClinic.id },
  });

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
  // নিশ্চিত করা যে এই মেম্বারশিপটি এই ইউজারের ক্লিনিকেরই
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { clinic: { select: { id: true } } },
  });

  if (!user?.clinic) {
    throw new ApiError(httpStatus.NOT_FOUND, 'ক্লিনিক প্রোফাইল পাওয়া যায়নি');
  }

  const membership = await prisma.membership.findUnique({
    where: { id: membershipId, clinicId: user.clinic.id },
  });

  if (!membership) {
    throw new ApiError(httpStatus.NOT_FOUND, 'সদস্যপদটি পাওয়া যায়নি');
  }

  await prisma.membership.delete({
    where: { id: membershipId },
  });

  return { message: 'সফলভাবে সদস্যপদ থেকে অপসারিত করা হয়েছে' };
};

export const MembershipService = {
  createMembership,
  getClinicMemberships,
  updateMembership,
  getMyDoctors,
  deleteMembership,
};
