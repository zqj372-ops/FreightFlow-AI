# IMAP Recognition Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the inbound email recognition queue: persist/simulate IMAP messages, classify Chinese/English/mixed emails, deduplicate by messageId, and show pending recognition items without writing back Shipment state.

**Architecture:** Add pure email recognition rules first, persist email messages and recognition results with Prisma, expose a manual sync API with mock fallback, then add a compact recognition queue panel on the workbench. Writeback actions stay out of this phase.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma 7, PostgreSQL, ImapFlow, Vitest, Tailwind CSS.

---

## File Structure

- Create `src/features/freightflow/email-recognition-rules.ts`: pure classification, summary, shipment matching, risk flags, and mock email fixtures.
- Create `src/features/freightflow/email-recognition-rules.test.ts`: TDD tests for Chinese, English, mixed, unknown, and duplicate-safe message IDs.
- Modify `prisma/schema.prisma`: add `EmailMessage`, `EmailRecognitionResult`, and related enums.
- Create migration `prisma/migrations/<timestamp>_email_recognition/migration.sql`.
- Create `src/lib/services/email-recognition/email-recognition-service.ts`: list queue items, run manual sync from IMAP/mock messages, dedupe by messageId, persist recognition results.
- Create `src/lib/services/email-recognition/email-recognition-service.test.ts`: mock-only service tests.
- Create `src/app/api/email-sync/run/route.ts`: `POST /api/email-sync/run` manual sync endpoint.
- Create `src/app/api/email-recognitions/route.ts`: `GET /api/email-recognitions` queue endpoint.
- Modify `src/features/freightflow/api-client.ts`: add sync/list API methods and types.
- Create `src/features/freightflow/email-recognition-panel.tsx`: compact pending recognition queue UI.
- Modify `src/features/freightflow/workbench-page.tsx`: load recognitions, run manual sync, show panel.
- Update `docs/project-overview.md`, `docs/todo.md`, and `docs/handover.md`.

## Scope Boundary

This phase does not confirm/write back recognition results. It only syncs, classifies, deduplicates, persists, and displays pending items.

## Acceptance Criteria

- Chinese emails such as `SO已出` classify as `SO_RECEIVED`.
- English emails such as `SI Confirmed` classify as `SUPPLEMENT_CONFIRMED`.
- Exception emails such as `柜型不符` classify as `EXCEPTION` with a risk flag.
- Unknown emails classify as `UNKNOWN` and remain pending.
- Re-running sync with the same `messageId` does not create duplicate pending queue items.
- Workbench shows a pending email recognition queue and a `同步邮箱` action.
- No recognition item mutates Shipment state in this phase.
- `npm run prisma:validate`, `npm run lint`, `npm test`, and `npm run build` pass.
