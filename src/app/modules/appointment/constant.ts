import { Prisma } from '@prisma/client';
import config from '../../../config/config';
import { jwtTokenHelper } from '../../../helper';
import prisma from '../../../prisma/client';
import { generatePatientId } from '../../../utils/common';
import { sendBatchNotification } from '../../../utils/notification.utils';
import { IUserResponse } from '../user/interface';

interface ResolvePatientUserPayload {
  tx: Prisma.TransactionClient;

  phoneNumber: string;
  patientName: string;

  address?: string;
  ptAge?: string | number;

  hashedPassword?: string;
}
interface NotifyPayload {
  result: any;
  diagId: string;
  doctorId: string;
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
  const newPatientId = await generatePatientId(tx);
  // ================= 4. CREATE PATIENT IF NOT FOUND =================
  if (!patient) {
    patient = await tx.patient.create({
      data: {
        userId: user.id,
        age: ptAge ? Number(ptAge) : 0,
        address: address || null,
        patientId: newPatientId,
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
export async function updateDiagnosticAnalytics(
  tx: any,
  diagId: string,
  docId: string,
  sId: string | undefined,
  dayStart: Date,
  source: 'PLATFORM' | 'STAFF',
) {
  const analytics = await tx.diagnosticAnalytics.findUnique({
    where: { diagId_date: { diagId, date: dayStart } },
  });

  const docStats = (analytics?.doctorStats as any) || {};
  const staffStats = (analytics?.staffStats as any) || {};

  // Doctor stats increment
  docStats[docId] = (docStats[docId] || 0) + 1;

  // Staff stats increment (sId চেক করে নেয়া হচ্ছে)
  if (sId) {
    staffStats[sId] = (staffStats[sId] || 0) + 1;
  }

  // কাউন্ট লজিক
  const platformIncrement = source === 'PLATFORM' ? 1 : 0;

  if (analytics) {
    await tx.diagnosticAnalytics.update({
      where: { diagId_date: { diagId, date: dayStart } },
      data: {
        totalBookings: { increment: 1 },
        platformBookings: { increment: platformIncrement },

        doctorStats: docStats,
        staffStats: staffStats,
      },
    });
  } else {
    await tx.diagnosticAnalytics.create({
      data: {
        diagId,
        date: dayStart,
        totalBookings: 1,
        platformBookings: platformIncrement,

        doctorStats: docStats,
        staffStats: staffStats,
      },
    });
  }
}
export async function notifyCoordinator({ result, doctorId, diagId }: NotifyPayload) {
  const coordinators = await prisma.staff.findMany({
    where: {
      assignedDoctorId: doctorId,
      diagId: diagId,
      staffType: 'COORDINATOR',
    },
    select: {
      userId: true,
      user: {
        select: {
          deviceTokens: { select: { token: true } },
        },
      },
    },
  });

  const coordinatorTokens = coordinators.flatMap((c) => c.user.deviceTokens.map((dt) => dt.token));

  if (coordinatorTokens.length > 0) {
    const title = 'নতুন অ্যাপয়েন্টমেন্ট';
    const body = `${result.patientName} (সিরিয়াল: ${result.serialNumber}) আজ অ্যাপয়েন্টমেন্ট নিয়েছেন।`;

    // একবারে সব কো-অর্ডিনেটরকে নোটিফিকেশন পাঠানো
    await sendBatchNotification(coordinatorTokens, title, body);
  }
}

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
  diagnostic: {
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
  'diagId',
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
