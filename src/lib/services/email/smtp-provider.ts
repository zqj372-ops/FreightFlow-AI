import nodemailer from "nodemailer";

import type { EmailConfig } from "@/lib/email-config";

import type { EmailProvider, EmailProviderMessage, SendEmailInput } from "./types";

function formatAddress(name: string, email: string) {
  return name ? { name, address: email } : email;
}

function getRecipientEmails(input: SendEmailInput, type: "to" | "cc") {
  return input.recipients.filter((recipient) => recipient.type === type).map((recipient) => recipient.email);
}

export class SmtpEmailProvider implements EmailProvider {
  name = "smtp";

  constructor(private readonly config: EmailConfig) {}

  private createTransport() {
    return nodemailer.createTransport({
      auth: {
        pass: this.config.password,
        user: this.config.username,
      },
      host: this.config.smtpHost,
      port: this.config.smtpPort,
      secure: this.config.smtpSecure,
    });
  }

  async verify() {
    const transport = this.createTransport();
    await transport.verify();
  }

  async send(input: SendEmailInput): Promise<EmailProviderMessage> {
    const transport = this.createTransport();
    const to = getRecipientEmails(input, "to");
    const cc = getRecipientEmails(input, "cc");
    const sentAt = new Date();
    const result = await transport.sendMail({
      cc,
      from: formatAddress(this.config.fromName, this.config.fromEmail),
      replyTo: this.config.replyTo || undefined,
      subject: input.subject,
      text: input.body,
      to,
    });

    return {
      accepted: (result.accepted ?? []).map(String),
      provider: this.name,
      providerMessageId: String(result.messageId ?? `smtp-${input.shipmentId}-${sentAt.getTime()}`),
      rejected: (result.rejected ?? []).map(String),
      sentAt,
    };
  }
}
