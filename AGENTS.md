# FreightFlow-AI Agent Rules

## Current Priority

FreightFlow-AI is focused on:

1. AI-generated booking emails
2. SMTP booking email sending
3. IMAP reply sync
4. SO attachment detection
5. SO OCR and structured extraction
6. Shipment status update based on SO recognition

Do not build quote, trucking delivery pricing, market rate search, customer portal, finance reconciliation, or BI dashboard features unless explicitly requested.

## Architecture

Keep the current Next.js single-repository architecture. Do not migrate to a monorepo.

## Agent Ownership

### Agent 1: UI Scope Reduction and Docs

Owns:

- `src/app/page.tsx`
- `src/app/layout.tsx`
- `src/features/freightflow/**`
- `src/features/booking/**` UI shell
- `src/components/workbench-shell.tsx`
- `README.md`
- `docs/**`
- `AGENTS.md`

Must not modify:

- `src/lib/email/**`
- `src/lib/booking/**` business logic
- `src/lib/so/**`
- `src/app/api/booking/**`
- `src/app/api/so/**`
- `prisma/schema.prisma`

### Agent 2: Booking Email Automation

Owns:

- `src/lib/booking/**`
- `src/lib/email/**`
- `src/app/api/booking/**`
- `src/app/api/shipments/**/emails/**`
- `tests/booking/**`
- `tests/email/**`

Must not modify:

- `src/lib/so/**`
- `src/app/api/so/**`
- OCR logic
- major UI layout
- quote modules

### Agent 3: SO OCR and Extraction

Owns:

- `src/lib/so/**`
- `src/app/api/so/**`
- `src/features/booking/so-upload-panel.tsx`
- `src/features/booking/so-extract-result-panel.tsx`
- `tests/so/**`
- `prisma/schema.prisma` only for SO-related models

Must not modify:

- `src/lib/email/**`
- `src/lib/booking/**`
- email sending logic
- quote modules

## Product Rules

AI booking email:

- AI may generate draft email content.
- AI must not send email without explicit confirmation.
- Sending requires valid recipient, subject, body, and enabled email settings.
- Missing key booking fields must block auto-send.
- Every generated draft should be persisted once the booking draft API exists.

SO OCR:

- OCR output must be stored as raw text.
- LLM extraction must return structured JSON.
- Low-confidence fields require manual review.
- High-confidence SO fields may update Shipment.
- Every SO apply action must create a Shipment action log.

## Deprioritized

Do not work on:

- AI quote
- Canada trucking delivery quote
- market rate search
- customer login
- finance reconciliation
- BI dashboard
