import { Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import httpStatus from 'http-status';
import config from '../../../config/config';
import { jwtTokenHelper } from '../../../helper';
import ApiError from '../../../utils/apiError';
import { IUserResponse } from '../user/interface';

interface ResolvePatientUserPayload {
  tx: Prisma.TransactionClient;

  phoneNumber: string;
  patientName: string;

  address?: string;
  ptAge?: string | number;

  hashedPassword?: string;
}

interface ResolvePatientUserReturn {
  patientId: string;
  userId: string;
  isNewUser: boolean;
}

export const resolvePatientUser = async ({
  tx,
  phoneNumber,
  patientName,
  address,
  ptAge,
  hashedPassword,
}: ResolvePatientUserPayload): Promise<ResolvePatientUserReturn> => {
  // Existing user check
  const existingUser = await tx.user.findUnique({
    where: {
      phoneNumber,
    },
    include: {
      patient: true,
    },
  });

  // -----------------------------------------
  // Existing User
  // -----------------------------------------
  if (existingUser) {
    // অন্য role হলে block
    if (existingUser.role !== 'PATIENT') {
      throw new ApiError(httpStatus.FORBIDDEN, 'এই নম্বরটি অন্য রোলে ব্যবহার করা হয়েছে।');
    }

    // Patient profile missing হলে create
    let patientProfile = existingUser.patient;

    if (!patientProfile) {
      patientProfile = await tx.patient.create({
        data: {
          userId: existingUser.id,
          age: ptAge ? Number(ptAge) : null,
          address: address || null,
        },
      });
    }

    return {
      patientId: patientProfile.id,
      userId: existingUser.id,
      isNewUser: false,
    };
  }

  // -----------------------------------------
  // New User Create
  // -----------------------------------------

  const defaultPassword = config.default_password || 'Password@123';

  const password = hashedPassword || (await bcrypt.hash(defaultPassword, 12));

  const newUser = await tx.user.create({
    data: {
      name: patientName,
      phoneNumber,
      password,
      role: 'PATIENT',
      isDefaultPassword: true,

      patient: {
        create: {
          age: ptAge ? Number(ptAge) : null,
          address: address || null,
        },
      },
    },

    include: {
      patient: true,
    },
  });

  return {
    patientId: newUser.patient!.id,
    userId: newUser.id,
    isNewUser: true,
  };
};

export const appointmentPopulate = {
  doctor: {
    select: {
      id: true,
      user: {
        select: {
          phoneNumber: true,
          name: true,
          image: true,
        },
      },

      department: true,
      specialization: true,
    },
  },
  patient: {
    select: {
      id: true,
      user: {
        select: {
          phoneNumber: true,
          name: true,
          image: true,
        },
      },
    },
  },
  clinic: {
    select: {
      id: true,
      user: {
        select: {
          phoneNumber: true,
          name: true,
          image: true,
        },
      },
      address: true,
    },
  },

  medicalRecords: true,
} satisfies Prisma.AppointmentSelect;
export const generateAppointmentCode = (length: number = 8): string => {
  return Math.random()
    .toString(36)
    .substring(2, 2 + length)
    .toUpperCase();
};
export const generateTokens = (user: IUserResponse) => {
  const payload = { userId: user.id, email: user.phoneNumber, role: user.role };
  return {
    accessToken: jwtTokenHelper.accessToken(payload),
    refreshToken: jwtTokenHelper.refreshToken(payload),
  };
};
export const AppointmentsFilterableFields = [
  'status',
  'date',
  'district',
  'area',
  'doctorId',
  'clinicId',
];
