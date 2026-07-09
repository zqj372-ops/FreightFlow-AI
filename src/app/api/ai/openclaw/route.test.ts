import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { saveOpenClawConfig } from "@/lib/openclaw-config";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/ai/openclaw", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function postJson(body: unknown) {
  const response = await POST(makeRequest(body) as never);
  return {
    response,
    json: await response.json(),
  };
}

describe("POST /api/ai/openclaw", () => {
  let originalCwd: string;
  let tempDir: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await mkdtemp(join(tmpdir(), "freightflow-openclaw-test-"));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    delete process.env.AI_API_KEY;
    delete process.env.AI_BASE_URL;
    delete process.env.AI_MODEL;
    delete process.env.AI_PROVIDER;
    delete process.env.OPENCLAW_API_URL;
    delete process.env.OPENCLAW_API_KEY;
    vi.unstubAllGlobals();
    return rm(tempDir, { recursive: true, force: true });
  });

  it("returns a 400 response when prompt is missing", async () => {
    const { response, json } = await postJson({ shipmentId: "SHP-1" });

    expect(response.status).toBe(400);
    expect(json).toEqual({ error: "Missing prompt" });
  });

  it("returns a local stub response when OpenClaw is not configured", async () => {
    const { response, json } = await postJson({ prompt: "检查异常", shipmentId: "SHP-240610-001" });

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      mode: "stub",
      forwarded: false,
      shipmentId: "SHP-240610-001",
    });
    expect(json.reply).toContain("检查异常");
  });

  it("forwards configured requests without calling a real OpenClaw service", async () => {
    process.env.AI_PROVIDER = "openai";
    process.env.AI_API_KEY = "secret-token";
    process.env.AI_MODEL = "gpt-4.1-mini";
    const raw = { choices: [{ message: { content: "ok" } }] };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(raw), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { response, json } = await postJson({
      prompt: "总结当前柜子",
      shipmentId: "SHP-240610-001",
      context: { carrier: "OOCL" },
    });

    expect(response.status).toBe(200);
    expect(json).toEqual({
      mode: "proxy",
      provider: "openai",
      forwarded: true,
      status: 201,
      reply: "ok",
      data: { raw, reply: "ok" },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer secret-token",
        },
        body: expect.stringContaining("gpt-4.1-mini"),
      }),
    );
  });

  it("returns a 502 response when the configured OpenClaw request fails", async () => {
    process.env.AI_PROVIDER = "openai";
    process.env.AI_API_KEY = "secret-token";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));

    const { response, json } = await postJson({ prompt: "检查异常" });

    expect(response.status).toBe(502);
    expect(json).toEqual({
      mode: "proxy",
      forwarded: false,
      error: "network unavailable",
    });
  });

  it("uses saved settings before environment variables", async () => {
    process.env.AI_PROVIDER = "openai";
    process.env.AI_API_KEY = "env-token";
    await saveOpenClawConfig({
      apiKey: "saved-token",
      enabled: true,
      model: "deepseek-chat",
      provider: "deepseek",
      timeoutMs: 9000,
    });
    const raw = { choices: [{ message: { content: "saved ok" } }] };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(raw), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { response, json } = await postJson({ prompt: "检查保存配置" });

    expect(response.status).toBe(200);
    expect(json).toMatchObject({ mode: "proxy", forwarded: true, provider: "deepseek", reply: "saved ok", status: 200 });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.deepseek.com/v1/chat/completions",
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer saved-token",
        },
        body: expect.stringContaining("deepseek-chat"),
      }),
    );
  });
});
