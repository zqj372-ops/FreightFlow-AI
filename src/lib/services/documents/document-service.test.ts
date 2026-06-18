import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";

import { shipments } from "@/lib/mock-data";
import {
  generateBookingInstructionDocument,
  generateSupplementTemplate,
  recognizeShippingOrder,
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
    expect(result.content.byteLength).toBeGreaterThan(2000);
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
    expect(result.content.byteLength).toBeGreaterThan(2000);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.content);
    const sheet = workbook.getWorksheet("补料");
    expect(sheet).toBeTruthy();
    expect(sheet?.getCell("A1").value).toBe("shipper:");
    expect(sheet?.getCell("P1").value).toBe("SO");
    expect(sheet?.getCell("P2").value).toBe("COSU5519028");
    expect(sheet?.getCell("E20").value).toBe("CSNU9539462");
    expect(sheet?.getCell("G20").value).toBe("40GP");
    expect(sheet?.getCell("J22").value).toBe("1140");
    expect(sheet?.getCell("K22").value).toBe("19000");
    expect(sheet?.getCell("N22").value).toBe("78");
  });
});

describe("recognizeShippingOrder", () => {
  it("extracts SO number and container number from OCR text with context", async () => {
    const result = await recognizeShippingOrder({
      shipmentId: "SHP-240610-001",
      sourceText: "SO released. SO: OOLU8791320. Container TEMU9088771 40HQ.",
    });

    expect(result.mode).toBe("ocr");
    expect(result.status).toBe("recognized");
    expect(result.extractedFields).toMatchObject({
      containerNo: "TEMU9088771",
      containerType: "40HQ",
      soNo: "OOLU8791320",
    });
  });
});
