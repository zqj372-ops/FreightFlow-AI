# FreightFlow AI Ops Mail Workbench Design

Date: 2026-06-13

## 1. Product Positioning

FreightFlow AI will be completed as an internal logistics operations workbench with an email automation center.

The first production-shaped version serves Chinese-speaking internal operators. It focuses on booking plans, manual-approved booking email sending, IMAP email recognition, human-reviewed writeback, shipment timelines, and Chinese AI assistance.

The product is not a customer portal, public SaaS, quote system, or fully autonomous bot in this phase.

## 2. Core Product Loop

The core loop is:

```text
Booking plan
-> Batch-generate Chinese booking email drafts
-> Operator reviews each draft manually
-> SMTP sends approved booking email
-> Email/action/timeline logs are written
-> Shipment moves to waiting release
-> IMAP pulls agent replies
-> Rules and AI classify Chinese/English/mixed emails
-> Recognition result enters review queue
-> Operator confirms, edits association, marks exception, or ignores
-> Shipment status, documents, exceptions, and timeline are updated
```

Automation may generate drafts, classify emails, summarize messages, and recommend actions. It must not send external emails or write confirmed business state without operator approval.

## 3. First-Version Navigation

The first screen remains the operations workbench. The left navigation should emphasize work queues rather than broad ERP modules.

Recommended first-version entries:

- Booking workbench
- Booking plans
- Email recognition queue
- Exceptions
- Settings

AI is available as a right-side assistant and contextual panel rather than a separate navigation destination.

## 4. Booking Plans

Booking plans are the start of the outbound email workflow. They answer what operators need to book today, what is ready, what is missing, and what draft needs review.

Each plan should show:

- Customer or batch identifier
- Shipment ID / batch number
- Origin port, destination port, carrier, container type, expected ETD
- Booking agent and recipient readiness
- Required information completeness
- Draft status
- Risk flags such as missing recipient, missing attachment, missing container type, near ETD, or incomplete cargo data
- Recommended next action

Booking plan statuses:

```text
missing_info
ready_to_draft
draft_ready
send_failed
sent
```

Chinese display labels:

```text
资料缺失
可生成草稿
草稿待确认
发送失败
已发送
```

Booking plan status should be separate from ShipmentStatus. Booking plan status describes outbound booking preparation. ShipmentStatus describes the freight operation lifecycle.

## 5. Batch Draft Generation

The booking plans page must support selecting multiple eligible plans and clicking `批量生成订舱草稿`.

Batch generation does this for each selected plan:

```text
Validate required fields
Resolve booking agent and recipients
Apply Chinese booking email template
Create email draft
Update plan status to draft_ready, missing_info, or send_failed
Return per-plan result
```

Batch generation must never send emails.

Batch result should clearly show:

- Number of drafts generated
- Plans skipped because information is missing
- Plans missing recipient data
- Plans that failed generation
- Specific failure reason per plan

Operators then open each draft, inspect recipients, subject, body, and attachments, and manually confirm sending one by one.

## 6. Booking Email Sending

Booking email sending is a core first-version feature.

Flow:

```text
Operator opens draft
-> System shows Chinese subject, body, recipients, CC, and attachments
-> Operator edits as needed
-> System validates recipients, subject, body, SMTP config, and attachment readiness
-> Operator clicks send
-> SMTP sends email
-> shipment_email_logs and recipients are written
-> shipment_action_logs is written
-> shipment_timeline_events is written
-> booking plan becomes sent
-> shipment status becomes 已发送订舱 or 等待放舱
```

Failure behavior:

- SMTP not configured: do not send; show Chinese setup guidance.
- Invalid email address: block send and highlight the field.
- Missing attachment: block send by default; allow explicit no-attachment send only if the product later adds a confirmation control.
- SMTP failure: keep draft, record failure, allow retry.
- Database unavailable: do not claim persistence; keep only local/demo state when applicable.

## 7. IMAP Email Sync

IMAP is the first-version inbound email source.

Sync triggers:

- Manual button: `同步邮箱`
- Optional local polling every 5-10 minutes when running in a server environment that supports it

Sync flow:

```text
Connect to IMAP
-> Pull new messages from configured mailbox folders
-> Deduplicate by messageId
-> Store email message metadata and body text/summary
-> Parse subject, text, sender, recipients, attachment metadata
-> Match shipment by SO number, container number, batch number, thread/message relationship, carrier, port, ETD, and agent email
-> Classify email type by rules first, AI second
-> Create recognition result
-> Put result into email recognition queue
```

Recognition types:

