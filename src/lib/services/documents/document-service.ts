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
import * as XLSX from "xlsx";

import type { ShipmentRecord } from "@/lib/mock-data";

export type SoRecognitionInput = {
  shipmentId: string;
  fileName?: string | null;
  mimeType?: string | null;
  sourceText?: string | null;
};

export type SoRecognitionResult = {
  mode: "placeholder";
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

  return {
    soNo: sourceText.match(/\b[A-Z]{4}\d{7}\b/)?.[0] ?? null,
    containerNo: sourceText.match(/\b[A-Z]{4}\d{7}\b/)?.[0] ?? null,
    containerType: sourceText.match(/\b(?:20GP|40GP|40HQ|45HQ)\b/i)?.[0]?.toUpperCase() ?? null,
  };
}

export async function recognizeShippingOrder(input: SoRecognitionInput): Promise<SoRecognitionResult> {
  const parsed = parseSourceText(input.sourceText);
  const hasAnyField = Object.values(parsed).some(Boolean);

  return {
    mode: "placeholder",
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
    warnings: [
      "SO recognition is a replaceable placeholder; wire OCR/parser provider before production use.",
    ],
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

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 14 } },
    { s: { r: 6, c: 0 }, e: { r: 6, c: 14 } },
    { s: { r: 13, c: 0 }, e: { r: 13, c: 14 } },
    { s: { r: 19, c: 0 }, e: { r: 19, c: 3 } },
    { s: { r: 19, c: 7 }, e: { r: 19, c: 8 } },
    { s: { r: 19, c: 9 }, e: { r: 19, c: 14 } },
  ];
  worksheet["!cols"] = [
    { wch: 14 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 18 },
    { wch: 14 },
    { wch: 10 },
    { wch: 14 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
    { wch: 22 },
    { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(workbook, worksheet, "补料");
  const content = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;

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
