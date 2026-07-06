export type AiProviderKind = "anthropic" | "gemini" | "openai-compatible";

export type AiProviderId =
  | "anthropic"
  | "custom"
  | "deepseek"
  | "gemini"
  | "groq"
  | "kimi"
  | "mistral"
  | "openai"
  | "openrouter"
  | "perplexity"
  | "qwen"
  | "siliconflow"
  | "together"
  | "volcengine"
  | "xai"
  | "zhipu";

export type AiProviderPreset = {
  baseUrl: string;
  defaultModel: string;
  id: AiProviderId;
  kind: AiProviderKind;
  label: string;
  models: string[];
  requiresBaseUrl?: boolean;
};

export const AI_PROVIDER_PRESETS: AiProviderPreset[] = [
  {
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4.1-mini",
    id: "openai",
    kind: "openai-compatible",
    label: "OpenAI",
    models: ["gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini", "o4-mini"],
  },
  {
    baseUrl: "https://api.anthropic.com",
    defaultModel: "claude-3-5-sonnet-latest",
    id: "anthropic",
    kind: "anthropic",
    label: "Anthropic Claude",
    models: ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest", "claude-3-opus-latest"],
  },
  {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-1.5-pro",
    id: "gemini",
    kind: "gemini",
    label: "Google Gemini",
    models: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"],
  },
  {
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-4o-mini",
    id: "openrouter",
    kind: "openai-compatible",
    label: "OpenRouter",
    models: ["openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet", "google/gemini-flash-1.5", "deepseek/deepseek-chat"],
  },
  {
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    id: "deepseek",
    kind: "openai-compatible",
    label: "DeepSeek",
    models: ["deepseek-chat", "deepseek-reasoner"],
  },
  {
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-plus",
    id: "qwen",
    kind: "openai-compatible",
    label: "阿里通义千问 Qwen",
    models: ["qwen-plus", "qwen-max", "qwen-turbo", "qwen-long"],
  },
  {
    baseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-32k",
    id: "kimi",
    kind: "openai-compatible",
    label: "Moonshot Kimi",
    models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
  },
  {
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4-flash",
    id: "zhipu",
    kind: "openai-compatible",
    label: "智谱 GLM",
    models: ["glm-4-plus", "glm-4-air", "glm-4-flash"],
  },
  {
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.1-70b-versatile",
    id: "groq",
    kind: "openai-compatible",
    label: "Groq",
    models: ["llama-3.1-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
  },
  {
    baseUrl: "https://api.together.xyz/v1",
    defaultModel: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
    id: "together",
    kind: "openai-compatible",
    label: "Together AI",
    models: ["meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo", "mistralai/Mixtral-8x7B-Instruct-v0.1"],
  },
  {
    baseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-large-latest",
    id: "mistral",
    kind: "openai-compatible",
    label: "Mistral",
    models: ["mistral-large-latest", "mistral-small-latest", "open-mixtral-8x7b"],
  },
  {
    baseUrl: "https://api.x.ai/v1",
    defaultModel: "grok-2-latest",
    id: "xai",
    kind: "openai-compatible",
    label: "xAI Grok",
    models: ["grok-2-latest", "grok-2-vision-latest"],
  },
  {
    baseUrl: "https://api.perplexity.ai",
    defaultModel: "sonar-pro",
    id: "perplexity",
    kind: "openai-compatible",
    label: "Perplexity",
    models: ["sonar-pro", "sonar", "sonar-reasoning-pro"],
  },
  {
    baseUrl: "https://api.siliconflow.cn/v1",
    defaultModel: "Qwen/Qwen2.5-72B-Instruct",
    id: "siliconflow",
    kind: "openai-compatible",
    label: "SiliconFlow",
    models: ["Qwen/Qwen2.5-72B-Instruct", "deepseek-ai/DeepSeek-V2.5", "meta-llama/Meta-Llama-3.1-70B-Instruct"],
  },
  {
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModel: "",
    id: "volcengine",
    kind: "openai-compatible",
    label: "火山方舟 Ark",
    models: [],
  },
  {
    baseUrl: "",
    defaultModel: "",
    id: "custom",
    kind: "openai-compatible",
    label: "自定义 OpenAI 兼容",
    models: [],
    requiresBaseUrl: true,
  },
];

export const DEFAULT_AI_PROVIDER_ID: AiProviderId = "openai";

export function getAiProviderPreset(value: string | null | undefined) {
  return AI_PROVIDER_PRESETS.find((provider) => provider.id === value) ?? AI_PROVIDER_PRESETS[0];
}

export function resolveAiBaseUrl(providerId: string, baseUrl: string) {
  return (baseUrl.trim() || getAiProviderPreset(providerId).baseUrl).replace(/\/+$/, "");
}
