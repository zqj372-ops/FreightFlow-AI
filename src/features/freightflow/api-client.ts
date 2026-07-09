import type { ShipmentRecord } from "@/lib/mock-data";
import type {
  SoApplyResult,
  SoDocumentCenterRecord,
  SoDocumentStatusBucket,
  SoExtractionResult,
  SoFieldReviewPatch,
  SoOcrResult,
} from "@/lib/so/so-types";
import type { ContactRecord, DetailActionLabel } from "@/lib/freightflow-domain";
import type { AiProviderId } from "@/lib/ai-providers";

import type { BookingDraft } from "./page-helpers";

type ApiEnvelope<T> = {
  data?: T;
  error?: string;
  source?: "database" | "local" | "mock";
  warning?: string;
};

export type ApiLoadResult<T> = {
  data: T;
  source: "database" | "mock" | "local";
  warning?: string;
};

export type PublicOpenClawConfig = {
  apiKeyConfigured: boolean;
  endpoint: string;
  enabled: boolean;
  model: string;
  models: string[];
  provider: AiProviderId;
  timeoutMs: number;
  updatedAt: string | null;
};

export type OpenClawSettingsPayload = {
  apiKey?: string;
  endpoint: string;
  enabled: boolean;
  model: string;
  models?: string[];
  provider: AiProviderId;
  test?: boolean;
  timeoutMs: number;
};

export type OpenClawConnectionTest = {
  message: string;
  ok: boolean;
  responseTimeMs?: number;
  status?: number;
};

export type PublicEmailConfig = {
  enabled: boolean;
  fromEmail: string;
  fromName: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  passwordConfigured: boolean;
  replyTo: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  updatedAt: string | null;
  username: string;
};

export type EmailSettingsPayload = {
  enabled: boolean;
  fromEmail: string;
  fromName: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  password?: string;
  replyTo: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  test?: boolean;
  username: string;
};

export type EmailServiceTest = {
  message: string;
  ok: boolean;
  responseTimeMs?: number;
  service: "imap" | "smtp";
};

export type EmailConnectionTest = {
  imap?: EmailServiceTest;
  message: string;
  ok: boolean;
  smtp?: EmailServiceTest;
};

export type BookingDraftApiResult = {
  canSend: boolean;
  draft: BookingDraft;
  draftId: string | null;
  missingFields: string[];
  persisted: boolean;
  prompt: string;
  riskNotes: string[];
  source: "local" | "openclaw";
  warning?: string;
};

export type SoDocumentRecord = {
  confidence?: number | null;
  createdAt?: string;
  fileName: string;
  id: string;
  mimeType: string;
  ocrStatus: string;
  rawText?: string | null;
  shipmentId: string;
  source: string;
  status?: string;
  updatedAt?: string;
};

export type SoValidationResult = {
  canAutoApply: boolean;
  lowConfidenceFields: string[];
  missingFields: string[];
};

export type SoExtractionApiResult = {
  extraction: SoExtractionResult;
  validation: SoValidationResult;
};

export type BookingReplySyncResult = {
  configured: boolean;
  createdDocuments: Array<{ fileName: string; shipmentId: string; soDocumentId: string | null }>;
  matchedCount: number;
  matches: unknown[];
  messageCount: number;
  syncLogId: string | null;
  warning?: string;
};

