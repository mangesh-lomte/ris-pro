-- CreateTable
CREATE TABLE "external_shares" (
    "id" TEXT NOT NULL,
    "shareNumber" TEXT NOT NULL,
    "shareToken" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "reportId" TEXT,
    "pacsStudyLinkId" TEXT,
    "studyInstanceUid" TEXT,
    "accessionNumber" TEXT NOT NULL,
    "patientMrn" TEXT NOT NULL,
    "shareType" TEXT NOT NULL DEFAULT 'PATIENT_LINK',
    "recipientName" TEXT NOT NULL,
    "recipientEmail" TEXT,
    "recipientPhone" TEXT,
    "recipientRole" TEXT NOT NULL DEFAULT 'PATIENT',
    "institutionName" TEXT,
    "includeDicom" BOOLEAN NOT NULL DEFAULT true,
    "includeReportPdf" BOOLEAN NOT NULL DEFAULT true,
    "includeWebViewer" BOOLEAN NOT NULL DEFAULT true,
    "requiresOtp" BOOLEAN NOT NULL DEFAULT true,
    "otpCode" TEXT,
    "otpExpiresAt" TIMESTAMP(3),
    "otpVerified" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "revokeReason" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_consents" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "consentedBy" TEXT NOT NULL,
    "consentedByRelation" TEXT NOT NULL DEFAULT 'SELF',
    "consentMethod" TEXT NOT NULL DEFAULT 'DIGITAL_SIGNATURE',
    "consentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "share_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "large_file_transfers" (
    "id" TEXT NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "shareId" TEXT,
    "orderId" TEXT NOT NULL,
    "studyInstanceUid" TEXT NOT NULL,
    "accessionNumber" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "packageType" TEXT NOT NULL DEFAULT 'DICOM_ZIP',
    "totalFiles" INTEGER NOT NULL DEFAULT 1,
    "totalBytes" BIGINT,
    "transferredBytes" BIGINT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "errorMessage" TEXT,
    "downloadUrl" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "large_file_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outside_study_imports" (
    "id" TEXT NOT NULL,
    "importNumber" TEXT NOT NULL,
    "sourceInstitution" TEXT NOT NULL,
    "modality" "ModalityType" NOT NULL,
    "studyDate" TIMESTAMP(3),
    "studyDescription" TEXT,
    "patientNameRaw" TEXT NOT NULL,
    "patientIdRaw" TEXT,
    "patientDobRaw" TIMESTAMP(3),
    "patientGenderRaw" TEXT,
    "accessionRaw" TEXT,
    "studyInstanceUid" TEXT NOT NULL,
    "numberOfInstances" INTEGER NOT NULL DEFAULT 0,
    "fileSize" BIGINT,
    "storagePath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "matchedPatientId" TEXT,
    "matchedOrderId" TEXT,
    "reconciliationNotes" TEXT,
    "reconciledById" TEXT,
    "reconciledAt" TIMESTAMP(3),
    "importedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outside_study_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_access_logs" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "external_shares_shareNumber_key" ON "external_shares"("shareNumber");

-- CreateIndex
CREATE UNIQUE INDEX "external_shares_shareToken_key" ON "external_shares"("shareToken");

-- CreateIndex
CREATE INDEX "external_shares_orderId_idx" ON "external_shares"("orderId");

-- CreateIndex
CREATE INDEX "external_shares_patientId_idx" ON "external_shares"("patientId");

-- CreateIndex
CREATE INDEX "external_shares_shareToken_idx" ON "external_shares"("shareToken");

-- CreateIndex
CREATE INDEX "external_shares_status_idx" ON "external_shares"("status");

-- CreateIndex
CREATE INDEX "external_shares_expiresAt_idx" ON "external_shares"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "share_consents_shareId_key" ON "share_consents"("shareId");

-- CreateIndex
CREATE INDEX "share_consents_patientId_idx" ON "share_consents"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "large_file_transfers_transferNumber_key" ON "large_file_transfers"("transferNumber");

-- CreateIndex
CREATE INDEX "large_file_transfers_orderId_idx" ON "large_file_transfers"("orderId");

-- CreateIndex
CREATE INDEX "large_file_transfers_status_idx" ON "large_file_transfers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "outside_study_imports_importNumber_key" ON "outside_study_imports"("importNumber");

-- CreateIndex
CREATE UNIQUE INDEX "outside_study_imports_studyInstanceUid_key" ON "outside_study_imports"("studyInstanceUid");

-- CreateIndex
CREATE INDEX "outside_study_imports_studyInstanceUid_idx" ON "outside_study_imports"("studyInstanceUid");

-- CreateIndex
CREATE INDEX "outside_study_imports_status_idx" ON "outside_study_imports"("status");

-- CreateIndex
CREATE INDEX "outside_study_imports_matchedPatientId_idx" ON "outside_study_imports"("matchedPatientId");

-- CreateIndex
CREATE INDEX "share_access_logs_shareId_idx" ON "share_access_logs"("shareId");

-- AddForeignKey
ALTER TABLE "external_shares" ADD CONSTRAINT "external_shares_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "imaging_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_shares" ADD CONSTRAINT "external_shares_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_shares" ADD CONSTRAINT "external_shares_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_shares" ADD CONSTRAINT "external_shares_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_consents" ADD CONSTRAINT "share_consents_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "external_shares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_consents" ADD CONSTRAINT "share_consents_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "large_file_transfers" ADD CONSTRAINT "large_file_transfers_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "external_shares"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "large_file_transfers" ADD CONSTRAINT "large_file_transfers_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "imaging_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "large_file_transfers" ADD CONSTRAINT "large_file_transfers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outside_study_imports" ADD CONSTRAINT "outside_study_imports_matchedPatientId_fkey" FOREIGN KEY ("matchedPatientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outside_study_imports" ADD CONSTRAINT "outside_study_imports_matchedOrderId_fkey" FOREIGN KEY ("matchedOrderId") REFERENCES "imaging_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outside_study_imports" ADD CONSTRAINT "outside_study_imports_reconciledById_fkey" FOREIGN KEY ("reconciledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outside_study_imports" ADD CONSTRAINT "outside_study_imports_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_access_logs" ADD CONSTRAINT "share_access_logs_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "external_shares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

