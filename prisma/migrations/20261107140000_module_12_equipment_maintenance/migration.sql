-- AlterEnum UserRole
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ENGINEER';

-- AlterEnum EquipmentStatus
ALTER TYPE "EquipmentStatus" ADD VALUE IF NOT EXISTS 'UNDER_PM';

-- AlterTable equipment
ALTER TABLE "equipment"
ADD COLUMN IF NOT EXISTS "assetTag" TEXT,
ADD COLUMN IF NOT EXISTS "assetCategory" TEXT NOT NULL DEFAULT 'SCANNER',
ADD COLUMN IF NOT EXISTS "roomNumber" TEXT,
ADD COLUMN IF NOT EXISTS "department" TEXT DEFAULT 'Radiology',
ADD COLUMN IF NOT EXISTS "installationDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "warrantyExpiryDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "powerRatingKva" DECIMAL(8,2),
ADD COLUMN IF NOT EXISTS "operatingTempMin" DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS "operatingTempMax" DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS "notes" TEXT,
ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS "equipment_assetTag_key" ON "equipment"("assetTag");
CREATE INDEX IF NOT EXISTS "equipment_assetCategory_idx" ON "equipment"("assetCategory");

-- CreateTable maintenance_schedules
CREATE TABLE IF NOT EXISTS "maintenance_schedules" (
    "id" TEXT NOT NULL,
    "scheduleNumber" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "maintenanceType" TEXT NOT NULL DEFAULT 'PREVENTIVE_MAINTENANCE',
    "frequency" TEXT NOT NULL DEFAULT 'QUARTERLY',
    "intervalDays" INTEGER NOT NULL DEFAULT 90,
    "contractType" TEXT DEFAULT 'AMC',
    "contractId" TEXT,
    "lastCompletedDate" TIMESTAMP(3),
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "nextDueDate" TIMESTAMP(3) NOT NULL,
    "assignedEngineer" TEXT,
    "vendorName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "checklistTemplateId" TEXT,
    "completedChecklist" JSONB,
    "completedById" TEXT,
    "completedByName" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable pm_checklist_templates
CREATE TABLE IF NOT EXISTS "pm_checklist_templates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "modality" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "oemManufacturer" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "sections" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pm_checklist_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable equipment_qc_checks
CREATE TABLE IF NOT EXISTS "equipment_qc_checks" (
    "id" TEXT NOT NULL,
    "checkNumber" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'DAILY',
    "checkDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performedById" TEXT NOT NULL,
    "performedByName" TEXT NOT NULL,
    "performedByRole" TEXT NOT NULL DEFAULT 'TECHNOLOGIST',
    "overallResult" TEXT NOT NULL DEFAULT 'PASS',
    "temperatureC" DECIMAL(5,2),
    "humidityPercent" DECIMAL(5,2),
    "chillerTempC" DECIMAL(5,2),
    "heliumLevelPercent" DECIMAL(5,2),
    "ctNumberWaterHu" DECIMAL(6,2),
    "noiseVariance" DECIMAL(6,3),
    "checklistData" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_qc_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable service_tickets
CREATE TABLE IF NOT EXISTS "service_tickets" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "errorCodes" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reportedById" TEXT NOT NULL,
    "reportedByName" TEXT NOT NULL,
    "assignedEngineer" TEXT,
    "vendorName" TEXT,
    "isDowntimeCaused" BOOLEAN NOT NULL DEFAULT false,
    "downtimeId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "rootCause" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable equipment_downtimes
CREATE TABLE IF NOT EXISTS "equipment_downtimes" (
    "id" TEXT NOT NULL,
    "downtimeNumber" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "serviceTicketId" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "causeCategory" TEXT NOT NULL DEFAULT 'HARDWARE_FAILURE',
    "cause" TEXT NOT NULL,
    "impactLevel" TEXT NOT NULL DEFAULT 'FULL_STOP',
    "affectedAppointmentsCount" INTEGER NOT NULL DEFAULT 0,
    "affectedAppointmentIds" JSONB,
    "rescheduledCount" INTEGER NOT NULL DEFAULT 0,
    "resolutionSummary" TEXT,
    "recordedById" TEXT NOT NULL,
    "recordedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_downtimes_pkey" PRIMARY KEY ("id")
);

-- CreateTable maintenance_part_usages
CREATE TABLE IF NOT EXISTS "maintenance_part_usages" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "serviceTicketId" TEXT,
    "pmScheduleId" TEXT,
    "inventoryItemId" TEXT NOT NULL,
    "batchId" TEXT,
    "stockTransactionId" TEXT,
    "location" TEXT NOT NULL DEFAULT 'GENERAL_STORE',
    "quantityUsed" INTEGER NOT NULL DEFAULT 1,
    "unitCost" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "totalCost" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "reason" TEXT NOT NULL,
    "installedById" TEXT NOT NULL,
    "installedByName" TEXT NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_part_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable service_records
CREATE TABLE IF NOT EXISTS "service_records" (
    "id" TEXT NOT NULL,
    "recordNumber" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL DEFAULT 'PREVENTIVE_MAINTENANCE',
    "serviceDate" TIMESTAMP(3) NOT NULL,
    "serviceProvider" TEXT NOT NULL,
    "engineerName" TEXT NOT NULL,
    "engineerContact" TEXT,
    "workDescription" TEXT NOT NULL,
    "partsReplaced" TEXT,
    "findingsAndRecommendations" TEXT,
    "statusBefore" "EquipmentStatus" NOT NULL DEFAULT 'OUT_OF_SERVICE',
    "statusAfter" "EquipmentStatus" NOT NULL DEFAULT 'AVAILABLE',
    "customerSignOffBy" TEXT,
    "serviceReportUrl" TEXT,
    "cost" DECIMAL(10,2),
    "serviceTicketId" TEXT,
    "pmScheduleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable calibration_certificates
CREATE TABLE IF NOT EXISTS "calibration_certificates" (
    "id" TEXT NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "certificationType" TEXT NOT NULL,
    "issuingAuthority" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'VALID',
    "documentReference" TEXT,
    "measuredValues" JSONB,
    "passed" BOOLEAN NOT NULL DEFAULT true,
    "certifiedByName" TEXT NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calibration_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable maintenance_contracts
CREATE TABLE IF NOT EXISTS "maintenance_contracts" (
    "id" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "contractType" TEXT NOT NULL DEFAULT 'AMC_COMPREHENSIVE',
    "vendorName" TEXT NOT NULL,
    "vendorContact" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "coverageDetails" TEXT NOT NULL,
    "annualCost" DECIMAL(10,2),
    "responseSlaHours" INTEGER NOT NULL DEFAULT 4,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "contactPerson" TEXT,
    "escalationContact" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable service_contacts
CREATE TABLE IF NOT EXISTS "service_contacts" (
    "id" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "emergencyPhone" TEXT,
    "escalationLevel" INTEGER NOT NULL DEFAULT 1,
    "equipmentSpecialty" TEXT,
    "vendorAddress" TEXT,
    "equipmentIds" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_contacts_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "maintenance_schedules_scheduleNumber_key" ON "maintenance_schedules"("scheduleNumber");
CREATE INDEX IF NOT EXISTS "maintenance_schedules_equipmentId_idx" ON "maintenance_schedules"("equipmentId");
CREATE INDEX IF NOT EXISTS "maintenance_schedules_scheduledDate_idx" ON "maintenance_schedules"("scheduledDate");
CREATE INDEX IF NOT EXISTS "maintenance_schedules_nextDueDate_idx" ON "maintenance_schedules"("nextDueDate");
CREATE INDEX IF NOT EXISTS "maintenance_schedules_status_idx" ON "maintenance_schedules"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "pm_checklist_templates_code_key" ON "pm_checklist_templates"("code");
CREATE INDEX IF NOT EXISTS "pm_checklist_templates_modality_idx" ON "pm_checklist_templates"("modality");
CREATE INDEX IF NOT EXISTS "pm_checklist_templates_frequency_idx" ON "pm_checklist_templates"("frequency");

CREATE UNIQUE INDEX IF NOT EXISTS "equipment_qc_checks_checkNumber_key" ON "equipment_qc_checks"("checkNumber");
CREATE INDEX IF NOT EXISTS "equipment_qc_checks_equipmentId_idx" ON "equipment_qc_checks"("equipmentId");
CREATE INDEX IF NOT EXISTS "equipment_qc_checks_checkDate_idx" ON "equipment_qc_checks"("checkDate");
CREATE INDEX IF NOT EXISTS "equipment_qc_checks_overallResult_idx" ON "equipment_qc_checks"("overallResult");

CREATE UNIQUE INDEX IF NOT EXISTS "service_tickets_ticketNumber_key" ON "service_tickets"("ticketNumber");
CREATE INDEX IF NOT EXISTS "service_tickets_equipmentId_idx" ON "service_tickets"("equipmentId");
CREATE INDEX IF NOT EXISTS "service_tickets_status_idx" ON "service_tickets"("status");
CREATE INDEX IF NOT EXISTS "service_tickets_priority_idx" ON "service_tickets"("priority");
CREATE INDEX IF NOT EXISTS "service_tickets_openedAt_idx" ON "service_tickets"("openedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "equipment_downtimes_downtimeNumber_key" ON "equipment_downtimes"("downtimeNumber");
CREATE INDEX IF NOT EXISTS "equipment_downtimes_equipmentId_idx" ON "equipment_downtimes"("equipmentId");
CREATE INDEX IF NOT EXISTS "equipment_downtimes_startTime_idx" ON "equipment_downtimes"("startTime");
CREATE INDEX IF NOT EXISTS "equipment_downtimes_causeCategory_idx" ON "equipment_downtimes"("causeCategory");

CREATE INDEX IF NOT EXISTS "maintenance_part_usages_equipmentId_idx" ON "maintenance_part_usages"("equipmentId");
CREATE INDEX IF NOT EXISTS "maintenance_part_usages_inventoryItemId_idx" ON "maintenance_part_usages"("inventoryItemId");
CREATE INDEX IF NOT EXISTS "maintenance_part_usages_serviceTicketId_idx" ON "maintenance_part_usages"("serviceTicketId");
CREATE INDEX IF NOT EXISTS "maintenance_part_usages_pmScheduleId_idx" ON "maintenance_part_usages"("pmScheduleId");

CREATE UNIQUE INDEX IF NOT EXISTS "service_records_recordNumber_key" ON "service_records"("recordNumber");
CREATE INDEX IF NOT EXISTS "service_records_equipmentId_idx" ON "service_records"("equipmentId");
CREATE INDEX IF NOT EXISTS "service_records_serviceDate_idx" ON "service_records"("serviceDate");
CREATE INDEX IF NOT EXISTS "service_records_serviceType_idx" ON "service_records"("serviceType");

CREATE UNIQUE INDEX IF NOT EXISTS "calibration_certificates_certificateNumber_key" ON "calibration_certificates"("certificateNumber");
CREATE INDEX IF NOT EXISTS "calibration_certificates_equipmentId_idx" ON "calibration_certificates"("equipmentId");
CREATE INDEX IF NOT EXISTS "calibration_certificates_expiryDate_idx" ON "calibration_certificates"("expiryDate");
CREATE INDEX IF NOT EXISTS "calibration_certificates_status_idx" ON "calibration_certificates"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "maintenance_contracts_contractNumber_key" ON "maintenance_contracts"("contractNumber");
CREATE INDEX IF NOT EXISTS "maintenance_contracts_equipmentId_idx" ON "maintenance_contracts"("equipmentId");
CREATE INDEX IF NOT EXISTS "maintenance_contracts_endDate_idx" ON "maintenance_contracts"("endDate");
CREATE INDEX IF NOT EXISTS "maintenance_contracts_status_idx" ON "maintenance_contracts"("status");

CREATE INDEX IF NOT EXISTS "service_contacts_vendorName_idx" ON "service_contacts"("vendorName");
CREATE INDEX IF NOT EXISTS "service_contacts_role_idx" ON "service_contacts"("role");

-- Foreign Keys
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "maintenance_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_checklistTemplateId_fkey" FOREIGN KEY ("checklistTemplateId") REFERENCES "pm_checklist_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "equipment_qc_checks" ADD CONSTRAINT "equipment_qc_checks_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "equipment_downtimes" ADD CONSTRAINT "equipment_downtimes_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "equipment_downtimes" ADD CONSTRAINT "equipment_downtimes_serviceTicketId_fkey" FOREIGN KEY ("serviceTicketId") REFERENCES "service_tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "maintenance_part_usages" ADD CONSTRAINT "maintenance_part_usages_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "maintenance_part_usages" ADD CONSTRAINT "maintenance_part_usages_serviceTicketId_fkey" FOREIGN KEY ("serviceTicketId") REFERENCES "service_tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "maintenance_part_usages" ADD CONSTRAINT "maintenance_part_usages_pmScheduleId_fkey" FOREIGN KEY ("pmScheduleId") REFERENCES "maintenance_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "maintenance_part_usages" ADD CONSTRAINT "maintenance_part_usages_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "maintenance_part_usages" ADD CONSTRAINT "maintenance_part_usages_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "maintenance_part_usages" ADD CONSTRAINT "maintenance_part_usages_stockTransactionId_fkey" FOREIGN KEY ("stockTransactionId") REFERENCES "stock_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "service_records" ADD CONSTRAINT "service_records_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_records" ADD CONSTRAINT "service_records_serviceTicketId_fkey" FOREIGN KEY ("serviceTicketId") REFERENCES "service_tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_records" ADD CONSTRAINT "service_records_pmScheduleId_fkey" FOREIGN KEY ("pmScheduleId") REFERENCES "maintenance_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "calibration_certificates" ADD CONSTRAINT "calibration_certificates_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "maintenance_contracts" ADD CONSTRAINT "maintenance_contracts_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

