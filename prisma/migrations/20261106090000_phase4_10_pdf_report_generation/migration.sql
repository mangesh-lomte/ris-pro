-- Phase 4.10: PDF Report Generation Artifact Association
-- Adds PDF persistence metadata to reports table

ALTER TABLE "reports" ADD COLUMN "pdfGeneratedAt" TIMESTAMP(3);
ALTER TABLE "reports" ADD COLUMN "pdfArtifactPath" TEXT;
ALTER TABLE "reports" ADD COLUMN "pdfFileSizeBytes" INTEGER;
ALTER TABLE "reports" ADD COLUMN "pdfVersion" INTEGER;
