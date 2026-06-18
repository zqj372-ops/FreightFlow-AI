import { describe, expect, it, vi } from "vitest";
import {
  ActionSource,
  EmailMessageSyncStatus,
  EmailRecognitionStatus,
  EmailRecognitionType,
  MailStatus,
  ShipmentActionType,
  ShipmentDocumentStatus,
  ShipmentStatus,
  SoStatus,
} from "@prisma/client";

import { shipments } from "@/lib/mock-data";
import { prisma } from "@/lib/prisma";

import {
  buildMockEmailRecognitionSync,
  confirmEmailRecognition,
  ignoreEmailRecognition,
  listMockEmailRecognitionQueue,
  markEmailRecognitionException,
} from "./email-recognition-service";

vi.mock("@/lib/prisma", () => ({
  isDatabaseConfigured: vi.fn(() => true),
  prisma: {
    $transaction: vi.fn(),
  },
}));

describe("buildMockEmailRecognitionSync", () => {
  it("deduplicates messages by messageId and creates pending recognition items", () => {
    const sync = buildMockEmailRecognitionSync(
      [
        {
          bodyText: "SO已出，SO: OOLU8791320。",
          from: "agent@example.com",
          messageId: "same-message",
          subject: "FF-CA-240610-A01 SO已出",
        },
        {
          bodyText: "SO已出，SO: OOLU8791320。",
          from: "agent@example.com",
          messageId: "same-message",
          subject: "FF-CA-240610-A01 SO已出",
        },
      ],
      shipments,
    );

    expect(sync.importedCount).toBe(1);
    expect(sync.duplicateCount).toBe(1);
    expect(sync.recognitions).toHaveLength(1);
    expect(sync.recognitions[0]).toMatchObject({
      matchedShipmentId: "SHP-240610-001",
      recognitionType: "SO_RECEIVED",
      status: "pending_review",
    });
  });
});

describe("listMockEmailRecognitionQueue", () => {
  it("returns Chinese and English pending recognition fixtures", () => {
    const queue = listMockEmailRecognitionQueue(shipments);

    expect(queue.length).toBeGreaterThanOrEqual(3);
    expect(queue.map((item) => item.recognitionType)).toContain("SO_RECEIVED");
    expect(queue.map((item) => item.recognitionType)).toContain("SUPPLEMENT_CONFIRMED");
    expect(queue.every((item) => item.status === "pending_review")).toBe(true);
  });
});

