import { requestOpenClawJson } from "@/lib/openclaw-client";

import { buildBookingEmailPrompt } from "./booking-prompt";
import type { BookingEmailContext, BookingEmailDraft } from "./booking-types";

type BookingAiResponse = Partial<BookingEmailDraft> & {
  draft?: Partial<BookingEmailDraft>;
};

function stringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function normalizeAiDraft(value: BookingAiResponse | null): BookingEmailDraft | null {
  const candidate = value?.draft ?? value;
  if (!candidate) return null;

  const subject = typeof candidate.subject === "string" ? candidate.subject.trim() : "";
  const body = typeof candidate.body === "string" ? candidate.body.trim() : "";
  const to = stringList(candidate.to);
  const cc = stringList(candidate.cc);
  const attachmentName = typeof candidate.attachmentName === "string" ? candidate.attachmentName.trim() : "";

  if (!subject || !body || to.length === 0) return null;

  return {
    attachmentName,
    body,
    cc,
    subject,
    to,
  };
}

export async function generateBookingDraftWithOpenClaw(context: BookingEmailContext) {
  const prompt = [
    buildBookingEmailPrompt(context),
    "",
    "Return JSON only with this exact shape:",
    '{"subject":"...","body":"...","to":["booking@example.com"],"cc":["ops@example.com"],"attachmentName":"..."}',
  ].join("\n");
  const response = await requestOpenClawJson<BookingAiResponse>({
    context: {
      batchNo: context.shipment.batchNo,
      bookingAgent: context.bookingAgent,
      containerQuantity: context.containerQuantity,
      containerType: context.containerType,
      destinationPort: context.destinationPort,
      etd: context.etd,
      originPort: context.originPort,
    },
    prompt,
  });

  return normalizeAiDraft(response);
}
