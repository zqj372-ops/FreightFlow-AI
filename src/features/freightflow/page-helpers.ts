import type { AlertLevel, ShipmentRecord, ShipmentStatus } from "@/lib/mock-data";

export const quickPrompts = [
  "催当前队列里超4小时未放舱的柜子",
  "检查这票补料还缺什么",
  "总结异常原因并给出处理动作",
] as const;

export type ToastState = {
  tone: "success" | "info";
  message: string;
};

export type BookingDraft = {
  attachmentName: string;
  body: string;
  cc: string[];
  subject: string;
  to: string[];
};

export type ContactRole = "booking_agent" | "ops" | "sales" | "customs";

export type ContactRecord = {
  email: string;
  label: string;
  role: ContactRole;
};

export type ContactDraft = {
  email: string;
  label: string;
  role: ContactRole;
};

export type DetailActionLabel =
  | "订舱邮件"
  | "催单提醒"
  | "补料文件"
  | "SO 识别"
  | "AMS/ACI/ISF"
  | "异常标记";

export type SurfaceTone = "danger" | "info" | "neutral" | "success" | "warning";

export type ShipmentBrief = {
  primaryLine: string;
  route: string;
  summaryItems: Array<{ label: string; value: string }>;
  timing: string;
};

export type ShipmentDetailGroup = {
  items: Array<{ label: string; value: string }>;
  title: string;
};

export type BookingTrackingCard = {
  batchNo: string;
  blTelexStatus: { className: string; label: string };
  bookingAgent: string;
  containerNo: string;
  containerType: string;
  customsBroker: string;
  cutoffPills: Array<{ label: string; value: string }>;
  eta: string;
  etd: string;
  oceanFreightPrice: string;
  packageWeightVolume: string;
  queryUrl: string;
  soNo: string;
  status: string;
  truckingCompany: string;
  vesselVoyage: string;
};

export type BookingPlanCreateCheck = {
  canCreate: boolean;
  message: string;
};

export type BookingFormDraft = {
  bookingAgent: string;
  carrier: string;
  containerType: string;
  destinationPort: string;
  etd: string;
  originPort: string;
  pickupLocation: string;
  remarks: string;
  returnLocation: string;
  vesselVoyage: string;
};

export type BookingPlanAttachmentPreview = {
  fileName: string;
  html: string;
  lines: string[];
};

export type ShipmentStatusEditDraft = {
  carrier: string;
  containerNo: string;
  cutoffTime: string;
  documentStatus: ShipmentRecord["documentStatus"];
  etd: string;
  followUpCount: string;
  mailStatus: ShipmentRecord["mailStatus"];
  nextAction: string;
  operator: string;
  soNo: string;
  soStatus: ShipmentRecord["soStatus"];
  status: ShipmentStatus;
};

export const contactRoleLabel: Record<ContactRole, string> = {
  booking_agent: "订舱代理",
  customs: "报关 / 单证",
  ops: "操作",
  sales: "业务",
};

export function toneClass(tone: SurfaceTone) {
  if (tone === "danger") return "border-red-200 bg-red-50 text-red-700";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tone === "info") return "border-cyan-200 bg-cyan-50 text-cyan-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function toneBadgeClass(tone: SurfaceTone) {
  if (tone === "danger") return "border-red-200 bg-red-50 text-red-700";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tone === "info") return "border-cyan-200 bg-cyan-50 text-cyan-700";
  return "border-slate-200 bg-white text-slate-700";
}

export function contactRoleBadgeClass(role: ContactRole) {
  if (role === "booking_agent") return "border-cyan-200 bg-cyan-50 text-cyan-700";
  if (role === "ops") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (role === "sales") return "border-violet-200 bg-violet-50 text-violet-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export function progressTone(value: string): SurfaceTone {
  if (["已发送", "已确认", "已识别"].includes(value)) return "success";
  if (["处理中", "草稿完成", "跟进中"].includes(value)) return "warning";
  if (["待处理", "待识别", "待生成", "未发送"].includes(value)) return "neutral";
  return "info";
}

export function waitingTone(hours: number): SurfaceTone {
  if (hours >= 4) return "danger";
  if (hours > 0) return "warning";
  return "success";
}

export function cutoffTone(hours: number): SurfaceTone {
  if (hours <= 6) return "danger";
  if (hours <= 24) return "warning";
  return "info";
}

export function pickRecommendedAction(shipment: ShipmentRecord): DetailActionLabel {
  if (shipment.status === "异常处理中") return "异常标记";
  if (shipment.mailStatus === "未发送") return "订舱邮件";
  if (["待补料", "已发送补料", "等待补料确认"].includes(shipment.status)) return "补料文件";
  if (shipment.soStatus === "待识别") return "SO 识别";
  if (["等待放舱", "已发送订舱", "已催放舱"].includes(shipment.status)) return "催单提醒";
  return "AMS/ACI/ISF";
}