```text
SO_RECEIVED
BOOKING_REPLY
SUPPLEMENT_CONFIRMED
FOLLOW_UP_REPLY
EXCEPTION
UNKNOWN
```

Chinese display labels:

```text
SO 回传
订舱回复
补料确认
催单回复
异常
未知
```

## 8. Email Recognition Queue

The email recognition queue is the main human-review surface for inbound mail.

Each queue item should show:

- Subject
- Sender
- Received time
- Recognition type
- Confidence
- Matched shipment
- Chinese summary
- Extracted fields
- Risk flags
- Attachment list
- Original text preview

Actions:

- `确认写入`: apply the result to the matched shipment
- `改关联`: choose the correct shipment before writeback
- `标记异常`: create an exception and timeline event
- `忽略`: archive as no business action
- `查看原文`: inspect original email text and attachment metadata

All recognition results default to pending review. Low-confidence or conflicting results cannot write shipment state without explicit operator action.

## 9. Writeback Rules

Confirmed recognition results update shipment state through explicit rules.

Examples:

- SO 回传: set `soStatus = 已识别`; if appropriate, move shipment to `已放舱`.
- 补料确认: set `documentStatus = 已确认`.
- 订舱回复 or 催单回复: update mail/follow-up state and timeline.
- 异常: create ShipmentException and move shipment to `异常处理中`.
- 未知: keep archived only; do not update Shipment.

Every writeback creates a timeline event. The timeline must show the chain from inbound email to recognition result to operator confirmation to status change.

## 10. Shipment Timeline

Each shipment needs a single timeline as the operational source of truth.

Timeline events include:

- Booking draft generated
- Booking email sent
- Agent reply received
- Email recognition created
- SO recognized
- Supplement sent
- Supplement confirmed
- Follow-up sent
- Exception marked
- AI summary generated
- Manual action confirmed

Each event has a source:

```text
manual
smtp
imap
ai
system
```

The UI should display Chinese source labels:

```text
人工
SMTP 发件
IMAP 收件
AI
系统规则
```

## 11. Chinese Language Requirements

Chinese support is part of the product design, not a later translation pass.

Requirements:

- The internal UI defaults to Chinese.
- Status labels, errors, action names, empty states, and settings are Chinese.
- Booking email templates are Chinese by default.
- IMAP recognition handles Chinese, English, and mixed Chinese-English emails.
- AI output defaults to Chinese business summaries and operator actions.
- Internal enums may remain English, but all operator-facing labels must be Chinese.
- Template structure should allow future template editing without rewriting core sending logic.

First-version outbound templates:

- 订舱申请
- 催放舱
- 补料发送
- 补料确认跟进
- 异常确认

First-version recognition phrases should cover common Chinese and English signals:

- `SO已出`, `SO 已出`, `放舱`, `订舱确认`
- `补料确认`, `资料确认`, `请修改资料`, `柜型不符`
- `Booking Confirmation`, `SO Released`, `SI Confirmed`, `Container Type Mismatch`

## 12. Data Model Changes

Existing models to keep and reuse:

- `shipments`
- `shipment_email_logs`
- `shipment_email_recipients`
- `shipment_action_logs`
- `ai_requests`

Recommended new models:

### booking_plans

- `id`
- `shipmentId`
- `planStatus`
- `requiredFieldsSnapshot`
- `preferredBookingAgent`
- `plannedSendAt`
- `lastDraftId`
- `lastBatchId`
- `lastError`
- `createdAt`
- `updatedAt`

### email_drafts

- `id`
- `shipmentId`
- `draftType`: booking / follow_up / supplement
- `to`
- `cc`
- `subject`
- `body`
- `attachments`
- `status`: draft / pending_review / sent / failed
- `createdFromPlanId`
- `lastError`
- `createdAt`
- `updatedAt`

### booking_draft_batches

- `id`
- `createdBy`
- `selectedShipmentIds`
- `successCount`
- `skippedCount`
- `failedCount`
- `createdAt`

### email_messages

- `id`
- `messageId`
- `threadId`
- `from`
- `to`
- `cc`
- `subject`
- `receivedAt`
- `mailbox`
- `bodyText`
- `bodySummary`
- `attachments`
- `syncStatus`: new / parsed / queued / confirmed / ignored / failed
- `createdAt`
- `updatedAt`

### email_recognition_results

- `id`
- `emailMessageId`
- `matchedShipmentId`
- `confidence`
- `recognitionType`
- `extractedFields`
- `summary`
- `riskFlags`
- `status`: pending_review / confirmed / rejected / ignored
- `reviewedBy`
- `reviewedAt`
- `createdAt`
- `updatedAt`

