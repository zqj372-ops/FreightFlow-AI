import type { ShipmentRecord } from "@/lib/mock-data";

export const soFieldKeys = [
  "soNo",
  "carrier",
  "vessel",
  "voyage",
  "etd",
  "eta",
  "portOfLoading",
  "portOfDischarge",
  "placeOfReceipt",
  "placeOfDelivery",
  "containerType",
  "containerQuantity",
  "cutoffTime",
  "cyClosing",
  "siCutoff",
  "amsCutoff",
  "aciCutoff",
  "isfCutoff",
  "pickupLocation",
  "returnLocation",
  "bookingAgent",
  "remarks",
] as const;

export type SoFieldKey = (typeof soFieldKeys)[number];

export type SoExtractedField = {
  confidence: number;
  fieldKey: SoFieldKey;
  needsReview: boolean;
  sourceText: string;
  value: string | null;
};

export type SoFieldReviewPatch = {
  apply?: boolean;
  confidence?: number;
  confirmed?: boolean;
  fieldKey: SoFieldKey;
  sourceText?: string;
  value?: string | null;
};

export type SoExtractionResult = {
  confidence: number;
  fields: SoExtractedField[];
  rawText: string;
  status: "EXTRACTED" | "NEED_REVIEW";
};

export type SoOcrResult = {
  message: string;
  provider?: string;
  rawText: string;
  status: "FAILED" | "OCR_DONE" | "not_configured";
};

export type SoApplyResult = {
  appliedFields: string[];
  actionLogId?: string | null;
  appliedAt?: string | null;
  soDocumentId?: string | null;
  skippedFields: string[];
  shipment: ShipmentRecord;
};

export type SoDocumentStatusBucket = "applied" | "failed" | "pending" | "review";

export type SoDocumentCenterRecord = {
  appliedAt: string | null;
  appliedFields: string[];
  batchNo: string | null;
  confidence: number | null;
  createdAt: string;
  extractedFields: SoExtractedField[];
  failedReason: string | null;
  fileName: string;
  id: string;
  mimeType: string;
  ocrStatus: string;
  rawText: string | null;
  reviewFields: SoExtractedField[];
  shipment: ShipmentRecord | null;
  shipmentId: string;
  source: string;
  statusBucket: SoDocumentStatusBucket;
  statusLabel: "失败" | "待复核" | "待识别" | "已回写";
  updatedAt: string;
};
