import type { AlertLevel, ShipmentRecord } from "@/lib/mock-data";

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
