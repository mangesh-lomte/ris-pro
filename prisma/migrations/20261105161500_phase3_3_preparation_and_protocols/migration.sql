-- CreateEnum
CREATE TYPE "PreparationStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETE');

-- CreateEnum
CREATE TYPE "FastingStatus" AS ENUM ('NOT_REQUIRED', 'CONFIRMED', 'NOT_CONFIRMED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('NOT_REQUIRED', 'CONFIRMED', 'NOT_CONFIRMED');

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'PREPARATION_IN_PROGRESS';
ALTER TYPE "OrderStatus" ADD VALUE 'PREPARED';
ALTER TYPE "OrderStatus" ADD VALUE 'READY_FOR_SCAN';

-- AlterTable
ALTER TABLE "exam_definitions" ADD COLUMN     "additionalPreparationInstructions" TEXT,
ADD COLUMN     "consentRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "contrastPreparationRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fastingRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ivRequired" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "imaging_orders" ADD COLUMN     "confirmedProtocolId" TEXT,
ADD COLUMN     "protocolConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "protocolConfirmedById" TEXT;

-- CreateTable
CREATE TABLE "technologist_preparations" (
    "id" TEXT NOT NULL,
    "imagingOrderId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "completedByUserId" TEXT,
    "fastingRequired" BOOLEAN NOT NULL DEFAULT false,
    "fastingStatus" "FastingStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "ivRequired" BOOLEAN NOT NULL DEFAULT false,
    "ivReady" BOOLEAN NOT NULL DEFAULT false,
    "contrastPreparationRequired" BOOLEAN NOT NULL DEFAULT false,
    "contrastReady" BOOLEAN NOT NULL DEFAULT false,
    "consentRequired" BOOLEAN NOT NULL DEFAULT false,
    "consentStatus" "ConsentStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "additionalPreparationRequired" BOOLEAN NOT NULL DEFAULT false,
    "additionalPreparationComplete" BOOLEAN NOT NULL DEFAULT false,
    "additionalPreparationInstructions" TEXT,
    "preparationNotes" TEXT,
    "preparationStatus" "PreparationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "preparedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technologist_preparations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imaging_protocols" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "modality" "ModalityType" NOT NULL,
    "examDefinitionId" TEXT,
    "bodyPart" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "imaging_protocols_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "technologist_preparations_imagingOrderId_key" ON "technologist_preparations"("imagingOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "technologist_preparations_appointmentId_key" ON "technologist_preparations"("appointmentId");

-- CreateIndex
CREATE INDEX "technologist_preparations_imagingOrderId_idx" ON "technologist_preparations"("imagingOrderId");

-- CreateIndex
CREATE INDEX "technologist_preparations_patientId_idx" ON "technologist_preparations"("patientId");

-- CreateIndex
CREATE INDEX "technologist_preparations_preparationStatus_idx" ON "technologist_preparations"("preparationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "imaging_protocols_code_key" ON "imaging_protocols"("code");

-- CreateIndex
CREATE INDEX "imaging_protocols_modality_idx" ON "imaging_protocols"("modality");

-- CreateIndex
CREATE INDEX "imaging_protocols_code_idx" ON "imaging_protocols"("code");

-- CreateIndex
CREATE INDEX "imaging_protocols_isActive_idx" ON "imaging_protocols"("isActive");

-- CreateIndex
CREATE INDEX "imaging_orders_confirmedProtocolId_idx" ON "imaging_orders"("confirmedProtocolId");

-- AddForeignKey
ALTER TABLE "imaging_orders" ADD CONSTRAINT "imaging_orders_confirmedProtocolId_fkey" FOREIGN KEY ("confirmedProtocolId") REFERENCES "imaging_protocols"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imaging_orders" ADD CONSTRAINT "imaging_orders_protocolConfirmedById_fkey" FOREIGN KEY ("protocolConfirmedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technologist_preparations" ADD CONSTRAINT "technologist_preparations_imagingOrderId_fkey" FOREIGN KEY ("imagingOrderId") REFERENCES "imaging_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technologist_preparations" ADD CONSTRAINT "technologist_preparations_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technologist_preparations" ADD CONSTRAINT "technologist_preparations_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technologist_preparations" ADD CONSTRAINT "technologist_preparations_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imaging_protocols" ADD CONSTRAINT "imaging_protocols_examDefinitionId_fkey" FOREIGN KEY ("examDefinitionId") REFERENCES "exam_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