export function buildShipmentBrief(shipment: ShipmentRecord): ShipmentBrief {
  const route = `${shipment.originPort} → ${shipment.destinationPort}`;
  const soDisplay = shipment.soStatus === "已识别" && shipment.soNo.trim() ? shipment.soNo : "待代理回传";

  return {
    primaryLine: `批次 ${shipment.batchNo} · SO ${soDisplay} · 柜号 ${shipment.containerNo} · ${shipment.containerType}`,
    route,
    summaryItems: [
      { label: "航线", value: route },
      { label: "船名航次", value: shipment.vesselVoyage },
      { label: "柜型", value: shipment.containerType },
      { label: "责任人", value: `${shipment.operator} · ${shipment.bookingAgent}` },
    ],
    timing: `ETD ${shipment.etd} / ETA ${shipment.eta}`,
  };
}

export function buildShipmentDetailGroups(shipment: ShipmentRecord): ShipmentDetailGroup[] {
  return [
    {
      title: "基础信息",
      items: [
        { label: "批次号", value: shipment.batchNo },
        { label: "SO", value: shipment.soNo },
        { label: "柜号", value: shipment.containerNo },
        { label: "状态", value: shipment.status },
        { label: "订舱代理", value: shipment.bookingAgent },
        { label: "操作员", value: shipment.operator },
      ],
    },
    {
      title: "航线与时效",
      items: [
        { label: "船公司", value: shipment.carrier },
        { label: "起运港", value: shipment.originPort },
        { label: "中转港", value: shipment.transitPort || "直达" },
        { label: "目的港", value: shipment.destinationPort },
        { label: "船名航次", value: shipment.vesselVoyage },
        { label: "ETD", value: shipment.etd },
        { label: "ETA", value: shipment.eta },
        { label: "截补料", value: shipment.cutoffTime },
      ],
    },
    {
      title: "作业地点",
      items: [
        { label: "提柜地点", value: shipment.pickupLocation },
        { label: "还柜地点", value: shipment.returnLocation },
      ],
    },
    {
      title: "单证与提醒",
      items: [
        { label: "邮件状态", value: shipment.mailStatus },
        { label: "SO 状态", value: shipment.soStatus },
        { label: "补料状态", value: shipment.documentStatus },
        { label: "AMS", value: shipment.documentProgress.ams },
        { label: "ACI", value: shipment.documentProgress.aci },
        { label: "ISF", value: shipment.documentProgress.isf },
        { label: "提醒", value: shipment.reminderFlags.join(" / ") || "无" },
        { label: "异常", value: shipment.exceptions.join(" / ") || "无" },
      ],
    },
  ];
}

function displayValue(value: unknown) {
  if (value === null || value === undefined) return "-";

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : "-";
}

function splitVesselVoyage(value: string) {
  const normalized = value.trim();
  if (!normalized) return { vesselName: "", voyageNo: "" };

  const parts = normalized.split(/\s+/);
  if (parts.length === 1) return { vesselName: normalized, voyageNo: "" };

  return {
    vesselName: parts.slice(0, -1).join(" "),
    voyageNo: parts[parts.length - 1] ?? "",
  };
}

function blTelexStatusBadge(value: ShipmentRecord["blTelexStatus"]): BookingTrackingCard["blTelexStatus"] {
  if (value === "已确认") {
    return { className: "border-emerald-200 bg-emerald-50 text-emerald-700", label: "已确认" };
  }

  if (value === "待确认") {
    return { className: "border-amber-200 bg-amber-50 text-amber-700", label: "待确认" };
  }

  return { className: "border-slate-200 bg-slate-50 text-slate-600", label: "未确认" };
}

function carrierTrackingUrl(carrier: string) {
  const normalized = carrier.trim().toUpperCase();

  if (normalized.includes("OOCL")) {
    return "https://www.oocl.com/eng/ourservices/eservices/cargotracking/Pages/cargotracking.aspx";
  }

  if (normalized.includes("COSCO")) return "https://elines.coscoshipping.com/ebusiness/cargoTracking";
  if (normalized.includes("MAERSK")) return "https://www.maersk.com/tracking";
  if (normalized.includes("HAPAG")) return "https://www.hapag-lloyd.com/en/online-business/track/track-by-booking-solution.html";
  if (normalized.includes("YML") || normalized.includes("YANG")) return "https://www.yangming.com/e-service/track_trace/track_trace_cargo_tracking.aspx";
  if (normalized.includes("EMC") || normalized.includes("EVER")) return "https://ct.shipmentlink.com/servlet/TDB1_CargoTracking.do";

  return "https://www.track-trace.com/container";
}

