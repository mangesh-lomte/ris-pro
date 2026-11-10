-- CreateEnum
CREATE TYPE "SafetyStatus" AS ENUM ('NOT_STARTED', 'IN_REVIEW', 'CLEARED', 'REQUIRES_REVIEW', 'BLOCKED');

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'SAFETY_REVIEW';
ALTER TYPE "OrderStatus" ADD VALUE 'SAFETY_CLEARED';

-- CreateTable
CREATE TABLE "technologist_safety_screenings" (
    "id" TEXT NOT NULL,
    "imagingOrderId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "completedByUserId" TEXT NOT NULL,
    "modality" "ModalityType" NOT NULL,
    "identityVerified" BOOLEAN NOT NULL DEFAULT false,
    "identityVerificationMethod" TEXT,
    "identityVerifiedAt" TIMESTAMP(3),
    "safetyStatus" "SafetyStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "safetyNotes" TEXT,
    "answers" JSONB NOT NULL,
    "riskFactors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technologist_safety_screenings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "technologist_safety_screenings_imagingOrderId_key" ON "technologist_safety_screenings"("imagingOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "technologist_safety_screenings_appointmentId_key" ON "technologist_safety_screenings"("appointmentId");

-- CreateIndex
CREATE INDEX "technologist_safety_screenings_imagingOrderId_idx" ON "technologist_safety_screenings"("imagingOrderId");

-- CreateIndex
CREATE INDEX "technologist_safety_screenings_patientId_idx" ON "technologist_safety_screenings"("patientId");

-- CreateIndex
CREATE INDEX "technologist_safety_screenings_safetyStatus_idx" ON "technologist_safety_screenings"("safetyStatus");

-- AddForeignKey
ALTER TABLE "technologist_safety_screenings" ADD CONSTRAINT "technologist_safety_screenings_imagingOrderId_fkey" FOREIGN KEY ("imagingOrderId") REFERENCES "imaging_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technologist_safety_screenings" ADD CONSTRAINT "technologist_safety_screenings_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technologist_safety_screenings" ADD CONSTRAINT "technologist_safety_screenings_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technologist_safety_screenings" ADD CONSTRAINT "technologist_safety_screenings_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

