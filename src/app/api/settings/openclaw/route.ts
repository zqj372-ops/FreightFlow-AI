import { NextRequest, NextResponse } from "next/server";

import { fetchAiModels, requestAiModel } from "@/lib/ai-model-client";
import {
  readOpenClawConfig,
  saveOpenClawConfig,
  toPublicOpenClawConfig,
  type OpenClawConfig,
} from "@/lib/openclaw-config";

type SavePayload = Partial<Pick<OpenClawConfig, "apiKey" | "enabled" | "endpoint" | "model" | "models" | "provider" | "timeoutMs">>;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "AI settings request failed";
}

async function testAiConnection(config: OpenClawConfig) {
  if (!config.enabled) {
    return {
      ok: false,
      message: "AI 大模型尚未启用。",
    };
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const result = await requestAiModel(config, {
      context: { source: "freightflow-ai-settings" },
      prompt: "FreightFlow AI connection test. Reply with ok.",
      signal: controller.signal,
    });

    return {
      ok: result.ok,
      status: result.status,
      responseTimeMs: Date.now() - startedAt,
      message: result.ok ? "AI 大模型连接测试成功。" : `AI 大模型返回 HTTP ${result.status}。`,
    };
  } catch (error) {
    return {
      ok: false,
      responseTimeMs: Date.now() - startedAt,
      message: getErrorMessage(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  try {
    const config = await readOpenClawConfig();

    return NextResponse.json({
      config: toPublicOpenClawConfig(config),
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as SavePayload & { test?: boolean };

  try {
    let config = await saveOpenClawConfig(body);
    const models = await fetchAiModels(config);
    const model = config.model || models[0] || "";
    config = await saveOpenClawConfig({ models, model });
    const test = body.test ? await testAiConnection(config) : null;

    return NextResponse.json({
      config: toPublicOpenClawConfig(config),
      test,
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}