async function readJson<T>(response: Response) {
  return (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
}

export async function loadShipmentsFromApi(): Promise<ApiLoadResult<ShipmentRecord[]>> {
  const response = await fetch("/api/shipments", { cache: "no-store" });
  const payload = await readJson<ShipmentRecord[]>(response);

  if (!response.ok || !payload.data) {
    throw new Error(payload.error ?? "Failed to load shipments.");
  }

  return {
    data: payload.data,
    source: payload.source ?? "database",
    warning: payload.warning,
  };
}

export async function loadContactsFromApi(): Promise<ApiLoadResult<ContactRecord[]>> {
  const response = await fetch("/api/contacts", { cache: "no-store" });
  const payload = await readJson<ContactRecord[]>(response);

  if (!response.ok || !payload.data) {
    throw new Error(payload.error ?? "Failed to load contacts.");
  }

  return {
    data: payload.data,
    source: payload.source ?? "database",
    warning: payload.warning,
  };
}

export async function persistContact(contact: ContactRecord) {
  const response = await fetch("/api/contacts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(contact),
  });

  if (!response.ok) {
    const payload = await readJson<ContactRecord>(response);
    throw new Error(payload.error ?? "Failed to persist contact.");
  }
}

export async function persistShipmentAction({
  action,
  draft,
  shipmentId,
}: {
  action: DetailActionLabel;
  draft?: BookingDraft;
  shipmentId: string;
}) {
  const response = await fetch(`/api/shipments/${encodeURIComponent(shipmentId)}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action,
      source: "UI",
      ...(draft
        ? {
            attachmentName: draft.attachmentName,
            body: draft.body,
            cc: draft.cc,
            subject: draft.subject,
            to: draft.to,
          }
        : {}),
    }),
  });

  if (!response.ok) {
    const payload = await readJson<unknown>(response);
    throw new Error(payload.error ?? "Failed to persist shipment action.");
  }
}

export async function sendBookingEmail({
  draft,
  shipmentId,
}: {
  draft: BookingDraft;
  shipmentId: string;
}) {
  const response = await fetch(`/api/shipments/${encodeURIComponent(shipmentId)}/emails`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      attachmentName: draft.attachmentName,
      body: draft.body,
      cc: draft.cc,
      subject: draft.subject,
      to: draft.to,
    }),
  });

  if (!response.ok) {
    const payload = await readJson<unknown>(response);
    throw new Error(payload.error ?? "Failed to send booking email.");
  }
}

export async function generateBookingDraft({
  shipment,
  shipmentId,
}: {
  shipment?: ShipmentRecord;
  shipmentId: string;
}) {
  const response = await fetch("/api/booking/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shipment, shipmentId }),
  });
  const payload = await readJson<BookingDraftApiResult>(response);

  if (!response.ok || !payload.data) {
    throw new Error(payload.error ?? "Failed to generate booking draft.");
  }

  return payload.data;
}

export async function sendConfirmedBookingEmail({
  draft,
  shipmentId,
}: {
  draft: BookingDraft;
  shipmentId: string;
}) {
  const response = await fetch("/api/booking/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      attachmentName: draft.attachmentName,
      body: draft.body,
      cc: draft.cc,
      confirmed: true,
      draftId: draft.draftId,
      shipmentId,
      subject: draft.subject,
      to: draft.to,
    }),
  });
  const payload = await readJson<unknown>(response);

  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to send confirmed booking email.");
  }
}

export async function syncBookingReplies(messages?: unknown[]) {
  const response = await fetch("/api/booking/sync-replies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messages ? { messages } : {}),
  });
  const payload = await readJson<BookingReplySyncResult>(response);

  if (!response.ok || !payload.data) {
    throw new Error(payload.error ?? "Failed to sync booking replies.");
  }

  return payload.data;
}

export async function uploadSoDocument({
  fileName,
  mimeType,
  shipmentId,
  sourceText,
}: {
  fileName: string;
  mimeType: string;
  shipmentId: string;
  sourceText: string;
}) {
  const response = await fetch("/api/so/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName, mimeType, shipmentId, sourceText }),
  });
  const payload = await readJson<SoDocumentRecord>(response);

  if (!response.ok || !payload.data) {
    throw new Error(payload.error ?? "Failed to upload SO document.");
  }

  return payload.data;
}

export async function loadSoDocuments(bucket?: SoDocumentStatusBucket): Promise<ApiLoadResult<SoDocumentCenterRecord[]>> {
  const query = bucket ? `?bucket=${encodeURIComponent(bucket)}` : "";
  const response = await fetch(`/api/so/upload${query}`, { cache: "no-store" });
  const payload = await readJson<SoDocumentCenterRecord[]>(response);

  if (!response.ok || !payload.data) {
    throw new Error(payload.error ?? "Failed to load SO documents.");
  }

  return {
    data: payload.data,
    source: payload.source ?? "database",
    warning: payload.warning,
  };
}

export async function runSoOcr({
  fileBase64,
  fileName,
  mimeType,
  soDocumentId,
  sourceText,
}: {
  fileBase64?: string;
  fileName: string;
  mimeType: string;
  soDocumentId?: string;
  sourceText: string;
}) {
  const response = await fetch("/api/so/ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileBase64, fileName, mimeType, soDocumentId, sourceText }),
  });
  const payload = await readJson<SoOcrResult>(response);

  if (!response.ok || !payload.data) {
    throw new Error(payload.error ?? "Failed to run SO OCR.");
  }

  return payload.data;
}

export async function extractSoDocument({
  rawText,
  soDocumentId,
}: {
  rawText: string;
  soDocumentId?: string;
}) {
  const response = await fetch("/api/so/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rawText, soDocumentId }),
  });
  const payload = await readJson<SoExtractionApiResult>(response);

  if (!response.ok || !payload.data) {
    throw new Error(payload.error ?? "Failed to extract SO document.");
  }

  return payload.data;
}

export async function applySoExtractionToShipment({
  confirmedFieldKeys,
  extraction,
  fieldOverrides,
  shipmentId,
  soDocumentId,
}: {
  confirmedFieldKeys?: string[];
  extraction: SoExtractionResult;
  fieldOverrides?: SoFieldReviewPatch[];
  shipmentId: string;
  soDocumentId?: string | null;
}) {
  const response = await fetch("/api/so/apply-to-shipment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmedFieldKeys, extraction, fieldOverrides, shipmentId, soDocumentId, source: "UI" }),
  });
  const payload = await readJson<SoApplyResult & { persisted?: boolean }>(response);

  if (!response.ok || !payload.data) {
    throw new Error(payload.error ?? "Failed to apply SO extraction.");
  }

  return payload.data;
}

export async function loadOpenClawSettings() {
  const response = await fetch("/api/settings/openclaw", { cache: "no-store" });
  const payload = (await response.json().catch(() => ({}))) as {
    config?: PublicOpenClawConfig;
    error?: string;
  };

  if (!response.ok || !payload.config) {
    throw new Error(payload.error ?? "Failed to load OpenClaw settings.");
  }

  return payload.config;
}

export async function saveOpenClawSettings(payload: OpenClawSettingsPayload) {
  const response = await fetch("/api/settings/openclaw", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => ({}))) as {
    config?: PublicOpenClawConfig;
    error?: string;
    test?: OpenClawConnectionTest | null;
  };

  if (!response.ok || !data.config) {
    throw new Error(data.error ?? "Failed to save OpenClaw settings.");
  }

  return {
    config: data.config,
    test: data.test ?? null,
  };
}

export async function loadEmailSettings() {
  const response = await fetch("/api/settings/email", { cache: "no-store" });
  const payload = (await response.json().catch(() => ({}))) as {
    config?: PublicEmailConfig;
    error?: string;
  };

  if (!response.ok || !payload.config) {
    throw new Error(payload.error ?? "Failed to load email settings.");
  }

  return payload.config;
}

export async function saveEmailSettings(payload: EmailSettingsPayload) {
  const response = await fetch("/api/settings/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => ({}))) as {
    config?: PublicEmailConfig;
    error?: string;
    test?: EmailConnectionTest | null;
  };

  if (!response.ok || !data.config) {
    throw new Error(data.error ?? "Failed to save email settings.");
  }

  return {
    config: data.config,
    test: data.test ?? null,
  };
}
