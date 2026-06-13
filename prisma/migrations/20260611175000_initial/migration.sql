-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('已发送订舱', '等待放舱', '已催放舱', '已放舱', '待补料', '已发送补料', '等待补料确认', '补料已确认', '待报关', '已报关', '待提柜', '已提柜', '已装柜', '已还柜', '已开船', '已到港', '已签收', '已完成', '异常处理中');

-- CreateEnum
CREATE TYPE "AlertLevel" AS ENUM ('red', 'yellow', 'green');

-- CreateEnum
CREATE TYPE "DocumentProgressStatus" AS ENUM ('待处理', '草稿完成', '已发送');

-- CreateEnum
CREATE TYPE "MailStatus" AS ENUM ('未发送', '已发送', '跟进中');

-- CreateEnum
CREATE TYPE "SoStatus" AS ENUM ('待识别', '已识别');

-- CreateEnum
CREATE TYPE "ShipmentDocumentStatus" AS ENUM ('待生成', '处理中', '已发送', '已确认');

-- CreateEnum
CREATE TYPE "ContactRole" AS ENUM ('booking_agent', 'ops', 'sales', 'customs');

-- CreateEnum
CREATE TYPE "ShipmentActionType" AS ENUM ('订舱邮件', '催单提醒', '补料文件', 'SO 识别', 'AMS/ACI/ISF', '异常标记');

-- CreateEnum
CREATE TYPE "action_source" AS ENUM ('UI', 'AI', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AiRequestStatus" AS ENUM ('idle', 'loading', 'success', 'error');

-- CreateEnum
CREATE TYPE "EmailRecipientType" AS ENUM ('to', 'cc');

-- CreateTable
CREATE TABLE "shipments" (
    "id" VARCHAR(64) NOT NULL,
    "batchNo" VARCHAR(64) NOT NULL,
    "soNo" VARCHAR(64) NOT NULL,
    "containerNo" VARCHAR(64) NOT NULL,
    "bookingAgent" VARCHAR(128) NOT NULL,
    "carrier" VARCHAR(128) NOT NULL,
    "originPort" VARCHAR(128) NOT NULL,
    "transitPort" VARCHAR(128) NOT NULL DEFAULT '',
    "destinationPort" VARCHAR(128) NOT NULL,
    "containerType" VARCHAR(32) NOT NULL,
    "vesselVoyage" VARCHAR(128) NOT NULL,
    "etd" TIMESTAMP(3) NOT NULL,
    "eta" TIMESTAMP(3) NOT NULL,
    "cutoffTime" TIMESTAMP(3) NOT NULL,
    "pickupLocation" VARCHAR(128) NOT NULL,
    "returnLocation" VARCHAR(128) NOT NULL,
    "status" "ShipmentStatus" NOT NULL,
    "operator" VARCHAR(128) NOT NULL,
    "followUpCount" INTEGER NOT NULL DEFAULT 0,
    "lastEmailTime" TIMESTAMP(3),
    "hoursWaitingRelease" INTEGER NOT NULL DEFAULT 0,
    "hoursToCutoff" INTEGER NOT NULL,
    "aiSummary" TEXT NOT NULL,
    "nextAction" TEXT NOT NULL,
    "alertLevel" "AlertLevel",
    "mailStatus" "MailStatus" NOT NULL,
    "soStatus" "SoStatus" NOT NULL,
    "documentStatus" "ShipmentDocumentStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_document_progress" (
    "shipmentId" VARCHAR(64) NOT NULL,
    "ams" "DocumentProgressStatus" NOT NULL,
    "aci" "DocumentProgressStatus" NOT NULL,
    "isf" "DocumentProgressStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipment_document_progress_pkey" PRIMARY KEY ("shipmentId")
);

-- CreateTable
CREATE TABLE "shipment_exceptions" (
    "id" TEXT NOT NULL,
    "shipmentId" VARCHAR(64) NOT NULL,
    "message" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_reminder_flags" (
    "id" TEXT NOT NULL,
    "shipmentId" VARCHAR(64) NOT NULL,
    "message" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_reminder_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "label" VARCHAR(128) NOT NULL,
    "role" "ContactRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_action_logs" (
    "id" TEXT NOT NULL,
    "shipmentId" VARCHAR(64) NOT NULL,
    "actionType" "ShipmentActionType" NOT NULL,
    "source" "action_source" NOT NULL DEFAULT 'UI',
    "actorName" VARCHAR(128),
    "actorEmail" VARCHAR(255),
    "summary" TEXT NOT NULL,
    "beforeSnapshot" JSONB,
    "afterSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_email_logs" (
    "id" TEXT NOT NULL,
    "shipmentId" VARCHAR(64) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "attachmentName" VARCHAR(255),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_email_recipients" (
    "id" TEXT NOT NULL,
    "emailLogId" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "recipientType" "EmailRecipientType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_email_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_requests" (
    "id" TEXT NOT NULL,
    "shipmentId" VARCHAR(64),
    "prompt" TEXT NOT NULL,
    "reply" TEXT,
    "requestStatus" "AiRequestStatus" NOT NULL,
    "requestContext" JSONB,
    "provider" VARCHAR(64),
    "endpoint" VARCHAR(255),
    "errorMessage" TEXT,
    "responseTimeMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ai_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shipments_batchNo_key" ON "shipments"("batchNo");

-- CreateIndex
CREATE INDEX "shipments_status_idx" ON "shipments"("status");

-- CreateIndex
CREATE INDEX "shipments_operator_idx" ON "shipments"("operator");

-- CreateIndex
CREATE INDEX "shipments_carrier_idx" ON "shipments"("carrier");

-- CreateIndex
CREATE INDEX "shipments_destinationPort_idx" ON "shipments"("destinationPort");

-- CreateIndex
CREATE INDEX "shipment_exceptions_shipmentId_sortOrder_idx" ON "shipment_exceptions"("shipmentId", "sortOrder");

-- CreateIndex
CREATE INDEX "shipment_reminder_flags_shipmentId_sortOrder_idx" ON "shipment_reminder_flags"("shipmentId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_email_key" ON "contacts"("email");

-- CreateIndex
CREATE INDEX "contacts_role_idx" ON "contacts"("role");

-- CreateIndex
CREATE INDEX "shipment_action_logs_shipmentId_createdAt_idx" ON "shipment_action_logs"("shipmentId", "createdAt");

-- CreateIndex
CREATE INDEX "shipment_action_logs_actionType_idx" ON "shipment_action_logs"("actionType");

-- CreateIndex
CREATE INDEX "shipment_email_logs_shipmentId_createdAt_idx" ON "shipment_email_logs"("shipmentId", "createdAt");

-- CreateIndex
CREATE INDEX "shipment_email_recipients_emailLogId_recipientType_idx" ON "shipment_email_recipients"("emailLogId", "recipientType");

-- CreateIndex
CREATE INDEX "ai_requests_shipmentId_createdAt_idx" ON "ai_requests"("shipmentId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_requests_requestStatus_idx" ON "ai_requests"("requestStatus");

-- AddForeignKey
ALTER TABLE "shipment_document_progress" ADD CONSTRAINT "shipment_document_progress_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_exceptions" ADD CONSTRAINT "shipment_exceptions_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_reminder_flags" ADD CONSTRAINT "shipment_reminder_flags_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_action_logs" ADD CONSTRAINT "shipment_action_logs_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_email_logs" ADD CONSTRAINT "shipment_email_logs_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_email_recipients" ADD CONSTRAINT "shipment_email_recipients_emailLogId_fkey" FOREIGN KEY ("emailLogId") REFERENCES "shipment_email_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
