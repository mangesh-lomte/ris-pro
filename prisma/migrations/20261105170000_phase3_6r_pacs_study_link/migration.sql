-- CreateEnum
CREATE TYPE "PacsStudyLinkStatus" AS ENUM ('LINKED', 'UNLINKED');

-- CreateTable
CREATE TABLE "pacs_study_links" (
    "id" TEXT NOT NULL,
    "imagingOrderId" TEXT NOT NULL,
    "orthancStudyId" TEXT NOT NULL,
    "studyInstanceUid" TEXT,
    "status" "PacsStudyLinkStatus" NOT NULL DEFAULT 'LINKED',
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pacs_study_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pacs_study_links_imagingOrderId_key" ON "pacs_study_links"("imagingOrderId");

-- CreateIndex
CREATE INDEX "pacs_study_links_orthancStudyId_idx" ON "pacs_study_links"("orthancStudyId");

-- CreateIndex
CREATE INDEX "pacs_study_links_imagingOrderId_idx" ON "pacs_study_links"("imagingOrderId");

-- AddForeignKey
ALTER TABLE "pacs_study_links" ADD CONSTRAINT "pacs_study_links_imagingOrderId_fkey" FOREIGN KEY ("imagingOrderId") REFERENCES "imaging_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacs_study_links" ADD CONSTRAINT "pacs_study_links_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
