-- AlterTable
ALTER TABLE "reports" ADD COLUMN "signedAt" TIMESTAMP(3);
ALTER TABLE "reports" ADD COLUMN "signedById" TEXT;
ALTER TABLE "reports" ADD COLUMN "isSigned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "reports" ADD COLUMN "isLocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "reports" ADD COLUMN "digitalSignature" JSONB;
ALTER TABLE "reports" ADD COLUMN "signatureHash" TEXT;

-- CreateIndex
CREATE INDEX "reports_signedById_idx" ON "reports"("signedById");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_signedById_fkey" FOREIGN KEY ("signedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

