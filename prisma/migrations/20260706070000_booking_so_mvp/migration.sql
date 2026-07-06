-- CreateEnum
CREATE TYPE "BookingEmailDraftStatus" AS ENUM ('DRAFT', 'APPROVED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "SoDocumentSource" AS ENUM ('UPLOAD', 'EMAIL_ATTACHMENT');

-- CreateEnum
CREATE TYPE "SoOcrStatus" AS ENUM ('PENDING', 'OCR_PROCESSING', 'OCR_DONE', 'EXTRACTING', 'EXTRACTED', 'NEED_REVIEW', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailSyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "booking_email_drafts" (
    "id" TEXT NOT NULL,
    "shipmentId" VARCHAR(64) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "to" JSONB NOT NULL,
    "cc" JSONB,
    "status" "BookingEmailDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "aiRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_email_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "so_documents" (
    "id" TEXT NOT NULL,
    "shipmentId" VARCHAR(64) NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(128) NOT NULL,
    "storagePath" TEXT NOT NULL,
    "source" "SoDocumentSource" NOT NULL,
    "ocrStatus" "SoOcrStatus" NOT NULL DEFAULT 'PENDING',
    "rawText" TEXT,
    "extractedJson" JSONB,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "so_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "so_extracted_fields" (
    "id" TEXT NOT NULL,
    "soDocumentId" TEXT NOT NULL,
    "fieldKey" VARCHAR(128) NOT NULL,
    "fieldValue" TEXT,
    "confidence" DOUBLE PRECISION,
    "sourceText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "so_extracted_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_sync_logs" (
    "id" TEXT NOT NULL,
    "mailbox" VARCHAR(255) NOT NULL,
    "status" "EmailSyncStatus" NOT NULL,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "attachmentCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "email_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "booking_email_drafts_shipmentId_idx" ON "booking_email_drafts"("shipmentId");

-- CreateIndex
CREATE INDEX "so_documents_shipmentId_idx" ON "so_documents"("shipmentId");

-- CreateIndex
CREATE INDEX "so_documents_ocrStatus_idx" ON "so_documents"("ocrStatus");

-- CreateIndex
CREATE INDEX "so_extracted_fields_soDocumentId_idx" ON "so_extracted_fields"("soDocumentId");

-- CreateIndex
CREATE INDEX "so_extracted_fields_fieldKey_idx" ON "so_extracted_fields"("fieldKey");

-- CreateIndex
CREATE INDEX "email_sync_logs_startedAt_idx" ON "email_sync_logs"("startedAt");

-- AddForeignKey
ALTER TABLE "booking_email_drafts" ADD CONSTRAINT "booking_email_drafts_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "so_documents" ADD CONSTRAINT "so_documents_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "so_extracted_fields" ADD CONSTRAINT "so_extracted_fields_soDocumentId_fkey" FOREIGN KEY ("soDocumentId") REFERENCES "so_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
