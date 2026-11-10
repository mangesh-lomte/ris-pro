-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'SCAN_IN_PROGRESS';
ALTER TYPE "OrderStatus" ADD VALUE 'SCAN_INTERRUPTED';
ALTER TYPE "OrderStatus" ADD VALUE 'SCAN_COMPLETED';
ALTER TYPE "OrderStatus" ADD VALUE 'SCAN_CANCELLED';

-- CreateEnum
CREATE TYPE "ScanState" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'INTERRUPTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ScanLifecycleAction" AS ENUM ('STARTED', 'INTERRUPTED', 'RESUMED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "scan_lifecycles" (
    "id" TEXT NOT NULL,
    "imagingOrderId" TEXT NOT NULL,
    "equipmentId" TEXT,
    "startedByUserId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "interruptedByUserId" TEXT,
    "interruptedAt" TIMESTAMP(3),
    "interruptionReason" TEXT,
    "interruptionNotes" TEXT,
    "resumedByUserId" TEXT,
    "resumedAt" TIMESTAMP(3),
    "completedByUserId" TEXT,
    "completedAt" TIMESTAMP(3),
    "cancelledByUserId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "cancellationNotes" TEXT,
    "state" "ScanState" NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scan_lifecycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_lifecycle_events" (
    "id" TEXT NOT NULL,
    "scanLifecycleId" TEXT NOT NULL,
    "action" "ScanLifecycleAction" NOT NULL,
    "userId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "notes" TEXT,
    "metadata" JSONB,

    CONSTRAINT "scan_lifecycle_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scan_lifecycles_imagingOrderId_key" ON "scan_lifecycles"("imagingOrderId");

-- CreateIndex
CREATE INDEX "scan_lifecycles_imagingOrderId_idx" ON "scan_lifecycles"("imagingOrderId");

-- CreateIndex
CREATE INDEX "scan_lifecycles_equipmentId_idx" ON "scan_lifecycles"("equipmentId");

-- CreateIndex
CREATE INDEX "scan_lifecycles_state_idx" ON "scan_lifecycles"("state");

-- CreateIndex
CREATE INDEX "scan_lifecycle_events_scanLifecycleId_idx" ON "scan_lifecycle_events"("scanLifecycleId");

-- CreateIndex
CREATE INDEX "scan_lifecycle_events_action_idx" ON "scan_lifecycle_events"("action");

-- CreateIndex
CREATE INDEX "scan_lifecycle_events_timestamp_idx" ON "scan_lifecycle_events"("timestamp");

-- AddForeignKey
ALTER TABLE "scan_lifecycles" ADD CONSTRAINT "scan_lifecycles_imagingOrderId_fkey" FOREIGN KEY ("imagingOrderId") REFERENCES "imaging_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_lifecycles" ADD CONSTRAINT "scan_lifecycles_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_lifecycles" ADD CONSTRAINT "scan_lifecycles_startedByUserId_fkey" FOREIGN KEY ("startedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_lifecycles" ADD CONSTRAINT "scan_lifecycles_interruptedByUserId_fkey" FOREIGN KEY ("interruptedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_lifecycles" ADD CONSTRAINT "scan_lifecycles_resumedByUserId_fkey" FOREIGN KEY ("resumedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_lifecycles" ADD CONSTRAINT "scan_lifecycles_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_lifecycles" ADD CONSTRAINT "scan_lifecycles_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_lifecycle_events" ADD CONSTRAINT "scan_lifecycle_events_scanLifecycleId_fkey" FOREIGN KEY ("scanLifecycleId") REFERENCES "scan_lifecycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_lifecycle_events" ADD CONSTRAINT "scan_lifecycle_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