export function buildBookingTrackingCard(shipment: ShipmentRecord): BookingTrackingCard {
  const fallbackVessel = splitVesselVoyage(shipment.vesselVoyage);
  const vesselName = displayValue(shipment.vesselName?.trim() ? shipment.vesselName : fallbackVessel.vesselName);
  const voyageNo = displayValue(shipment.voyageNo?.trim() ? shipment.voyageNo : fallbackVessel.voyageNo);
  const soNo = shipment.soStatus === "待识别" && shipment.soNo.trim() ? "待代理回传" : displayValue(shipment.soNo);

  return {
    batchNo: displayValue(shipment.batchNo),
    blTelexStatus: blTelexStatusBadge(shipment.blTelexStatus),
    bookingAgent: displayValue(shipment.bookingAgent),
    containerNo: displayValue(shipment.containerNo),
    containerType: displayValue(shipment.containerType),
    customsBroker: displayValue(shipment.customsBroker),
    cutoffPills: [
      { label: "截单", value: displayValue(shipment.cutoffTime) },
      { label: "截重", value: displayValue(shipment.cutWeightTime) },
      { label: "截关", value: displayValue(shipment.cutCustomsTime) },
    ],
    eta: displayValue(shipment.eta),
    etd: displayValue(shipment.etd),
    oceanFreightPrice: displayValue(shipment.oceanFreightPrice),
    packageWeightVolume: [displayValue(shipment.packages), displayValue(shipment.grossWeight), displayValue(shipment.cbm)].join(" / "),
    queryUrl: carrierTrackingUrl(shipment.carrier),
    soNo,
    status: displayValue(shipment.status),
    truckingCompany: displayValue(shipment.truckingCompany),
    vesselVoyage: `${vesselName} / ${voyageNo}`,
  };
}

export function buildShipmentStatusEditDraft(shipment: ShipmentRecord): ShipmentStatusEditDraft {
  const soNo = shipment.soStatus === "已识别" && shipment.soNo.trim() ? shipment.soNo : "待代理回传 SO";

  return {
    carrier: shipment.carrier,
    containerNo: shipment.containerNo,
    cutoffTime: shipment.cutoffTime,
    documentStatus: shipment.documentStatus,
    etd: shipment.etd,
    followUpCount: String(shipment.followUpCount),
    mailStatus: shipment.mailStatus,
    nextAction: shipment.nextAction,
    operator: shipment.operator,
    soNo,
    soStatus: shipment.soStatus,
    status: shipment.status,
  };
}

export function applyShipmentStatusEditDraft(
  shipment: ShipmentRecord,
  draft: ShipmentStatusEditDraft,
): ShipmentRecord {
  const parsedFollowUpCount = Number.parseInt(draft.followUpCount, 10);
  const nextSoNo = draft.soStatus === "已识别" ? draft.soNo.trim() : "";

  return {
    ...shipment,
    carrier: draft.carrier.trim(),
    containerNo: draft.containerNo.trim(),
    cutoffTime: draft.cutoffTime.trim(),
    documentStatus: draft.documentStatus,
    etd: draft.etd.trim(),
    followUpCount: Number.isFinite(parsedFollowUpCount) && parsedFollowUpCount >= 0 ? parsedFollowUpCount : 0,
    mailStatus: draft.mailStatus,
    nextAction: draft.nextAction.trim(),
    operator: draft.operator.trim(),
    reminderFlags: Array.from(new Set(["人工修正状态明细", ...shipment.reminderFlags])),
    soNo: nextSoNo,
    soStatus: draft.soStatus,
    status: draft.status,
  };
}

export function canCreateBookingPlanFromShipment(shipment: ShipmentRecord): BookingPlanCreateCheck {
  if (shipment.mailStatus === "已发送") {
    return { canCreate: false, message: "订舱邮件已发送" };
  }

  const requiredFields: Array<{ label: string; value: string }> = [
    { label: "订舱代理", value: shipment.bookingAgent },
    { label: "船公司", value: shipment.carrier },
    { label: "柜型", value: shipment.containerType },
    { label: "起运港", value: shipment.originPort },
    { label: "目的港", value: shipment.destinationPort },
    { label: "预计 ETD", value: shipment.etd },
  ];
  const missingFields = requiredFields.filter((field) => field.value.trim().length === 0).map((field) => field.label);

  if (missingFields.length > 0) {
    return { canCreate: false, message: `资料缺失：${missingFields.join("、")}` };
  }

  return { canCreate: true, message: "可新建订舱计划并生成中文草稿" };
}

