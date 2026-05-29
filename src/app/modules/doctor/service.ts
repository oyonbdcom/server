import { Prisma, UserRole } from '@prisma/client';
import httpStatus from 'http-status';

import bcrypt from 'bcrypt';
import { IOptions, paginationCalculator } from '../../../helper/pagination';
import { IGenericResponse } from '../../../interface/common';
import prisma from '../../../prisma/client';
import ApiError from '../../../utils/apiError';

import config from '../../../config/config';
import { createSlug } from '../../../utils/createSlug';
import { AREA_DOCTOR_SELECT, DOCTOR_SELECT, EMERGENCY_DOCTOR_SELECT } from './constant';
import { IDoctorResponse } from './interface';
import { CreateDoctorInput } from './zodValidation';

const createDoctor = async (doctorData: CreateDoctorInput): Promise<IDoctorResponse | null> => {
  const defaultPassword = config?.default_password || 'Password@123';

  // ১. পাসওয়ার্ড হ্যাশ করা
  const hashedPassword = await bcrypt.hash(doctorData.user?.password || defaultPassword, 10);

  // ২. প্রিজমা ক্রিয়েট অপারেশন
  const doctor = await prisma.doctor.create({
    data: {
      user: {
        create: {
          name: doctorData.user.name,
          phoneNumber: doctorData.user.phoneNumber,
          password: hashedPassword,
          role: UserRole.DOCTOR,
          image: doctorData.user.image || null,

          deactivate: doctorData.user.deactivate ?? false,
          isPhoneVerified: doctorData.user.isPhoneVerified ?? false,
        },
      },

      slug: doctorData.slug || createSlug(doctorData.user.name),
      isEmergency: doctorData?.isEmergency,
      specialization: doctorData.specialization,
      experience: doctorData.experience,
      hospital: doctorData.hospital,
      position: doctorData.position || '',
      website: doctorData.website || '',
      gender: doctorData.gender,

      department: {
        connect: {
          id: doctorData.departmentId,
        },
      },
    },
    select: DOCTOR_SELECT,
  });

  if (!doctor) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create doctor');
  }

  return doctor as any;
};

// add to manager area
const addDoctorToArea = async (doctorId: string, userId: string): Promise<any> => {
  // ১. চেক করা যে ইউজারটি একজন বৈধ ম্যানেজার কি না
  const manager = await prisma.manager.findUnique({
    where: { userId },
  });

  if (!manager) {
    throw new ApiError(httpStatus.NOT_FOUND, 'ম্যানেজার তথ্য খুঁজে পাওয়া যায়নি!');
  }

  // ২. চেক করা যে এই ডাক্তার অলরেডি ওই এরিয়াতে যুক্ত আছেন কি না
  const isExists = await prisma.doctorArea.findFirst({
    where: {
      doctorId,
      areaId: manager.areaId,
    },
  });

  if (isExists) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'এই ডাক্তার ইতিমধ্যে আপনার এরিয়াতে যুক্ত আছেন!');
  }

  // ৩. DoctorArea টেবিলে নতুন এন্ট্রি তৈরি করা
  const result = await prisma.doctorArea.create({
    data: {
      doctorId,
      areaId: manager.areaId,
    },
  });

  return result;
};

