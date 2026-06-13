import type { ShipmentRecord } from "@/lib/mock-data";

export type RawEmailMessage = {
  bodyText: string;
  from: string;
  messageId: string;
  receivedAt?: string;
  subject: string;
};

export type EmailRecognitionType =
  | "BOOKING_REPLY"
  | "EXCEPTION"
  | "FOLLOW_UP_REPLY"
  | "SO_RECEIVED"
  | "SUPPLEMENT_CONFIRMED"
  | "UNKNOWN";

export type EmailRecognitionDraft = {
  confidence: number;
  extractedFields: Record<string, string>;
  recognitionType: EmailRecognitionType;
  riskFlags: string[];
  summary: string;
};

function emailText(message: RawEmailMessage) {
  return `${message.subject}\n${message.bodyText}`;
}

function includesAny(text: string, keywords: string[]) {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function extractSoNo(text: string) {
  const prefixed = /\bSO[:：\s-]*([A-Z]{3,4}\d{6,10})\b/i.exec(text);
  if (prefixed) return prefixed[1].toUpperCase();

  const containerLike = /\b([A-Z]{4}\d{7})\b/i.exec(text);
  return containerLike?.[1].toUpperCase();
}

export function classifyEmailMessage(message: RawEmailMessage): EmailRecognitionDraft {
  const text = emailText(message);
  const extractedFields: Record<string, string> = {};
  const soNo = extractSoNo(text);

  if (soNo) extractedFields.soNo = soNo;

  if (includesAny(text, ["柜型不符", "请修改资料", "container type mismatch", "mismatch"])) {
    return {
      confidence: 0.9,
      extractedFields,
      recognitionType: "EXCEPTION",
      riskFlags: ["柜型不符"],
      summary: "识别到异常邮件：代理反馈柜型或资料不一致，需要人工确认后处理。",
    };
  }

  if (includesAny(text, ["补料确认", "资料确认", "SI Confirmed", "documents are confirmed"])) {
    return {
      confidence: 0.82,
      extractedFields,
      recognitionType: "SUPPLEMENT_CONFIRMED",
      riskFlags: [],
      summary: "识别到补料确认邮件，建议人工确认后更新补料状态。",
    };
  }

  if (includesAny(text, ["SO已出", "SO 已出", "SO Released", "booking confirmation"])) {
    return {
      confidence: 0.86,
      extractedFields,
      recognitionType: "SO_RECEIVED",
      riskFlags: [],
      summary: "识别到 SO 回传邮件，建议人工核对附件和截补料时间后写回 Shipment。",
    };
  }

  if (includesAny(text, ["已收到", "收到订舱", "booking received", "booking reply"])) {
    return {
      confidence: 0.72,
      extractedFields,
      recognitionType: "BOOKING_REPLY",
      riskFlags: [],
      summary: "识别到订舱回复邮件，建议继续等待 SO 或放舱确认。",
    };
  }

  if (includesAny(text, ["催", "follow up", "reminder"])) {
    return {
      confidence: 0.68,
      extractedFields,
      recognitionType: "FOLLOW_UP_REPLY",
      riskFlags: [],
      summary: "识别到催单相关回复，建议人工判断是否需要继续跟进。",
    };
  }

  return {
    confidence: 0.2,
    extractedFields,
    recognitionType: "UNKNOWN",
    riskFlags: [],
    summary: "暂未识别出明确业务动作，请人工查看原文后决定是否忽略。",
  };
}

export function matchShipmentForEmail(message: RawEmailMessage, shipments: ShipmentRecord[]) {
  const text = emailText(message).toLowerCase();

  return shipments.find((shipment) => {
    const candidates = [shipment.batchNo, shipment.soNo, shipment.containerNo]
      .filter(Boolean)
      .map((value) => value.toLowerCase());

    return candidates.some((value) => text.includes(value));
  }) ?? null;
}
