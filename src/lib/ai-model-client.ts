import { getAiProviderPreset, resolveAiBaseUrl } from "./ai-providers";
import type { OpenClawConfig } from "./openclaw-config";

type AiRequest = {
  context?: Record<string, unknown>;
  json?: boolean;
  prompt: string;
  signal?: AbortSignal;
};

type ProviderRequest = {
  body?: unknown;
  headers: Record<string, string>;
  method: "GET" | "POST";
  url: string;
};

const SYSTEM_PROMPT =
  "You are FreightFlow AI, a shipping operations assistant. Answer in Chinese unless the user asks otherwise.";

function getModel(config: OpenClawConfig) {
  const preset = getAiProviderPreset(config.provider);
  return config.model || preset.defaultModel || preset.models[0] || "";
}

function withContext(input: AiRequest) {
  const context = input.context ? `\n\nContext JSON:\n${JSON.stringify(input.context)}` : "";
  return `${input.prompt}${context}`;
}

function anthropicVersion() {
  return "2023-06-01";
}

function openAiRequest(config: OpenClawConfig, input: AiRequest): ProviderRequest {
  const model = getModel(config);
  const body: Record<string, unknown> = {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: withContext(input) },
    ],
    model,
    temperature: 0.2,
  };

  if (input.json) body.response_format = { type: "json_object" };

  return {
    body,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
    url: `${resolveAiBaseUrl(config.provider, config.endpoint)}/chat/completions`,
  };
}

function anthropicRequest(config: OpenClawConfig, input: AiRequest): ProviderRequest {
  return {
    body: {
      max_tokens: 1600,
      messages: [{ role: "user", content: withContext(input) }],
      model: getModel(config),
      system: input.json ? `${SYSTEM_PROMPT} Return JSON only.` : SYSTEM_PROMPT,
      temperature: 0.2,
    },
    headers: {
      "anthropic-version": anthropicVersion(),
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
    },
    method: "POST",
    url: `${resolveAiBaseUrl(config.provider, config.endpoint)}/v1/messages`,
  };
}

function geminiRequest(config: OpenClawConfig, input: AiRequest): ProviderRequest {
  const url = new URL(`${resolveAiBaseUrl(config.provider, config.endpoint)}/models/${getModel(config)}:generateContent`);
  url.searchParams.set("key", config.apiKey);

  return {
    body: {
      contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n${withContext(input)}` }], role: "user" }],
      generationConfig: {
        ...(input.json ? { responseMimeType: "application/json" } : {}),
        temperature: 0.2,
      },
    },
    headers: { "Content-Type": "application/json" },
    method: "POST",
    url: url.toString(),
  };
}

function buildAiRequest(config: OpenClawConfig, input: AiRequest) {
  const provider = getAiProviderPreset(config.provider);
  if (provider.kind === "anthropic") return anthropicRequest(config, input);
  if (provider.kind === "gemini") return geminiRequest(config, input);

  return openAiRequest(config, input);
}

function getReplyText(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;

  const reply = record.reply;
  if (typeof reply === "string") return reply;

  const choices = record.choices;
  if (Array.isArray(choices)) {
    const firstChoice = choices[0] as Record<string, unknown> | undefined;
    const message = firstChoice?.message as Record<string, unknown> | undefined;
    if (typeof message?.content === "string") return message.content;
  }

  const content = record.content;
  if (Array.isArray(content)) {
    const text = content.map((item) => (typeof item?.text === "string" ? item.text : "")).join("");
    if (text.trim()) return text;
  }

  const candidates = record.candidates;
  if (Array.isArray(candidates)) {
    const parts = ((candidates[0] as Record<string, unknown> | undefined)?.content as Record<string, unknown> | undefined)?.parts;
    if (Array.isArray(parts)) {
      const text = parts.map((item) => (typeof item?.text === "string" ? item.text : "")).join("");
      if (text.trim()) return text;
    }
  }

  return null;
}

function modelIdsFromData(data: unknown, providerId: string) {
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  const rows = Array.isArray(record.data) ? record.data : Array.isArray(record.models) ? record.models : [];

  return rows
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const row = item as Record<string, unknown>;
      const id = typeof row.id === "string" ? row.id : typeof row.name === "string" ? row.name.replace(/^models\//, "") : "";
      if (providerId === "gemini") {
        const methods = row.supportedGenerationMethods;
        if (Array.isArray(methods) && !methods.includes("generateContent")) return "";
      }
      return id;
    })
    .filter((id): id is string => id.length > 0);
}

export async function requestAiModel(config: OpenClawConfig, input: AiRequest) {
  const request = buildAiRequest(config, input);
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body ? JSON.stringify(request.body) : undefined,
    cache: "no-store",
    signal: input.signal,
  });
  const data = await response.json().catch(() => null);
  const reply = getReplyText(data);

  return {
    data,
    ok: response.ok,
    reply,
    request,
    status: response.status,
  };
}

export async function fetchAiModels(config: OpenClawConfig) {
  const preset = getAiProviderPreset(config.provider);
  if (!config.apiKey) return preset.models;

  const baseUrl = resolveAiBaseUrl(config.provider, config.endpoint);
  const request: ProviderRequest =
    preset.kind === "anthropic"
      ? {
          headers: { "anthropic-version": anthropicVersion(), "x-api-key": config.apiKey },
          method: "GET",
          url: `${baseUrl}/v1/models`,
        }
      : preset.kind === "gemini"
        ? {
            headers: {},
            method: "GET",
            url: `${baseUrl}/models?key=${encodeURIComponent(config.apiKey)}`,
          }
        : {
            headers: { Authorization: `Bearer ${config.apiKey}` },
            method: "GET",
            url: `${baseUrl}/models`,
          };

  try {
    const response = await fetch(request.url, { headers: request.headers, method: request.method, cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (!response.ok) return preset.models;

    const models = modelIdsFromData(data, config.provider);
    return models.length > 0 ? models : preset.models;
  } catch {
    return preset.models;
  }
}
