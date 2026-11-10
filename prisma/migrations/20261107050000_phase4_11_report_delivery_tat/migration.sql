-- CreateEnum
CREATE TYPE "ReportDeliveryMethod" AS ENUM ('RECEPTION_HANDOVER', 'PATIENT_PORTAL', 'REFERRING_PHYSICIAN', 'PRINT');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('SENT', 'DELIVERED', 'FAILED');

-- AlterTable
ALTER TABLE "reports" ADD COLUMN "isReadyForReception" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "readyForReceptionAt" TIMESTAMP(3),
ADD COLUMN "readyForReceptionById" TEXT;

-- CreateTable
CREATE TABLE "report_deliveries" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deliveryMethod" "ReportDeliveryMethod" NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientRole" TEXT,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACKNOWLEDGED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_notifications" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "recipientContact" TEXT NOT NULL,
    "messageBody" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'SENT',
    "provider" TEXT NOT NULL DEFAULT 'LOCAL_DEMO_ADAPTER',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_reprints" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "printedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "printedById" TEXT NOT NULL,
    "reason" TEXT,
    "copiesCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_reprints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reports_readyForReceptionById_idx" ON "reports"("readyForReceptionById");
CREATE INDEX "reports_isReadyForReception_idx" ON "reports"("isReadyForReception");

-- CreateIndex
CREATE INDEX "report_deliveries_reportId_idx" ON "report_deliveries"("reportId");
CREATE INDEX "report_deliveries_deliveryMethod_idx" ON "report_deliveries"("deliveryMethod");
CREATE INDEX "report_deliveries_deliveredAt_idx" ON "report_deliveries"("deliveredAt");

-- CreateIndex
CREATE INDEX "report_notifications_reportId_idx" ON "report_notifications"("reportId");
CREATE INDEX "report_notifications_channel_idx" ON "report_notifications"("channel");
CREATE INDEX "report_notifications_sentAt_idx" ON "report_notifications"("sentAt");

-- CreateIndex
CREATE INDEX "report_reprints_reportId_idx" ON "report_reprints"("reportId");
CREATE INDEX "report_reprints_printedById_idx" ON "report_reprints"("printedById");
CREATE INDEX "report_reprints_printedAt_idx" ON "report_reprints"("printedAt");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_readyForReceptionById_fkey" FOREIGN KEY ("readyForReceptionById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_deliveries" ADD CONSTRAINT "report_deliveries_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_deliveries" ADD CONSTRAINT "report_deliveries_deliveredById_fkey" FOREIGN KEY ("deliveredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_notifications" ADD CONSTRAINT "report_notifications_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_notifications" ADD CONSTRAINT "report_notifications_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_reprints" ADD CONSTRAINT "report_reprints_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_reprints" ADD CONSTRAINT "report_reprints_printedById_fkey" FOREIGN KEY ("printedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

