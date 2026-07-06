import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { DEFAULT_AI_PROVIDER_ID, getAiProviderPreset, type AiProviderId } from "./ai-providers";

export type OpenClawConfig = {
  apiKey: string;
  endpoint: string;
  enabled: boolean;
  model: string;
  models: string[];
  provider: AiProviderId;
  timeoutMs: number;
  updatedAt: string | null;
};

export type PublicOpenClawConfig = Omit<OpenClawConfig, "apiKey"> & {
  apiKeyConfigured: boolean;
};

type RawOpenClawConfig = Omit<Partial<OpenClawConfig>, "timeoutMs"> & {
  timeoutMs?: unknown;
};

const DEFAULT_TIMEOUT_MS = 30000;

export const defaultOpenClawConfig: OpenClawConfig = {
  apiKey: "",
  endpoint: "",
  enabled: false,
  model: getAiProviderPreset(DEFAULT_AI_PROVIDER_ID).defaultModel,
  models: getAiProviderPreset(DEFAULT_AI_PROVIDER_ID).models,
  provider: DEFAULT_AI_PROVIDER_ID,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  updatedAt: null,
};

function getConfigDir() {
  return path.join(process.cwd(), ".freightflow");
}

function getConfigPath() {
  return path.join(getConfigDir(), "openclaw-config.json");
}

function normalizeTimeout(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_TIMEOUT_MS;

  return Math.min(Math.max(Math.round(numeric), 5000), 120000);
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeModels(value: unknown, fallback: string[]) {
  const models = Array.isArray(value)
    ? value.filter((model): model is string => typeof model === "string" && model.trim().length > 0).map((model) => model.trim())
    : [];

  return models.length > 0 ? Array.from(new Set(models)) : fallback;
}

function normalizeConfig(raw: RawOpenClawConfig | null | undefined): OpenClawConfig {
  const endpoint = normalizeString(raw?.endpoint);
  const provider = getAiProviderPreset(normalizeString(raw?.provider) || (endpoint ? "custom" : DEFAULT_AI_PROVIDER_ID));
  const models = normalizeModels(raw?.models, provider.models);
  const model = normalizeString(raw?.model) || provider.defaultModel || models[0] || "";

  return {
    apiKey: normalizeString(raw?.apiKey),
    endpoint,
    enabled: Boolean(raw?.enabled),
    model,
    models,
    provider: provider.id,
    timeoutMs: normalizeTimeout(raw?.timeoutMs),
    updatedAt: typeof raw?.updatedAt === "string" ? raw.updatedAt : null,
  };
}

function envConfig(): OpenClawConfig {
  const endpoint = process.env.AI_BASE_URL?.trim() || process.env.OPENCLAW_API_URL?.trim() || "";
  const apiKey = process.env.AI_API_KEY?.trim() || process.env.OPENCLAW_API_KEY?.trim() || "";
  const provider = process.env.AI_PROVIDER?.trim() || (endpoint ? "custom" : DEFAULT_AI_PROVIDER_ID);

  return normalizeConfig({
    apiKey,
    endpoint,
    enabled: Boolean(apiKey || endpoint),
    model: process.env.AI_MODEL?.trim() || process.env.OPENCLAW_MODEL?.trim() || "",
    provider: provider as AiProviderId,
    timeoutMs: process.env.AI_TIMEOUT_MS ?? process.env.OPENCLAW_TIMEOUT_MS,
    updatedAt: null,
  });
}

export async function readStoredOpenClawConfig(): Promise<OpenClawConfig | null> {
  try {
    const content = await readFile(getConfigPath(), "utf8");
    return normalizeConfig(JSON.parse(content) as Partial<OpenClawConfig>);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function readOpenClawConfig(): Promise<OpenClawConfig> {
  const stored = await readStoredOpenClawConfig();
  const config = stored ?? envConfig();
  return config.apiKey ? config : { ...config, enabled: false };
}

export async function saveOpenClawConfig(input: Partial<OpenClawConfig>) {
  const existing = (await readStoredOpenClawConfig()) ?? envConfig();
  const nextApiKey =
    typeof input.apiKey === "string" && input.apiKey.trim().length > 0 ? input.apiKey : existing.apiKey;
  const next = normalizeConfig({
    ...existing,
    ...input,
    apiKey: nextApiKey,
    updatedAt: new Date().toISOString(),
  });
  const provider = getAiProviderPreset(next.provider);

  if (next.enabled && !next.apiKey) {
    throw new Error("启用 AI 大模型前必须填写 API Key。");
  }

  if (next.enabled && provider.requiresBaseUrl && !next.endpoint) {
    throw new Error("使用自定义模型前必须填写 Base URL。");
  }

  if (next.endpoint) {
    try {
      const url = new URL(next.endpoint);
      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("AI Base URL 必须是 HTTP 或 HTTPS。");
      }
    } catch {
      throw new Error("AI Base URL 格式无效。");
    }
  }

  await mkdir(getConfigDir(), { recursive: true });
  await writeFile(getConfigPath(), `${JSON.stringify(next, null, 2)}\n`, "utf8");

  return next;
}

export function toPublicOpenClawConfig(config: OpenClawConfig): PublicOpenClawConfig {
  return {
    endpoint: config.endpoint,
    enabled: config.enabled,
    model: config.model,
    models: config.models,
    provider: config.provider,
    timeoutMs: config.timeoutMs,
    updatedAt: config.updatedAt,
    apiKeyConfigured: config.apiKey.length > 0,
  };
}