export function buildBookingFormDraft(shipment: ShipmentRecord): BookingFormDraft {
  return {
    bookingAgent: shipment.bookingAgent,
    carrier: shipment.carrier,
    containerType: shipment.containerType,
    destinationPort: shipment.destinationPort,
    etd: shipment.etd,
    originPort: shipment.originPort,
    pickupLocation: shipment.pickupLocation,
    remarks: "请协助订舱并回传 SO / 放舱确认。",
    returnLocation: shipment.returnLocation,
    vesselVoyage: shipment.vesselVoyage,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildBookingPlanAttachmentPreview(
  shipment: ShipmentRecord,
  form: BookingFormDraft,
): BookingPlanAttachmentPreview {
  const lines = [
    `批次号：${shipment.batchNo}`,
    `SO：${shipment.soNo}`,
    `柜号：${shipment.containerNo}`,
    `订舱代理：${form.bookingAgent}`,
    `船公司：${form.carrier}`,
    `柜型：${form.containerType}`,
    `起运港：${form.originPort}`,
    `目的港：${form.destinationPort}`,
    `预计 ETD：${form.etd}`,
    `船名航次：${form.vesselVoyage}`,
    `提柜地点：${form.pickupLocation}`,
    `还柜地点：${form.returnLocation}`,
    `备注：${form.remarks}`,
  ];

  return {
    fileName: `${shipment.batchNo}-booking-request.html`,
    html: [
      "<!doctype html>",
      '<html lang="zh-CN">',
      "<head><meta charset=\"utf-8\"><title>订舱申请</title></head>",
      "<body>",
      "<h1>订舱申请</h1>",
      "<dl>",
      ...lines.map((line) => {
        const [label, ...rest] = line.split("：");
        return `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(rest.join("："))}</dd>`;
      }),
      "</dl>",
      "</body>",
      "</html>",
    ].join("\n"),
    lines,
  };
}

export function buildPostBookingSendState(shipment: ShipmentRecord, sentAt: string): ShipmentRecord {
  return {
    ...shipment,
    lastEmailTime: sentAt,
    mailStatus: "已发送",
    nextAction: "等待代理回传 SO 信息，IMAP 识别后人工确认写回。",
    reminderFlags: Array.from(new Set(["等待 SO 回传", ...shipment.reminderFlags])),
    soStatus: "待识别",
    status: "等待放舱",
  };
}

export function levelDot(level: AlertLevel) {
  if (level === "red") return "bg-red-500";
  if (level === "yellow") return "bg-amber-500";
  return "bg-emerald-500";
}

export function levelBadge(level: AlertLevel) {
  if (level === "red") return "border-red-200 bg-red-50 text-red-700";
  if (level === "yellow") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export function metricTone(label: string) {
  if (label === "红色异常") return "text-red-600";
  if (label === "待补料") return "text-amber-600";
  return "text-slate-950";
}

export function actionButtonClass(primary = false) {
  return primary
    ? "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-3.5 text-sm font-medium text-white transition hover:bg-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/70 disabled:cursor-not-allowed disabled:bg-cyan-300 disabled:text-white/90"
    : "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400";
}

function formatFreightFlowEmail(value: string) {
  return `${value.toLowerCase().replace(/\s+/g, ".")}@freightflow.ai`;
}

export function buildBookingDraft(shipment: ShipmentRecord): BookingDraft {
  return {
    to: [formatFreightFlowEmail(shipment.bookingAgent)],
    cc: ["ops@freightflow.ai"],
    subject: `${shipment.batchNo} Booking Request | ${shipment.containerType} | ${shipment.originPort} - ${shipment.destinationPort}`,
    attachmentName: `${shipment.batchNo}-shipping-instruction.pdf`,
    body: [
      `Dear ${shipment.bookingAgent},`,
      "",
      "Please help arrange booking for the below shipment.",
      "",
      `Batch No: ${shipment.batchNo}`,
      `Container Type: ${shipment.containerType}`,
      `POL: ${shipment.originPort}`,
      `POD: ${shipment.destinationPort}`,
      `Carrier: ${shipment.carrier}`,
      `ETD: ${shipment.etd}`,
      "",
      "Shipping instruction is attached for your reference.",
      "Please confirm space and release SO once available.",
      "",
      "Best regards,",
      "FreightFlow AI Ops",
    ].join("\n"),
  };
}

export function buildContacts(shipment: ShipmentRecord): ContactRecord[] {
  return [
    {
      email: formatFreightFlowEmail(shipment.bookingAgent),
      label: `${shipment.bookingAgent} booking desk`,
      role: "booking_agent",
    },
    {
      email: "ops@freightflow.ai",
      label: "FreightFlow operations",
      role: "ops",
    },
    {
      email: formatFreightFlowEmail(shipment.operator),
      label: `${shipment.operator} operator`,
      role: "ops",
    },
    {
      email: "sales@freightflow.ai",
      label: "Sales owner",
      role: "sales",
    },
    {
      email: "customs.docs@freightflow.ai",
      label: "Customs documents",
      role: "customs",
    },
  ];
}

export function normalizeEmail(value: string) {
  return value.trim().replace(/[;,]+$/, "");
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
