import { readOcrConfig } from "@/lib/ocr-config";

import type { SoOcrResult } from "./so-types";

export type SoOcrInput = {
  fileBase64?: string | null;
  fileDataUrl?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  sourceText?: string | null;
};

function stripDataUrl(value: string) {
  const match = value.match(/^data:[^;]+;base64,(.+)$/);
  return match?.[1] ?? value;
}

function textFromProviderResponse(data: unknown): string {
  if (!data || typeof data !== "object") return "";

  const record = data as Record<string, unknown>;
  for (const key of ["rawText", "text", "content", "markdown"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  for (const key of ["data", "result", "ocr"]) {
    const nested = textFromProviderResponse(record[key]);
    if (nested) return nested;
  }

  return "";
}

export async function runSoOcr(input: SoOcrInput): Promise<SoOcrResult> {
  const rawText = input.sourceText?.trim() ?? "";

  if (rawText) {
    return {
      message: "Source text supplied; OCR provider was bypassed.",
      rawText,
      status: "OCR_DONE",
    };
  }

  const fileBase64 = stripDataUrl(input.fileBase64?.trim() || input.fileDataUrl?.trim() || "");
  if (!fileBase64) {
    return {
      message: "OCR provider requires fileBase64 for PDF/image files, or sourceText for text uploads.",
      rawText: "",
      status: "not_configured",
    };
  }

  const config = await readOcrConfig();
  if (!config.enabled || !config.endpoint) {
    return {
      message: "OCR provider is not configured. Set OCR_API_URL or .freightflow/ocr-config.json.",
      rawText: "",
      status: "not_configured",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        fileBase64,
        fileName: input.fileName || "shipping-order",
        mimeType: input.mimeType || "application/octet-stream",
        model: config.model || undefined,
        source: "freightflow-ai",
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    const providerText = textFromProviderResponse(data);

    if (!response.ok) {
      return {
        message: `OCR provider returned HTTP ${response.status}.`,
        provider: "http-json",
        rawText: providerText,
        status: "FAILED",
      };
    }

    if (!providerText) {
      return {
        message: "OCR provider returned no rawText/text field.",
        provider: "http-json",
        rawText: "",
        status: "FAILED",
      };
    }

    return {
      message: "OCR provider completed.",
      provider: "http-json",
      rawText: providerText,
      status: "OCR_DONE",
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "OCR provider request failed.",
      provider: "http-json",
      rawText: "",
      status: "FAILED",
    };
  } finally {
    clearTimeout(timeout);
  }
}
