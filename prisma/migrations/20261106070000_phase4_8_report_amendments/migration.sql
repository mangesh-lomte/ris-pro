-- CreateEnum
CREATE TYPE "ReportAmendmentType" AS ENUM ('CORRECTION', 'ADDENDUM');

-- CreateTable
CREATE TABLE "report_amendments" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "amendmentType" "ReportAmendmentType" NOT NULL,
    "reason" TEXT NOT NULL,
    "findings" TEXT,
    "impression" TEXT,
    "contentSnapshot" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_amendments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_amendments_reportId_idx" ON "report_amendments"("reportId");

-- CreateIndex
CREATE INDEX "report_amendments_createdById_idx" ON "report_amendments"("createdById");

-- CreateIndex
CREATE INDEX "report_amendments_amendmentType_idx" ON "report_amendments"("amendmentType");

-- CreateIndex
CREATE UNIQUE INDEX "report_amendments_reportId_versionNumber_key" ON "report_amendments"("reportId", "versionNumber");

-- AddForeignKey
ALTER TABLE "report_amendments" ADD CONSTRAINT "report_amendments_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_amendments" ADD CONSTRAINT "report_amendments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

