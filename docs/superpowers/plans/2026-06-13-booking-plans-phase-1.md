# Booking Plans Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first booking-plan workflow: persistent booking plans, batch Chinese booking draft generation, draft review, and manual per-draft sending.

**Architecture:** Add focused domain helpers for booking plan readiness and Chinese draft creation, persist booking plans/drafts/batches through Prisma, expose small Next API routes, then connect the workbench UI to list plans, batch-generate drafts, and send a selected draft manually. Existing shipment email service remains the SMTP/mock sending boundary.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma 7, PostgreSQL, Vitest, Tailwind CSS.

---

## File Structure

- Create `src/features/freightflow/booking-plan-rules.ts`: pure booking plan readiness checks, Chinese draft template generation, batch result shaping.
- Create `src/features/freightflow/booking-plan-rules.test.ts`: TDD tests for readiness, Chinese template output, and batch classification.
- Modify `prisma/schema.prisma`: add `BookingPlan`, `EmailDraft`, and `BookingDraftBatch` models plus enums.
- Create `src/lib/services/booking-plans/booking-plan-service.ts`: Prisma persistence and mock fallback helpers for plans, drafts, and batch generation.
- Create `src/app/api/booking-plans/route.ts`: `GET /api/booking-plans`.
- Create `src/app/api/booking-plans/batch-drafts/route.ts`: `POST /api/booking-plans/batch-drafts`.
- Create `src/app/api/email-drafts/[draftId]/route.ts`: get/update one draft.
- Create `src/app/api/email-drafts/[draftId]/send/route.ts`: manual draft send through existing email service.
- Modify `src/features/freightflow/api-client.ts`: add booking plan API client calls.
- Modify `src/features/freightflow/workbench-page.tsx`: add booking plan state, batch action, and draft send entry point.
- Modify `src/components/workbench-shell.tsx`: surface `待发订舱` and `草稿待确认` metrics/queue entry.
- Modify docs after implementation: update `docs/project-overview.md`, `docs/todo.md`, and `docs/handover.md`.

## Task 1: Booking Plan Rules

**Files:**
- Create: `src/features/freightflow/booking-plan-rules.ts`
- Create: `src/features/freightflow/booking-plan-rules.test.ts`

- [ ] **Step 1: Write the failing readiness and draft tests**

```ts
import { describe, expect, it } from "vitest";
import { shipments } from "@/lib/mock-data";
import { buildBookingDraftPlan, evaluateBookingPlanReadiness } from "./booking-plan-rules";

describe("evaluateBookingPlanReadiness", () => {
  it("marks a complete unsent shipment as ready to draft", () => {
    const result = evaluateBookingPlanReadiness({ ...shipments[0], mailStatus: "未发送" });

    expect(result.status).toBe("ready_to_draft");
    expect(result.missingFields).toEqual([]);
    expect(result.riskFlags).toContain("可生成订舱草稿");
  });

  it("marks missing booking agent and container type as missing info", () => {
    const result = evaluateBookingPlanReadiness({
      ...shipments[0],
      bookingAgent: "",
      containerType: "",
      mailStatus: "未发送",
    });

    expect(result.status).toBe("missing_info");
    expect(result.missingFields).toEqual(["订舱代理", "柜型"]);
  });
});

describe("buildBookingDraftPlan", () => {
  it("generates a Chinese booking draft from shipment data", () => {
    const draft = buildBookingDraftPlan(shipments[0]);

    expect(draft.subject).toBe("订舱申请｜FF-CA-240610-A01｜40HQ｜Yantian-Vancouver");
    expect(draft.to).toEqual(["seabay.logistics@freightflow.ai"]);
    expect(draft.cc).toEqual(["ops@freightflow.ai"]);
    expect(draft.body).toContain("您好，");
    expect(draft.body).toContain("请协助安排以下订舱");
    expect(draft.body).toContain("船公司：OOCL");
    expect(draft.body).toContain("预计 ETD：2026-06-12 23:00");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/freightflow/booking-plan-rules.test.ts`

Expected: FAIL because `booking-plan-rules` does not exist.

- [ ] **Step 3: Implement minimal pure rules**

```ts
import type { ShipmentRecord } from "@/lib/mock-data";
import { buildBookingDraft, type BookingDraft } from "./page-helpers";

export type BookingPlanStatus = "missing_info" | "ready_to_draft" | "draft_ready" | "send_failed" | "sent";

export type BookingPlanReadiness = {
  missingFields: string[];
  riskFlags: string[];
  status: BookingPlanStatus;
};

const requiredFields: Array<{ key: keyof ShipmentRecord; label: string }> = [
  { key: "bookingAgent", label: "订舱代理" },
  { key: "carrier", label: "船公司" },
  { key: "containerType", label: "柜型" },
  { key: "originPort", label: "起运港" },
  { key: "destinationPort", label: "目的港" },
  { key: "etd", label: "预计 ETD" },
];

export function evaluateBookingPlanReadiness(shipment: ShipmentRecord): BookingPlanReadiness {
  if (shipment.mailStatus !== "未发送") {
    return { missingFields: [], riskFlags: ["订舱邮件已发送"], status: "sent" };
  }

  const missingFields = requiredFields
    .filter((field) => String(shipment[field.key] ?? "").trim().length === 0)
    .map((field) => field.label);

  if (missingFields.length > 0) {
    return { missingFields, riskFlags: missingFields.map((field) => `缺${field}`), status: "missing_info" };
  }

  return { missingFields: [], riskFlags: ["可生成订舱草稿"], status: "ready_to_draft" };
}

export function buildBookingDraftPlan(shipment: ShipmentRecord): BookingDraft {
  const base = buildBookingDraft(shipment);

  return {
    ...base,
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/freightflow/booking-plan-rules.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/freightflow/booking-plan-rules.ts src/features/freightflow/booking-plan-rules.test.ts
git commit -m "feat: add booking plan rules"
```

