import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type EmailConfig = {
  enabled: boolean;
  fromEmail: string;
  fromName: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  password: string;
  replyTo: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  updatedAt: string | null;
  username: string;
};

export type PublicEmailConfig = Omit<EmailConfig, "password"> & {
  passwordConfigured: boolean;
};

type RawEmailConfig = Omit<Partial<EmailConfig>, "imapPort" | "smtpPort"> & {
  host?: unknown;
  imapPort?: unknown;
  port?: unknown;
  secure?: unknown;
  smtpPort?: unknown;
};

const DEFAULT_IMAP_PORT = 993;
const DEFAULT_SMTP_PORT = 587;

export const defaultEmailConfig: EmailConfig = {
  enabled: false,
  fromEmail: "",
  fromName: "FreightFlow AI",
  imapHost: "",
  imapPort: DEFAULT_IMAP_PORT,
  imapSecure: true,
  password: "",
  replyTo: "",
  smtpHost: "",
  smtpPort: DEFAULT_SMTP_PORT,
  smtpSecure: false,
  updatedAt: null,
  username: "",
};

function getConfigDir() {
  return path.join(process.cwd(), ".freightflow");
}

function getConfigPath() {
  return path.join(getConfigDir(), "email-config.json");
}

function normalizePort(value: unknown, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;

  return Math.min(Math.max(Math.round(numeric), 1), 65535);
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeConfig(raw: RawEmailConfig | null | undefined): EmailConfig {
  const legacyHost = normalizeString(raw?.host);
  const legacySecure = Boolean(raw?.secure);

  return {
    enabled: Boolean(raw?.enabled),
    fromEmail: normalizeString(raw?.fromEmail),
    fromName: normalizeString(raw?.fromName) || "FreightFlow AI",
    imapHost: normalizeString(raw?.imapHost),
    imapPort: normalizePort(raw?.imapPort, DEFAULT_IMAP_PORT),
    imapSecure: raw?.imapSecure === undefined ? true : Boolean(raw.imapSecure),
    password: normalizeString(raw?.password),
    replyTo: normalizeString(raw?.replyTo),
    smtpHost: normalizeString(raw?.smtpHost) || legacyHost,
    smtpPort: normalizePort(raw?.smtpPort ?? raw?.port, DEFAULT_SMTP_PORT),
    smtpSecure: raw?.smtpSecure === undefined ? legacySecure : Boolean(raw.smtpSecure),
    updatedAt: typeof raw?.updatedAt === "string" ? raw.updatedAt : null,
    username: normalizeString(raw?.username),
  };
}

function envConfig(): EmailConfig {
  const smtpHost = process.env.SMTP_HOST?.trim() ?? "";
  const imapHost = process.env.IMAP_HOST?.trim() ?? "";
  const username = process.env.SMTP_USERNAME?.trim() ?? "";

  return normalizeConfig({
    enabled: Boolean(smtpHost || imapHost),
    fromEmail: process.env.SMTP_FROM_EMAIL?.trim() ?? username,
    fromName: process.env.SMTP_FROM_NAME?.trim() ?? "FreightFlow AI",
    imapHost,
    imapPort: process.env.IMAP_PORT,
    imapSecure: process.env.IMAP_SECURE !== "false",
    password: process.env.SMTP_PASSWORD?.trim() ?? "",
    replyTo: process.env.SMTP_REPLY_TO?.trim() ?? "",
    smtpHost,
    smtpPort: process.env.SMTP_PORT,
    smtpSecure: process.env.SMTP_SECURE === "true",
    updatedAt: null,
    username,
  });
}

export async function readStoredEmailConfig(): Promise<EmailConfig | null> {
  try {
    const content = await readFile(getConfigPath(), "utf8");
    return normalizeConfig(JSON.parse(content) as RawEmailConfig);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function readEmailConfig(): Promise<EmailConfig> {
  const stored = await readStoredEmailConfig();
  return stored ?? envConfig();
}

export async function saveEmailConfig(input: Partial<EmailConfig>) {
  const existing = (await readStoredEmailConfig()) ?? envConfig();
  const next = normalizeConfig({
    ...existing,
    ...input,
    password: typeof input.password === "string" ? input.password : existing.password,
    updatedAt: new Date().toISOString(),
  });

  if (next.enabled) {
    if (!next.smtpHost) throw new Error("启用邮箱前必须填写 SMTP Host。");
    if (!next.imapHost) throw new Error("启用邮箱前必须填写 IMAP Host。");
    if (!next.username) throw new Error("启用邮箱前必须填写邮箱用户名。");
    if (!next.password) throw new Error("启用邮箱前必须填写 SMTP 密码或授权码。");
    if (!next.fromEmail) throw new Error("启用邮箱前必须填写发件邮箱。");
  }

  await mkdir(getConfigDir(), { recursive: true });
  await writeFile(getConfigPath(), `${JSON.stringify(next, null, 2)}\n`, "utf8");

  return next;
}

export function toPublicEmailConfig(config: EmailConfig): PublicEmailConfig {
  return {
    enabled: config.enabled,
    fromEmail: config.fromEmail,
    fromName: config.fromName,
    imapHost: config.imapHost,
    imapPort: config.imapPort,
    imapSecure: config.imapSecure,
    passwordConfigured: config.password.length > 0,
    replyTo: config.replyTo,
    smtpHost: config.smtpHost,
    smtpPort: config.smtpPort,
    smtpSecure: config.smtpSecure,
    updatedAt: config.updatedAt,
    username: config.username,
  };
}
