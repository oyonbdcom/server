/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import prisma from '../../../prisma/client';
import ApiError from '../../../utils/apiError';

// --- District Services ---
const createDistrict = async (data: { name: string; slug: string }) => {
  const isExist = await prisma.district.findUnique({
    where: { slug: data.slug },
  });

  if (isExist) {
    throw new ApiError(httpStatus.CONFLICT, 'এই স্লাগ দিয়ে ইতিমধ্যে একটি জেলা তৈরি করা আছে।');
  }

  const result = await prisma.district.create({
    data,
  });
  return result;
};

const getAllDistricts = async () => {
  const result = await prisma.district.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { areas: true },
      },
    },
  });
  return result;
};

const updateDistrict = async (id: string, payload: Partial<{ name: string; slug: string }>) => {
  const isExist = await prisma.district.findUnique({ where: { id } });
  if (!isExist) throw new ApiError(httpStatus.NOT_FOUND, 'জেলাটি খুঁজে পাওয়া যায়নি।');

  const result = await prisma.district.update({
    where: { id },
    data: payload,
  });
  return result;
};

const deleteDistrict = async (id: string) => {
  const hasAreas = await prisma.area.findFirst({ where: { districtId: id } });
  if (hasAreas) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'এই জেলার অধীনে এরিয়া রয়েছে, তাই এটি ডিলিট করা সম্ভব নয়।',
    );
  }

  const result = await prisma.district.delete({ where: { id } });
  return result;
};

// --- Area Services ---
const createArea = async (data: { name: string; slug: string; districtId: string }) => {
  const districtExist = await prisma.district.findUnique({ where: { id: data.districtId } });
  if (!districtExist)
    throw new ApiError(httpStatus.NOT_FOUND, 'নির্বাচিত জেলাটি খুঁজে পাওয়া যায়নি।');

  const isExist = await prisma.area.findUnique({ where: { slug: data.slug } });
  if (isExist)
    throw new ApiError(httpStatus.CONFLICT, 'এই স্লাগ দিয়ে ইতিমধ্যে একটি এরিয়া তৈরি করা আছে।');

  const result = await prisma.area.create({ data });
  return result;
};

const getAllAreas = async () => {
  const result = await prisma.area.findMany({
    include: { district: { select: { name: true } } },
    orderBy: { name: 'asc' },
  });
  return result;
};

const updateArea = async (
  id: string,
  payload: Partial<{ name: string; slug: string; districtId: string }>,
) => {
  const isExist = await prisma.area.findUnique({ where: { id } });
  if (!isExist) throw new ApiError(httpStatus.NOT_FOUND, 'এরিয়াটি খুঁজে পাওয়া যায়নি।');

  const result = await prisma.area.update({
    where: { id },
    data: payload,
  });
  return result;
};

const deleteArea = async (id: string) => {
  // এখানে আপনি চাইলে চেক করতে পারেন এই এরিয়ার অধীনে কোনো হাসপাতাল বা ইউজার আছে কি না
  const result = await prisma.area.delete({ where: { id } });
  return result;
};

// --- Department Services ---
const createDepartment = async (data: { name: string; slug: string; image?: string }) => {
  const isExist = await prisma.department.findUnique({ where: { slug: data.slug } });
  if (isExist)
    throw new ApiError(
      httpStatus.CONFLICT,
      'এই স্লাগ দিয়ে ইতিমধ্যে একটি ডিপার্টমেন্ট তৈরি করা আছে।',
    );

  const result = await prisma.department.create({ data });
  return result;
};

const getAllDepartments = async () => {
  const result = await prisma.department.findMany({
    include: {
      _count: {
        select: { doctors: true },
      },
    },
    orderBy: {
      doctors: {
        _count: 'asc',
      },
    },
  });

  return result.map((dept) => ({
    ...dept,
    doctorsCount: dept._count.doctors,
  }));
};

const updateDepartment = async (
  id: string,
  payload: Partial<{ name: string; slug: string; image?: string }>,
) => {
  const isExist = await prisma.department.findUnique({ where: { id } });
  if (!isExist) throw new ApiError(httpStatus.NOT_FOUND, 'ডিপার্টমেন্টটি খুঁজে পাওয়া যায়নি।');

  const result = await prisma.department.update({
    where: { id },
    data: payload,
  });
  return result;
};

const deleteDepartment = async (id: string) => {
  // চেক করা হচ্ছে কোনো ডক্টর এই ডিপার্টমেন্টের সাথে যুক্ত আছে কি না
  const hasDoctors = await prisma.doctor.findFirst({
    where: { departmentId: id },
  });

  if (hasDoctors) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'এই ডিপার্টমেন্টের অধীনে ডাক্তার রয়েছে, তাই এটি ডিলিট করা সম্ভব নয়।',
    );
  }

  const result = await prisma.department.delete({ where: { id } });
  return result;
};

export const SetupService = {
  createDistrict,
  getAllDistricts,
  updateDistrict,
  deleteDistrict,
  createArea,
  getAllAreas,
  updateArea,
  deleteArea,
  createDepartment,
  getAllDepartments,
  updateDepartment,
  deleteDepartment,
};
