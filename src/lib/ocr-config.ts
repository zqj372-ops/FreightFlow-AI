import { readFile } from "node:fs/promises";
import path from "node:path";

export type OcrConfig = {
  apiKey: string;
  enabled: boolean;
  endpoint: string;
  model: string;
  timeoutMs: number;
};

type RawOcrConfig = Omit<Partial<OcrConfig>, "timeoutMs"> & {
  timeoutMs?: unknown;
};

const DEFAULT_TIMEOUT_MS = 45000;

export const defaultOcrConfig: OcrConfig = {
  apiKey: "",
  enabled: false,
  endpoint: "",
  model: "",
  timeoutMs: DEFAULT_TIMEOUT_MS,
};

function normalizeTimeout(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_TIMEOUT_MS;

  return Math.min(Math.max(Math.round(numeric), 5000), 180000);
}

function normalizeConfig(raw: RawOcrConfig | null | undefined): OcrConfig {
  const endpoint = typeof raw?.endpoint === "string" ? raw.endpoint.trim() : "";

  return {
    apiKey: typeof raw?.apiKey === "string" ? raw.apiKey.trim() : "",
    enabled: Boolean(raw?.enabled ?? endpoint),
    endpoint,
    model: typeof raw?.model === "string" ? raw.model.trim() : "",
    timeoutMs: normalizeTimeout(raw?.timeoutMs),
  };
}

function getConfigPath() {
  return path.join(process.cwd(), ".freightflow", "ocr-config.json");
}

function envConfig(): OcrConfig {
  return normalizeConfig({
    apiKey: process.env.OCR_API_KEY?.trim() ?? "",
    enabled: Boolean(process.env.OCR_API_URL?.trim()),
    endpoint: process.env.OCR_API_URL?.trim() ?? "",
    model: process.env.OCR_MODEL?.trim() ?? "",
    timeoutMs: process.env.OCR_TIMEOUT_MS,
  });
}

async function readStoredOcrConfig() {
  try {
    const content = await readFile(getConfigPath(), "utf8");
    return normalizeConfig(JSON.parse(content) as RawOcrConfig);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function readOcrConfig() {
  return (await readStoredOcrConfig()) ?? envConfig();
}
