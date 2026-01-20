-- CreateEnum
CREATE TYPE "WeekDay" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CLINIC', 'DOCTOR', 'PATIENT');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'PENDING', 'RESCHEDULED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "password" TEXT NOT NULL,
    "refreshToken" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'PATIENT',
    "lastActiveAt" TIMESTAMP(3),
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Doctor" (
    "id" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "bio" TEXT,
    "experience" INTEGER,
    "specialization" TEXT,
    "gender" "Gender",
    "languages" TEXT,
    "education" TEXT,
    "phoneNumber" TEXT,
    "offlineFee" INTEGER,
    "street" TEXT,
    "state" TEXT,
    "city" TEXT,
    "country" TEXT,
    "zipCode" TEXT,
    "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "reviewsCount" INTEGER,
    "userId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "_search" tsvector,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Doctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FavoriteDoctor" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteDoctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "age" INTEGER,
    "gender" "Gender" NOT NULL DEFAULT 'MALE',
    "bloodGroup" TEXT,
    "phoneNumber" TEXT,
    "street" TEXT,
    "city" TEXT,
    "country" TEXT,
    "zipCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clinic" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "image" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "openingHour" TEXT,
    "establishedYear" INTEGER,
    "street" TEXT,
    "city" TEXT,
    "country" TEXT,
    "zipCode" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Clinic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicMembership" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "maxAppointments" INTEGER NOT NULL DEFAULT 0,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "startDay" "WeekDay" NOT NULL,
    "endDay" "WeekDay" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prescription" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalHistory" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" DATE NOT NULL,
    "document" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorReview" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 1,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicReview" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 1,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "User_lastActiveAt_idx" ON "User"("lastActiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_userId_key" ON "Doctor"("userId");

-- CreateIndex
CREATE INDEX "Doctor_department_idx" ON "Doctor" USING HASH ("department");

-- CreateIndex
CREATE INDEX "Doctor_specialization_idx" ON "Doctor" USING HASH ("specialization");

-- CreateIndex
CREATE INDEX "Doctor_city_idx" ON "Doctor" USING HASH ("city");

-- CreateIndex
CREATE INDEX "Doctor_gender_idx" ON "Doctor" USING HASH ("gender");

-- CreateIndex
CREATE INDEX "Doctor_averageRating_idx" ON "Doctor"("averageRating");

-- CreateIndex
CREATE INDEX "Doctor_experience_idx" ON "Doctor"("experience");

-- CreateIndex
CREATE INDEX "Doctor_offlineFee_idx" ON "Doctor"("offlineFee");

-- CreateIndex
CREATE INDEX "Doctor_city_department_idx" ON "Doctor"("city", "department");

-- CreateIndex
CREATE INDEX "Doctor_city_specialization_idx" ON "Doctor"("city", "specialization");

-- CreateIndex
CREATE INDEX "Doctor_department_averageRating_idx" ON "Doctor"("department", "averageRating");

-- CreateIndex
CREATE INDEX "Doctor_city_averageRating_idx" ON "Doctor"("city", "averageRating");

-- CreateIndex
CREATE INDEX "Doctor_country_city_department_idx" ON "Doctor"("country", "city", "department");

-- CreateIndex
CREATE INDEX "Doctor__search_idx" ON "Doctor" USING GIN ("_search");

-- CreateIndex
CREATE INDEX "FavoriteDoctor_doctorId_idx" ON "FavoriteDoctor"("doctorId");

-- CreateIndex
CREATE INDEX "FavoriteDoctor_patientId_idx" ON "FavoriteDoctor"("patientId");

-- CreateIndex
CREATE INDEX "FavoriteDoctor_userId_idx" ON "FavoriteDoctor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteDoctor_patientId_doctorId_key" ON "FavoriteDoctor"("patientId", "doctorId");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteDoctor_userId_doctorId_key" ON "FavoriteDoctor"("userId", "doctorId");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_userId_key" ON "Patient"("userId");

-- CreateIndex
CREATE INDEX "Patient_userId_idx" ON "Patient"("userId");

-- CreateIndex
CREATE INDEX "Patient_city_idx" ON "Patient"("city");

-- CreateIndex
CREATE UNIQUE INDEX "Clinic_userId_key" ON "Clinic"("userId");

-- CreateIndex
CREATE INDEX "Clinic_userId_idx" ON "Clinic"("userId");

-- CreateIndex
CREATE INDEX "Clinic_city_idx" ON "Clinic"("city");

-- CreateIndex
CREATE INDEX "ClinicMembership_clinicId_idx" ON "ClinicMembership"("clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicMembership_doctorId_clinicId_key" ON "ClinicMembership"("doctorId", "clinicId");

-- CreateIndex
CREATE INDEX "Schedule_membershipId_startDay_idx" ON "Schedule"("membershipId", "startDay");

-- CreateIndex
CREATE INDEX "Schedule_startDay_idx" ON "Schedule"("startDay");

-- CreateIndex
CREATE UNIQUE INDEX "Schedule_membershipId_startDay_key" ON "Schedule"("membershipId", "startDay");

-- CreateIndex
CREATE INDEX "Appointment_doctorId_idx" ON "Appointment"("doctorId");

-- CreateIndex
CREATE INDEX "Appointment_patientId_idx" ON "Appointment"("patientId");

-- CreateIndex
CREATE INDEX "Appointment_clinicId_idx" ON "Appointment"("clinicId");

-- CreateIndex
CREATE INDEX "Appointment_date_idx" ON "Appointment"("date");

-- CreateIndex
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");

-- CreateIndex
CREATE INDEX "Prescription_doctorId_idx" ON "Prescription"("doctorId");

-- CreateIndex
CREATE INDEX "Prescription_patientId_idx" ON "Prescription"("patientId");

-- CreateIndex
CREATE INDEX "MedicalHistory_patientId_idx" ON "MedicalHistory"("patientId");

-- CreateIndex
CREATE INDEX "MedicalHistory_date_idx" ON "MedicalHistory"("date");

-- CreateIndex
CREATE INDEX "DoctorReview_doctorId_idx" ON "DoctorReview"("doctorId");

-- CreateIndex
CREATE INDEX "DoctorReview_rating_idx" ON "DoctorReview"("rating");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorReview_patientId_doctorId_key" ON "DoctorReview"("patientId", "doctorId");

-- CreateIndex
CREATE INDEX "ClinicReview_clinicId_idx" ON "ClinicReview"("clinicId");

-- CreateIndex
CREATE INDEX "ClinicReview_rating_idx" ON "ClinicReview"("rating");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicReview_patientId_clinicId_key" ON "ClinicReview"("patientId", "clinicId");
