-- CreateEnum
CREATE TYPE "EmailMessageSyncStatus" AS ENUM ('new', 'parsed', 'queued', 'confirmed', 'ignored', 'failed');

-- CreateEnum
CREATE TYPE "EmailRecognitionType" AS ENUM ('SO_RECEIVED', 'BOOKING_REPLY', 'SUPPLEMENT_CONFIRMED', 'FOLLOW_UP_REPLY', 'EXCEPTION', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "EmailRecognitionStatus" AS ENUM ('pending_review', 'confirmed', 'rejected', 'ignored');

-- CreateTable
CREATE TABLE "email_messages" (
    "id" TEXT NOT NULL,
    "messageId" VARCHAR(255) NOT NULL,
    "threadId" VARCHAR(255),
    "from" VARCHAR(255) NOT NULL,
    "to" JSONB NOT NULL,
    "cc" JSONB NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "mailbox" VARCHAR(128) NOT NULL DEFAULT 'INBOX',
    "bodyText" TEXT NOT NULL,
    "bodySummary" TEXT NOT NULL,
    "attachments" JSONB NOT NULL,
    "syncStatus" "EmailMessageSyncStatus" NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_recognition_results" (
    "id" TEXT NOT NULL,
    "emailMessageId" TEXT NOT NULL,
    "matchedShipmentId" VARCHAR(64),
    "confidence" DOUBLE PRECISION NOT NULL,
    "recognitionType" "EmailRecognitionType" NOT NULL,
    "extractedFields" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "riskFlags" JSONB NOT NULL,
    "status" "EmailRecognitionStatus" NOT NULL DEFAULT 'pending_review',
    "reviewedBy" VARCHAR(128),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_recognition_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_messages_messageId_key" ON "email_messages"("messageId");

-- CreateIndex
CREATE INDEX "email_messages_receivedAt_idx" ON "email_messages"("receivedAt");

-- CreateIndex
CREATE INDEX "email_messages_syncStatus_idx" ON "email_messages"("syncStatus");

-- CreateIndex
CREATE INDEX "email_recognition_results_status_createdAt_idx" ON "email_recognition_results"("status", "createdAt");

-- CreateIndex
CREATE INDEX "email_recognition_results_matchedShipmentId_createdAt_idx" ON "email_recognition_results"("matchedShipmentId", "createdAt");

-- AddForeignKey
ALTER TABLE "email_recognition_results" ADD CONSTRAINT "email_recognition_results_emailMessageId_fkey" FOREIGN KEY ("emailMessageId") REFERENCES "email_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_recognition_results" ADD CONSTRAINT "email_recognition_results_matchedShipmentId_fkey" FOREIGN KEY ("matchedShipmentId") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
