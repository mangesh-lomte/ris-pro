-- AlterTable
ALTER TABLE "patients" ADD COLUMN "isMerged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "mergedIntoId" TEXT,
ADD COLUMN "mergedAt" TIMESTAMP(3),
ADD COLUMN "mergedById" TEXT;

-- AlterTable
ALTER TABLE "reporting_templates" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';

-- CreateTable
CREATE TABLE "patient_merge_records" (
    "id" TEXT NOT NULL,
    "sourcePatientId" TEXT NOT NULL,
    "sourceMrn" TEXT NOT NULL,
    "targetPatientId" TEXT NOT NULL,
    "targetMrn" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reassignedCounts" JSONB NOT NULL,
    "performedById" TEXT NOT NULL,
    "performedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_merge_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_retention_rules" (
    "id" TEXT NOT NULL,
    "dataCategory" TEXT NOT NULL,
    "policyName" TEXT NOT NULL,
    "retentionYears" INTEGER NOT NULL,
    "description" TEXT,
    "legalBasis" TEXT,
    "actionOnExpiry" TEXT NOT NULL DEFAULT 'REVIEW_REQUIRED',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_retention_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_records" (
    "id" TEXT NOT NULL,
    "backupType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "filePath" TEXT,
    "sizeBytes" BIGINT,
    "checksumSha256" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verificationDetails" JSONB,
    "errorMessage" TEXT,
    "triggeredById" TEXT,
    "triggeredByName" TEXT,

    CONSTRAINT "backup_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disaster_recovery_drills" (
    "id" TEXT NOT NULL,
    "drillName" TEXT NOT NULL,
    "drillType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationSec" INTEGER NOT NULL,
    "backupRecordId" TEXT,
    "recoveryTarget" TEXT NOT NULL,
    "findings" TEXT NOT NULL,
    "signedOffById" TEXT NOT NULL,
    "signedOffByName" TEXT NOT NULL,

    CONSTRAINT "disaster_recovery_drills_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patients_isMerged_idx" ON "patients"("isMerged");

-- CreateIndex
CREATE INDEX "patient_merge_records_sourceMrn_idx" ON "patient_merge_records"("sourceMrn");

-- CreateIndex
CREATE INDEX "patient_merge_records_targetMrn_idx" ON "patient_merge_records"("targetMrn");

-- CreateIndex
CREATE UNIQUE INDEX "data_retention_rules_dataCategory_key" ON "data_retention_rules"("dataCategory");

-- CreateIndex
CREATE INDEX "backup_records_status_idx" ON "backup_records"("status");

-- CreateIndex
CREATE INDEX "backup_records_startedAt_idx" ON "backup_records"("startedAt");

-- CreateIndex
CREATE INDEX "disaster_recovery_drills_executedAt_idx" ON "disaster_recovery_drills"("executedAt");

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

