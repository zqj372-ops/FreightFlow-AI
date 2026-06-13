import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type OpenClawConfig = {
  apiKey: string;
  endpoint: string;
  enabled: boolean;
  model: string;
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
  model: "",
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

function normalizeConfig(raw: RawOpenClawConfig | null | undefined): OpenClawConfig {
  return {
    apiKey: typeof raw?.apiKey === "string" ? raw.apiKey.trim() : "",
    endpoint: typeof raw?.endpoint === "string" ? raw.endpoint.trim() : "",
    enabled: Boolean(raw?.enabled),
    model: typeof raw?.model === "string" ? raw.model.trim() : "",
    timeoutMs: normalizeTimeout(raw?.timeoutMs),
    updatedAt: typeof raw?.updatedAt === "string" ? raw.updatedAt : null,
  };
}

function envConfig(): OpenClawConfig {
  const endpoint = process.env.OPENCLAW_API_URL?.trim() ?? "";

  return normalizeConfig({
    apiKey: process.env.OPENCLAW_API_KEY?.trim() ?? "",
    endpoint,
    enabled: Boolean(endpoint),
    model: process.env.OPENCLAW_MODEL?.trim() ?? "",
    timeoutMs: process.env.OPENCLAW_TIMEOUT_MS,
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
  return stored ?? envConfig();
}

export async function saveOpenClawConfig(input: Partial<OpenClawConfig>) {
  const existing = (await readStoredOpenClawConfig()) ?? envConfig();
  const next = normalizeConfig({
    ...existing,
    ...input,
    apiKey: typeof input.apiKey === "string" ? input.apiKey : existing.apiKey,
    updatedAt: new Date().toISOString(),
  });

  if (next.enabled && !next.endpoint) {
    throw new Error("启用 OpenClaw 前必须填写服务地址。");
  }

  if (next.endpoint) {
    try {
      const url = new URL(next.endpoint);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error("OpenClaw 服务地址必须是 HTTP 或 HTTPS。");
      }
    } catch {
      throw new Error("OpenClaw 服务地址格式无效。");
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
    timeoutMs: config.timeoutMs,
    updatedAt: config.updatedAt,
    apiKeyConfigured: config.apiKey.length > 0,
  };
}