### shipment_timeline_events

- `id`
- `shipmentId`
- `eventType`
- `source`
- `title`
- `summary`
- `relatedEmailId`
- `relatedActionLogId`
- `relatedAiRequestId`
- `createdAt`

## 13. API Shape

Recommended first-version APIs:

```text
GET /api/booking-plans
POST /api/booking-plans/[shipmentId]/draft
POST /api/booking-plans/batch-drafts
GET /api/email-drafts/[draftId]
PATCH /api/email-drafts/[draftId]
POST /api/email-drafts/[draftId]/send
POST /api/email-sync/run
GET /api/email-recognitions
POST /api/email-recognitions/[id]/confirm
POST /api/email-recognitions/[id]/reassign
POST /api/email-recognitions/[id]/mark-exception
POST /api/email-recognitions/[id]/ignore
GET /api/shipments/[id]/timeline
```

Existing settings APIs can be expanded:

```text
GET /api/settings/email
POST /api/settings/email
```

The settings payload should distinguish SMTP sending config from IMAP recognition config while keeping a simple UI.

## 14. AI Role

AI assists but does not own business state.

AI may:

- Summarize inbound emails in Chinese
- Classify email type with confidence
- Extract likely SO, container, vessel, ETD, and exception fields
- Draft Chinese booking, follow-up, supplement, and exception emails
- Recommend next operator action

AI must not:

- Send external email automatically
- Confirm recognition writeback automatically
- Override operator-reviewed shipment facts
- Hide uncertain or conflicting evidence

## 15. Implementation Phases

### Phase 1: Booking Plan And Draft Sending

- Add booking plan model/API.
- Add email draft model/API.
- Add batch draft generation.
- Add Chinese booking template.
- Add manual per-draft send flow.
- Write email/action/timeline logs on send.

### Phase 2: IMAP Sync And Recognition Queue

- Persist pulled IMAP messages.
- Deduplicate by messageId.
- Classify Chinese/English/mixed emails.
- Create pending recognition queue.
- Add manual sync button.

### Phase 3: Human Review Writeback And Timeline

- Confirm, reassign, mark exception, and ignore recognition results.
- Write confirmed results back to shipments.
- Build shipment timeline UI/API.

### Phase 4: Chinese AI Copilot Enhancements

- Add Chinese email summaries.
- Add shipment-aware action suggestions.
- Add draft generation assistance.
- Keep audit records.

## 16. Acceptance Criteria

The project is complete for this phase when all criteria below are met.

Booking plans:

- Operators can see a persistent list of pending booking plans.
- Plans clearly show missing information and readiness.
- Operators can select multiple ready plans and batch-generate Chinese booking email drafts.
- Batch generation reports success, skipped, and failed plans with reasons.
- Batch generation never sends emails.

Booking email sending:

- Operators can open a generated draft, edit it, and manually send it.
- SMTP missing or invalid config blocks sending with Chinese guidance.
- Invalid recipients block sending.
- Successful send writes email log, recipients, action log, and timeline event.
- Sent plan moves out of the pending booking plan queue.
- Refreshing the page does not lose drafts or send results.

IMAP recognition:

- Operators can manually sync IMAP mail.
- Duplicate messages do not create duplicate queue items.
- Chinese, English, and mixed emails are classified into first-version recognition types.
- Low-confidence emails enter pending review rather than updating shipments.

Human review:

- Operators can confirm, reassign, mark exception, or ignore recognition results.
- Confirmed SO, supplement, reply, and exception results update the correct shipment.
- Every writeback creates a timeline event.

Chinese support:

- UI copy, errors, labels, summaries, and operator-facing statuses are Chinese.
- AI summaries and suggestions are Chinese by default.
- Booking templates are Chinese by default.

Quality:

- Existing lint and test commands pass.
- New pure business rules have focused unit tests.
- API fallback behavior is explicit when database, SMTP, IMAP, or OpenClaw is unavailable.

## 17. Explicitly Out Of Scope

These are intentionally not part of the first completion phase:

- Customer login or customer portal
- Enterprise WeChat writeback into FreightFlow AI
- Automatic outbound email sending
- Automatic shipment state changes without human review
- Full permission system
- Quote app integration
- Business intelligence dashboards
- Mobile-first redesign

## 18. Design Decisions

- Use a dedicated booking plan status instead of overloading ShipmentStatus.
- Batch operations generate drafts only; sending remains per-draft and manually confirmed.
- IMAP recognition creates pending review records; it does not directly mutate shipment facts.
- Shipment timeline is the source of truth for operational history.
- Chinese is the default user-facing language.
