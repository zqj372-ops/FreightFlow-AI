import { describe, expect, it } from "vitest";

import { extractSoFields } from "@/lib/so/so-extractor";

const rawSo = [
  "SO: OOLU8791320",
  "Carrier: OOCL",
  "Vessel: OOCL Rauma",
  "Voyage: 068E",
  "ETD: 2026-06-12 23:00",
  "ETA: 2026-06-28 09:00",
  "POL: Yantian",
  "POD: Vancouver",
  "Container Quantity: 1",
  "Container Type: 40HQ",
  "Pickup Location: Yantian Depot 3",
  "Return Location: Yantian Terminal 7",
].join("\n");

describe("extractSoFields", () => {
  it("extracts booking fields from OCR text", () => {
    const result = extractSoFields(rawSo);
    const fields = new Map(result.fields.map((field) => [field.fieldKey, field.value]));

    expect(fields.get("soNo")).toBe("OOLU8791320");
    expect(fields.get("carrier")).toBe("OOCL");
    expect(fields.get("vessel")).toBe("OOCL Rauma");
    expect(fields.get("voyage")).toBe("068E");
    expect(fields.get("containerType")).toBe("40HQ");
    expect(result.confidence).toBeGreaterThan(0.7);
  });
});
