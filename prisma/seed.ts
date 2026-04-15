import { Gender, PrismaClient, ReviewStatus, ReviewTargetType, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('123456', 10);

  // ---------------- District + Area ----------------
  const district = await prisma.district.create({
    data: {
      name: 'দিনাজপুর',
      slug: 'dinajpur',
      areas: {
        create: [
          { name: 'দিনাজপুর সদর', slug: 'dinajpur-sadar' },
          { name: 'বিরগঞ্জ', slug: 'birganj' },
          { name: 'সেতাবগঞ্জ', slug: 'setabganj' },
          { name: 'পার্বতীপুর', slug: 'parbatipur' },
          { name: 'ফুলবাড়ী', slug: 'phulbari' },
        ],
      },
    },
    include: { areas: true },
  });

  // ---------------- Department ----------------
  const deptData = [
    { name: 'কার্ডিওলজি', slug: 'cardiology' },
    { name: 'মেডিসিন', slug: 'medicine' },
    { name: 'নিউরোলজি', slug: 'neurology' },
    { name: 'অর্থোপেডিক', slug: 'orthopedic' },
    { name: 'চর্মরোগ', slug: 'dermatology' },
    { name: 'শিশু বিভাগ', slug: 'pediatrics' },
  ];

  const departments = await Promise.all(deptData.map((d) => prisma.department.create({ data: d })));

  // ---------------- Clinics ----------------
  const clinics: any[] = [];

  for (let i = 1; i <= 30; i++) {
    const area = district.areas[i % district.areas.length];

    const user = await prisma.user.create({
      data: {
        name: `ক্লিনিক ${toBanglaNumber(i)}`,
        phoneNumber: `+88019${String(i).padStart(8, '0')}`,
        password,
        role: UserRole.CLINIC,
        isPhoneVerified: true,
      },
    });

    const clinic = await prisma.clinic.create({
      data: {
        userId: user.id,
        name: `সুস্থি ক্লিনিক ${i}`,
        slug: `susthi-clinic-${i}`,
        address: `${area.name}, দিনাজপুর`,
        areaId: area.id,
        active: true,
      },
    });

    clinics.push({ clinic, user });
  }

  // ---------------- Doctors ----------------
  const doctors: any[] = [];

  for (let i = 1; i <= 30; i++) {
    const area = district.areas[i % district.areas.length];
    const dept = departments[i % departments.length];

    const user = await prisma.user.create({
      data: {
        name: `ডাক্তার ${toBanglaNumber(i)}`,
        phoneNumber: `+88016${String(i).padStart(8, '0')}`,
        password,
        role: UserRole.DOCTOR,
        isPhoneVerified: true,
      },
    });

    const doctor = await prisma.doctor.create({
      data: {
        userId: user.id,
        slug: `doctor-${i}`,
        specialization: dept.name,
        departmentId: dept.id,
        position: 'কনসালটেন্ট',
        hospital: `জেনারেল হাসপাতাল ${i}`,
        gender: i % 2 === 0 ? Gender.MALE : Gender.FEMALE,
        experience: 2 + i,
      },
    });

    await prisma.doctorArea.create({
      data: {
        doctorId: doctor.id,
        areaId: area.id,
      },
    });

    const clinicRef = clinics[i % clinics.length];

    await prisma.membership.create({
      data: {
        doctorId: doctor.id,
        clinicId: clinicRef.clinic.id,
        createdById: clinicRef.user.id,
        fee: 500,
        schedules: {
          create: [
            { time: 'শনিবার বিকাল ৫টা - রাত ৮টা' },
            { time: 'সোমবার বিকাল ৪টা - সন্ধ্যা ৭টা' },
          ],
        },
      },
    });

    doctors.push({ doctor, user });
  }

  // ---------------- Patients ----------------
  const patients: any[] = [];

  for (let i = 1; i <= 3; i++) {
    const user = await prisma.user.create({
      data: {
        name: `রোগী ${toBanglaNumber(i)}`,
        phoneNumber: `+88015${String(i).padStart(8, '0')}`,
        password,
        role: UserRole.PATIENT,
        isPhoneVerified: true,
      },
    });

    await prisma.patient.create({
      data: {
        userId: user.id,
        age: 20 + i,
        gender: i % 2 === 0 ? Gender.FEMALE : Gender.MALE,
        address: 'দিনাজপুর, বাংলাদেশ',
      },
    });

    patients.push(user);
  }

  // ---------------- Doctor Reviews ----------------
  for (let i = 0; i < doctors.length; i++) {
    for (let j = 0; j < 2; j++) {
      const reviewer = patients[(i + j) % patients.length];

      await prisma.review.create({
        data: {
          rating: 5,
          comment: `ডাক্তার খুব ভালো (${j + 1})`,
          targetId: doctors[i].user.id,
          targetType: ReviewTargetType.DOCTOR,
          reviewerId: reviewer.id,
          status: ReviewStatus.APPROVED,
        },
      });
    }
  }

  // ---------------- Clinic Reviews ----------------
  for (let i = 0; i < clinics.length; i++) {
    for (let j = 0; j < 2; j++) {
      const reviewer = patients[(i + j) % patients.length];

      await prisma.review.create({
        data: {
          rating: 4,
          comment: `ক্লিনিক ভালো (${j + 1})`,
          targetId: clinics[i].user.id,
          targetType: ReviewTargetType.CLINIC,
          reviewerId: reviewer.id,
          status: ReviewStatus.APPROVED,
        },
      });
    }
  }

  console.log('✅ বাংলা + ইংরেজি slug সহ seed complete');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
const toBanglaNumber = (num: number | string) => {
  const engToBan = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return num
    .toString()
    .split('')
    .map((d) => engToBan[Number(d)] || d)
    .join('');
};
