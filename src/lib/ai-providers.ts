export type AiProviderKind = "anthropic" | "gemini" | "openai-compatible";

export type AiProviderId =
  | "360_zhinao"
  | "anthropic"
  | "baichuan"
  | "baidu_qianfan"
  | "custom"
  | "deepseek"
  | "gemini"
  | "groq"
  | "huawei_maas"
  | "infini_ai"
  | "kimi"
  | "lingyiwanwu"
  | "mistral"
  | "minimax"
  | "modelscope"
  | "openai"
  | "openrouter"
  | "perplexity"
  | "ppio"
  | "qwen"
  | "qiniu"
  | "sensenova"
  | "siliconflow"
  | "spark"
  | "stepfun"
  | "together"
  | "tencent_hunyuan"
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
    models: ["qwen-plus", "qwen-max", "qwen-turbo", "qwen-long", "qwq-plus", "qwen3-coder-plus"],
  },
  {
    baseUrl: "https://qianfan.baidubce.com/v2",
    defaultModel: "ernie-4.0-turbo-8k",
    id: "baidu_qianfan",
    kind: "openai-compatible",
    label: "百度千帆 / 文心 ERNIE",
    models: ["ernie-4.0-turbo-8k", "ernie-3.5-8k", "deepseek-v3.2", "deepseek-r1"],
  },
  {
    baseUrl: "https://api.baichuan-ai.com/v1",
    defaultModel: "Baichuan4-Turbo",
    id: "baichuan",
    kind: "openai-compatible",
    label: "百川智能 Baichuan",
    models: ["Baichuan4-Turbo", "Baichuan4-Air", "Baichuan3-Turbo", "Baichuan-M2-32B"],
  },
  {
    baseUrl: "https://api.360.cn/v1",
    defaultModel: "minimax/MiniMax-M2.5",
    id: "360_zhinao",
    kind: "openai-compatible",
    label: "360 智脑 API",
    models: ["minimax/MiniMax-M2.5", "deepseek/DeepSeek-R1", "qwen/Qwen3-235B-A22B-Instruct-2507", "zhipu/GLM-4.5"],
  },
  {
    baseUrl: "https://api.modelarts-maas.com/openai/v1",
    defaultModel: "GLM-5.2",
    id: "huawei_maas",
    kind: "openai-compatible",
    label: "华为云 MaaS / 盘古",
    models: ["GLM-5.2", "DeepSeek-R1", "DeepSeek-V3"],
  },
  {
    baseUrl: "https://api.qnaigc.com/v1",
    defaultModel: "deepseek/deepseek-r1",
    id: "qiniu",
    kind: "openai-compatible",
    label: "七牛云 AI",
    models: ["deepseek/deepseek-r1", "qwen/qwen3-coder", "moonshotai/kimi-k2", "doubao/doubao-seed-1-6"],
  },
  {
    baseUrl: "https://cloud.infini-ai.com/maas/v1",
    defaultModel: "kimi-k2.6",
    id: "infini_ai",
    kind: "openai-compatible",
    label: "无问芯穹 InfiniAI",
    models: ["kimi-k2.6", "deepseek-v4", "deepseek-r1", "qwen3-coder"],
  },
  {
    baseUrl: "https://api.ppio.com/openai",
    defaultModel: "deepseek/deepseek-v3-0324",
    id: "ppio",
    kind: "openai-compatible",
    label: "PPIO 派欧云",
    models: ["deepseek/deepseek-v3-0324", "deepseek/deepseek-r1", "qwen/qwen3-235b-a22b", "qwen/qwen-2.5-72b-instruct"],
  },
  {
    baseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-32k",
    id: "kimi",
    kind: "openai-compatible",
    label: "Moonshot Kimi",
    models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k", "kimi-k2-0711-preview"],
  },
  {
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4-flash",
    id: "zhipu",
    kind: "openai-compatible",
    label: "智谱 GLM",
    models: ["glm-4.5", "glm-4.5-air", "glm-4-plus", "glm-4-air", "glm-4-flash"],
  },
  {
    baseUrl: "https://api.minimaxi.com/v1",
    defaultModel: "MiniMax-M3",
    id: "minimax",
    kind: "openai-compatible",
    label: "MiniMax",
    models: ["MiniMax-M3", "MiniMax-M2.1", "MiniMax-Text-01"],
  },
  {
    baseUrl: "https://api.hunyuan.cloud.tencent.com/v1",
    defaultModel: "hunyuan-turbos-latest",
    id: "tencent_hunyuan",
    kind: "openai-compatible",
    label: "腾讯混元 Hunyuan",
    models: ["hunyuan-turbos-latest", "hunyuan-lite", "hunyuan-standard", "hunyuan-large"],
  },
  {
    baseUrl: "https://spark-api-open.xf-yun.com/v1",
    defaultModel: "generalv3.5",
    id: "spark",
    kind: "openai-compatible",
    label: "讯飞星火 Spark",
    models: ["generalv3.5", "generalv3", "general", "pro-128k"],
  },
  {
    baseUrl: "https://api.stepfun.com/v1",
    defaultModel: "step-3.7-flash",
    id: "stepfun",
    kind: "openai-compatible",
    label: "阶跃星辰 StepFun",
    models: ["step-3.7-flash", "step-3.5-flash", "step-3.5-flash-2603"],
  },
  {
    baseUrl: "https://api.sensenova.cn/compatible-mode/v2",
    defaultModel: "SenseChat-5",
    id: "sensenova",
    kind: "openai-compatible",
    label: "商汤日日新 SenseNova",
    models: ["SenseChat-5", "sensenova-6.7-flash-lite", "deepseek-v4-flash"],
  },
  {
    baseUrl: "https://api-inference.modelscope.cn/v1",
    defaultModel: "Qwen/Qwen3-235B-A22B-Instruct-2507",
    id: "modelscope",
    kind: "openai-compatible",
    label: "魔搭 ModelScope",
    models: [
      "Qwen/Qwen3-235B-A22B-Instruct-2507",
      "Qwen/Qwen3-Coder-480B-A35B-Instruct",
      "deepseek-ai/DeepSeek-V3.1",
    ],
  },
  {
    baseUrl: "https://api.lingyiwanwu.com/v1",
    defaultModel: "yi-large",
    id: "lingyiwanwu",
    kind: "openai-compatible",
    label: "零一万物 01.AI",
    models: ["yi-large", "yi-medium", "yi-spark"],
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
    defaultModel: "doubao-seed-1-6-250615",
    id: "volcengine",
    kind: "openai-compatible",
    label: "火山方舟 Ark",
    models: ["doubao-seed-1-6-250615", "deepseek-v3-250324", "deepseek-r1-250528"],
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
