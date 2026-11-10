-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('REFERRAL', 'LAB_RESULT', 'CONSENT', 'PREVIOUS_REPORT', 'OTHER');

-- CreateTable
CREATE TABLE "order_documents" (
    "id" TEXT NOT NULL,
    "imagingOrderId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "accessionNumber" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL DEFAULT 'OTHER',
    "fileName" TEXT NOT NULL,
    "storedFilename" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "notes" TEXT,
    "uploadedByUserId" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_documents_imagingOrderId_idx" ON "order_documents"("imagingOrderId");

-- CreateIndex
CREATE INDEX "order_documents_patientId_idx" ON "order_documents"("patientId");

-- CreateIndex
CREATE INDEX "order_documents_accessionNumber_idx" ON "order_documents"("accessionNumber");

-- CreateIndex
CREATE INDEX "order_documents_category_idx" ON "order_documents"("category");

-- AddForeignKey
ALTER TABLE "order_documents" ADD CONSTRAINT "order_documents_imagingOrderId_fkey" FOREIGN KEY ("imagingOrderId") REFERENCES "imaging_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_documents" ADD CONSTRAINT "order_documents_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_documents" ADD CONSTRAINT "order_documents_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

