import { NextRequest, NextResponse } from "next/server";

import {
  readEmailConfig,
  saveEmailConfig,
  toPublicEmailConfig,
  type EmailConfig,
} from "@/lib/email-config";
import { verifyImapConnection } from "@/lib/services/email/imap-client";
import { SmtpEmailProvider } from "@/lib/services/email/smtp-provider";

type SavePayload = Partial<Pick<EmailConfig, "enabled" | "fromEmail" | "fromName" | "imapHost" | "imapPort" | "imapSecure" | "password" | "replyTo" | "smtpHost" | "smtpPort" | "smtpSecure" | "username">>;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Email settings request failed";
}

async function testOne(name: "imap" | "smtp", action: () => Promise<void>) {
  const startedAt = Date.now();

  try {
    await action();

    return {
      message: name === "smtp" ? "SMTP 连接测试成功。" : "IMAP 连接测试成功。",
      ok: true,
      responseTimeMs: Date.now() - startedAt,
      service: name,
    };
  } catch (error) {
    return {
      message: getErrorMessage(error),
      ok: false,
      responseTimeMs: Date.now() - startedAt,
      service: name,
    };
  }
}

async function testEmailConnection(config: EmailConfig) {
  if (!config.enabled) {
    return {
      ok: false,
      message: "邮箱发送尚未启用。",
    };
  }

  const [smtp, imap] = await Promise.all([
    testOne("smtp", () => new SmtpEmailProvider(config).verify()),
    testOne("imap", () => verifyImapConnection(config)),
  ]);

  return {
    imap,
    message: smtp.ok && imap.ok ? "SMTP / IMAP 连接测试成功。" : "邮箱连接测试未全部通过。",
    ok: smtp.ok && imap.ok,
    smtp,
  };
}

export async function GET() {
  try {
    const config = await readEmailConfig();

    return NextResponse.json({
      config: toPublicEmailConfig(config),
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as SavePayload & { test?: boolean };

  try {
    const config = await saveEmailConfig(body);
    const test = body.test ? await testEmailConnection(config) : null;

    return NextResponse.json({
      config: toPublicEmailConfig(config),
      test,
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}
