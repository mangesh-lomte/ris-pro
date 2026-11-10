-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'RECEPTION', 'TECHNOLOGIST', 'RADIOLOGIST');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'UNKNOWN', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'ARRIVED', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW', 'COMPLETED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('CREATED', 'SCHEDULED', 'ARRIVED', 'READY_FOR_TECH', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StudyStatus" AS ENUM ('PENDING', 'ACQUIRING', 'ACQUIRED', 'SENT_TO_PACS', 'READY_FOR_REPORTING', 'REPORTED');

-- CreateEnum
CREATE TYPE "PacsStatus" AS ENUM ('NOT_SENT', 'SENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'PRELIMINARY', 'FINAL', 'ADDENDUM');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('ROUTINE', 'URGENT', 'STAT');

-- CreateEnum
CREATE TYPE "ModalityType" AS ENUM ('CT', 'MRI', 'XRAY', 'ULTRASOUND', 'MAMMOGRAPHY');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'INSURANCE', 'ONLINE');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('AVAILABLE', 'OPERATIONAL', 'BUSY', 'MAINTENANCE', 'OUT_OF_SERVICE');

-- CreateEnum
CREATE TYPE "AuthorizationStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PayerType" AS ENUM ('SELF_PAY', 'INSURANCE', 'CORPORATE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL,
    "phone" TEXT NOT NULL,
    "alternatePhone" TEXT,
    "email" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "emergencyContactRelation" TEXT,
    "address" TEXT,
    "emergencyContact" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referring_doctors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "registrationNumber" TEXT,
    "providerIdentifier" TEXT,
    "npi" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referring_doctors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_definitions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "modality" "ModalityType" NOT NULL,
    "bodyPart" TEXT NOT NULL,
    "defaultDurationMinutes" INTEGER NOT NULL DEFAULT 30,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 5,
    "contrastSupported" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "modality" "ModalityType" NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'AVAILABLE',
    "location" TEXT NOT NULL,
    "lastMaintenanceDate" TIMESTAMP(3),
    "nextMaintenanceDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imaging_orders" (
    "id" TEXT NOT NULL,
    "accessionNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "modality" "ModalityType" NOT NULL,
    "bodyPart" TEXT NOT NULL,
    "examinationName" TEXT NOT NULL,
    "clinicalIndication" TEXT NOT NULL,
    "referringDoctorId" TEXT,
    "referringDoctorText" TEXT,
    "contrastRequired" BOOLEAN NOT NULL DEFAULT false,
    "priority" "Priority" NOT NULL DEFAULT 'ROUTINE',
    "orderStatus" "OrderStatus" NOT NULL DEFAULT 'CREATED',
    "payerType" "PayerType" DEFAULT 'SELF_PAY',
    "payerName" TEXT,
    "memberId" TEXT,
    "authorizationRequired" BOOLEAN NOT NULL DEFAULT false,
    "authorizationStatus" "AuthorizationStatus" DEFAULT 'NOT_REQUIRED',
    "authorizationCode" TEXT,
    "insuranceNotes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "imaging_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "appointmentNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "imagingOrderId" TEXT,
    "modality" "ModalityType" NOT NULL,
    "equipmentId" TEXT,
    "examDefinitionId" TEXT,
    "examination" TEXT NOT NULL,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "priority" "Priority" NOT NULL DEFAULT 'ROUTINE',
    "location" TEXT,
    "notes" TEXT,
    "cancellationReason" TEXT,
    "noShowReason" TEXT,
    "rescheduleReason" TEXT,
    "tokenNumber" TEXT,
    "checkedInAt" TIMESTAMP(3),
    "checkedInById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studies" (
    "id" TEXT NOT NULL,
    "studyInstanceUid" TEXT NOT NULL,
    "accessionNumber" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "studyDate" TIMESTAMP(3) NOT NULL,
    "studyStatus" "StudyStatus" NOT NULL DEFAULT 'PENDING',
    "pacsStatus" "PacsStatus" NOT NULL DEFAULT 'NOT_SENT',
    "instanceCount" INTEGER NOT NULL DEFAULT 0,
    "pacsTransferAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "radiologistId" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "findings" TEXT,
    "impression" TEXT,
    "isPreliminary" BOOLEAN NOT NULL DEFAULT true,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "orderId" TEXT,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balance" DOUBLE PRECISION NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'COMPLETED',
    "transactionRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "lotNumber" TEXT,
    "expiryDate" TIMESTAMP(3),
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,
    "reorderLevel" INTEGER NOT NULL DEFAULT 10,
    "costPerUnit" DOUBLE PRECISION,
    "location" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "patients_patientId_key" ON "patients"("patientId");

-- CreateIndex
CREATE INDEX "patients_lastName_firstName_idx" ON "patients"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "patients_phone_idx" ON "patients"("phone");

-- CreateIndex
CREATE INDEX "patients_patientId_idx" ON "patients"("patientId");

-- CreateIndex
CREATE INDEX "patients_dateOfBirth_idx" ON "patients"("dateOfBirth");

-- CreateIndex
CREATE INDEX "referring_doctors_name_idx" ON "referring_doctors"("name");

-- CreateIndex
CREATE UNIQUE INDEX "exam_definitions_code_key" ON "exam_definitions"("code");

-- CreateIndex
CREATE INDEX "exam_definitions_modality_idx" ON "exam_definitions"("modality");

-- CreateIndex
CREATE INDEX "exam_definitions_code_idx" ON "exam_definitions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_serialNumber_key" ON "equipment"("serialNumber");

-- CreateIndex
CREATE INDEX "equipment_modality_idx" ON "equipment"("modality");

-- CreateIndex
CREATE INDEX "equipment_status_idx" ON "equipment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "imaging_orders_accessionNumber_key" ON "imaging_orders"("accessionNumber");

-- CreateIndex
CREATE INDEX "imaging_orders_patientId_idx" ON "imaging_orders"("patientId");

-- CreateIndex
CREATE INDEX "imaging_orders_accessionNumber_idx" ON "imaging_orders"("accessionNumber");

-- CreateIndex
CREATE INDEX "imaging_orders_modality_idx" ON "imaging_orders"("modality");

-- CreateIndex
CREATE INDEX "imaging_orders_orderStatus_idx" ON "imaging_orders"("orderStatus");

-- CreateIndex
CREATE INDEX "imaging_orders_priority_idx" ON "imaging_orders"("priority");

-- CreateIndex
CREATE INDEX "imaging_orders_createdAt_idx" ON "imaging_orders"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_appointmentNumber_key" ON "appointments"("appointmentNumber");

-- CreateIndex
CREATE INDEX "appointments_patientId_idx" ON "appointments"("patientId");

-- CreateIndex
CREATE INDEX "appointments_imagingOrderId_idx" ON "appointments"("imagingOrderId");

-- CreateIndex
CREATE INDEX "appointments_equipmentId_idx" ON "appointments"("equipmentId");

-- CreateIndex
CREATE INDEX "appointments_scheduledStart_scheduledEnd_idx" ON "appointments"("scheduledStart", "scheduledEnd");

-- CreateIndex
CREATE INDEX "appointments_status_idx" ON "appointments"("status");

-- CreateIndex
CREATE INDEX "appointments_createdAt_idx" ON "appointments"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "studies_studyInstanceUid_key" ON "studies"("studyInstanceUid");

-- CreateIndex
CREATE UNIQUE INDEX "studies_orderId_key" ON "studies"("orderId");

-- CreateIndex
CREATE INDEX "studies_patientId_idx" ON "studies"("patientId");

-- CreateIndex
CREATE INDEX "studies_accessionNumber_idx" ON "studies"("accessionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "reports_studyId_key" ON "reports"("studyId");

-- CreateIndex
CREATE UNIQUE INDEX "reports_orderId_key" ON "reports"("orderId");

-- CreateIndex
CREATE INDEX "reports_radiologistId_idx" ON "reports"("radiologistId");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_orderId_key" ON "invoices"("orderId");

-- CreateIndex
CREATE INDEX "invoices_patientId_idx" ON "invoices"("patientId");

-- CreateIndex
CREATE INDEX "payments_invoiceId_idx" ON "payments"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_sku_key" ON "inventory_items"("sku");

-- CreateIndex
CREATE INDEX "inventory_items_category_idx" ON "inventory_items"("category");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- AddForeignKey
ALTER TABLE "imaging_orders" ADD CONSTRAINT "imaging_orders_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imaging_orders" ADD CONSTRAINT "imaging_orders_referringDoctorId_fkey" FOREIGN KEY ("referringDoctorId") REFERENCES "referring_doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imaging_orders" ADD CONSTRAINT "imaging_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_imagingOrderId_fkey" FOREIGN KEY ("imagingOrderId") REFERENCES "imaging_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_examDefinitionId_fkey" FOREIGN KEY ("examDefinitionId") REFERENCES "exam_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studies" ADD CONSTRAINT "studies_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "imaging_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studies" ADD CONSTRAINT "studies_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "studies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "imaging_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_radiologistId_fkey" FOREIGN KEY ("radiologistId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "imaging_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

