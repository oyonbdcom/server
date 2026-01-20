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
  const exitingClinic = await prisma.clinic.findFirst({
    where: { userId },
  });
  if (!exitingClinic) {
    throw new ApiError(httpStatus.FORBIDDEN, 'First setup your profile !');
  }
  const existingMembership = await prisma.membership.findFirst({
    where: {
      doctorId,
      clinicId: exitingClinic?.id,
    },
    select: { id: true },
  });

  if (existingMembership) {
    throw new ApiError(
      httpStatus.CONFLICT,
      'Membership between this doctor and clinic already exists',
    );
  }

  // ---- CREATE MEMBERSHIP ----
  const membership = await prisma.membership.create({
    data: {
      doctorId,
      clinicId: exitingClinic?.id,
      fee,
      maxAppointments,
      discount,
    },
  });

  return membership;
};

export const getClinicMemberships = async (
  userId: string,
  options: IOptions,
): Promise<IGenericResponse<IMembershipResponse[]> | null> => {
  const { page, limit, skip, sortBy, sortOrder } = paginationCalculator(options);

  // 1. Check user exists
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { clinic: { select: { id: true } } },
  });

  if (!existingUser) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  // 2. Check user has a clinic
  if (!existingUser.clinic || !existingUser.clinic.id) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User does not belong to any clinic');
  }

  const clinicId = existingUser.clinic.id;

  // 4. Fetch memberships
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
          averageRating: true,
          reviewsCount: true,
          country: true,
          gender: true,
          user: {
            select: {
              name: true,
              email: true,
              image: true,
              id: true,
            },
          },
        },
      },
      schedules: true,
    },
  });

  // 5. Count total
  const total = await prisma.membership.count({
    where: { clinicId },
  });

  return {
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
    },
    data: memberships,
  };
};

const updateMembership = async (
  userId: string,
  membershipId: string,
  payload: Partial<CreateMembershipInput>,
): Promise<IMembershipResponse> => {
  // 1. Find the clinic associated with the logged-in user
  const existingClinic = await prisma.clinic.findFirst({
    where: { userId },
    select: { id: true },
  });

  if (!existingClinic) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Clinic profile not found!');
  }

  // 2. Ensure the membership exists and belongs to THIS clinic
  const membershipToUpdate = await prisma.membership.findUnique({
    where: {
      id: membershipId,
      clinicId: existingClinic.id,
    },
  });

  if (!membershipToUpdate) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      'Membership not found or you do not have permission to edit it',
    );
  }

  // 3. Perform the update
  const updatedMembership = await prisma.membership.update({
    where: { id: membershipId },
    data: payload,
    include: {
      doctor: {
        include: {
          user: true,
        },
      },
    },
  });

  return updatedMembership;
};

const deleteMembership = async (membershipId: string, id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { clinic: { select: { id: true } } },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Delete user
  await prisma.membership.delete({
    where: { id: membershipId },
  });

  return { message: 'User deleted successfully' };
};

export const MembershipService = {
  createMembership,
  getClinicMemberships,
  updateMembership,
  deleteMembership,
};
