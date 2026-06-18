import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { strToU8, zipSync } from "fflate";

import type { ShipmentRecord } from "@/lib/mock-data";

export type SoRecognitionInput = {
  shipmentId: string;
  fileName?: string | null;
  mimeType?: string | null;
  sourceText?: string | null;
};

export type SoRecognitionResult = {
  mode: "ocr" | "placeholder";
  status: "queued" | "recognized";
  shipmentId: string;
  fileName: string | null;
  extractedFields: {
    soNo: string | null;
    carrier: string | null;
    vesselVoyage: string | null;
    etd: string | null;
    containerNo: string | null;
    containerType: string | null;
  };
  confidence: number;
  warnings: string[];
};

export type DocumentField = {
  key: string;
  label: string;
  required: boolean;
  value: string | null;
};

export type BookingInstructionInput = {
  shipment: ShipmentRecord | Record<string, unknown>;
  shipmentId: string;
};

export type BookingInstructionDocumentResult = {
  content: Uint8Array;
  fields: DocumentField[];
  fileName: string;
  mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  mode: "generated";
  shipmentId: string;
  templateName: string;
};

export type SupplementTemplateInput = {
  shipmentId: string;
  templateType?: "agent" | "customer";
  language?: "zh-CN" | "en";
  shipment?: Record<string, unknown> | null;
};

export type SupplementTemplateResult = {
  content: Uint8Array;
  fields: DocumentField[];
  fileName: string;
  language: "zh-CN" | "en";
  mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  mode: "generated";
  shipmentId: string;
  templateName: string;
  templateType: "agent" | "customer";
};

type RawObject = Record<string, unknown>;

const bookingTemplateName = "BOOKING-YTN-LAX.docx";
const supplementTemplateName = "COSU6503267207补料-含vgm.xls";

function valueFromRecord(record: RawObject | null | undefined, key: string) {
  const value = record?.[key];
  if (typeof value === "number") return String(value);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function displayValue(record: RawObject | null | undefined, key: string, fallback = "") {
  return valueFromRecord(record, key) ?? fallback;
}

function numericText(value: string | null, fallback = "") {
  return value?.match(/[\d,.]+/)?.[0]?.replaceAll(",", "") ?? fallback;
}

function splitVesselVoyage(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { vesselName: value.trim(), voyageNo: "" };

  const voyageNo = parts.at(-1) ?? "";
  return {
    vesselName: parts.slice(0, -1).join(" "),
    voyageNo,
  };
}

function estimateTareWeight(containerType: string) {
  if (/20/.test(containerType)) return 2300;
  if (/45/.test(containerType)) return 4700;
  if (/40/.test(containerType)) return 3900;
  return 0;
}

function escapeXml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

function columnName(index: number) {
  let current = index + 1;
  let name = "";
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
}

function xlsxCell(rowIndex: number, columnIndex: number, value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  const cellRef = `${columnName(columnIndex)}${rowIndex + 1}`;
  return `<c r="${cellRef}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
}

function buildSheetXml(rows: unknown[][], widths: number[], merges: string[]) {
  const cols = widths
    .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    .join("");
  const sheetRows = rows
    .map((row, rowIndex) => {
      const cells = row.map((value, columnIndex) => xlsxCell(rowIndex, columnIndex, value)).join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");
  const mergeXml = merges.length
    ? `<mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>${cols}</cols>
  <sheetData>${sheetRows}</sheetData>
  ${mergeXml}
</worksheet>`;
}

function buildXlsxBuffer(rows: unknown[][], widths: number[], merges: string[]) {
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="补料" sheetId="1" r:id="rId1"/></sheets>
</workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`),
    "xl/worksheets/sheet1.xml": strToU8(buildSheetXml(rows, widths, merges)),
  };

  return Buffer.from(zipSync(files));
}

function buildFields(shipment: RawObject): DocumentField[] {
  return [
    { key: "batchNo", label: "批次号", value: valueFromRecord(shipment, "batchNo"), required: true },
    { key: "soNo", label: "SO号", value: valueFromRecord(shipment, "soNo"), required: true },
    { key: "containerNo", label: "柜号", value: valueFromRecord(shipment, "containerNo"), required: true },
    { key: "bookingAgent", label: "订舱代理", value: valueFromRecord(shipment, "bookingAgent"), required: true },
    { key: "carrier", label: "船公司", value: valueFromRecord(shipment, "carrier"), required: true },
    { key: "containerType", label: "柜型", value: valueFromRecord(shipment, "containerType"), required: true },
    { key: "originPort", label: "起运港", value: valueFromRecord(shipment, "originPort"), required: true },
    { key: "destinationPort", label: "目的港", value: valueFromRecord(shipment, "destinationPort"), required: true },
    { key: "vesselVoyage", label: "船名航次", value: valueFromRecord(shipment, "vesselVoyage"), required: false },
    { key: "packages", label: "件数", value: valueFromRecord(shipment, "packages"), required: false },
    { key: "grossWeight", label: "毛重", value: valueFromRecord(shipment, "grossWeight"), required: false },
    { key: "cbm", label: "体积", value: valueFromRecord(shipment, "cbm"), required: false },
    { key: "etd", label: "ETD", value: valueFromRecord(shipment, "etd"), required: true },
    { key: "eta", label: "ETA", value: valueFromRecord(shipment, "eta"), required: false },
    { key: "pickupLocation", label: "提柜点", value: valueFromRecord(shipment, "pickupLocation"), required: false },
    { key: "returnLocation", label: "还柜点", value: valueFromRecord(shipment, "returnLocation"), required: false },
  ];
}

