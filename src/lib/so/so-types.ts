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
  skippedFields: string[];
  shipment: ShipmentRecord;
};
