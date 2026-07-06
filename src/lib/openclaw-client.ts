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
  if (!config.enabled || !config.endpoint) return null;

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
        context: context ?? {},
        model: config.model || undefined,
        prompt,
        response_format: { type: "json_object" },
        source: "freightflow-ai",
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) return null;

    return parseOpenClawJson<T>(data);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
