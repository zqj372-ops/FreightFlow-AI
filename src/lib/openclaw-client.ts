import { requestAiModel } from "./ai-model-client";
import { readOpenClawConfig } from "./openclaw-config";

type OpenClawJsonRequest = {
  context?: Record<string, unknown>;
  prompt: string;
};

function stripJsonFence(value: string) {
  return value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

export function parseOpenClawJson<T>(data: unknown): T | null {
  if (!data || typeof data !== "object") return null;

  const directJson = (data as { json?: unknown }).json;
  if (directJson && typeof directJson === "object") return directJson as T;

  const nestedData = (data as { data?: unknown }).data;
  if (nestedData && typeof nestedData === "object") {
    const nested = parseOpenClawJson<T>(nestedData);
    if (nested) return nested;
  }

  const reply = (data as { reply?: unknown }).reply;
  if (typeof reply !== "string") return null;

  try {
    return JSON.parse(stripJsonFence(reply)) as T;
  } catch {
    const match = reply.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

export async function requestOpenClawJson<T>({ context, prompt }: OpenClawJsonRequest): Promise<T | null> {
  const config = await readOpenClawConfig();
  if (!config.enabled) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await requestAiModel(config, {
      context,
      json: true,
      prompt,
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const data = response.data && typeof response.data === "object" ? response.data : {};
    return parseOpenClawJson<T>({ ...data, reply: response.reply });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
