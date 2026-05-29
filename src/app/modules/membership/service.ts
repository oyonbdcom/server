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
  const { doctorId, fee, discount } = payload;

  let diagId = payload.diagId;

  // ✅ diagid না থাকলে logged in user থেকে diagnostic বের করো
  if (!diagId) {
    const diagnostic = await prisma.diagnostic.findUnique({
      where: {
        userId,
      },
      select: {
        id: true,
      },
    });

    if (!diagnostic) {
      throw new ApiError(httpStatus.NOT_FOUND, 'ক্লিনিক প্রোফাইল পাওয়া যায়নি!');
    }

    diagId = diagnostic.id;
  }

  // ✅ already exists check
  const isExistingMembership = await prisma.membership.findUnique({
    where: {
      doctorId_diagId: {
        doctorId,
        diagId,
      },
    },
  });

  if (isExistingMembership) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'এই চিকিৎসক ইতিমধ্যে এই ক্লিনিকে যুক্ত আছেন!');
  }

  try {
    // ✅ create membership
    const membership = await prisma.membership.create({
      data: {
        doctorId,
        diagId,
        createdById: userId,
        fee: Number(fee),
        discount: Number(discount || 0),
      },

      include: {
        doctor: {
          include: {
            user: {
              select: {
                name: true,
                image: true,
              },
            },
          },
        },

        diagnostic: {
          include: {
            user: {
              select: {
                name: true,
                image: true,
              },
            },
          },
        },
      },
    });

    return membership as any;
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'মেম্বারশিপ তৈরি করার সময় সমস্যা হয়েছে।');
  }
};
// ১. মেম্বারশিপ লিস্ট দেখা
const getMembershipsBySlug = async (
  slug: string,
  options: IOptions,
): Promise<IGenericResponse<IMembershipResponse[]>> => {
  const { page, limit, skip } = paginationCalculator(options);

  // ১. স্লাগ চেক করা
  const doctorOrDiagnostic = await prisma.user.findFirst({
    where: {
      OR: [{ doctor: { slug: slug } }, { diagnostic: { slug: slug } }],
    },
    select: {
      id: true,
      doctor: { select: { id: true } },
      diagnostic: { select: { id: true } },
    },
  });

  if (!doctorOrDiagnostic) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      'প্রদত্ত স্লাগ দিয়ে কোনো ডক্টর বা ক্লিনিক পাওয়া যায়নি',
    );
  }

  const andConditions: Prisma.MembershipWhereInput[] = [];

  // ২. ডক্টর অথবা ক্লিনিক ফিল্টার সেট করা
  if (doctorOrDiagnostic.doctor) {
    andConditions.push({ doctorId: doctorOrDiagnostic.doctor.id });
  } else if (doctorOrDiagnostic.diagnostic) {
    andConditions.push({ diagId: doctorOrDiagnostic.diagnostic?.id });
  }

  const whereConditions: Prisma.MembershipWhereInput = {
    AND: andConditions,
  };

  const [memberships, total] = await Promise.all([
    prisma.membership.findMany({
      where: whereConditions,

      skip,
      take: limit,
      select: {
        doctor: {
          select: {
            id: true,
            slug: true,
            specialization: true,
            user: { select: { name: true, image: true } },
            department: {
              select: {
                name: true,
              },
            },
          },
        },
        diagnostic: {
          select: {
            id: true,
            user: { select: { name: true } },
            area: true,
            address: true,
            slug: true,
          },
        },
        fee: true,
        schedules: true,
      },
    }),
    prisma.membership.count({
      where: whereConditions, // এখানেও whereConditions ব্যবহার করুন
    }),
  ]);

  const totalPage = Math.ceil(total / limit);
  console.log(memberships);
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
export const getDiagnosticMemberDoctors = async (
  userId: string,
  filters: {
    searchTerm?: string;
    diagId?: string;
    doctorId?: string;
  },
  options: IOptions,
): Promise<IGenericResponse<IMembershipResponse[]>> => {
  const { page, limit, skip, sortBy, sortOrder } = paginationCalculator(options);

  const { searchTerm, diagId, doctorId } = filters;

  // ✅ logged in diagnostic / diagnostic manager
  const diagnostic = await prisma.diagnostic.findUnique({
    where: {
      userId,
    },
    select: {
      id: true,
    },
  });

  // ✅ base condition
  const andConditions: Prisma.MembershipWhereInput[] = [];

  // 🔥 manager OR diagnostic user memberships
  andConditions.push({
    OR: [
      {
        createdById: userId,
      },

      ...(diagnostic
        ? [
            {
              diagId: diagnostic.id,
            },
          ]
        : []),
    ],
  });

  // 🔍 search
  if (searchTerm) {
    andConditions.push({
      OR: [
        {
          doctor: {
            user: {
              name: {
                contains: searchTerm,
                mode: 'insensitive',
              },
            },
          },
        },

        {
          doctor: {
            department: {
              name: {
                contains: searchTerm,
                mode: 'insensitive',
              },
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

  // ✅ diagnostic filter
  if (diagId) {
    andConditions.push({
      diagId,
    });
  }

  // ✅ doctor filter
  if (doctorId) {
    andConditions.push({
      doctorId,
    });
  }

  const whereConditions: Prisma.MembershipWhereInput = {
    AND: andConditions,
  };

  // ✅ query
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

            department: {
              select: {
                name: true,
              },
            },

            user: {
              select: {
                id: true,
                name: true,
                image: true,
                phoneNumber: true,
              },
            },
          },
        },

        diagnostic: {
          select: {
            id: true,

            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },

        schedules: true,
      },

      skip,
      take: limit,

      orderBy: sortBy && sortOrder ? { [sortBy]: sortOrder } : { createdAt: 'desc' },
    }),

    prisma.membership.count({
      where: whereConditions,
    }),
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

// const getMyDoctors = async ({ userId }: { userId: string }) => {
//   // ১. ইউজারের ক্লিনিক প্রোফাইল খুঁজে বের করা
//   const existingdiagnostic = await prisma.diagnostic.findUnique({
//     where: { userId },
//   });

//   if (!existingdiagnostic) {
//     throw new ApiError(httpStatus.NOT_FOUND, 'ক্লিনিক প্রোফাইল পাওয়া যায়নি!');
//   }

//   // ২. যেহেতু ডুপ্লিকেট নেই, সরাসরি মেম্বারশিপ থেকে ডাটা আনা
//   const memberships = await prisma.membership.findMany({
//     where: {
//       active: true,
//       diagnosticId: existingdiagnostic.id,
//     },
//     select: {
//       doctor: {
//         select: {
//           id: true,
//           department: true,
//           user: {
//             select: {
//               name: true,
//               id: true,
//               image: true,
//             },
//           },
//         },
//       },
//     },
//   });

//   // ৩. রেজাল্ট ম্যাপিং
//   return memberships.map((item) => ({
//     id: item.doctor.id,
//     name: item.doctor.user?.name || 'অজানা চিকিৎসক',
//     department: item.doctor.department || 'জেনারেল',
//     image: item.doctor.user?.image || null,
//     userId: item.doctor.user.id,
//   }));
// };

// ২. মেম্বারশিপ আপডেট করা
const updateMembership = async (
  membershipId: string,
  payload: Partial<CreateMembershipInput>,
): Promise<IMembershipResponse> => {
  const membershipToUpdate = await prisma.membership.findUnique({
    where: { id: membershipId },
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
  await prisma.membership.delete({
    where: { id: membershipId },
  });

  return { message: 'সফলভাবে সদস্যপদ থেকে অপসারিত করা হয়েছে' };
};

export const MembershipService = {
  createMembership,
  getDiagnosticMemberDoctors,
  updateMembership,
  getMembershipsBySlug,
  deleteMembership,
};
