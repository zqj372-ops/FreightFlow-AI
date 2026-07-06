import { averageConfidence, needsReview } from "./so-confidence";
import type { SoExtractedField, SoExtractionResult, SoFieldKey } from "./so-types";

function lineFor(rawText: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = rawText.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return null;
}

function makeField(fieldKey: SoFieldKey, value: string | null, confidence: number, sourceText = ""): SoExtractedField {
  return {
    confidence: value ? confidence : 0,
    fieldKey,
    needsReview: !value || needsReview(confidence),
    sourceText,
    value,
  };
}

export function extractSoFields(rawText: string): SoExtractionResult {
  const text = rawText.trim();
  const fields: SoExtractedField[] = [
    makeField("soNo", lineFor(text, [/\b(?:SO|S\/O|Booking(?:\s+No)?|Booking Confirmation)[:#\s-]+([A-Z]{3,5}\d{6,10})\b/i]), 0.9, "SO / Booking No"),
    makeField("carrier", lineFor(text, [/Carrier[:#\s-]+([^\n\r]+)/i, /Line[:#\s-]+([^\n\r]+)/i]), 0.78, "Carrier"),
    makeField("vessel", lineFor(text, [/Vessel[:#\s-]+([^\n\r]+)/i]), 0.78, "Vessel"),
    makeField("voyage", lineFor(text, [/Voyage[:#\s-]+([^\n\r]+)/i, /V\/V[:#\s-]+[^\n\r]*?\s+([A-Z0-9-]+)\b/i]), 0.74, "Voyage"),
    makeField("etd", lineFor(text, [/ETD[:#\s-]+([0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2}(?:\s+[0-9]{1,2}:[0-9]{2})?)/i]), 0.82, "ETD"),
    makeField("eta", lineFor(text, [/ETA[:#\s-]+([0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2}(?:\s+[0-9]{1,2}:[0-9]{2})?)/i]), 0.75, "ETA"),
    makeField("portOfLoading", lineFor(text, [/(?:POL|Port of Loading)[:#\s-]+([^\n\r]+)/i]), 0.82, "POL"),
    makeField("portOfDischarge", lineFor(text, [/(?:POD|Port of Discharge)[:#\s-]+([^\n\r]+)/i]), 0.82, "POD"),
    makeField("placeOfReceipt", lineFor(text, [/(?:Place of Receipt|POR)[:#\s-]+([^\n\r]+)/i]), 0.68, "Place of Receipt"),
    makeField("placeOfDelivery", lineFor(text, [/(?:Place of Delivery|DEL)[:#\s-]+([^\n\r]+)/i]), 0.68, "Place of Delivery"),
    makeField("containerType", lineFor(text, [/\b(20GP|40GP|40HQ|45HQ)\b/i]), 0.86, "Container Type"),
    makeField("containerQuantity", lineFor(text, [/(?:Qty|Quantity|Container Quantity)[:#\s-]+(\d+)/i, /(\d+)\s*x\s*(?:20GP|40GP|40HQ|45HQ)/i]), 0.78, "Container Quantity"),
    makeField("cutoffTime", lineFor(text, [/(?:Cutoff|Cut-off|Closing)[:#\s-]+([^\n\r]+)/i]), 0.7, "Cutoff"),
    makeField("cyClosing", lineFor(text, [/(?:CY Closing|CY Cutoff)[:#\s-]+([^\n\r]+)/i]), 0.7, "CY Closing"),
    makeField("siCutoff", lineFor(text, [/(?:SI Cutoff|SI Closing)[:#\s-]+([^\n\r]+)/i]), 0.72, "SI Cutoff"),
    makeField("amsCutoff", lineFor(text, [/AMS Cutoff[:#\s-]+([^\n\r]+)/i]), 0.72, "AMS Cutoff"),
    makeField("aciCutoff", lineFor(text, [/ACI Cutoff[:#\s-]+([^\n\r]+)/i]), 0.72, "ACI Cutoff"),
    makeField("isfCutoff", lineFor(text, [/ISF Cutoff[:#\s-]+([^\n\r]+)/i]), 0.72, "ISF Cutoff"),
    makeField("pickupLocation", lineFor(text, [/(?:Pickup Location|Pick up|Empty Pickup)[:#\s-]+([^\n\r]+)/i]), 0.76, "Pickup"),
    makeField("returnLocation", lineFor(text, [/(?:Return Location|Empty Return|Return Depot)[:#\s-]+([^\n\r]+)/i]), 0.76, "Return"),
    makeField("bookingAgent", lineFor(text, [/(?:Booking Agent|Agent)[:#\s-]+([^\n\r]+)/i]), 0.7, "Booking Agent"),
    makeField("remarks", lineFor(text, [/(?:Remarks|Remark|Note)[:#\s-]+([^\n\r]+)/i]), 0.65, "Remarks"),
  ];
  const foundConfidences = fields.filter((field) => field.value).map((field) => field.confidence);
  const confidence = averageConfidence(foundConfidences);

  return {
    confidence,
    fields,
    rawText: text,
    status: fields.some((field) => field.value && field.needsReview) ? "NEED_REVIEW" : "EXTRACTED",
  };
}
