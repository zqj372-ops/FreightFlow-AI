import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import { shipments } from "@/lib/mock-data";
import {
  generateBookingInstructionDocument,
  generateSupplementTemplate,
} from "./document-service";

describe("generateBookingInstructionDocument", () => {
  it("creates a Word booking instruction document from shipment fields", async () => {
    const result = await generateBookingInstructionDocument({
      shipment: {
        ...shipments[1],
        packages: "750 CTNS",
        grossWeight: "13000KG",
        cbm: "78CBM",
      },
      shipmentId: shipments[1].id,
    });

    expect(result.mode).toBe("generated");
    expect(result.fileName).toBe("FF-US-240610-B03-托书.docx");
    expect(result.mimeType).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(result.content.byteLength).toBeGreaterThan(5000);
    expect(result.content[0]).toBe(0x50);
    expect(result.content[1]).toBe(0x4b);
    expect(result.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "batchNo", value: "FF-US-240610-B03" }),
        expect.objectContaining({ key: "originPort", value: "Ningbo" }),
        expect.objectContaining({ key: "destinationPort", value: "Los Angeles" }),
      ]),
    );
  });
});

describe("generateSupplementTemplate", () => {
  it("creates an Excel supplement template with SO and container details", async () => {
    const result = await generateSupplementTemplate({
      shipment: {
        ...shipments[1],
        cbm: "78",
        containerNo: "CSNU9539462",
        grossWeight: "19000",
        packages: "1140",
      },
      shipmentId: shipments[1].id,
    });

    expect(result.mode).toBe("generated");
    expect(result.fileName).toBe("FF-US-240610-B03-补料-含vgm.xlsx");
    expect(result.mimeType).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(result.content.byteLength).toBeGreaterThan(5000);

    const workbook = XLSX.read(result.content, { type: "array" });
    const sheet = workbook.Sheets["补料"];
    expect(sheet).toBeTruthy();
    expect(sheet.A1?.v).toBe("shipper:");
    expect(sheet.P1?.v).toBe("SO");
    expect(sheet.P2?.v).toBe("COSU5519028");
    expect(sheet.E20?.v).toBe("CSNU9539462");
    expect(sheet.G20?.v).toBe("40GP");
    expect(sheet.J22?.v).toBe("1140");
    expect(sheet.K22?.v).toBe("19000");
    expect(sheet.N22?.v).toBe("78");
  });
});
