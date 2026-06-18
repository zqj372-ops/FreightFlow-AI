import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { __resetRepositoryCache, getRepositories } from "@/lib/repositories";
import { resetMockStore } from "@/lib/repositories/mock/mock-store";
import {
  createBookingDraftBatchWithFallback,
  getEmailDraft,
  sendEmailDraft,
} from "@/lib/services/booking-plans/booking-plan-service";
import {
  confirmEmailRecognition,
  listEmailRecognitionQueueWithFallback,
  runEmailRecognitionSyncWithFallback,
} from "@/lib/services/email-recognition/email-recognition-service";

describe("FreightFlow mock operation workflow", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    delete process.env.DATABASE_URL;
    __resetRepositoryCache();
    resetMockStore();
  });

  afterEach(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
    __resetRepositoryCache();
    resetMockStore();
  });

  it("persists a generated booking draft and sends it back into shipment state", async () => {
    const batch = await createBookingDraftBatchWithFallback(["SHP-240610-006"], "验收操作");

    expect(batch.source).toBe("mock");
    expect(batch.data.successCount).toBe(1);

    const item = batch.data.items[0];
    const draftId = item.plan.lastDraftId;
    expect(item.status).toBe("success");
    expect(draftId).toMatch(/^mock-draft-/);

    const draft = await getEmailDraft(draftId ?? "");
    expect(draft).toMatchObject({
      shipmentId: "SHP-240610-006",
      status: "pending_review",
    });

    const sendResult = await sendEmailDraft(draftId ?? "");
    expect(sendResult).toMatchObject({
      mode: "mock",
      emailLog: { shipmentId: "SHP-240610-006" },
    });

    const repositories = await getRepositories();
    const sentDraft = await repositories.drafts.getById(draftId ?? "");
    const shipment = await repositories.shipments.getById("SHP-240610-006");
    const plans = await repositories.bookingPlans.list();

    expect(sentDraft?.status).toBe("sent");
    expect(shipment).toMatchObject({
      mailStatus: "已发送",
      nextAction: "等待代理回传 SO 信息，IMAP 识别后人工确认写回。",
      reminderFlags: ["等待 SO 回传"],
      soStatus: "待识别",
      status: "等待放舱",
    });
    expect(plans.find((plan) => plan.shipmentId === "SHP-240610-006")?.planStatus).toBe("sent");
  });

  it("syncs the email queue and confirms an SO recognition into shipment state", async () => {
    const sync = await runEmailRecognitionSyncWithFallback();
    expect(sync.source).toBe("mock");
    expect(sync.data.duplicateCount).toBeGreaterThanOrEqual(0);

    const queue = await listEmailRecognitionQueueWithFallback();
    const soRecognition = queue.data.find(
      (item) => item.recognitionType === "SO_RECEIVED" && item.matchedShipmentId === "SHP-240610-001",
    );

    expect(soRecognition).toBeDefined();

    const review = await confirmEmailRecognition(soRecognition?.id ?? "", { reviewer: "验收操作" });
    expect(review).toMatchObject({
      shipmentId: "SHP-240610-001",
      status: "confirmed",
    });

    const repositories = await getRepositories();
    const shipment = await repositories.shipments.getById("SHP-240610-001");
    const refreshedQueue = await listEmailRecognitionQueueWithFallback();

    expect(shipment).toMatchObject({
      soStatus: "已识别",
      status: "已放舱",
    });
    expect(refreshedQueue.data.some((item) => item.id === soRecognition?.id)).toBe(false);
  });
});
