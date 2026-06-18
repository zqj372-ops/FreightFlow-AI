import type { ShipmentRecord } from "@/lib/mock-data";

import { buildBookingDraft, type BookingDraft } from "./page-helpers";

export type BookingPlanStatus =
  | "missing_info"
  | "ready_to_draft"
  | "draft_ready"
  | "send_failed"
  | "sent";

export type BookingPlanReadiness = {
  missingFields: string[];
  riskFlags: string[];
  status: BookingPlanStatus;
};

export type BookingPlanRecord = {
  batchNo: string;
  bookingAgent: string;
  containerType: string;
  destinationPort: string;
  id: string;
  lastDraftId: string | null;
  lastError: string | null;
  missingFields: string[];
  originPort: string;
  planStatus: BookingPlanStatus;
  riskFlags: string[];
  shipmentId: string;
};

export type BookingDraftBatchItem = {
  draft: BookingDraft | null;
  message: string;
  plan: BookingPlanRecord;
  status: "failed" | "skipped" | "success";
};

export type BookingDraftBatchResult = {
  failedCount: number;
  items: BookingDraftBatchItem[];
  skippedCount: number;
  successCount: number;
};

const requiredShipmentFields: Array<{ key: keyof ShipmentRecord; label: string }> = [
  { key: "bookingAgent", label: "订舱代理" },
  { key: "carrier", label: "船公司" },
  { key: "containerType", label: "柜型" },
  { key: "originPort", label: "起运港" },
  { key: "destinationPort", label: "目的港" },
  { key: "etd", label: "预计 ETD" },
];

const bookingAlreadyStartedStatuses = new Set<ShipmentRecord["status"]>([
  "等待放舱",
  "已催放舱",
  "已放舱",
  "待补料",
  "已发送补料",
  "等待补料确认",
  "补料已确认",
  "待报关",
  "已报关",
  "待提柜",
  "已提柜",
  "已装柜",
  "已还柜",
  "已开船",
  "已到港",
  "已签收",
  "已完成",
  "异常处理中",
]);

export function evaluateBookingPlanReadiness(
  shipment: ShipmentRecord,
): BookingPlanReadiness {
  if (shipment.mailStatus !== "未发送" || bookingAlreadyStartedStatuses.has(shipment.status)) {
    return {
      missingFields: [],
      riskFlags: [shipment.mailStatus === "未发送" ? `当前状态为${shipment.status}` : "订舱邮件已发送"],
      status: "sent",
    };
  }

  const missingFields = requiredShipmentFields
    .filter((field) => String(shipment[field.key] ?? "").trim().length === 0)
    .map((field) => field.label);

  if (missingFields.length > 0) {
    return {
      missingFields,
      riskFlags: missingFields.map((field) => `缺${field}`),
      status: "missing_info",
    };
  }

  return {
    missingFields: [],
    riskFlags: ["可生成订舱草稿"],
    status: "ready_to_draft",
  };
}

export function buildBookingDraftPlan(shipment: ShipmentRecord): BookingDraft {
  const baseDraft = buildBookingDraft(shipment);

  return {
    ...baseDraft,
    subject: `订舱申请｜${shipment.batchNo}｜${shipment.containerType}｜${shipment.originPort}-${shipment.destinationPort}`,
    body: [
      "您好，",
      "",
      "请协助安排以下订舱：",
      `批次号：${shipment.batchNo}`,
      `船公司：${shipment.carrier}`,
      `柜型：${shipment.containerType}`,
      `起运港：${shipment.originPort}`,
      `目的港：${shipment.destinationPort}`,
      `预计 ETD：${shipment.etd}`,
      `船名航次：${shipment.vesselVoyage}`,
      `提柜地点：${shipment.pickupLocation}`,
      `还柜地点：${shipment.returnLocation}`,
      "",
      "附件为订舱资料，请查收并回复 SO / 放舱确认。",
      "谢谢。",
    ].join("\n"),
  };
}

export function buildBookingPlanRecord(
  shipment: ShipmentRecord,
  overrides: Partial<Pick<BookingPlanRecord, "lastDraftId" | "lastError" | "planStatus">> = {},
): BookingPlanRecord {
  const readiness = evaluateBookingPlanReadiness(shipment);

  return {
    batchNo: shipment.batchNo,
    bookingAgent: shipment.bookingAgent,
    containerType: shipment.containerType,
    destinationPort: shipment.destinationPort,
    id: `plan-${shipment.id}`,
    lastDraftId: overrides.lastDraftId ?? null,
    lastError: overrides.lastError ?? null,
    missingFields: readiness.missingFields,
    originPort: shipment.originPort,
    planStatus: overrides.planStatus ?? readiness.status,
    riskFlags: readiness.riskFlags,
    shipmentId: shipment.id,
  };
}

export function buildBookingPlanRecords(shipments: ShipmentRecord[]) {
  return shipments
    .map((shipment) => buildBookingPlanRecord(shipment))
    .filter((plan) => plan.planStatus !== "sent");
}

export function buildBookingDraftBatchResult(
  selectedShipmentIds: string[],
  shipments: ShipmentRecord[],
): BookingDraftBatchResult {
  const shipmentById = new Map(shipments.map((shipment) => [shipment.id, shipment]));
  const items = selectedShipmentIds.map<BookingDraftBatchItem>((shipmentId) => {
    const shipment = shipmentById.get(shipmentId);

    if (!shipment) {
      return {
        draft: null,
        message: "未找到 Shipment",
        plan: {
          batchNo: shipmentId,
          bookingAgent: "",
          containerType: "",
          destinationPort: "",
          id: `plan-${shipmentId}`,
          lastDraftId: null,
          lastError: "未找到 Shipment",
          missingFields: ["Shipment"],
          originPort: "",
          planStatus: "send_failed",
          riskFlags: ["未找到 Shipment"],
          shipmentId,
        },
        status: "failed",
      };
    }

    const plan = buildBookingPlanRecord(shipment);

    if (plan.planStatus === "missing_info") {
      return {
        draft: null,
        message: `资料缺失：${plan.missingFields.join("、")}`,
        plan,
        status: "skipped",
      };
    }

    if (plan.planStatus === "sent") {
      return {
        draft: null,
        message: "订舱邮件已发送",
        plan,
        status: "skipped",
      };
    }

    return {
      draft: buildBookingDraftPlan(shipment),
      message: "草稿已生成",
      plan: { ...plan, planStatus: "draft_ready" },
      status: "success",
    };
  });

  return {
    failedCount: items.filter((item) => item.status === "failed").length,
    items,
    skippedCount: items.filter((item) => item.status === "skipped").length,
    successCount: items.filter((item) => item.status === "success").length,
  };
}
