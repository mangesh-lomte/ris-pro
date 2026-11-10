-- CreateTable
CREATE TABLE "reporting_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "modality" "ModalityType" NOT NULL,
    "bodyPart" TEXT NOT NULL,
    "description" TEXT,
    "sections" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reporting_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_drafts" (
    "id" TEXT NOT NULL,
    "imagingOrderId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "templateId" TEXT,
    "templateName" TEXT,
    "content" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastAutosavedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reporting_templates_modality_bodyPart_idx" ON "reporting_templates"("modality", "bodyPart");

-- CreateIndex
CREATE UNIQUE INDEX "report_drafts_imagingOrderId_key" ON "report_drafts"("imagingOrderId");

-- CreateIndex
CREATE INDEX "report_drafts_imagingOrderId_idx" ON "report_drafts"("imagingOrderId");

-- CreateIndex
CREATE INDEX "report_drafts_authorId_idx" ON "report_drafts"("authorId");

-- AddForeignKey
ALTER TABLE "report_drafts" ADD CONSTRAINT "report_drafts_imagingOrderId_fkey" FOREIGN KEY ("imagingOrderId") REFERENCES "imaging_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_drafts" ADD CONSTRAINT "report_drafts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_drafts" ADD CONSTRAINT "report_drafts_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "reporting_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

