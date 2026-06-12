import { Prisma, UserRole } from '@prisma/client';
import httpStatus from 'http-status';

import bcrypt from 'bcrypt';
import { IOptions, paginationCalculator } from '../../../helper/pagination';
import { IGenericResponse } from '../../../interface/common';
import prisma from '../../../prisma/client';
import ApiError from '../../../utils/apiError';

import config from '../../../config/config';
import { createSlug } from '../../../utils/createSlug';
import { bdEndOfDay, bdStartOfDay } from '../../../utils/timezone';
import { AREA_DOCTOR_SELECT, DOCTOR_SELECT, EMERGENCY_DOCTOR_SELECT } from './constant';
import { IDoctorAppointmentStats, IDoctorResponse } from './interface';
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
const getAllDoctors = async (
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
const getDoctorDirectory = async (
  filter: {
    searchTerm?: string;
    department?: string;
    district?: string;
    area?: string;
    minRating?: string;
    deactivate?: string;
    gender?: 'MALE' | 'FEMALE';
    myAreaOnly?: string;
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

    district,
    area,

    myAreaOnly,
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
      select: AREA_DOCTOR_SELECT,
    }),
    prisma.doctor.count({ where: whereCondition }),
  ]);

  const totalPage = Math.ceil(total / limit);

  return {
    meta: { page, limit, total, totalPage },
    data: data as unknown as IDoctorResponse[],
  };
};

