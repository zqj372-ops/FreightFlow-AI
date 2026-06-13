/**
 * Shared types for the Track A repository layer.
 *
 * The repository layer is intentionally self-contained: it does not depend
 * on `@/features/freightflow/*` helpers so that the API routes can be
 * refactored independently of the workbench UI rules.
 */

export type BookingPlanStatus =
  | "missing_info"
  | "ready_to_draft"
  | "draft_ready"
  | "send_failed"
  | "sent";

export const BOOKING_PLAN_STATUSES: BookingPlanStatus[] = [
  "missing_info",
  "ready_to_draft",
  "draft_ready",
  "send_failed",
  "sent",
];

export type EmailDraftStatus = "draft" | "pending_review" | "sent" | "failed";

export const EMAIL_DRAFT_STATUSES: EmailDraftStatus[] = [
  "draft",
  "pending_review",
  "sent",
  "failed",
];

export type EmailDraftType = "booking" | "follow_up" | "supplement";

export type EmailMessageSyncStatus =
  | "new"
  | "parsed"
  | "failed";

export type EmailRecognitionType =
  | "SO_RECEIVED"
  | "BOOKING_REPLY"
  | "SUPPLEMENT_CONFIRMED"
  | "FOLLOW_UP_REPLY"
  | "EXCEPTION"
  | "UNKNOWN";

export type EmailRecognitionStatus =
  | "pending_review"
  | "confirmed"
  | "rejected"
  | "ignored";
