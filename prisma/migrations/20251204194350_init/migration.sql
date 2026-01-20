/*
  Warnings:

  - You are about to drop the column `date` on the `Appointment` table. All the data in the column will be lost.
  - You are about to drop the column `image` on the `Clinic` table. All the data in the column will be lost.
  - You are about to drop the column `street` on the `Clinic` table. All the data in the column will be lost.
  - You are about to drop the column `_search` on the `Doctor` table. All the data in the column will be lost.
  - You are about to drop the column `experience` on the `Doctor` table. All the data in the column will be lost.
  - You are about to drop the column `languages` on the `Doctor` table. All the data in the column will be lost.
  - You are about to drop the column `latitude` on the `Doctor` table. All the data in the column will be lost.
  - You are about to drop the column `longitude` on the `Doctor` table. All the data in the column will be lost.
  - You are about to drop the column `offlineFee` on the `Doctor` table. All the data in the column will be lost.
  - You are about to drop the column `phoneNumber` on the `Doctor` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `Doctor` table. All the data in the column will be lost.
  - You are about to drop the column `street` on the `Doctor` table. All the data in the column will be lost.
  - You are about to drop the column `zipCode` on the `Doctor` table. All the data in the column will be lost.
  - The `education` column on the `Doctor` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `street` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the column `zipCode` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the column `endDay` on the `Schedule` table. All the data in the column will be lost.
  - You are about to drop the column `endTime` on the `Schedule` table. All the data in the column will be lost.
  - You are about to drop the column `startDay` on the `Schedule` table. All the data in the column will be lost.
  - You are about to drop the column `startTime` on the `Schedule` table. All the data in the column will be lost.
  - You are about to drop the column `deactivatedAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `lastActiveAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `AccountDeactivation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Session` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[appointmentId]` on the table `Prescription` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[membershipId,schedule]` on the table `Schedule` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `appointmentDate` to the `Appointment` table without a default value. This is not possible if the table is not empty.
  - Made the column `country` on table `Clinic` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `fee` to the `ClinicMembership` table without a default value. This is not possible if the table is not empty.
  - Made the column `country` on table `Doctor` required. This step will fail if there are existing NULL values in that column.
  - Made the column `reviewsCount` on table `Doctor` required. This step will fail if there are existing NULL values in that column.
  - Made the column `country` on table `Patient` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `schedule` to the `Schedule` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Schedule` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Appointment_date_idx";

-- DropIndex
DROP INDEX "Appointment_doctorId_idx";

-- DropIndex
DROP INDEX "Appointment_patientId_idx";

-- DropIndex
DROP INDEX "Clinic_userId_idx";

-- DropIndex
DROP INDEX "ClinicReview_rating_idx";

-- DropIndex
DROP INDEX "Doctor__search_idx";

-- DropIndex
DROP INDEX "Doctor_averageRating_idx";

-- DropIndex
DROP INDEX "Doctor_city_averageRating_idx";

-- DropIndex
DROP INDEX "Doctor_city_department_idx";

-- DropIndex
DROP INDEX "Doctor_city_idx";

-- DropIndex
DROP INDEX "Doctor_city_specialization_idx";

-- DropIndex
DROP INDEX "Doctor_country_city_department_idx";

-- DropIndex
DROP INDEX "Doctor_department_averageRating_idx";

-- DropIndex
DROP INDEX "Doctor_department_idx";

-- DropIndex
DROP INDEX "Doctor_experience_idx";

-- DropIndex
DROP INDEX "Doctor_gender_idx";

-- DropIndex
DROP INDEX "Doctor_offlineFee_idx";

-- DropIndex
DROP INDEX "Doctor_specialization_idx";

-- DropIndex
DROP INDEX "DoctorReview_rating_idx";

-- DropIndex
DROP INDEX "FavoriteDoctor_doctorId_idx";

-- DropIndex
DROP INDEX "FavoriteDoctor_patientId_doctorId_key";

-- DropIndex
DROP INDEX "FavoriteDoctor_patientId_idx";

-- DropIndex
DROP INDEX "MedicalHistory_date_idx";

-- DropIndex
DROP INDEX "Patient_city_idx";

-- DropIndex
DROP INDEX "Patient_userId_idx";

-- DropIndex
DROP INDEX "Prescription_doctorId_idx";

-- DropIndex
DROP INDEX "Schedule_membershipId_startDay_idx";

-- DropIndex
DROP INDEX "Schedule_membershipId_startDay_key";

-- DropIndex
DROP INDEX "Schedule_startDay_idx";

-- DropIndex
DROP INDEX "User_createdAt_idx";

-- DropIndex
DROP INDEX "User_lastActiveAt_idx";

-- AlterTable
ALTER TABLE "Appointment" DROP COLUMN "date",
ADD COLUMN     "appointmentDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "fee" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Clinic" DROP COLUMN "image",
DROP COLUMN "street",
ADD COLUMN     "address" TEXT,
ADD COLUMN     "district" TEXT,
ALTER COLUMN "country" SET NOT NULL,
ALTER COLUMN "country" SET DEFAULT 'Bangladesh';

-- AlterTable
ALTER TABLE "ClinicMembership" ADD COLUMN     "fee" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "slotDuration" INTEGER NOT NULL DEFAULT 30,
ALTER COLUMN "isActive" SET DEFAULT true,
ALTER COLUMN "maxAppointments" SET DEFAULT 20;

-- AlterTable
ALTER TABLE "Doctor" DROP COLUMN "_search",
DROP COLUMN "experience",
DROP COLUMN "languages",
DROP COLUMN "latitude",
DROP COLUMN "longitude",
DROP COLUMN "offlineFee",
DROP COLUMN "phoneNumber",
DROP COLUMN "state",
DROP COLUMN "street",
DROP COLUMN "zipCode",
ADD COLUMN     "address" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "search_vector" tsvector,
DROP COLUMN "education",
ADD COLUMN     "education" JSONB,
ALTER COLUMN "country" SET NOT NULL,
ALTER COLUMN "country" SET DEFAULT 'Bangladesh',
ALTER COLUMN "reviewsCount" SET NOT NULL,
ALTER COLUMN "reviewsCount" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "Patient" DROP COLUMN "street",
DROP COLUMN "zipCode",
ADD COLUMN     "address" TEXT,
ADD COLUMN     "district" TEXT,
ALTER COLUMN "country" SET NOT NULL,
ALTER COLUMN "country" SET DEFAULT 'Bangladesh';

-- AlterTable
ALTER TABLE "Prescription" ADD COLUMN     "appointmentId" TEXT;

-- AlterTable
ALTER TABLE "Schedule" DROP COLUMN "endDay",
DROP COLUMN "endTime",
DROP COLUMN "startDay",
DROP COLUMN "startTime",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "schedule" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "deactivatedAt",
DROP COLUMN "lastActiveAt",
ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailVerificationExpires" TIMESTAMP(3),
ADD COLUMN     "emailVerificationToken" TEXT,
ADD COLUMN     "passwordResetExpires" TIMESTAMP(3),
ADD COLUMN     "passwordResetToken" TEXT;

-- DropTable
DROP TABLE "AccountDeactivation";

-- DropTable
DROP TABLE "Session";

-- CreateIndex
CREATE INDEX "Appointment_doctorId_appointmentDate_idx" ON "Appointment"("doctorId", "appointmentDate");

-- CreateIndex
CREATE INDEX "Appointment_patientId_appointmentDate_idx" ON "Appointment"("patientId", "appointmentDate");

-- CreateIndex
CREATE INDEX "Clinic_isActive_idx" ON "Clinic"("isActive");

-- CreateIndex
CREATE INDEX "ClinicMembership_doctorId_idx" ON "ClinicMembership"("doctorId");

-- CreateIndex
CREATE INDEX "Doctor_city_idx" ON "Doctor"("city");

-- CreateIndex
CREATE INDEX "Doctor_district_idx" ON "Doctor"("district");

-- CreateIndex
CREATE INDEX "Doctor_department_idx" ON "Doctor"("department");

-- CreateIndex
CREATE INDEX "Doctor_specialization_idx" ON "Doctor"("specialization");

-- CreateIndex
CREATE INDEX "Doctor_averageRating_idx" ON "Doctor"("averageRating" DESC);

-- CreateIndex
CREATE INDEX "Doctor_search_vector_idx" ON "Doctor" USING GIN ("search_vector");

-- CreateIndex
CREATE INDEX "Patient_phoneNumber_idx" ON "Patient"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Prescription_appointmentId_key" ON "Prescription"("appointmentId");

-- CreateIndex
CREATE INDEX "Schedule_membershipId_idx" ON "Schedule"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "Schedule_membershipId_schedule_key" ON "Schedule"("membershipId", "schedule");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clinic" ADD CONSTRAINT "Clinic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicMembership" ADD CONSTRAINT "ClinicMembership_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicMembership" ADD CONSTRAINT "ClinicMembership_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "ClinicMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalHistory" ADD CONSTRAINT "MedicalHistory_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorReview" ADD CONSTRAINT "DoctorReview_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorReview" ADD CONSTRAINT "DoctorReview_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicReview" ADD CONSTRAINT "ClinicReview_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicReview" ADD CONSTRAINT "ClinicReview_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteDoctor" ADD CONSTRAINT "FavoriteDoctor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteDoctor" ADD CONSTRAINT "FavoriteDoctor_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteDoctor" ADD CONSTRAINT "FavoriteDoctor_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
