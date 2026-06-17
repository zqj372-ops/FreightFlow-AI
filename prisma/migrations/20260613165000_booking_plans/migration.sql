-- CreateEnum
CREATE TYPE "BookingPlanStatus" AS ENUM ('missing_info', 'ready_to_draft', 'draft_ready', 'send_failed', 'sent');

-- CreateEnum
CREATE TYPE "EmailDraftType" AS ENUM ('booking', 'follow_up', 'supplement');

-- CreateEnum
CREATE TYPE "EmailDraftStatus" AS ENUM ('draft', 'pending_review', 'sent', 'failed');

-- CreateTable
CREATE TABLE "booking_draft_batches" (
    "id" TEXT NOT NULL,
    "createdBy" VARCHAR(128),
    "selectedShipmentIds" JSONB NOT NULL,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_draft_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_drafts" (
    "id" TEXT NOT NULL,
    "shipmentId" VARCHAR(64) NOT NULL,
    "draftType" "EmailDraftType" NOT NULL,
    "to" JSONB NOT NULL,
    "cc" JSONB NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "attachments" JSONB NOT NULL,
    "status" "EmailDraftStatus" NOT NULL,
    "createdFromPlanId" TEXT,
    "lastError" TEXT,
    "sentEmailLogId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_plans" (
    "id" TEXT NOT NULL,
    "shipmentId" VARCHAR(64) NOT NULL,
    "planStatus" "BookingPlanStatus" NOT NULL,
    "requiredFieldsSnapshot" JSONB NOT NULL,
    "preferredBookingAgent" VARCHAR(128),
    "plannedSendAt" TIMESTAMP(3),
    "lastDraftId" TEXT,
    "lastBatchId" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "booking_plans_planStatus_idx" ON "booking_plans"("planStatus");

-- CreateIndex
CREATE INDEX "booking_plans_plannedSendAt_idx" ON "booking_plans"("plannedSendAt");

-- CreateIndex
CREATE UNIQUE INDEX "booking_plans_shipmentId_key" ON "booking_plans"("shipmentId");

-- CreateIndex
CREATE INDEX "email_drafts_shipmentId_status_idx" ON "email_drafts"("shipmentId", "status");

-- CreateIndex
CREATE INDEX "email_drafts_draftType_status_idx" ON "email_drafts"("draftType", "status");

-- AddForeignKey
ALTER TABLE "booking_plans" ADD CONSTRAINT "booking_plans_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_plans" ADD CONSTRAINT "booking_plans_lastDraftId_fkey" FOREIGN KEY ("lastDraftId") REFERENCES "email_drafts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_plans" ADD CONSTRAINT "booking_plans_lastBatchId_fkey" FOREIGN KEY ("lastBatchId") REFERENCES "booking_draft_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_createdFromPlanId_fkey" FOREIGN KEY ("createdFromPlanId") REFERENCES "booking_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