const removeDoctorFromArea = async (doctorId: string, userId: string) => {
  // ১. ম্যানেজার ভেরিফাই করা
  const manager = await prisma.manager.findUnique({
    where: { userId },
  });

  if (!manager) {
    throw new ApiError(httpStatus.NOT_FOUND, 'ম্যানেজার তথ্য খুঁজে পাওয়া যায়নি!');
  }

  // ২. DoctorArea থেকে ওই ডাক্তার এবং ওই ম্যানেজারের এরিয়া আইডি ম্যাচ করে ডিলিট করা
  const result = await prisma.doctorArea.deleteMany({
    where: {
      doctorId: doctorId,
      areaId: manager.areaId,
    },
  });

  if (result.count === 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'এই ডাক্তার আপনার এরিয়াতে নেই বা অলরেডি রিমুভ করা হয়েছে!',
    );
  }

  return result;
};
// all doctor with manager doctor
const getDoctors = async (
  filter: {
    searchTerm?: string;
    department?: string;
    district?: string;
    area?: string;
    minRating?: string;
    deactivate?: string;
    gender?: 'MALE' | 'FEMALE';
    myAreaOnly?: string;
    area_doctor?: string;
    membership?: string;
    isEmergency?: string;
  },
  options: IOptions,
  userId?: string,
): Promise<IGenericResponse<IDoctorResponse[]>> => {
  const { page, limit, skip, sortBy, sortOrder } = paginationCalculator(options);
  const {
    searchTerm,
    deactivate,
    minRating,
    gender,
    department,
    membership,
    district,
    area,
    isEmergency,
    myAreaOnly,
    area_doctor,
  } = filter;

  const andConditions: Prisma.DoctorWhereInput[] = [];

  // ১. গ্লোবাল সার্চ (আগের মতোই থাকবে)
  if (searchTerm) {
    andConditions.push({
      OR: [
        { user: { name: { contains: searchTerm, mode: 'insensitive' } } },
        { specialization: { contains: searchTerm, mode: 'insensitive' } },
        { hospital: { contains: searchTerm, mode: 'insensitive' } },
      ],
    });
  }

  // ২. মাই এরিয়া ফিল্টার (ম্যানেজারের জন্য)
  if (myAreaOnly === 'true') {
    if (!userId) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'ম্যানেজার হিসেবে লগইন করুন');
    }

    const manager = await prisma.manager.findUnique({
      where: { userId },
    });

    if (manager) {
      andConditions.push({
        areas: {
          some: {
            areaId: manager.areaId,
          },
        },
      });
    }
  }

  // ৩. লোকেশন ফিল্টার (ফিক্সড: slug এর মাধ্যমে ম্যাচিং)
  if (district || area) {
    andConditions.push({
      areas: {
        some: {
          area: {
            district: district ? { slug: { equals: district } } : undefined,

            slug: area ? { equals: area } : undefined,
          },
        },
      },
    });
  }

  // ৪. ডিপার্টমেন্ট ফিল্টার (ফিক্সড: slug এর মাধ্যমে ম্যাচিং)
  if (department) {
    andConditions.push({
      department: {
        slug: department, // name-এর বদলে slug ব্যবহার করা হয়েছে
      },
    });
  }

  // ৫. রেটিং ফিল্টার (আগের মতোই থাকবে)
  if (minRating) {
    const ratingNum = parseFloat(minRating);
    if (!isNaN(ratingNum)) {
      andConditions.push({ averageRating: { gte: ratingNum } });
    }
  }

  // ৬. জেন্ডার ফিল্টার
  if (gender) {
    andConditions.push({ gender });
  }

  // ৭. স্ট্যাটাস ফিল্টার
  if (deactivate !== undefined) {
    const isDeactivated = deactivate === 'true';
    andConditions.push({
      user: { deactivate: isDeactivated },
    });
  }
  if (isEmergency !== undefined) {
    const emergency = isEmergency === 'true';
    andConditions.push({
      isEmergency: emergency,
    });
  }
  if (membership) {
    andConditions.push({
      memberships: {
        some: {},
      },
    });
  }

  // ফাইনাল কন্ডিশন
  const whereCondition: Prisma.DoctorWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  // ৮. ডাটাবেজ কোয়েরি
  const [data, total] = await Promise.all([
    prisma.doctor.findMany({
      where: whereCondition,
      skip,
      take: limit,
      orderBy: sortBy && sortOrder ? { [sortBy]: sortOrder } : { createdAt: 'desc' },
      select: isEmergency
        ? EMERGENCY_DOCTOR_SELECT
        : area_doctor
          ? AREA_DOCTOR_SELECT
          : DOCTOR_SELECT,
    }),
    prisma.doctor.count({ where: whereCondition }),
  ]);

  const totalPage = Math.ceil(total / limit);

  return {
    meta: { page, limit, total, totalPage },
    data: data as unknown as IDoctorResponse[],
  };
};

