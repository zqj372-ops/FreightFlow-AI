# Booking Plan Usable Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current shipment view summary-first, move shipment details behind a drawer, and add a usable top-level create booking plan action.

**Architecture:** Add testable UI data helpers in `page-helpers.ts`, update `ShipmentDetailPanel` and create a focused drawer component in `detail-panels.tsx`, then wire top-level create booking plan behavior in `workbench-page.tsx` using the existing batch draft API. No new backend model is required.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, lucide-react, Vitest.

---

## File Structure

- Modify `src/features/freightflow/page-helpers.ts`: add brief/detail/create-plan helper functions and types.
- Modify `src/features/freightflow/page-helpers.test.ts`: add TDD coverage for helper behavior.
- Modify `src/features/freightflow/detail-panels.tsx`: make `ShipmentDetailPanel` summary-first and add `ShipmentDetailDrawer`.
- Modify `src/components/workbench-shell.tsx`: add optional create booking plan action to `WorkbenchHeader`.
- Modify `src/features/freightflow/workbench-page.tsx`: wire drawer state and top-level create booking plan action.

---

### Task 1: Helper Rules

**Files:**
- Modify: `src/features/freightflow/page-helpers.test.ts`
- Modify: `src/features/freightflow/page-helpers.ts`

- [x] Write failing tests for `buildShipmentBrief`, `buildShipmentDetailGroups`, and `canCreateBookingPlanFromShipment`.
- [x] Run `npm test -- src/features/freightflow/page-helpers.test.ts` and verify red.
- [x] Implement minimal helper functions.
- [x] Run the same test and verify green.

### Task 2: Summary Card And Detail Drawer Components

**Files:**
- Modify: `src/features/freightflow/detail-panels.tsx`

- [x] Update `ShipmentDetailPanel` props to accept summary items and callbacks for `查看明细` and `用此柜新建订舱计划`.
- [x] Keep status, cutoff, AI summary, and next action visible.
- [x] Add `ShipmentDetailDrawer` with close button and grouped details.
- [x] Run `npm run lint`.

### Task 3: Header Create Booking Plan Action

**Files:**
- Modify: `src/components/workbench-shell.tsx`

- [x] Add optional props `onTopCreateBookingPlan?: () => void` and `topCreateBookingPlanDisabled?: boolean` to `WorkbenchHeader`.
- [x] Render a `新建订舱计划` button in the header action group when handler exists.
- [x] Preserve refresh, 催单, 补料, AI 总结 actions.
- [x] Run `npm run lint`.

### Task 4: Workbench Wiring

**Files:**
- Modify: `src/features/freightflow/workbench-page.tsx`

- [x] Import new helpers and `ShipmentDetailDrawer`.
- [x] Add `detailDrawerOpen` state.
- [x] Build brief/detail data from `selectedShipment`.
- [x] Implement `handleCreateBookingPlanForShipment(shipment)` using existing `batchGenerateBookingDrafts([shipment.id])` and `refreshBookingPlans()`.
- [x] Wire top header `新建订舱计划`, summary card `查看明细`, and summary card `用此柜新建订舱计划`.
- [x] Render `ShipmentDetailDrawer`.
- [x] Run `npm run lint`.

### Task 5: Verification And Commit

**Files:**
- Modify docs only if behavior differs from this plan.

- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Browser verify `新建订舱计划`, `查看明细`, `当前柜子明细`, and booking plan toast behavior.
- [ ] Commit and push with message `feat: make booking plan workflow usable`.

---

## Self-Review

- Spec coverage: covers summary card, detail drawer, top create booking plan action, existing batch draft API reuse, and validation.
- Placeholder scan: no placeholders or undefined future steps.
- Type consistency: helper names are consistent across tasks and intended imports.
