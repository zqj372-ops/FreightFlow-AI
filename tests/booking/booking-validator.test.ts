import { describe, expect, it } from "vitest";

import { buildBookingEmailContext, buildDeterministicBookingDraft } from "@/lib/booking/booking-email-builder";
import { validateBookingDraft } from "@/lib/booking/booking-validator";
import { defaultEmailConfig } from "@/lib/email-config";
import { shipments } from "@/lib/mock-data";

describe("validateBookingDraft", () => {
  it("accepts a complete draft when SMTP is not required", () => {
    const context = buildBookingEmailContext(shipments[1]);
    const draft = buildDeterministicBookingDraft(context);

    expect(validateBookingDraft({ context, draft })).toMatchObject({
      canSend: true,
      missingFields: [],
    });
  });

  it("blocks confirmed send when email settings are disabled", () => {
    const context = buildBookingEmailContext(shipments[1]);
    const draft = buildDeterministicBookingDraft(context);
    const result = validateBookingDraft({
      context,
      draft,
      emailConfig: defaultEmailConfig,
      requireEmailEnabled: true,
    });

    expect(result.canSend).toBe(false);
    expect(result.missingFields).toContain("emailSettings");
    expect(result.riskNotes).toContain("Email settings are not enabled; SMTP send is blocked.");
  });
});
