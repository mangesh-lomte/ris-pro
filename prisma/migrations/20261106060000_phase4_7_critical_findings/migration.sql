-- CreateEnum
CREATE TYPE "CriticalFindingStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED');

-- CreateTable
CREATE TABLE "critical_findings" (
    "id" TEXT NOT NULL,
    "imagingOrderId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "findingText" TEXT NOT NULL,
    "status" "CriticalFindingStatus" NOT NULL DEFAULT 'PENDING',
    "severity" TEXT NOT NULL DEFAULT 'CRITICAL',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedById" TEXT,
    "acknowledgmentNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "critical_findings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "critical_findings_imagingOrderId_idx" ON "critical_findings"("imagingOrderId");

-- CreateIndex
CREATE INDEX "critical_findings_recipientId_idx" ON "critical_findings"("recipientId");

-- CreateIndex
CREATE INDEX "critical_findings_createdById_idx" ON "critical_findings"("createdById");

-- CreateIndex
CREATE INDEX "critical_findings_status_idx" ON "critical_findings"("status");

-- AddForeignKey
ALTER TABLE "critical_findings" ADD CONSTRAINT "critical_findings_imagingOrderId_fkey" FOREIGN KEY ("imagingOrderId") REFERENCES "imaging_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "critical_findings" ADD CONSTRAINT "critical_findings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "critical_findings" ADD CONSTRAINT "critical_findings_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "critical_findings" ADD CONSTRAINT "critical_findings_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

