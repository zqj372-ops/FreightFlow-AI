import { AUTO_APPLY_CONFIDENCE } from "./so-confidence";
import type { SoExtractionResult } from "./so-types";

const REQUIRED_FIELDS = ["soNo", "carrier", "vessel", "voyage", "etd", "portOfLoading", "portOfDischarge"] as const;

export function validateSoExtraction(result: SoExtractionResult) {
  const fields = new Map(result.fields.map((field) => [field.fieldKey, field]));
  const missingFields = REQUIRED_FIELDS.filter((fieldKey) => !fields.get(fieldKey)?.value);
  const lowConfidenceFields = result.fields
    .filter((field) => field.value && field.confidence < AUTO_APPLY_CONFIDENCE)
    .map((field) => field.fieldKey);

  return {
    canAutoApply: missingFields.length === 0 && lowConfidenceFields.length === 0,
    lowConfidenceFields,
    missingFields,
  };
}
