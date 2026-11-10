-- CreateEnum
CREATE TYPE "ImageQualityStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REPEAT_REQUIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ImageQualityReason" AS ENUM ('PATIENT_MOTION', 'POSITIONING', 'COVERAGE_INCOMPLETE', 'TECHNICAL_ARTIFACT', 'PROTOCOL_DEVIATION', 'OTHER');

-- CreateEnum
CREATE TYPE "PacsHandoffStatus" AS ENUM ('READY', 'PENDING', 'COMPLETE', 'FAILED');

-- CreateEnum
CREATE TYPE "PacsHandoffOutcome" AS ENUM ('SUCCESS', 'FAILURE');

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'IMAGE_QA_PENDING';
ALTER TYPE "OrderStatus" ADD VALUE 'IMAGE_ACCEPTED';
ALTER TYPE "OrderStatus" ADD VALUE 'REPEAT_REQUIRED';
ALTER TYPE "OrderStatus" ADD VALUE 'IMAGE_REJECTED';
ALTER TYPE "OrderStatus" ADD VALUE 'PACS_READY';
ALTER TYPE "OrderStatus" ADD VALUE 'PACS_HANDOFF_PENDING';
ALTER TYPE "OrderStatus" ADD VALUE 'PACS_HANDOFF_COMPLETE';
ALTER TYPE "OrderStatus" ADD VALUE 'PACS_HANDOFF_FAILED';

-- DropIndex
DROP INDEX "scan_lifecycles_imagingOrderId_key";

-- AlterTable
ALTER TABLE "scan_lifecycles" ADD COLUMN     "attemptNumber" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "image_quality_reviews" (
    "id" TEXT NOT NULL,
    "imagingOrderId" TEXT NOT NULL,
    "scanLifecycleId" TEXT NOT NULL,
    "status" "ImageQualityStatus" NOT NULL DEFAULT 'PENDING',
    "startedByUserId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reasonCode" "ImageQualityReason",
    "notes" TEXT,
    "repeatAuthorizedByUserId" TEXT,
    "repeatAuthorizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "image_quality_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pacs_handoffs" (
    "id" TEXT NOT NULL,
    "imagingOrderId" TEXT NOT NULL,
    "scanLifecycleId" TEXT NOT NULL,
    "imageQualityReviewId" TEXT NOT NULL,
    "status" "PacsHandoffStatus" NOT NULL DEFAULT 'READY',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "initiatedByUserId" TEXT,
    "initiatedAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pacs_handoffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pacs_handoff_attempts" (
    "id" TEXT NOT NULL,
    "pacsHandoffId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "outcome" "PacsHandoffOutcome" NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "initiatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pacs_handoff_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "image_quality_reviews_scanLifecycleId_key" ON "image_quality_reviews"("scanLifecycleId");

-- CreateIndex
CREATE INDEX "image_quality_reviews_imagingOrderId_idx" ON "image_quality_reviews"("imagingOrderId");

-- CreateIndex
CREATE INDEX "image_quality_reviews_scanLifecycleId_idx" ON "image_quality_reviews"("scanLifecycleId");

-- CreateIndex
CREATE INDEX "image_quality_reviews_status_idx" ON "image_quality_reviews"("status");

-- CreateIndex
CREATE INDEX "image_quality_reviews_startedAt_idx" ON "image_quality_reviews"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "pacs_handoffs_scanLifecycleId_key" ON "pacs_handoffs"("scanLifecycleId");

-- CreateIndex
CREATE UNIQUE INDEX "pacs_handoffs_imageQualityReviewId_key" ON "pacs_handoffs"("imageQualityReviewId");

-- CreateIndex
CREATE INDEX "pacs_handoffs_imagingOrderId_idx" ON "pacs_handoffs"("imagingOrderId");

-- CreateIndex
CREATE INDEX "pacs_handoffs_scanLifecycleId_idx" ON "pacs_handoffs"("scanLifecycleId");

-- CreateIndex
CREATE INDEX "pacs_handoffs_imageQualityReviewId_idx" ON "pacs_handoffs"("imageQualityReviewId");

-- CreateIndex
CREATE INDEX "pacs_handoffs_status_idx" ON "pacs_handoffs"("status");

-- CreateIndex
CREATE INDEX "pacs_handoff_attempts_pacsHandoffId_idx" ON "pacs_handoff_attempts"("pacsHandoffId");

-- CreateIndex
CREATE INDEX "pacs_handoff_attempts_outcome_idx" ON "pacs_handoff_attempts"("outcome");

-- CreateIndex
CREATE UNIQUE INDEX "pacs_handoff_attempts_pacsHandoffId_attemptNumber_key" ON "pacs_handoff_attempts"("pacsHandoffId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "scan_lifecycles_imagingOrderId_attemptNumber_key" ON "scan_lifecycles"("imagingOrderId", "attemptNumber");

-- AddForeignKey
ALTER TABLE "image_quality_reviews" ADD CONSTRAINT "image_quality_reviews_imagingOrderId_fkey" FOREIGN KEY ("imagingOrderId") REFERENCES "imaging_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_quality_reviews" ADD CONSTRAINT "image_quality_reviews_scanLifecycleId_fkey" FOREIGN KEY ("scanLifecycleId") REFERENCES "scan_lifecycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_quality_reviews" ADD CONSTRAINT "image_quality_reviews_startedByUserId_fkey" FOREIGN KEY ("startedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_quality_reviews" ADD CONSTRAINT "image_quality_reviews_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_quality_reviews" ADD CONSTRAINT "image_quality_reviews_repeatAuthorizedByUserId_fkey" FOREIGN KEY ("repeatAuthorizedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacs_handoffs" ADD CONSTRAINT "pacs_handoffs_imagingOrderId_fkey" FOREIGN KEY ("imagingOrderId") REFERENCES "imaging_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacs_handoffs" ADD CONSTRAINT "pacs_handoffs_scanLifecycleId_fkey" FOREIGN KEY ("scanLifecycleId") REFERENCES "scan_lifecycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacs_handoffs" ADD CONSTRAINT "pacs_handoffs_imageQualityReviewId_fkey" FOREIGN KEY ("imageQualityReviewId") REFERENCES "image_quality_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacs_handoffs" ADD CONSTRAINT "pacs_handoffs_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacs_handoff_attempts" ADD CONSTRAINT "pacs_handoff_attempts_pacsHandoffId_fkey" FOREIGN KEY ("pacsHandoffId") REFERENCES "pacs_handoffs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacs_handoff_attempts" ADD CONSTRAINT "pacs_handoff_attempts_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

