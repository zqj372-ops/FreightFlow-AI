import { requestOpenClawJson } from "@/lib/openclaw-client";

import { AUTO_APPLY_CONFIDENCE, needsReview } from "./so-confidence";
import { soFieldKeys, type SoExtractedField, type SoExtractionResult, type SoFieldKey } from "./so-types";

type AiFieldValue =
  | string
  | null
  | {
      confidence?: unknown;
      sourceText?: unknown;
      value?: unknown;
    };

type SoAiResponse = {
  fields?: Partial<Record<SoFieldKey, AiFieldValue>>;
};

function normalizeField(fieldKey: SoFieldKey, value: AiFieldValue | undefined): SoExtractedField | null {
  if (value === undefined || value === null) return null;

  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return null;

    return {
      confidence: AUTO_APPLY_CONFIDENCE,
      fieldKey,
      needsReview: false,
      sourceText: "OpenClaw",
      value: text,
    };
  }

  if (typeof value !== "object") return null;

  const text = typeof value.value === "string" ? value.value.trim() : "";
  if (!text) return null;

  const rawConfidence = Number(value.confidence);
  const confidence = Number.isFinite(rawConfidence) ? Math.min(Math.max(rawConfidence, 0), 1) : AUTO_APPLY_CONFIDENCE;

  return {
    confidence,
    fieldKey,
    needsReview: needsReview(confidence),
    sourceText: typeof value.sourceText === "string" ? value.sourceText : "OpenClaw",
    value: text,
  };
}

export async function enhanceSoExtractionWithOpenClaw(
  rawText: string,
  fallback: SoExtractionResult,
): Promise<SoExtractionResult> {
  const response = await requestOpenClawJson<SoAiResponse>({
    context: { rawText },
    prompt: [
      "Extract shipping order fields from the OCR text.",
      "Return JSON only as {\"fields\":{\"soNo\":{\"value\":\"...\",\"confidence\":0.9,\"sourceText\":\"...\"}}}.",
      `Allowed field keys: ${soFieldKeys.join(", ")}.`,
      "",
      rawText,
    ].join("\n"),
  });
  const aiFields = response?.fields;
  if (!aiFields) return fallback;

  const byKey = new Map(fallback.fields.map((field) => [field.fieldKey, field]));
  let usedAi = false;

  for (const fieldKey of soFieldKeys) {
    const field = normalizeField(fieldKey, aiFields[fieldKey]);
    if (!field) continue;

    usedAi = true;
    const current = byKey.get(fieldKey);
    if (!current || !current.value || field.confidence >= current.confidence) {
      byKey.set(fieldKey, field);
    }
  }

  if (!usedAi) return fallback;

  const fields = soFieldKeys.map((fieldKey) => byKey.get(fieldKey)).filter((field): field is SoExtractedField => Boolean(field));
  const foundConfidences = fields.filter((field) => field.value).map((field) => field.confidence);
  const confidence =
    foundConfidences.length === 0
      ? 0
      : foundConfidences.reduce((sum, value) => sum + value, 0) / foundConfidences.length;

  return {
    confidence,
    fields,
    rawText: fallback.rawText,
    status: fields.some((field) => field.value && field.needsReview) ? "NEED_REVIEW" : "EXTRACTED",
  };
}
