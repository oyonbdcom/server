import bcrypt from 'bcrypt';
import prisma from '../../../prisma/client';

// create staff

interface ICreateStaffPayload {
  diagId: string;
  user: {
    name: string;
    phoneNumber: string;
    password: string;
    image?: string;
  };
  staffType: 'COORDINATOR' | 'RECEPTIONIST';
  assignedDoctorId?: string;
}

const createStaff = async (userId: string, payload: ICreateStaffPayload) => {
  const { user, staffType, assignedDoctorId } = payload;

  const diagnostic = await prisma.diagnostic.findUnique({
    where: {
      userId,
    },

    select: {
      id: true,
      user: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!diagnostic) {
    throw new Error('ক্লিনিক পাওয়া যায়নি');
  }

  const diagId = diagnostic.id;

  // 2. CHECK PHONE ALREADY EXISTS
  const existingUser = await prisma.user.findUnique({
    where: { phoneNumber: user.phoneNumber },
  });

  if (existingUser) {
    throw new Error('এই ফোন নম্বর ইতিমধ্যে ব্যবহৃত হয়েছে');
  }

  // 3. HASH PASSWORD
  const hashedPassword = await bcrypt.hash(user.password, 10);

  // 4. CREATE USER + STAFF (TRANSACTION)
  const result = await prisma.$transaction(async (tx) => {
    // create user
    const createdUser = await tx.user.create({
      data: {
        name: user.name,
        phoneNumber: user.phoneNumber,
        password: hashedPassword,
        image: user.image,
        role: 'STAFF',
      },
    });

    // create staff
    const staff = await tx.staff.create({
      data: {
        userId: createdUser.id,
        diagId,
        staffType,
        assignedDoctorId: assignedDoctorId || null,
      },

      include: {
        user: true,
        assignedDoctor: {
          include: {
            user: true,
          },
        },
      },
    });

    return staff;
  });

  return result;
};
const getAllStaffForDiagnostic = async (diagId: string) => {
  const staffList = await prisma.staff.findMany({
    where: {
      diagId,
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      staffType: true,
      assignedDoctorId: true,
      user: {
        select: {
          name: true,
          phoneNumber: true,
          _count: {
            select: {
              createdAppointments: true,
            },
          },
        },
      },
      assignedDoctor: {
        select: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  return staffList;
};
const updateStaff = async (staffId: string, payload: ICreateStaffPayload) => {
  const { user, staffType, assignedDoctorId } = payload;

  // 1. Check if the staff exists
  const existingStaff = await prisma.staff.findUnique({
    where: { id: staffId },
    include: { user: true },
  });

  if (!existingStaff) {
    throw new Error('স্টাফ পাওয়া যায়নি');
  }

  // 2. Optional: If phone number is being updated, check for duplicates
  if (user?.phoneNumber && user.phoneNumber !== existingStaff.user.phoneNumber) {
    const phoneExists = await prisma.user.findUnique({
      where: { phoneNumber: user.phoneNumber },
    });
    if (phoneExists) {
      throw new Error('এই ফোন নম্বর ইতিমধ্যে ব্যবহৃত হয়েছে');
    }
  }

  // 4. UPDATE USER + STAFF (TRANSACTION)
  const result = await prisma.$transaction(async (tx) => {
    // Update user table
    if (user) {
      await tx.user.update({
        where: { id: existingStaff.userId },
        data: {
          name: user.name,
          phoneNumber: user.phoneNumber,
          image: user.image,
        },
      });
    }

    // Update staff table
    const updatedStaff = await tx.staff.update({
      where: { id: staffId },
      data: {
        staffType,
        assignedDoctorId: assignedDoctorId !== undefined ? assignedDoctorId : undefined,
      },
      include: {
        user: true,
        assignedDoctor: {
          include: {
            user: true,
          },
        },
      },
    });

    return updatedStaff;
  });

  return result;
};
const deleteStaff = async (staffId: string) => {
  // 1. Check if the staff exists
  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
  });

  if (!staff) {
    throw new Error('স্টাফ পাওয়া যায়নি');
  }

  // 2. DELETE STAFF + USER (TRANSACTION)
  const result = await prisma.$transaction(async (tx) => {
    // Delete staff first due to foreign key constraints
    await tx.staff.delete({
      where: { id: staffId },
    });

    // Delete the associated user
    const deletedUser = await tx.user.delete({
      where: { id: staff.userId },
    });

    return { message: 'স্টাফ সফলভাবে মুছে ফেলা হয়েছে', userId: deletedUser.id };
  });

  return result;
};
export const StaffService = {
  createStaff,
  getAllStaffForDiagnostic,
  updateStaff,
  deleteStaff,
};
