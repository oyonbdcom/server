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

export const StaffService = {
  createStaff,
};
