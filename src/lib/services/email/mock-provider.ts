import type { EmailProvider, EmailProviderMessage, SendEmailInput } from "./types";
import { readEmailConfig } from "@/lib/email-config";
import { SmtpEmailProvider } from "./smtp-provider";

export class MockEmailProvider implements EmailProvider {
  name = "mock-local";

  async send(input: SendEmailInput): Promise<EmailProviderMessage> {
    const sentAt = new Date();
    const accepted = input.recipients.map((recipient) => recipient.email);

    return {
      provider: this.name,
      providerMessageId: `mock-${input.shipmentId}-${sentAt.getTime()}`,
      accepted,
      rejected: [],
      sentAt,
    };
  }
}

export async function createEmailProvider(): Promise<EmailProvider> {
  const config = await readEmailConfig();

  if (config.enabled) {
    return new SmtpEmailProvider(config);
  }

  return new MockEmailProvider();
}
