import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { POST } from "./route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/so/extract", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function postJson(body: unknown) {
  const response = await POST(makeRequest(body) as never);
  return {
    json: await response.json(),
    response,
  };
}

describe("POST /api/so/extract", () => {
  let originalCwd: string;
  let tempDir: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await mkdtemp(join(tmpdir(), "freightflow-so-extract-test-"));
    process.chdir(tempDir);
    delete process.env.AI_API_KEY;
    delete process.env.AI_BASE_URL;
    delete process.env.AI_MODEL;
    delete process.env.AI_PROVIDER;
    delete process.env.OPENCLAW_API_KEY;
    delete process.env.OPENCLAW_API_URL;
  });

  afterEach(() => {
    process.chdir(originalCwd);
    return rm(tempDir, { recursive: true, force: true });
  });

  it("returns a 400 response when OCR text is missing", async () => {
    const { json, response } = await postJson({});

    expect(response.status).toBe(400);
    expect(json).toEqual({ error: "rawText is required before SO extraction." });
  });

  it("returns confidence per extracted field and marks low-confidence fields for review", async () => {
    const { json, response } = await postJson({
      rawText: [
        "SO: OOLU8791320",
        "Carrier: OOCL",
        "Vessel: OOCL Rauma",
        "Voyage: 068E",
        "ETD: 2026-06-12 23:00",
        "POL: Yantian",
        "POD: Vancouver",
        "Booking Agent: New Review Desk",
      ].join("\n"),
    });

    expect(response.status).toBe(200);
    expect(json.data.extraction.status).toBe("NEED_REVIEW");
    expect(json.data.extraction.fields.every((field: { confidence?: unknown }) => typeof field.confidence === "number")).toBe(true);
    expect(json.data.validation.lowConfidenceFields).toContain("bookingAgent");
  });
});
