-- CreateEnum
CREATE TYPE "RadiologistAssignmentStatus" AS ENUM ('ASSIGNED', 'RELEASED');

-- CreateTable
CREATE TABLE "radiologist_assignments" (
    "id" TEXT NOT NULL,
    "imagingOrderId" TEXT NOT NULL,
    "radiologistUserId" TEXT NOT NULL,
    "assignedByUserId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    "releasedByUserId" TEXT,
    "status" "RadiologistAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "radiologist_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "radiologist_assignments_imagingOrderId_idx" ON "radiologist_assignments"("imagingOrderId");

-- CreateIndex
CREATE INDEX "radiologist_assignments_radiologistUserId_idx" ON "radiologist_assignments"("radiologistUserId");

-- CreateIndex
CREATE INDEX "radiologist_assignments_status_idx" ON "radiologist_assignments"("status");

-- Create unique active assignment constraint (at most one ACTIVE assignment per order)
CREATE UNIQUE INDEX "unique_active_radiologist_assignment" ON "radiologist_assignments"("imagingOrderId") WHERE "status" = 'ASSIGNED';

-- AddForeignKey
ALTER TABLE "radiologist_assignments" ADD CONSTRAINT "radiologist_assignments_imagingOrderId_fkey" FOREIGN KEY ("imagingOrderId") REFERENCES "imaging_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiologist_assignments" ADD CONSTRAINT "radiologist_assignments_radiologistUserId_fkey" FOREIGN KEY ("radiologistUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiologist_assignments" ADD CONSTRAINT "radiologist_assignments_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiologist_assignments" ADD CONSTRAINT "radiologist_assignments_releasedByUserId_fkey" FOREIGN KEY ("releasedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