function cell(text: string, width = 20, bold = false) {
  return new TableCell({
    borders: {
      bottom: { color: "CBD5E1", size: 1, style: BorderStyle.SINGLE },
      left: { color: "CBD5E1", size: 1, style: BorderStyle.SINGLE },
      right: { color: "CBD5E1", size: 1, style: BorderStyle.SINGLE },
      top: { color: "CBD5E1", size: 1, style: BorderStyle.SINGLE },
    },
    children: [
      new Paragraph({
        children: [new TextRun({ bold, text })],
      }),
    ],
    width: { size: width, type: WidthType.PERCENTAGE },
  });
}

function infoRow(label: string, value: string) {
  return new TableRow({
    children: [
      cell(label, 25, true),
      cell(value || "-", 75),
    ],
  });
}

export async function generateBookingInstructionDocument(
  input: BookingInstructionInput,
): Promise<BookingInstructionDocumentResult> {
  const shipment = input.shipment as RawObject;
  const vesselVoyage = displayValue(shipment, "vesselVoyage");
  const { vesselName, voyageNo } = splitVesselVoyage(vesselVoyage);
  const fields = buildFields(shipment);

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ bold: true, size: 32, text: "托书 / Booking Instruction" })],
          }),
          new Paragraph({ text: "" }),
          new Table({
            rows: [
              infoRow("Shipper 托运人", "GUANGDONG WUYOU SUPPLY CHAIN CO.,LTD"),
              infoRow("Consignee 收货人", "TULE TECHNOLOGY CO., LIMITED"),
              infoRow("Notify Party 通知人", "VALUEWAY GLOBAL LOGISTICS INC."),
              infoRow("B/F No. 托运单号码", displayValue(shipment, "batchNo")),
              infoRow("SO No.", displayValue(shipment, "soNo")),
              infoRow("Container No. 柜号", displayValue(shipment, "containerNo")),
              infoRow("Ocean Vessel 船名", displayValue(shipment, "vesselName", vesselName)),
              infoRow("Voyage 航次", displayValue(shipment, "voyageNo", voyageNo)),
              infoRow("Port of Loading 装货港", displayValue(shipment, "originPort")),
              infoRow("Port of Discharge 卸货港", displayValue(shipment, "destinationPort")),
              infoRow("Place of Delivery 目的地", displayValue(shipment, "destinationPort")),
              infoRow("Container Type 柜型", displayValue(shipment, "containerType")),
              infoRow("Packages & Goods 包装、件数及品名", `${displayValue(shipment, "packages")} STORAGE BAG`.trim()),
              infoRow("Gross Weight 毛重", displayValue(shipment, "grossWeight")),
              infoRow("Measurement 体积", displayValue(shipment, "cbm")),
              infoRow("Haulage 拖柜资料", displayValue(shipment, "pickupLocation")),
              infoRow("Return Location 还柜地点", displayValue(shipment, "returnLocation")),
              infoRow("Freight & Charges 运费", displayValue(shipment, "oceanFreightPrice")),
              infoRow("Release 放货方式", displayValue(shipment, "blTelexStatus", "TLX 电放")),
            ],
            width: { size: 100, type: WidthType.PERCENTAGE },
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [
              new TextRun({
                text: "备注：本文件由 FreightFlow AI 根据托书模板生成，操作员发送前应复核收发通、件毛体、港口和放货方式。",
              }),
            ],
          }),
        ],
      },
    ],
  });
  const content = await Packer.toBuffer(doc);

  return {
    content,
    fields,
    fileName: `${displayValue(shipment, "batchNo", input.shipmentId)}-托书.docx`,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    mode: "generated",
    shipmentId: input.shipmentId,
    templateName: bookingTemplateName,
  };
}

