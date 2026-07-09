import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { requestAiModel } from "@/lib/ai-model-client";
import { resolveAiBaseUrl } from "@/lib/ai-providers";
import { readOpenClawConfig } from "@/lib/openclaw-config";
import { prisma } from "@/lib/prisma";

type OpenClawRequest = {
  prompt?: string;
  shipmentId?: string;
  context?: Record<string, unknown>;
};

type AiAuditInput = {
  prompt: string;
  shipmentId?: string;
  context?: Record<string, unknown>;
  provider: string;
  endpoint?: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "AI model request failed";
}

function getRequestContext(context: Record<string, unknown> | undefined): Prisma.InputJsonValue {
  return context ? JSON.parse(JSON.stringify(context)) : {};
}

async function startAiAudit(input: AiAuditInput) {
  try {
    const record = await prisma.aiRequest.create({
      data: {
        prompt: input.prompt,
        shipmentId: input.shipmentId,
        requestStatus: "LOADING",
        requestContext: getRequestContext(input.context),
        provider: input.provider,
        endpoint: input.endpoint,
      },
      select: { id: true },
    });

    return record.id;
  } catch (error) {
    console.warn("AI request audit start skipped", error);
    return null;
  }
}

async function completeAiAudit(
  auditId: string | null,
  data: {
    status: "SUCCESS" | "ERROR";
    reply?: string | null;
    responseTimeMs: number;
    errorMessage?: string;
  },
) {
  if (!auditId) return;

  try {
    await prisma.aiRequest.update({
      where: { id: auditId },
      data: {
        requestStatus: data.status,
        reply: data.reply,
        responseTimeMs: data.responseTimeMs,
        errorMessage: data.errorMessage,
        completedAt: new Date(),
      },
    });
  } catch (error) {
    console.warn("AI request audit completion skipped", error);
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as OpenClawRequest;
  const config = await readOpenClawConfig();

  if (!body.prompt) {
    return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
  }

  const startedAt = Date.now();

  if (!config.enabled) {
    const auditId = await startAiAudit({
      prompt: body.prompt,
      shipmentId: body.shipmentId,
      context: body.context,
      provider: "stub",
    });
    const reply = `已收到指令：${body.prompt}。当前为本地占位接口，配置 AI 大模型 API Key 后即可调用真实模型。`;

    await completeAiAudit(auditId, {
      status: "SUCCESS",
      reply,
      responseTimeMs: Date.now() - startedAt,
    });

    return NextResponse.json({
      mode: "stub",
      message: "AI model provider is not configured yet.",
      reply,
      forwarded: false,
      shipmentId: body.shipmentId ?? null,
    });
  }

  const auditId = await startAiAudit({
    prompt: body.prompt,
    shipmentId: body.shipmentId,
    context: body.context,
    provider: config.provider,
    endpoint: resolveAiBaseUrl(config.provider, config.endpoint),
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const result = await requestAiModel(config, {
      context: { ...(body.context ?? {}), shipmentId: body.shipmentId },
      prompt: body.prompt,
      signal: controller.signal,
    });
    const reply = result.reply;
    const responseTimeMs = Date.now() - startedAt;

    if (!result.ok) {
      const errorMessage = `AI provider returned HTTP ${result.status}`;

      await completeAiAudit(auditId, {
        status: "ERROR",
        reply,
        responseTimeMs,
        errorMessage,
      });

      return NextResponse.json(
        {
          mode: "proxy",
          forwarded: true,
          status: result.status,
          data: result.data,
          error: errorMessage,
        },
      );
    }

    await completeAiAudit(auditId, {
      status: "SUCCESS",
      reply,
      responseTimeMs,
    });

    return NextResponse.json({
      mode: "proxy",
      provider: config.provider,
      forwarded: true,
      status: result.status,
      reply,
      data: {
        raw: result.data,
        reply,
      },
    });
  } catch (error) {
    const errorMessage = getErrorMessage(error);

    await completeAiAudit(auditId, {
      status: "ERROR",
      responseTimeMs: Date.now() - startedAt,
      errorMessage,
    });

    return NextResponse.json(
      {
        mode: "proxy",
        forwarded: false,
        error: errorMessage,
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