const getDoctorAppointmentStats = async (
  doctorId: string,
  diagId?: string,
): Promise<IDoctorAppointmentStats> => {
  const today = new Date();

  const startOfDay = bdStartOfDay(today);
  const endOfDay = bdEndOfDay(today);

  const whereCondition: Prisma.AppointmentWhereInput = {
    doctorId,
    ...(diagId &&
      diagId !== 'all' && {
        diagId,
      }),
  };

  const [
    totalAppointments,
    todayAppointments,
    pendingAppointments,
    completedAppointments,
    cancelledAppointments,
  ] = await Promise.all([
    prisma.appointment.count({
      where: whereCondition,
    }),

    prisma.appointment.count({
      where: {
        ...whereCondition,
        appointmentDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    }),

    prisma.appointment.count({
      where: {
        ...whereCondition,
        status: 'PENDING',
      },
    }),

    prisma.appointment.count({
      where: {
        ...whereCondition,
        status: 'COMPLETED',
      },
    }),

    prisma.appointment.count({
      where: {
        ...whereCondition,
        status: 'CANCELLED',
      },
    }),
  ]);

  return {
    totalAppointments,
    todayAppointments,
    pendingAppointments,
    completedAppointments,
    cancelledAppointments,
  };
};

// ***************
//    area manager doctors name
// ******************
const getAreaManagerDoctorsName = async (userId: string) => {
  // ১. ম্যানেজার ও তার এরিয়া তথ্য একসাথে ফেচ করা (অপ্টিমাইজড)
  const manager = await prisma.manager.findUnique({
    where: { userId },
    select: { areaId: true },
  });

  if (!manager?.areaId) {
    throw new ApiError(403, 'আপনার সাথে কোনো এরিয়া যুক্ত নেই অথবা ইউজারটি ম্যানেজার নয়');
  }
  // ২. এরিয়ার ডাক্তারদের লিস্ট ফেচ করা
  const areaDoctors = await prisma.doctorArea.findMany({
    where: { areaId: manager.areaId },
    select: {
      doctor: {
        select: {
          id: true,

          user: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  // ৩. ডেটা ফরম্যাট করা
  return areaDoctors.map(({ doctor }) => ({
    id: doctor.id,
    name: doctor.user.name,
  }));
};

const getDiagnosticDoctorsName = async (userId: string): Promise<any[]> => {
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

  const diagId = user.diagnostic?.id || user?.staff?.diagId; // সরাসরি ইউজার থেকে ক্লিনিক আইডি
  if (!diagId) throw new ApiError(403, 'আপনার কোনো ক্লিনিক প্রোফাইল পাওয়া যায়নি');

  const memberships = await prisma.membership.findMany({
    where: { diagId, active: true },
    select: {
      doctorId: true,
      doctor: {
        select: {
          user: {
            select: { name: true, image: true },
          },
          id: true,
          department: {
            select: {
              name: true,
            },
          },
          specialization: true,
          slug: true,
        },
      },
    },
  });

  return memberships.map((doc) => ({
    id: doc.doctor?.id,
    name: doc.doctor?.user.name,
    image: doc.doctor?.user.image,
    department: doc.doctor?.department,
    specialization: doc.doctor?.specialization,
  }));
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

const getDoctorById = async (userId: string) => {
  if (!userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'আইডি বা স্ল্যাগ প্রদান করা বাধ্যতামূলক');
  }

  const doctor = await prisma.doctor.findFirst({
    where: {
      userId,
    },
    select: {
      ...DOCTOR_SELECT,
      appointments: {
        select: {
          createdById: true,
        },
      },
      _count: {
        select: {
          appointments: true,
        },
      },
    },
  });

  if (!doctor) {
    throw new ApiError(httpStatus.NOT_FOUND, 'কাঙ্ক্ষিত ডাক্তারকে খুঁজে পাওয়া যায়নি');
  }

  return {
    id: doctor.id,
    slug: doctor.slug,

    specialization: doctor.specialization,

    department: {
      id: doctor.department?.id,
      name: doctor.department?.name,
      slug: doctor.department?.slug,
    },

    position: doctor.position,
    hospital: doctor.hospital,
    website: doctor.website,
    totalAppointments: (doctor as any)._count?.appointments || 0,
    totalPatients:
      doctor.appointments.length > 0
        ? new Set(doctor.appointments.map((a) => a.createdById)).size
        : 0,
    experience: doctor.experience,
    gender: doctor.gender,
    isEmergency: doctor?.isEmergency,
    averageRating: doctor.averageRating,
    reviewsCount: doctor.reviewsCount,

    educations: doctor.educations,

    user: {
      name: doctor.user?.name,
      image: doctor.user?.image,
      phoneNumber: doctor.user?.phoneNumber,
    },

    practices:
      doctor.areas?.map((item) => ({
        area: item.area?.name,

        district: item.area?.district?.name,

        centers: doctor.memberships?.map((membership) => membership.diagnostic?.user?.name) || [],
      })) || [],
  };
};
const getDoctorByslug = async (identifier: string): Promise<IDoctorResponse> => {
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
      memberships: false,
    },
  });

  if (!doctor) {
    throw new ApiError(httpStatus.NOT_FOUND, 'কাঙ্ক্ষিত ডাক্তারকে খুঁজে পাওয়া যায়নি');
  }

  return doctor as any;
};
// for doctor dashboard daig name

const updateDoctor = async (doctorId: string, payload: any): Promise<any> => {
  if (!doctorId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Doctor ID is required');
  }

  // ১. পে-লোড থেকে ডাটা আলাদা করা
  const { user, departmentId, educations, ...restDoctorData } = payload;

  // ২. ইউজার ডাটা প্রস্তুত করা
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

  // ৩. ট্রানজেকশন ব্যবহার করা (যাতে ডাটা সামঞ্জস্যপূর্ণ থাকে)
  return await prisma.$transaction(async (tx) => {
    // ক. এডুকেশন আপডেট করা (প্রথমে ডিলিট, তারপর ইনসার্ট)
    if (educations) {
      await tx.doctorEducation.deleteMany({ where: { doctorId } });

      if (educations.length > 0) {
        await tx.doctorEducation.createMany({
          data: educations.map((edu: any) => ({
            ...edu,
            doctorId, // ডাটাবেজে সঠিক রিলেশন নিশ্চিত করা
          })),
        });
      }
    }

    // খ. ডাক্তার এবং ইউজার রিলেশন আপডেট করা
    return await tx.doctor.update({
      where: { id: doctorId },
      data: {
        ...restDoctorData,
        ...(departmentId && {
          department: { connect: { id: departmentId } },
        }),
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
        educations: true, // নতুন এডুকেশনগুলো রেসপন্সে পাঠানোর জন্য
      },
    });
  });
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
  getAllDoctors,
  getAreaManagerDoctorsName,
  getDoctorDirectory,
  getDiagnosticDoctorsName,
  deleteDoctor,
  getDoctorById,
  getDoctorByslug,
  updateDoctor,
  getDoctorAppointmentStats,
  getAreaAndDiagnosticDoctors,
  addDoctorToArea,
  removeDoctorFromArea,
};
