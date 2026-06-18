-- CreateTable
CREATE TABLE "shipment_attachments" (
    "id" TEXT NOT NULL,
    "shipmentId" VARCHAR(64) NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(128) NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "storageKey" VARCHAR(512) NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "documentType" VARCHAR(64) NOT NULL DEFAULT 'attachment',
    "ocrStatus" VARCHAR(32) NOT NULL DEFAULT 'not_started',
    "ocrText" TEXT,
    "ocrConfidence" DOUBLE PRECISION,
    "uploadedBy" VARCHAR(128),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipment_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shipment_attachments_storageKey_key" ON "shipment_attachments"("storageKey");

-- CreateIndex
CREATE INDEX "shipment_attachments_shipmentId_createdAt_idx" ON "shipment_attachments"("shipmentId", "createdAt");

-- CreateIndex
CREATE INDEX "shipment_attachments_documentType_idx" ON "shipment_attachments"("documentType");

-- CreateIndex
CREATE INDEX "shipment_attachments_ocrStatus_idx" ON "shipment_attachments"("ocrStatus");

-- AddForeignKey
ALTER TABLE "shipment_attachments" ADD CONSTRAINT "shipment_attachments_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
