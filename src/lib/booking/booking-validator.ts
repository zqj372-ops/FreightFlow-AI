import type { EmailConfig } from "@/lib/email-config";

import type { BookingEmailContext, BookingEmailDraft, BookingDraftValidation } from "./booking-types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hasText(value: string) {
  return value.trim().length > 0;
}

export function validateBookingDraft({
  context,
  draft,
  emailConfig,
  requireEmailEnabled = false,
}: {
  context: BookingEmailContext;
  draft: BookingEmailDraft;
  emailConfig?: EmailConfig | null;
  requireEmailEnabled?: boolean;
}): BookingDraftValidation {
  const missingFields: string[] = [];
  const riskNotes: string[] = [];

  if (!hasText(context.originPort)) missingFields.push("originPort");
  if (!hasText(context.destinationPort)) missingFields.push("destinationPort");
  if (!hasText(context.containerType)) missingFields.push("containerType");
  if (!Number.isFinite(context.containerQuantity) || context.containerQuantity <= 0) missingFields.push("containerQuantity");
  if (!hasText(context.etd)) missingFields.push("etd");
  if (!hasText(draft.subject)) missingFields.push("subject");
  if (!hasText(draft.body)) missingFields.push("body");
  if (draft.to.length === 0) missingFields.push("to");

  const invalidRecipient = [...draft.to, ...draft.cc].find((email) => !EMAIL_PATTERN.test(email));
  if (invalidRecipient) riskNotes.push(`Invalid recipient: ${invalidRecipient}`);

  if (context.shipment.hoursToCutoff <= 24) {
    riskNotes.push(`Cutoff is within ${context.shipment.hoursToCutoff} hours; confirm SO and SI timing before send.`);
  }

  if (requireEmailEnabled || emailConfig) {
    if (!emailConfig?.enabled) {
      missingFields.push("emailSettings");
      riskNotes.push("Email settings are not enabled; SMTP send is blocked.");
    }
  }

  return {
    canSend: missingFields.length === 0 && !invalidRecipient,
    missingFields,
    riskNotes,
  };
}
