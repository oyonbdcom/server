import { AppointmentStatus, Gender, PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('password123', 10);

  console.log('--- Cleaning Database ---');
  // Order matters due to foreign key constraints
  const models = [
    prisma.favoriteDoctor,
    prisma.review,
    prisma.appointment,
    prisma.schedule,
    prisma.membership,
    prisma.medicalRecord,
    prisma.doctor,
    prisma.clinic,
    prisma.patient,
    prisma.user,
  ];
  //   for (const model of models) {
  //     await model.deleteMany();
  //   }

  console.log('--- Seeding 5 Clinics ---');
  const clinics = [];
  const clinicNames = [
    'Popular Diagnostic',
    'Square Hospital',
    'Labaid Medical',
    'Ibn Sina',
    'United Clinic',
  ];

  for (let i = 0; i < 5; i++) {
    const user = await prisma.user.create({
      data: {
        name: clinicNames[i],
        email: `clinic${i}@example.com`,
        password,
        role: UserRole.CLINIC,
        image: `https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=200&auto=format&fit=crop`,
        clinic: {
          create: {
            phoneNumber: `0171100000${i}`,
            address: `${i * 10} Dhanmondi`,
            city: 'Dhaka',
            district: 'Dhaka',
            averageRating: 4.0 + i * 0.1,
          },
        },
      },
      include: { clinic: true },
    });
    if (user.clinic) clinics.push(user.clinic);
  }

  console.log('--- Seeding 10 Doctors ---');
  const departments = ['Cardiology', 'Neurology', 'Dermatology', 'Pediatrics', 'Internal Medicine'];
  const doctors = [];

  for (let i = 0; i < 10; i++) {
    const dept = departments[i % departments.length];
    const user = await prisma.user.create({
      data: {
        name: `Dr. Specialist ${i + 1}`,
        email: `doctor${i}@example.com`,
        password,
        role: UserRole.DOCTOR,
        image: `https://i.pravatar.cc/150?u=doctor${i}`,
        doctor: {
          create: {
            department: dept,
            specialization: `${dept} Specialist`,
            gender: i % 2 === 0 ? Gender.MALE : Gender.FEMALE,
            city: 'Dhaka',
            status: 'active',
          },
        },
      },
      include: { doctor: true },
    });
    if (user.doctor) doctors.push(user.doctor);
  }

  console.log('--- Seeding 5 Patients ---');
  const patients = [];
  for (let i = 0; i < 5; i++) {
    const user = await prisma.user.create({
      data: {
        name: `Patient User ${i + 1}`,
        email: `patient${i}@example.com`,
        password,
        role: UserRole.PATIENT,
        patient: {
          create: {
            age: 20 + i,
            gender: i % 2 === 0 ? Gender.MALE : Gender.FEMALE,
            phoneNumber: `0180000000${i}`,
          },
        },
      },
      include: { patient: true },
    });
    if (user.patient) patients.push(user.patient);
  }

  console.log('--- Linking Memberships & Appointments ---');
  // Every doctor works at at least 1 random clinic
  for (const doc of doctors) {
    const randomClinic = clinics[Math.floor(Math.random() * clinics.length)];

    await prisma.membership.create({
      data: {
        doctorId: doc.id,
        clinicId: randomClinic.id,
        fee: 500 + Math.random() * 500,
        schedules: {
          create: {
            days: ['Sunday', 'Tuesday', 'Thursday'],
            startTime: '10:00 AM',
            endTime: '01:00 PM',
          },
        },
      },
    });
  }

  // Create a few random appointments
  for (let i = 0; i < 5; i++) {
    await prisma.appointment.create({
      data: {
        doctorId: doctors[i].id,
        patientId: patients[i].id,
        clinicId: clinics[0].id,
        status: AppointmentStatus.SCHEDULED,
        appointmentDate: new Date(),
      },
    });
  }

  console.log('✅ 10 Doctors, 5 Clinics, and 5 Patients seeded!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
