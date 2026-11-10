-- CreateEnum
CREATE TYPE "PeerReviewStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "peer_review_requests" (
    "id" TEXT NOT NULL,
    "imagingOrderId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "status" "PeerReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "reviewComment" TEXT,
    "decision" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "peer_review_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "peer_review_requests_imagingOrderId_idx" ON "peer_review_requests"("imagingOrderId");

-- CreateIndex
CREATE INDEX "peer_review_requests_requesterId_idx" ON "peer_review_requests"("requesterId");

-- CreateIndex
CREATE INDEX "peer_review_requests_reviewerId_idx" ON "peer_review_requests"("reviewerId");

-- CreateIndex
CREATE INDEX "peer_review_requests_status_idx" ON "peer_review_requests"("status");

-- AddForeignKey
ALTER TABLE "peer_review_requests" ADD CONSTRAINT "peer_review_requests_imagingOrderId_fkey" FOREIGN KEY ("imagingOrderId") REFERENCES "imaging_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peer_review_requests" ADD CONSTRAINT "peer_review_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peer_review_requests" ADD CONSTRAINT "peer_review_requests_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