function parseSourceText(sourceText: string | null | undefined) {
  if (!sourceText) return {};
  const bookingRefs = sourceText.match(/\b[A-Z]{4}\d{7}\b/g) ?? [];
  const soNo = sourceText.match(/\bSO(?:\s*No\.?)?\s*[:：]?\s*([A-Z]{4}\d{7})\b/i)?.[1] ?? bookingRefs[0] ?? null;
  const containerNo =
    sourceText.match(/\b(?:container|cntr|柜号)\s*[:：]?\s*([A-Z]{4}\d{7})\b/i)?.[1]
    ?? bookingRefs.find((value) => value !== soNo)
    ?? null;

  return {
    soNo,
    containerNo,
    containerType: sourceText.match(/\b(?:20GP|40GP|40HQ|45HQ)\b/i)?.[0]?.toUpperCase() ?? null,
  };
}

export async function recognizeShippingOrder(input: SoRecognitionInput): Promise<SoRecognitionResult> {
  const parsed = parseSourceText(input.sourceText);
  const hasAnyField = Object.values(parsed).some(Boolean);
  const hasSourceText = Boolean(input.sourceText?.trim());

  return {
    mode: hasSourceText ? "ocr" : "placeholder",
    status: hasAnyField ? "recognized" : "queued",
    shipmentId: input.shipmentId,
    fileName: input.fileName?.trim() || null,
    extractedFields: {
      soNo: parsed.soNo ?? null,
      carrier: null,
      vesselVoyage: null,
      etd: null,
      containerNo: parsed.containerNo ?? null,
      containerType: parsed.containerType ?? null,
    },
    confidence: hasAnyField ? 0.35 : 0,
    warnings: hasSourceText
      ? ["OCR 已接入；字段抽取仍是规则解析，复杂 SO 版式后续可接 M3/云 OCR 做二次抽取。"]
      : ["未提供 OCR/sourceText，SO recognition 暂无可解析文本。"],
  };
}

export async function generateSupplementTemplate(input: SupplementTemplateInput): Promise<SupplementTemplateResult> {
  const shipment = input.shipment ?? {};
  const templateType = input.templateType ?? "agent";
  const language = input.language ?? "zh-CN";
  const containerType = displayValue(shipment, "containerType");
  const grossWeight = numericText(valueFromRecord(shipment, "grossWeight"));
  const tareWeight = estimateTareWeight(containerType);
  const vgmWeight = grossWeight ? String(Number(grossWeight) + tareWeight) : "";
  const fields = buildFields(shipment);

  const rows: unknown[][] = [
    ["shipper:", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "SO"],
    [
      "MOJIA SUPPLY CHAIN (SHENZHEN)LIMITED COMPANY\nAdress:601-620, Building C4, zhonghao industrial city, Xiangjiao Tang community, Bantian Street, Longgang District, Shenzhen, China\nPhone:18928444379\nName: binliu",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      displayValue(shipment, "soNo"),
    ],
    [],
    [],
    [],
    [],
    ["cnee:"],
    ["SERVICIOS DE IMPORTACION 365, S.A. de CV\nHERON RAMIREZ NO.EXT. 1615 NO.INT.\nREYNOSA, TAMAULIPAS\nTEL:626-770-3688\nEmail:ocean@starcoair.com"],
    [],
    [],
    [],
    [],
    [],
    ["notify:"],
    ["GREAT ROAD INC\nADDR: 425 Turnbull Canyon Rd, City of Industry, CA 91745\nTEL:626-250-7388\nEMAIL: OCEANOP@XK-SCM.COM"],
    [],
    [],
    [],
    [],
    ["CNTR:箱号 /柜号  尺寸", "", "", "", displayValue(shipment, "containerNo"), "", containerType, "件数单位：CTNS"],
    ["唛头", "", "", "", "货名", "", "", "", "", "件数", "重量", "柜重", "VGM重量", "体积", "AMS NO.及对应SCAC CODE", "HS CODE"],
    [
      "N/M",
      "",
      "",
      "",
      "STORAGE BAG\n\nTHIS SHIPMENT CONTAINS NO WOOD PACKING MATERIAL",
      "",
      "",
      "",
      "",
      numericText(valueFromRecord(shipment, "packages")),
      grossWeight,
      tareWeight ? String(tareWeight) : "",
      vgmWeight,
      numericText(valueFromRecord(shipment, "cbm")),
      "",
      "",
    ],
    ["", "", "", "", "TOTAL:", "", "", "", "", numericText(valueFromRecord(shipment, "packages")), grossWeight, tareWeight ? String(tareWeight) : "", vgmWeight, numericText(valueFromRecord(shipment, "cbm"))],
  ];

  const content = buildXlsxBuffer(
    rows,
    [14, 10, 10, 10, 18, 14, 10, 14, 10, 10, 10, 10, 12, 10, 22, 18],
    ["A1:O1", "A7:O7", "A14:O14", "A20:D20", "H20:I20", "J20:O20"],
  );

  return {
    content,
    fields,
    fileName: `${displayValue(shipment, "batchNo", input.shipmentId)}-补料-含vgm.xlsx`,
    language,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    mode: "generated",
    shipmentId: input.shipmentId,
    templateName: supplementTemplateName,
    templateType,
  };
}