## Task 2: Prisma Booking Models

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/seed.mjs`

- [ ] **Step 1: Add Prisma models and enums**

Add `BookingPlanStatus`, `EmailDraftStatus`, `EmailDraftType`, `BookingPlan`, `EmailDraft`, and `BookingDraftBatch` to `prisma/schema.prisma`. Link `BookingPlan` and `EmailDraft` to `Shipment` by `shipmentId`.

- [ ] **Step 2: Run Prisma validation**

Run: `npm run prisma:validate`

Expected: PASS.

- [ ] **Step 3: Generate migration**

Run: `npm run prisma:format && npm run prisma:validate`

Expected: schema remains valid. If local Postgres is unavailable, create a hand-written migration SQL matching the models.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations prisma/seed.mjs
git commit -m "feat: add booking plan schema"
```

## Task 3: Booking Plan Service And APIs

**Files:**
- Create: `src/lib/services/booking-plans/booking-plan-service.ts`
- Create: `src/app/api/booking-plans/route.ts`
- Create: `src/app/api/booking-plans/batch-drafts/route.ts`
- Create: `src/app/api/email-drafts/[draftId]/route.ts`
- Create: `src/app/api/email-drafts/[draftId]/send/route.ts`

- [ ] **Step 1: Write service tests or focused API tests**

Add Vitest coverage for batch result shaping with mock shipments and no database dependency.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/services/booking-plans/booking-plan-service.test.ts`

Expected: FAIL because service does not exist.

- [ ] **Step 3: Implement service and API routes**

Implement list plans, batch draft generation, draft load/update, and manual send. Use mock fallback when Prisma is unavailable.

- [ ] **Step 4: Run focused tests and route type checks**

Run: `npm test -- src/lib/services/booking-plans/booking-plan-service.test.ts && npm run lint`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/booking-plans src/app/api/booking-plans src/app/api/email-drafts
git commit -m "feat: add booking plan APIs"
```

## Task 4: Workbench UI Integration

**Files:**
- Modify: `src/features/freightflow/api-client.ts`
- Modify: `src/features/freightflow/workbench-page.tsx`
- Modify: `src/components/workbench-shell.tsx`

- [ ] **Step 1: Add client API types and methods**

Add `loadBookingPlans`, `batchGenerateBookingDrafts`, `loadEmailDraft`, `saveEmailDraft`, and `sendEmailDraft`.

- [ ] **Step 2: Add booking plan UI state**

Load booking plans on page start, show `待发订舱` and `草稿待确认` metrics, and add a booking plan queue view.

- [ ] **Step 3: Add batch draft action**

Allow selecting ready plans and calling `POST /api/booking-plans/batch-drafts`. Show Chinese success/skipped/failed toast.

- [ ] **Step 4: Add manual draft send path**

Open generated draft in the existing BookingModal shape where possible, require operator click to send, and refresh plans after sending.

- [ ] **Step 5: Run UI checks**

Run: `npm run lint && npm test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/freightflow/api-client.ts src/features/freightflow/workbench-page.tsx src/components/workbench-shell.tsx
git commit -m "feat: connect booking plan UI"
```

## Task 5: Docs And Final Verification

**Files:**
- Modify: `docs/project-overview.md`
- Modify: `docs/todo.md`
- Modify: `docs/handover.md`

- [ ] **Step 1: Update docs**

Document booking plans, batch draft generation, APIs, and first-version limitations.

- [ ] **Step 2: Run full verification**

Run:

```bash
npm run prisma:validate
npm run lint
npm test
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 3: Commit docs**

```bash
git add docs/project-overview.md docs/todo.md docs/handover.md docs/superpowers/plans/2026-06-13-booking-plans-phase-1.md
git commit -m "docs: plan booking workflow phase one"
```

- [ ] **Step 4: Push branch**

```bash
git push -u origin codex/booking-plans-phase-1
```

Expected: branch is available on GitHub.

## Self-Review

- Spec coverage: This plan covers booking plans, batch Chinese draft generation, manual per-draft sending, SMTP send reuse, timeline/log persistence entry points, and docs. IMAP recognition and AI recognition are intentionally left for Phase 2/4.
- Placeholder scan: The plan has no TBD/TODO markers. Task 3 and Task 4 describe concrete files and expected APIs, but implementation details should still be filled by TDD while executing.
- Type consistency: Booking statuses use `missing_info`, `ready_to_draft`, `draft_ready`, `send_failed`, and `sent` consistently.
