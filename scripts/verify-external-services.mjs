import { existsSync, readFileSync } from "node:fs";
import { basename, extname } from "node:path";
import { Client } from "pg";
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";

const root = process.cwd();

function loadEnvFile(fileName) {
  const path = `${root}/${fileName}`;
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;

    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

function mimeFromPath(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".txt") return "text/plain";
  return "application/octet-stream";
}

function textFromOcrResponse(data) {
  if (!data || typeof data !== "object") return "";
  for (const key of ["rawText", "text", "content", "markdown"]) {
    if (typeof data[key] === "string" && data[key].trim()) return data[key].trim();
  }
  for (const key of ["data", "result", "ocr"]) {
    const nested = textFromOcrResponse(data[key]);
    if (nested) return nested;
  }
  return "";
}

async function check(name, fn) {
  const startedAt = Date.now();
  try {
    const detail = await fn();
    console.log(`PASS ${name} ${Date.now() - startedAt}ms${detail ? ` - ${detail}` : ""}`);
    return true;
  } catch (error) {
    console.error(`FAIL ${name} ${Date.now() - startedAt}ms - ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function checkPostgres() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set.");

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("select 1");
    const tables = await client.query("select to_regclass('public.shipments') as shipments");
    if (!tables.rows[0]?.shipments) throw new Error("public.shipments table is missing. Run npm run prisma:migrate:deploy and npm run prisma:seed.");
    return "public.shipments is present";
  } finally {
    await client.end();
  }
}

async function checkSmtp() {
  const host = process.env.SMTP_HOST;
  const username = process.env.SMTP_USERNAME;
  const password = process.env.SMTP_PASSWORD;
  if (!host || !username || !password) throw new Error("SMTP_HOST, SMTP_USERNAME, and SMTP_PASSWORD are required.");

  const transport = nodemailer.createTransport({
    auth: { pass: password, user: username },
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
  });
  await transport.verify();
  return host;
}

async function checkImap() {
  const host = process.env.IMAP_HOST;
  const username = process.env.SMTP_USERNAME;
  const password = process.env.SMTP_PASSWORD;
  if (!host || !username || !password) throw new Error("IMAP_HOST, SMTP_USERNAME, and SMTP_PASSWORD are required.");

  const client = new ImapFlow({
    auth: { pass: password, user: username },
    host,
    logger: false,
    port: Number(process.env.IMAP_PORT || 993),
    secure: process.env.IMAP_SECURE !== "false",
  });
  await client.connect();
  try {
    const mailbox = await client.mailboxOpen("INBOX", { readOnly: true });
    return `INBOX has ${mailbox.exists} messages`;
  } finally {
    await client.logout().catch(() => undefined);
  }
}

async function checkOcr() {
  const endpoint = process.env.OCR_API_URL;
  const filePath = process.env.OCR_TEST_FILE;
  if (!endpoint) throw new Error("OCR_API_URL is not set.");
  if (!filePath) throw new Error("OCR_TEST_FILE is required for final OCR verification.");
  if (!existsSync(filePath)) throw new Error(`OCR_TEST_FILE does not exist: ${filePath}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.OCR_TIMEOUT_MS || 45000));
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.OCR_API_KEY ? { Authorization: `Bearer ${process.env.OCR_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        fileBase64: readFileSync(filePath).toString("base64"),
        fileName: basename(filePath),
        mimeType: mimeFromPath(filePath),
        model: process.env.OCR_MODEL || undefined,
        source: "freightflow-ai-verify",
      }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    const text = textFromOcrResponse(data);
    if (!response.ok) throw new Error(`OCR provider returned HTTP ${response.status}`);
    if (!text) throw new Error("OCR provider returned no rawText/text/content/markdown.");
    return `${text.length} chars`;
  } finally {
    clearTimeout(timeout);
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const results = await Promise.all([
  check("PostgreSQL", checkPostgres),
  check("SMTP", checkSmtp),
  check("IMAP", checkImap),
  check("OCR", checkOcr),
]);

if (results.some((ok) => !ok)) {
  process.exitCode = 1;
}
