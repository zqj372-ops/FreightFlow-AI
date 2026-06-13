import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readEmailConfig, saveEmailConfig, toPublicEmailConfig } from "./email-config";

describe("email config", () => {
  let originalCwd: string;
  let tempDir: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await mkdtemp(join(tmpdir(), "freightflow-email-test-"));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    return rm(tempDir, { recursive: true, force: true });
  });

  it("saves IMAP/SMTP settings and hides the password in public config", async () => {
    const saved = await saveEmailConfig({
      enabled: true,
      fromEmail: "ops@example.com",
      fromName: "Ops Team",
      imapHost: "imap.example.com",
      imapPort: 993,
      imapSecure: true,
      password: "app-password",
      smtpHost: "smtp.example.com",
      smtpPort: 465,
      smtpSecure: true,
      username: "ops@example.com",
    });
    const loaded = await readEmailConfig();
    const publicConfig = toPublicEmailConfig(loaded);

    expect(saved.enabled).toBe(true);
    expect(loaded.password).toBe("app-password");
    expect(publicConfig).toMatchObject({
      enabled: true,
      imapHost: "imap.example.com",
      imapPort: 993,
      imapSecure: true,
      passwordConfigured: true,
      smtpHost: "smtp.example.com",
      smtpPort: 465,
      smtpSecure: true,
      username: "ops@example.com",
    });
    expect(publicConfig).not.toHaveProperty("password");
  });

  it("requires IMAP/SMTP fields when email sending is enabled", async () => {
    await expect(saveEmailConfig({ enabled: true })).rejects.toThrow("SMTP Host");
  });
});
