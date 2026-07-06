import type { ShipmentRecord } from "@/lib/mock-data";

export type ContactRole = "booking_agent" | "ops" | "sales" | "customs";

export type ContactRecord = {
  email: string;
  label: string;
  role: ContactRole;
};

export const detailActionLabels = [
  "订舱邮件",
  "催单提醒",
  "补料文件",
  "SO 识别",
  "AMS/ACI/ISF",
  "异常标记",
] as const;

export type DetailActionLabel = (typeof detailActionLabels)[number];

export type ShipmentActionRequest = {
  action?: DetailActionLabel;
  actionType?: DetailActionLabel;
  actorEmail?: string;
  actorName?: string;
  body?: string;
  cc?: string[];
  exceptionMessage?: string;
  skipEmailLog?: boolean;
  soStage?: "received" | "reviewing" | "applied";
  source?: "UI" | "AI" | "SYSTEM";
  subject?: string;
  to?: string[];
};

export function isDetailActionLabel(value: unknown): value is DetailActionLabel {
  return typeof value === "string" && detailActionLabels.includes(value as DetailActionLabel);
}

export function formatFreightFlowEmail(value: string) {
  return `${value.toLowerCase().replace(/\s+/g, ".")}@freightflow.ai`;
}

export function formatActionTimestamp(value = new Date()) {
  const pad = (part: number) => String(part).padStart(2, "0");

  return [
    `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`,
    `${pad(value.getHours())}:${pad(value.getMinutes())}`,
  ].join(" ");
}

export function applyShipmentAction(
  record: ShipmentRecord,
  input: ShipmentActionRequest & { action: DetailActionLabel },
  now = new Date(),
) {
  const actionTime = formatActionTimestamp(now);

  switch (input.action) {
    case "订舱邮件":
      return {
        record: {
          ...record,
          bookingStatus: "已发送订舱" as const,
          lastEmailTime: actionTime,
          mailStatus: "已发送" as const,
          status: record.mailStatus === "未发送" ? ("已发送订舱" as const) : record.status,
        },
        summary: input.subject ? `已记录订舱邮件：${input.subject}` : "已记录订舱邮件发送动作",
      };
    case "催单提醒":
      return {
        record: {
          ...record,
          followUpCount: record.followUpCount + 1,
          lastEmailTime: actionTime,
          mailStatus: "跟进中" as const,
          bookingStatus:
            record.bookingStatus === "已发送订舱" || record.bookingStatus === "等待 SO"
              ? ("等待 SO" as const)
              : record.bookingStatus,
          reminderFlags: Array.from(new Set(["已手动催单", ...record.reminderFlags])),
          status:
            record.status === "等待放舱" || record.status === "已发送订舱"
              ? ("已催放舱" as const)
              : record.status,
        },
        summary: "已增加一次催单记录",
      };
    case "补料文件":
      return {
        record: {
          ...record,
          bookingStatus: "待补料" as const,
          documentStatus: "已发送" as const,
          lastEmailTime: actionTime,
          status: record.status === "待补料" ? ("已发送补料" as const) : record.status,
        },
        summary: "补料文件状态已推进",
      };
    case "SO 识别":
      if (input.soStage === "received") {
        return {
          record: {
            ...record,
            bookingStatus: "SO 已收到" as const,
            soStatus: "待识别" as const,
            status:
              record.status === "已发送订舱" || record.status === "已催放舱"
                ? ("等待放舱" as const)
                : record.status,
          },
          summary: "SO 已收到，等待 OCR 识别与字段抽取",
        };
      }

      if (input.soStage === "reviewing") {
        return {
          record: {
            ...record,
            bookingStatus: "SO 复核中" as const,
            soStatus: "已识别" as const,
          },
          summary: "SO 已识别，进入复核流程",
        };
      }

      return {
        record: {
          ...record,
          bookingStatus: "已放舱" as const,
          soStatus: "已识别" as const,
          status:
            record.status === "已发送订舱" || record.status === "已催放舱" || record.status === "等待放舱"
              ? ("已放舱" as const)
              : record.status,
        },
        summary: "SO 已回写 Shipment，订舱流程推进为已放舱",
      };
    case "AMS/ACI/ISF":
      return {
        record: {
          ...record,
          documentProgress: {
            ams: "已发送" as const,
            aci: record.documentProgress.aci === "待处理" ? ("草稿完成" as const) : record.documentProgress.aci,
            isf: "已发送" as const,
          },
        },
        summary: "AMS / ACI / ISF 进度已刷新",
      };
    case "异常标记": {
      const message = input.exceptionMessage?.trim() || "人工标记异常";
      const nextIsException = record.status !== "异常处理中";

      return {
        record: {
          ...record,
          exceptions: nextIsException ? Array.from(new Set([message, ...record.exceptions])) : [],
          bookingStatus: nextIsException ? ("失败" as const) : ("待补料" as const),
          status: nextIsException ? ("异常处理中" as const) : ("待补料" as const),
        },
        summary: nextIsException ? `已标记异常：${message}` : "已清空异常并恢复待补料",
      };
    }
  }
}
