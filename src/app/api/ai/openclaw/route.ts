import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

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
  provider: "stub" | "openclaw";
  endpoint?: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "OpenClaw request failed";
}

function getReplyText(data: unknown) {
  if (!data || typeof data !== "object") return null;

  const reply = (data as { reply?: unknown }).reply;
  return typeof reply === "string" ? reply : null;
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
  const endpoint = config.enabled ? config.endpoint : "";

  if (!body.prompt) {
    return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
  }

  const startedAt = Date.now();

  if (!endpoint) {
    const auditId = await startAiAudit({
      prompt: body.prompt,
      shipmentId: body.shipmentId,
      context: body.context,
      provider: "stub",
    });
    const reply = `已收到指令：${body.prompt}。当前为本地占位接口，配置 OPENCLAW_API_URL 后即可转发到服务器内的 OpenClaw。`;

    await completeAiAudit(auditId, {
      status: "SUCCESS",
      reply,
      responseTimeMs: Date.now() - startedAt,
    });

    return NextResponse.json({
      mode: "stub",
      message: "OpenClaw endpoint is not configured yet.",
      reply,
      forwarded: false,
      shipmentId: body.shipmentId ?? null,
    });
  }

  const auditId = await startAiAudit({
    prompt: body.prompt,
    shipmentId: body.shipmentId,
    context: body.context,
    provider: "openclaw",
    endpoint,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey
          ? { Authorization: `Bearer ${config.apiKey}` }
          : {}),
      },
      body: JSON.stringify({
        prompt: body.prompt,
        shipmentId: body.shipmentId,
        context: body.context ?? {},
        model: config.model || undefined,
        source: "freightflow-ai",
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));
    const reply = getReplyText(data);
    const responseTimeMs = Date.now() - startedAt;

    if (!response.ok) {
      const errorMessage = `OpenClaw returned HTTP ${response.status}`;

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
          status: response.status,
          data,
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
      forwarded: true,
      status: response.status,
      data,
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
