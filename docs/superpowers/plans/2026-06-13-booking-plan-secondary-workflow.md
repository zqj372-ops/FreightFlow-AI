# Booking Plan Secondary Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move booking plan creation into the left sidebar second-level menu and make the flow usable end to end: form, attachment preview, draft update, manual send, then wait for SO reply.

**Architecture:** Keep `订舱工作台` as the parent navigation item and add a second-level view state inside `FreightflowWorkbenchPage`. Reuse existing APIs: `/api/booking-plans/batch-drafts`, `/api/email-drafts/[draftId]`, and `/api/email-drafts/[draftId]/send`. Add a focused workflow component for the form and draft confirmation experience.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, lucide-react, Vitest.

---

## File Structure

- Modify `src/components/workbench-shell.tsx`: render booking workbench second-level menu under `订舱工作台`.
- Modify `src/features/freightflow/api-client.ts`: add email draft load/update/send client functions and types.
- Create `src/features/freightflow/booking-plan-workflow.tsx`: second-level booking plan form, attachment preview, draft editor, send confirmation controls.
- Modify `src/features/freightflow/page-helpers.ts`: add helper functions for booking form defaults, attachment preview, and send-state copy.
- Modify `src/features/freightflow/page-helpers.test.ts`: cover the new helper behavior with TDD.
- Modify `src/features/freightflow/workbench-page.tsx`: route top button and sidebar submenu into the new second-level page, wire real API calls.

## Tasks

### Task 1: Helper Rules

- [x] Add failing tests for booking form defaults, attachment filename/preview, and post-send shipment status copy.
- [x] Run `npm test -- src/features/freightflow/page-helpers.test.ts` and observe red.
- [x] Implement helpers in `page-helpers.ts`.
- [x] Run the focused test and observe green.

### Task 2: API Client

- [x] Add `EmailDraftRecord`, `loadEmailDraftFromApi`, `updateEmailDraftFromApi`, and `sendEmailDraftFromApi` to `api-client.ts`.
- [x] Keep payload compatible with existing API route shape.
- [x] Run `npm run lint`.

### Task 3: Sidebar Second-Level Menu

- [x] Add booking submenu props to `SidebarNav`.
- [x] Render `柜子队列`, `新建订舱计划`, `待发订舱计划`, `草稿确认`, `等待 SO 回传` under `订舱工作台`.
- [x] Wire top `新建订舱计划` button to switch into the second-level page instead of generating immediately.

### Task 4: Secondary Workflow Page

- [x] Create `BookingPlanWorkflow` with form, attachment preview, draft editor, and confirmation send controls.
- [x] Generate/update draft through `batchGenerateBookingDrafts` and `updateEmailDraftFromApi`.
- [x] Confirm send through `sendEmailDraftFromApi` when a persisted draft id exists.
- [x] Show clear local/mock boundary when no persisted draft id exists.

### Task 5: Real Operation Verification

- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Browser verify: sidebar submenu, top shortcut navigation, form update, attachment preview, draft update, confirmation send or persisted-draft guard.
- [x] Commit and push.

