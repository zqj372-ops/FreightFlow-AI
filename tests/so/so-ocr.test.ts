import { afterEach, describe, expect, it, vi } from "vitest";

import { runSoOcr } from "@/lib/so/so-ocr";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
});

describe("runSoOcr", () => {
  it("bypasses provider when source text is supplied", async () => {
    await expect(runSoOcr({ sourceText: "SO: OOLU8791320" })).resolves.toMatchObject({
      rawText: "SO: OOLU8791320",
      status: "OCR_DONE",
    });
  });

  it("returns not_configured for binary files without OCR endpoint", async () => {
    process.env.OCR_API_URL = "";

    await expect(runSoOcr({ fileBase64: "ZmFrZQ==", fileName: "so.pdf" })).resolves.toMatchObject({
      status: "not_configured",
    });
  });

  it("reads raw text from a configured OCR provider", async () => {
    process.env.OCR_API_URL = "https://ocr.example.test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({ rawText: "SO: OOLU8791320" }),
        ok: true,
        status: 200,
      })),
    );

    await expect(runSoOcr({ fileBase64: "ZmFrZQ==", fileName: "so.pdf" })).resolves.toMatchObject({
      provider: "http-json",
      rawText: "SO: OOLU8791320",
      status: "OCR_DONE",
    });
  });
});
