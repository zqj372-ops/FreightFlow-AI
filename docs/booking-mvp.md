# FreightFlow-AI · Booking MVP

## Product Positioning

FreightFlow-AI is now an AI booking and SO recognition workbench.

The first useful closed loop is:

```text
Create or select Shipment
→ AI generates booking email draft
→ operator confirms and sends by SMTP
→ IMAP sync receives booking reply
→ system detects SO attachment
→ OCR / LLM extracts SO fields
→ reviewed high-confidence fields update Shipment
→ status moves from waiting release to released / pending documents
```

## MVP Scope

Build only these five capabilities first:

1. Create or edit booking Shipment tasks. Done for the current workbench scope.
2. Generate AI booking email drafts. Done through `POST /api/booking/draft`.
3. Send confirmed booking emails through SMTP. Done through `POST /api/booking/send`, with local demo fallback in the UI when SMTP is disabled.
4. Sync replies through IMAP and detect SO attachments. Done through `POST /api/booking/sync-replies`.
5. OCR / AI extract SO fields and update Shipment. Done through `POST /api/so/*` with a replaceable OCR boundary.

## Keep

- Shipment model and status machine
- ShipmentActionLog
- ShipmentEmailLog
- Contact
- Email Settings
- OpenClaw Settings
- AI request audit
- Booking email modal
- SO status field

## Hide Or Deprioritize

- Quote flows
- Trucking delivery pricing
- Market rate search
- Customer portal
- Finance reconciliation
- BI dashboard
- Complex operations dashboard metrics
- Non-booking mock panels

## AI Booking Email Rules

Inputs:

- customer name
- booking agent
- origin port
- destination port
- container type
- container quantity
- expected ETD
- cargo name
- weight
- volume
- shipper / consignee / notify details
- special requirements
- attachments

Output:

- subject
- to
- cc
- body
- missing fields
- risk notes
- canSend flag

Rules:

- Missing origin port, destination port, container type, container quantity, or expected ETD blocks auto-send.
- AI can generate a draft, but cannot send without explicit confirmation.
- Auto-send requires complete fields, valid recipients, and enabled email settings.
- All generated drafts should be persisted once the draft model/API exists.
- Every sent email must create ShipmentEmailLog and ShipmentActionLog records.

## SO Recognition Fields

First version extracts:

- SO No
- Carrier
- Vessel
- Voyage
- ETD
- ETA
- Port of Loading
- Port of Discharge
- Place of Receipt
- Place of Delivery
- Container Type
- Container Quantity
- Cutoff Time
- CY Closing
- SI Cutoff
- AMS Cutoff
- ACI Cutoff
- ISF Cutoff
- Pickup Location
- Return Location
- Booking Agent
- Remarks

Each field should carry:

- value
- confidence
- source text
- needsReview

Low-confidence fields must not overwrite Shipment automatically.

## Current Status

Implemented in the current MVP pass:

- Booking draft builder, prompt builder, validator, draft API, confirmed send API, and reply sync API.
- OpenClaw JSON enhancement for booking drafts and SO extraction, with deterministic fallback when OpenClaw is unavailable.
- SO upload, OCR boundary, deterministic extractor, validator, field mapper, and Shipment apply API.
- IMAP reply sync now reads body snippets and attachment filenames from message body structure.
- Confirmed email send returns a warning instead of a hard failure when email is already sent but log persistence fails.
- Prisma migration for booking drafts, SO documents, extracted fields, and email sync logs.
- Workbench controls for AI booking draft generation, SO upload / sample text extraction, reply sync, and Shipment write-back.
- Vitest coverage for booking validation, SO attachment detection, reply matching, SO extraction, and SO field mapping.

Known shortcut:

- OCR currently uses supplied text or text files. PDF/image OCR returns a clear not-configured path until an OCR provider is wired.