const getAreaAndDiagnosticDoctors = async (userId: string): Promise<any[]> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      manager: true,
      diagnostic: true,
      staff: true,
    },
  });

  if (!user) {
    throw new ApiError(404, 'ইউজার পাওয়া যায়নি');
  }

  let allUniqueDoctorIds: string[] = [];

  // ==========================================
  // ১. AREA MANAGER: এরিয়ার সব ডাক্তার + এরিয়ার ক্লিনিকগুলোর মেম্বার ডাক্তার
  // ==========================================
  if (user.role === 'AREA_MANAGER') {
    const areaId = user.manager?.areaId;
    if (!areaId) throw new ApiError(403, 'আপনার সাথে কোনো এরিয়া যুক্ত নেই');

    const areaDoctors = await prisma.doctorArea.findMany({
      where: { areaId },
      select: { doctorId: true },
    });

    const diagnosticMembershipDoctors = await prisma.membership.findMany({
      where: {
        active: true,
        diagnostic: { areaId: areaId },
      },
      select: { doctorId: true },
    });

    allUniqueDoctorIds = Array.from(
      new Set([
        ...areaDoctors.map((d) => d.doctorId),
        ...diagnosticMembershipDoctors.map((m) => m.doctorId),
      ]),
    );
  }

  // ==========================================
  // ২. DIAGNOSTIC MANAGER / Diagnostic USER: তার নিজের ক্লিনিকের মেম্বার ডাক্তার
  // ==========================================
  else if (user.role === 'DIAGNOSTIC') {
    const diagId = user.diagnostic?.id; // সরাসরি ইউজার থেকে ক্লিনিক আইডি
    if (!diagId) throw new ApiError(403, 'আপনার কোনো ক্লিনিক প্রোফাইল পাওয়া যায়নি');

    const memberships = await prisma.membership.findMany({
      where: { diagId, active: true },
      select: { doctorId: true },
    });

    allUniqueDoctorIds = memberships.map((m) => m.doctorId);
  }

  // ==========================================
  // ৩. STAFF: যে ক্লিনিকে সে কর্মরত, সেই ক্লিনিকের মেম্বার ডাক্তার
  // ==========================================
  else if (user.role === 'STAFF') {
    const diagId = user.staff?.diagId;
    if (!diagId) throw new ApiError(403, 'আপনার কর্মরত ক্লিনিক খুঁজে পাওয়া যায়নি');

    const memberships = await prisma.membership.findMany({
      where: { diagId, active: true },
      select: { doctorId: true },
    });

    allUniqueDoctorIds = memberships.map((m) => m.doctorId);
  }

  // ==========================================
  // ৪. ফাইনাল ডাক্তারদের ডাটা ফেচিং
  // ==========================================
  if (allUniqueDoctorIds.length === 0) return [];

  const doctors = await prisma.doctor.findMany({
    where: {
      id: { in: allUniqueDoctorIds },
    },
    select: {
      id: true,
      department: true,
      specialization: true,
      user: {
        select: {
          name: true,
          image: true,
        },
      },
    },
  });

  return doctors.map((doc) => ({
    id: doc.id,
    name: doc.user.name,
    image: doc.user.image,
    department: doc.department,
    specialization: doc.specialization,
  }));
};

export const getDoctorById = async (identifier: string): Promise<IDoctorResponse> => {
  if (!identifier) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'আইডি বা স্ল্যাগ প্রদান করা বাধ্যতামূলক');
  }

  // ১. প্রথমে ডাক্তার ফেচ করুন (মেম্বারশিপ ছাড়া)
  const doctor = await prisma.doctor.findFirst({
    where: {
      OR: [{ userId: identifier }, { slug: identifier }],
    },
    select: {
      ...DOCTOR_SELECT,
      memberships: false, // ডিফল্ট সিলেকশন থেকে মেম্বারশিপ বাদ দেওয়া হয়েছে
    },
  });

  if (!doctor) {
    throw new ApiError(httpStatus.NOT_FOUND, 'কাঙ্ক্ষিত ডাক্তারকে খুঁজে পাওয়া যায়নি');
  }

  return doctor as any;
};

const updateDoctor = async (doctorId: string, payload: any): Promise<any> => {
  // ১. আর্লি এক্সিট (Early Exit)
  if (!doctorId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User ID is required');
  }

  const { user, departmentId, ...restDoctorData } = payload;

  const userUpdateData: any = {};
  if (user) {
    const fields = ['name', 'phoneNumber', 'image', 'deactivate'];
    fields.forEach((field) => {
      if (user[field] !== undefined) userUpdateData[field] = user[field];
    });

    if (user.password?.trim()) {
      userUpdateData.password = await bcrypt.hash(user.password, 12);
    }
  }

  const updatedDoctor = await prisma.doctor.update({
    where: { id: doctorId },
    data: {
      ...restDoctorData,
      // Department রিলেশন
      ...(departmentId && {
        department: { connect: { id: departmentId } },
      }),
      // ইউজার রিলেশন
      ...(Object.keys(userUpdateData).length > 0 && {
        user: { update: userUpdateData },
      }),
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          phoneNumber: true,
          image: true,
          role: true,
          deactivate: true,
        },
      },
      department: true,
    },
  });

  return updatedDoctor;
};
const deleteDoctor = async (userId: string): Promise<IDoctorResponse> => {
  // 1️⃣ Check if doctor exists
  const existingDoctor = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!existingDoctor) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Doctor not found');
  }

  // 2️⃣ Soft delete: update user.active to false
  const doctor = await prisma.user.delete({
    where: { id: userId },
  });

  return doctor as any;
};

export const DoctorService = {
  createDoctor,
  getDoctors,
  deleteDoctor,
  getDoctorById,
  updateDoctor,
  getAreaAndDiagnosticDoctors,
  addDoctorToArea,
  removeDoctorFromArea,
};