describe("email recognition review actions", () => {
  it("rejects confirmation when the recognition is not matched to a shipment", async () => {
    const tx = createRecognitionTx({ matchedShipmentId: null, recognitionType: EmailRecognitionType.SO_RECEIVED });
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => callback(tx));

    await expect(confirmEmailRecognition("rec-001", { reviewer: "王操作" })).rejects.toThrow(
      "Recognition is not matched to a shipment.",
    );
    expect(tx.shipment.update).not.toHaveBeenCalled();
  });

  it("confirms an SO recognition by updating the shipment and closing the queue item", async () => {
    const tx = createRecognitionTx({ recognitionType: EmailRecognitionType.SO_RECEIVED });
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => callback(tx));

    const result = await confirmEmailRecognition("rec-001", { reviewer: "王操作" });

    expect(result.summary).toBe("SO 回传已人工确认并写回 Shipment。仍保留人工审核记录。");
    expect(tx.shipment.update).toHaveBeenCalledWith({
      where: { id: "SHP-240610-001" },
      data: expect.objectContaining({
        aiSummary: "SO OOLU8791320 已回传并经人工确认，放舱节点已闭环；下一步进入补料、截单和申报准备。",
        carrier: "OOCL",
        containerNo: "TEMU9088771",
        containerType: "40HQ",
        hoursWaitingRelease: 0,
        mailStatus: MailStatus.SENT,
        nextAction: "核对 SO 附件中的柜号、柜型、船名航次和截单/截关时间，然后推进补料与 AMS/ACI/ISF。",
        soNo: "OOLU8791320",
        soStatus: SoStatus.RECOGNIZED,
        status: ShipmentStatus.RELEASED,
        vesselVoyage: "OOCL Rauma 068E",
      }),
    });
    expect(tx.shipmentException.deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        shipmentId: "SHP-240610-001",
        OR: expect.arrayContaining([expect.objectContaining({ message: { contains: "等待放舱" } })]),
      }),
    });
    expect(tx.shipmentReminderFlag.deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        shipmentId: "SHP-240610-001",
        OR: expect.arrayContaining([expect.objectContaining({ message: { contains: "催单" } })]),
      }),
    });
    expect(tx.emailRecognitionResult.update).toHaveBeenCalledWith({
      where: { id: "rec-001" },
      data: expect.objectContaining({
        status: EmailRecognitionStatus.CONFIRMED,
        reviewedBy: "王操作",
      }),
    });
    expect(tx.emailMessage.update).toHaveBeenCalledWith({
      where: { id: "email-001" },
      data: { syncStatus: EmailMessageSyncStatus.CONFIRMED },
    });
    expect(tx.shipmentActionLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actionType: ShipmentActionType.SO_RECOGNITION,
        actorName: "王操作",
        source: ActionSource.UI,
      }),
    });
  });

  it("confirms a supplement recognition by closing the document workflow", async () => {
    const tx = createRecognitionTx({ recognitionType: EmailRecognitionType.SUPPLEMENT_CONFIRMED });
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => callback(tx));

    const result = await confirmEmailRecognition("rec-001", { reviewer: "王操作" });

    expect(result.summary).toBe("补料确认邮件已人工确认并写回 Shipment。");
    expect(tx.shipment.update).toHaveBeenCalledWith({
      where: { id: "SHP-240610-001" },
      data: expect.objectContaining({
        aiSummary: "补料确认邮件已人工确认，SI/补料节点已闭环；下一步推进申报、截关校验和装船前跟踪。",
        documentStatus: ShipmentDocumentStatus.CONFIRMED,
        nextAction: "复核 AMS/ACI/ISF 与报关资料状态，确认截关前所有申报文件已完成。",
        status: ShipmentStatus.DOCUMENTS_CONFIRMED,
      }),
    });
    expect(tx.shipmentException.deleteMany).toHaveBeenCalled();
    expect(tx.shipmentReminderFlag.deleteMany).toHaveBeenCalled();
    expect(tx.shipmentActionLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actionType: ShipmentActionType.DOCUMENTS,
        actorName: "王操作",
      }),
    });
  });

  it("marks an exception recognition by writing an exception and setting shipment status", async () => {
    const tx = createRecognitionTx({ recognitionType: EmailRecognitionType.EXCEPTION, summary: "代理反馈柜型不符" });
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => callback(tx));

    await markEmailRecognitionException("rec-001", { reviewer: "李操作" });

    expect(tx.shipment.update).toHaveBeenCalledWith({
      where: { id: "SHP-240610-001" },
      data: expect.objectContaining({
        aiSummary: "邮件识别异常：代理反馈柜型不符 当前需要人工判定是否改柜型、重发资料或联系客户确认。",
        nextAction: "先核对原始邮件与 SO/托书字段，再联系客户或代理确认处理口径。",
        status: ShipmentStatus.EXCEPTION_PROCESSING,
      }),
    });
    expect(tx.shipmentException.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        message: "邮件识别异常：代理反馈柜型不符",
        shipmentId: "SHP-240610-001",
      }),
    });
    expect(tx.emailRecognitionResult.update).toHaveBeenCalledWith({
      where: { id: "rec-001" },
      data: expect.objectContaining({ status: EmailRecognitionStatus.CONFIRMED, reviewedBy: "李操作" }),
    });
  });

  it("ignores a recognition without writing back to the shipment", async () => {
    const tx = createRecognitionTx({ recognitionType: EmailRecognitionType.UNKNOWN });
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => callback(tx));

    await ignoreEmailRecognition("rec-001", { reviewer: "王操作" });

    expect(tx.shipment.update).not.toHaveBeenCalled();
    expect(tx.emailRecognitionResult.update).toHaveBeenCalledWith({
      where: { id: "rec-001" },
      data: expect.objectContaining({ status: EmailRecognitionStatus.IGNORED, reviewedBy: "王操作" }),
    });
    expect(tx.emailMessage.update).toHaveBeenCalledWith({
      where: { id: "email-001" },
      data: { syncStatus: EmailMessageSyncStatus.IGNORED },
    });
  });
});

function createRecognitionTx({
  matchedShipmentId = "SHP-240610-001",
  recognitionType,
  summary = "SO 回传已识别",
}: {
  matchedShipmentId?: string | null;
  recognitionType: EmailRecognitionType;
  summary?: string;
}) {
  const recognition = {
    id: "rec-001",
    emailMessageId: "email-001",
    matchedShipmentId,
    recognitionType,
    status: EmailRecognitionStatus.PENDING_REVIEW,
    summary,
    extractedFields: {
      carrier: "OOCL",
      containerNo: "TEMU9088771",
      containerType: "40HQ",
      soNo: "OOLU8791320",
      vesselVoyage: "OOCL Rauma 068E",
    },
    emailMessage: {
      id: "email-001",
      messageId: "message-001",
      subject: "FF-CA-240610-A01 SO已出",
    },
  };
  const shipmentStatus =
    recognitionType === EmailRecognitionType.SUPPLEMENT_CONFIRMED
      ? ShipmentStatus.PENDING_DOCUMENTS
      : ShipmentStatus.WAITING_RELEASE;

  return {
    emailMessage: {
      update: vi.fn(),
    },
    emailRecognitionResult: {
      findUnique: vi.fn().mockResolvedValue(recognition),
      update: vi.fn().mockResolvedValue({ ...recognition, status: EmailRecognitionStatus.CONFIRMED }),
    },
    shipment: {
      findUnique: vi.fn().mockResolvedValue({
        id: "SHP-240610-001",
        status: shipmentStatus,
        soStatus: SoStatus.PENDING_RECOGNITION,
        documentStatus: ShipmentDocumentStatus.SENT,
      }),
      update: vi.fn(),
    },
    shipmentActionLog: {
      create: vi.fn(),
    },
    shipmentException: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    shipmentReminderFlag: {
      deleteMany: vi.fn(),
    },
  };
}
