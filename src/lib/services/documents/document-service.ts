export type SoRecognitionInput = {
  shipmentId: string;
  fileName?: string | null;
  mimeType?: string | null;
  sourceText?: string | null;
};

export type SoRecognitionResult = {
  mode: "placeholder";
  status: "queued" | "recognized";
  shipmentId: string;
  fileName: string | null;
  extractedFields: {
    soNo: string | null;
    carrier: string | null;
    vesselVoyage: string | null;
    etd: string | null;
    containerNo: string | null;
    containerType: string | null;
  };
  confidence: number;
  warnings: string[];
};

export type SupplementTemplateInput = {
  shipmentId: string;
  templateType?: "agent" | "customer";
  language?: "zh-CN" | "en";
  shipment?: Record<string, unknown> | null;
};

export type SupplementTemplateResult = {
  mode: "placeholder";
  shipmentId: string;
  templateType: "agent" | "customer";
  language: "zh-CN" | "en";
  fileName: string;
  mimeType: "application/json";
  fields: Array<{
    key: string;
    label: string;
    value: string | null;
    required: boolean;
  }>;
};

type RawObject = Record<string, unknown>;

function valueFromRecord(record: RawObject | null | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseSourceText(sourceText: string | null | undefined) {
  if (!sourceText) return {};

  return {
    soNo: sourceText.match(/\b[A-Z]{4}\d{7}\b/)?.[0] ?? null,
    containerNo: sourceText.match(/\b[A-Z]{4}\d{7}\b/)?.[0] ?? null,
    containerType: sourceText.match(/\b(?:20GP|40GP|40HQ|45HQ)\b/i)?.[0]?.toUpperCase() ?? null,
  };
}

export async function recognizeShippingOrder(input: SoRecognitionInput): Promise<SoRecognitionResult> {
  const parsed = parseSourceText(input.sourceText);
  const hasAnyField = Object.values(parsed).some(Boolean);

  return {
    mode: "placeholder",
    status: hasAnyField ? "recognized" : "queued",
    shipmentId: input.shipmentId,
    fileName: input.fileName?.trim() || null,
    extractedFields: {
      soNo: parsed.soNo ?? null,
      carrier: null,
      vesselVoyage: null,
      etd: null,
      containerNo: parsed.containerNo ?? null,
      containerType: parsed.containerType ?? null,
    },
    confidence: hasAnyField ? 0.35 : 0,
    warnings: [
      "SO recognition is a replaceable placeholder; wire OCR/parser provider before production use.",
    ],
  };
}

export async function generateSupplementTemplate(input: SupplementTemplateInput): Promise<SupplementTemplateResult> {
  const shipment = input.shipment ?? null;
  const templateType = input.templateType ?? "agent";
  const language = input.language ?? "zh-CN";

  return {
    mode: "placeholder",
    shipmentId: input.shipmentId,
    templateType,
    language,
    fileName: `${input.shipmentId}-supplement-template.json`,
    mimeType: "application/json",
    fields: [
      { key: "batchNo", label: "业务批次号", value: valueFromRecord(shipment, "batchNo"), required: true },
      { key: "soNo", label: "SO No.", value: valueFromRecord(shipment, "soNo"), required: true },
      { key: "containerNo", label: "柜号", value: valueFromRecord(shipment, "containerNo"), required: true },
      { key: "carrier", label: "船公司", value: valueFromRecord(shipment, "carrier"), required: true },
      { key: "vesselVoyage", label: "船名航次", value: valueFromRecord(shipment, "vesselVoyage"), required: true },
      { key: "etd", label: "ETD", value: valueFromRecord(shipment, "etd"), required: true },
      { key: "eta", label: "ETA", value: valueFromRecord(shipment, "eta"), required: false },
      { key: "pickupLocation", label: "提柜点", value: valueFromRecord(shipment, "pickupLocation"), required: false },
      { key: "returnLocation", label: "还柜点", value: valueFromRecord(shipment, "returnLocation"), required: false },
    ],
  };
}
