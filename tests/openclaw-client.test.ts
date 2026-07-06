import { describe, expect, it } from "vitest";

import { parseOpenClawJson } from "@/lib/openclaw-client";

describe("parseOpenClawJson", () => {
  it("reads direct json payloads", () => {
    expect(parseOpenClawJson<{ ok: boolean }>({ json: { ok: true } })).toEqual({ ok: true });
  });

  it("reads fenced JSON replies", () => {
    expect(parseOpenClawJson<{ subject: string }>({ reply: '```json\n{"subject":"Booking"}\n```' })).toEqual({
      subject: "Booking",
    });
  });

  it("returns null for non-json replies", () => {
    expect(parseOpenClawJson({ reply: "plain text" })).toBeNull();
  });
});
