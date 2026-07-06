import type { SoOcrResult } from "./so-types";

export type SoOcrInput = {
  fileName?: string | null;
  mimeType?: string | null;
  sourceText?: string | null;
};

export async function runSoOcr(input: SoOcrInput): Promise<SoOcrResult> {
  const rawText = input.sourceText?.trim() ?? "";

  if (rawText) {
    return {
      message: "Source text supplied; OCR provider was bypassed.",
      rawText,
      status: "OCR_DONE",
    };
  }

  return {
    message: "OCR provider is not configured. Upload sourceText or configure an OCR provider.",
    rawText: "",
    status: "not_configured",
  };
}
