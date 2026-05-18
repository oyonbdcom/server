import { Prisma } from '@prisma/client';
import config from '../../../config/config';
import { jwtTokenHelper } from '../../../helper';
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
}: ResolvePatientUserPayload): Promise<ResolvePatientUserReturn> => {
  // ================= 1. FIND USER =================
  let user = await tx.user.findUnique({
    where: {
      phoneNumber,
    },
    include: {
      patient: true,
    },
  });
  const hashedPassword = config.default_password || 'Password@123';
  // ================= 2. CREATE USER IF NOT EXISTS =================
  if (!user) {
    user = await tx.user.create({
      data: {
        name: patientName,
        phoneNumber,
        role: 'PATIENT',
        password: hashedPassword,
      },
      include: {
        patient: true,
      },
    });
  }

  // ================= 3. FIND EXISTING PATIENT =================
  const normalizedName = patientName.trim();

  let patient = await tx.patient.findFirst({
    where: {
      userId: user.id,
    },
  });

  // ================= 4. CREATE PATIENT IF NOT FOUND =================
  if (!patient) {
    patient = await tx.patient.create({
      data: {
        userId: user.id,
        age: ptAge ? Number(ptAge) : 0,
        address: address || null,
      },
    });
  }

  // ================= 5. RETURN =================
  return {
    patientId: patient.id,
    userId: user.id,
    isNewUser: !user,
  };
};

export const appointmentPopulate = {
  createdBy: {
    select: {
      name: true,
    },
  },
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
  emergency: true,
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
  'search',
  'district',
  'area',
  'doctorId',
  'clinicId',
  'isEmergency',
];
export const normalizePhone = (value: string) => {
  if (!value) return '';

  let v = value.trim();

  // remove spaces, dashes
  v = v.replace(/\s|-/g, '');

  // convert 01XXXXXXXXX → +8801XXXXXXXXX
  if (v.startsWith('01')) {
    v = '+88' + v;
  }

  // if already 880 but no +
  if (v.startsWith('880')) {
    v = '+' + v;
  }

  return v;
};
export const getAttendanceStatus = (serialNumber: number, runningSerial: number | null) => {
  if (!runningSerial) return 'UNKNOWN';

  if (serialNumber < runningSerial) return 'PRESENT'; // আগে দেখা হয়ে গেছে
  if (serialNumber === runningSerial) return 'RUNNING'; // এখন দেখছে
  return 'WAITING'; // এখনও আসেনি
};
