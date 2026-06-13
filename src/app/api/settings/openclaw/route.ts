import { NextRequest, NextResponse } from "next/server";

import {
  readOpenClawConfig,
  saveOpenClawConfig,
  toPublicOpenClawConfig,
  type OpenClawConfig,
} from "@/lib/openclaw-config";

type SavePayload = Partial<Pick<OpenClawConfig, "apiKey" | "enabled" | "endpoint" | "model" | "timeoutMs">>;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "OpenClaw settings request failed";
}

async function testOpenClawConnection(config: OpenClawConfig) {
  if (!config.enabled || !config.endpoint) {
    return {
      ok: false,
      message: "OpenClaw 尚未启用或服务地址为空。",
    };
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        prompt: "FreightFlow AI OpenClaw connection test. Reply with ok.",
        context: { source: "freightflow-ai-settings" },
        model: config.model || undefined,
        source: "freightflow-ai",
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    return {
      ok: response.ok,
      status: response.status,
      responseTimeMs: Date.now() - startedAt,
      message: response.ok ? "OpenClaw 连接测试成功。" : `OpenClaw 返回 HTTP ${response.status}。`,
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
    const config = await saveOpenClawConfig(body);
    const test = body.test ? await testOpenClawConnection(config) : null;

    return NextResponse.json({
      config: toPublicOpenClawConfig(config),
      test,
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}
