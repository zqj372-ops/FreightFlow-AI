-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM (
    '订舱草稿',
    '已发送订舱',
    '等待 SO',
    'SO 已收到',
    'SO 复核中',
    '已放舱',
    '待补料',
    '失败'
);

-- CreateEnum
CREATE TYPE "SoDocumentStatus" AS ENUM ('RECEIVED', 'EXTRACTED', 'NEED_REVIEW', 'REVIEWED', 'APPLIED', 'FAILED');

-- AlterEnum
ALTER TYPE "ShipmentActionType" ADD VALUE IF NOT EXISTS '新建 Shipment';
ALTER TYPE "ShipmentActionType" ADD VALUE IF NOT EXISTS '更新 Shipment';
ALTER TYPE "ShipmentActionType" ADD VALUE IF NOT EXISTS 'SO 已收到';
ALTER TYPE "ShipmentActionType" ADD VALUE IF NOT EXISTS 'SO 已回写';

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN "bookingStatus" "BookingStatus" NOT NULL DEFAULT '订舱草稿';

UPDATE "shipments"
SET "bookingStatus" = CASE
    WHEN "status" IN ('待补料', '已发送补料', '等待补料确认', '补料已确认', '待报关', '已报关', '待提柜', '已提柜', '已装柜', '已还柜', '已开船', '已到港', '已签收', '已完成') THEN '待补料'::"BookingStatus"
    WHEN "status" = '已放舱' THEN '已放舱'::"BookingStatus"
    WHEN "status" = '异常处理中' AND "soStatus" = '已识别' THEN 'SO 复核中'::"BookingStatus"
    WHEN "status" = '异常处理中' THEN '失败'::"BookingStatus"
    WHEN "mailStatus" = '未发送' THEN '订舱草稿'::"BookingStatus"
    WHEN "status" IN ('已发送订舱', '等待放舱', '已催放舱') THEN '等待 SO'::"BookingStatus"
    ELSE '订舱草稿'::"BookingStatus"
END;

ALTER TABLE "so_documents" ADD COLUMN "status" "SoDocumentStatus" NOT NULL DEFAULT 'RECEIVED';

UPDATE "so_documents"
SET "status" = CASE
    WHEN "ocrStatus" = 'FAILED' THEN 'FAILED'::"SoDocumentStatus"
    WHEN "ocrStatus" = 'NEED_REVIEW' THEN 'NEED_REVIEW'::"SoDocumentStatus"
    WHEN "ocrStatus" = 'EXTRACTED' THEN 'EXTRACTED'::"SoDocumentStatus"
    ELSE 'RECEIVED'::"SoDocumentStatus"
END;

-- CreateIndex
CREATE INDEX "shipments_bookingStatus_idx" ON "shipments"("bookingStatus");

-- CreateIndex
CREATE INDEX "so_documents_status_idx" ON "so_documents"("status");
