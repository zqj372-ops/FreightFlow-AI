import { describe, expect, it, vi } from "vitest";
import {
  ActionSource,
  EmailMessageSyncStatus,
  EmailRecognitionStatus,
  EmailRecognitionType,
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
        soStatus: SoStatus.RECOGNIZED,
        status: ShipmentStatus.RELEASED,
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

  it("marks an exception recognition by writing an exception and setting shipment status", async () => {
    const tx = createRecognitionTx({ recognitionType: EmailRecognitionType.EXCEPTION, summary: "代理反馈柜型不符" });
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => callback(tx));

    await markEmailRecognitionException("rec-001", { reviewer: "李操作" });

    expect(tx.shipment.update).toHaveBeenCalledWith({
      where: { id: "SHP-240610-001" },
      data: expect.objectContaining({ status: ShipmentStatus.EXCEPTION_PROCESSING }),
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
    emailMessage: {
      id: "email-001",
      messageId: "message-001",
      subject: "FF-CA-240610-A01 SO已出",
    },
  };

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
        status: ShipmentStatus.WAITING_RELEASE,
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
    },
  };
}
