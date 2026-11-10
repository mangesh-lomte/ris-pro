-- CreateEnum
CREATE TYPE "ContrastRoute" AS ENUM ('IV', 'ORAL', 'OTHER');

-- CreateEnum
CREATE TYPE "IncidentCategory" AS ENUM ('CONTRAST_REACTION', 'EXTRAVASATION', 'PATIENT_DISTRESS', 'PATIENT_REQUEST', 'EQUIPMENT_RELATED', 'WORKFLOW_EVENT', 'OTHER');

-- CreateEnum
CREATE TYPE "IncidentWorkflowAction" AS ENUM ('SCAN_INTERRUPTED', 'SCAN_STOPPED', 'CLINICIAN_NOTIFIED', 'PATIENT_MONITORED', 'OTHER');

-- CreateTable
CREATE TABLE "contrast_administrations" (
    "id" TEXT NOT NULL,
    "imagingOrderId" TEXT NOT NULL,
    "scanLifecycleId" TEXT,
    "contrastAgentName" TEXT NOT NULL,
    "concentration" TEXT,
    "volume" DECIMAL(8,2) NOT NULL,
    "volumeUnit" TEXT NOT NULL DEFAULT 'mL',
    "route" "ContrastRoute" NOT NULL DEFAULT 'IV',
    "routeNotes" TEXT,
    "batchLotNumber" TEXT,
    "expirationDate" TIMESTAMP(3),
    "administeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "administeredByUserId" TEXT NOT NULL,
    "administrationNotes" TEXT,
    "incidentOccurred" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contrast_administrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technologist_incidents" (
    "id" TEXT NOT NULL,
    "imagingOrderId" TEXT NOT NULL,
    "scanLifecycleId" TEXT,
    "contrastAdministrationId" TEXT,
    "category" "IncidentCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedByUserId" TEXT NOT NULL,
    "clinicianNotified" BOOLEAN NOT NULL DEFAULT false,
    "clinicianNotifiedAt" TIMESTAMP(3),
    "notificationNotes" TEXT,
    "workflowActionTaken" "IncidentWorkflowAction",
    "workflowActionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technologist_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contrast_administrations_imagingOrderId_idx" ON "contrast_administrations"("imagingOrderId");

-- CreateIndex
CREATE INDEX "contrast_administrations_scanLifecycleId_idx" ON "contrast_administrations"("scanLifecycleId");

-- CreateIndex
CREATE INDEX "contrast_administrations_administeredByUserId_idx" ON "contrast_administrations"("administeredByUserId");

-- CreateIndex
CREATE INDEX "contrast_administrations_administeredAt_idx" ON "contrast_administrations"("administeredAt");

-- CreateIndex
CREATE INDEX "technologist_incidents_imagingOrderId_idx" ON "technologist_incidents"("imagingOrderId");

-- CreateIndex
CREATE INDEX "technologist_incidents_scanLifecycleId_idx" ON "technologist_incidents"("scanLifecycleId");

-- CreateIndex
CREATE INDEX "technologist_incidents_contrastAdministrationId_idx" ON "technologist_incidents"("contrastAdministrationId");

-- CreateIndex
CREATE INDEX "technologist_incidents_recordedByUserId_idx" ON "technologist_incidents"("recordedByUserId");

-- CreateIndex
CREATE INDEX "technologist_incidents_category_idx" ON "technologist_incidents"("category");

-- CreateIndex
CREATE INDEX "technologist_incidents_recordedAt_idx" ON "technologist_incidents"("recordedAt");

-- AddForeignKey
ALTER TABLE "contrast_administrations" ADD CONSTRAINT "contrast_administrations_imagingOrderId_fkey" FOREIGN KEY ("imagingOrderId") REFERENCES "imaging_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrast_administrations" ADD CONSTRAINT "contrast_administrations_scanLifecycleId_fkey" FOREIGN KEY ("scanLifecycleId") REFERENCES "scan_lifecycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrast_administrations" ADD CONSTRAINT "contrast_administrations_administeredByUserId_fkey" FOREIGN KEY ("administeredByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technologist_incidents" ADD CONSTRAINT "technologist_incidents_imagingOrderId_fkey" FOREIGN KEY ("imagingOrderId") REFERENCES "imaging_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technologist_incidents" ADD CONSTRAINT "technologist_incidents_scanLifecycleId_fkey" FOREIGN KEY ("scanLifecycleId") REFERENCES "scan_lifecycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technologist_incidents" ADD CONSTRAINT "technologist_incidents_contrastAdministrationId_fkey" FOREIGN KEY ("contrastAdministrationId") REFERENCES "contrast_administrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technologist_incidents" ADD CONSTRAINT "technologist_incidents_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

