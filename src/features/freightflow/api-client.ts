import type { ShipmentRecord } from "@/lib/mock-data";

import type { BookingDraftBatchResult, BookingPlanRecord } from "./booking-plan-rules";
import type { BookingDraft, ContactRecord, DetailActionLabel } from "./page-helpers";

export type EmailDraftRecord = BookingDraft & {
  createdAt?: string;
  id: string;
  lastError: string | null;
  shipmentId: string;
  status: "draft" | "failed" | "pending_review" | "sent";
  updatedAt?: string;
};

export type EmailRecognitionQueueItem = {
  bodyPreview: string;
  confidence: number;
  emailMessageId: string;
  from: string;
  id: string;
  matchedShipmentId: string | null;
  messageId: string;
  receivedAt: string;
  recognitionType: "BOOKING_REPLY" | "EXCEPTION" | "FOLLOW_UP_REPLY" | "SO_RECEIVED" | "SUPPLEMENT_CONFIRMED" | "UNKNOWN";
  riskFlags: string[];
  status: "confirmed" | "ignored" | "pending_review" | "rejected";
  subject: string;
  summary: string;
};

export type EmailRecognitionSyncResult = {
  duplicateCount: number;
  importedCount: number;
  recognitions: EmailRecognitionQueueItem[];
};

export type EmailRecognitionReviewAction = "confirm" | "ignore" | "mark_exception";

export type EmailRecognitionReviewResult = {
  recognitionId: string;
  shipmentId: string | null;
  status: "confirmed" | "ignored" | "rejected";
  summary: string;
};

export type ShipmentDocumentKind = "booking-template" | "supplement-template";

type ApiEnvelope<T> = {
  data?: T;
  error?: string;
  source?: "database" | "mock";
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
  timeoutMs: number;
  updatedAt: string | null;
};

export type OpenClawSettingsPayload = {
  apiKey?: string;
  endpoint: string;
  enabled: boolean;
  model: string;
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

async function readJson<T>(response: Response) {
  return (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
}

function fileNameFromDisposition(disposition: string | null, fallback: string) {
  if (!disposition) return fallback;

  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/)?.[1];
  if (encoded) return decodeURIComponent(encoded);

  const plain = disposition.match(/filename="?([^";]+)"?/)?.[1];
  return plain ? plain.trim() : fallback;
}

export async function downloadShipmentDocumentFromApi({
  kind,
  shipment,
}: {
  kind: ShipmentDocumentKind;
  shipment: ShipmentRecord;
}) {
  const response = await fetch(`/api/shipments/${encodeURIComponent(shipment.id)}/documents/${kind}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shipment }),
  });

  if (!response.ok) {
    const payload = await readJson<unknown>(response);
    throw new Error(payload.error ?? "Failed to generate document.");
  }

  const blob = await response.blob();
  const fileName = fileNameFromDisposition(
    response.headers.get("Content-Disposition"),
    kind === "booking-template" ? `${shipment.batchNo}-托书.docx` : `${shipment.batchNo}-补料-含vgm.xlsx`,
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return { fileName };
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

export async function loadBookingPlansFromApi(): Promise<ApiLoadResult<BookingPlanRecord[]>> {
  const response = await fetch("/api/booking-plans", { cache: "no-store" });
  const payload = await readJson<BookingPlanRecord[]>(response);

  if (!response.ok || !payload.data) {
    throw new Error(payload.error ?? "Failed to load booking plans.");
  }

  return {
    data: payload.data,
    source: payload.source ?? "database",
    warning: payload.warning,
  };
}

export async function batchGenerateBookingDrafts(shipmentIds: string[]) {
  const response = await fetch("/api/booking-plans/batch-drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shipmentIds }),
  });
  const payload = await readJson<BookingDraftBatchResult & { batchId?: string }>(response);

  if (!response.ok || !payload.data) {
    throw new Error(payload.error ?? "Failed to generate booking drafts.");
  }

  return {
    data: payload.data,
    source: payload.source ?? "database",
  };
}

export async function loadEmailDraftFromApi(draftId: string) {
  const response = await fetch(`/api/email-drafts/${encodeURIComponent(draftId)}`, { cache: "no-store" });
  const payload = await readJson<EmailDraftRecord>(response);

  if (!response.ok || !payload.data) {
    throw new Error(payload.error ?? "Failed to load email draft.");
  }

  return {
    data: payload.data,
    source: payload.source ?? "database",
  };
}

export async function updateEmailDraftFromApi(draftId: string, draft: Partial<BookingDraft>) {
  const response = await fetch(`/api/email-drafts/${encodeURIComponent(draftId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft),
  });
  const payload = await readJson<EmailDraftRecord>(response);

  if (!response.ok || !payload.data) {
    throw new Error(payload.error ?? "Failed to update email draft.");
  }

  return {
    data: payload.data,
    source: payload.source ?? "database",
  };
}

export async function sendEmailDraftFromApi(draftId: string) {
  const response = await fetch(`/api/email-drafts/${encodeURIComponent(draftId)}/send`, { method: "POST" });
  const payload = await readJson<unknown>(response);

  if (!response.ok || !payload.data) {
    throw new Error(payload.error ?? "Failed to send email draft.");
  }

  return {
    data: payload.data,
    source: payload.source ?? "database",
  };
}

export async function loadEmailRecognitionsFromApi(): Promise<ApiLoadResult<EmailRecognitionQueueItem[]>> {
  const response = await fetch("/api/email-recognitions", { cache: "no-store" });
  const payload = await readJson<EmailRecognitionQueueItem[]>(response);

  if (!response.ok || !payload.data) {
    throw new Error(payload.error ?? "Failed to load email recognitions.");
  }

  return {
    data: payload.data,
    source: payload.source ?? "database",
    warning: payload.warning,
  };
}

export async function runEmailSyncFromApi() {
  const response = await fetch("/api/email-sync/run", { method: "POST" });
  const payload = await readJson<EmailRecognitionSyncResult>(response);

  if (!response.ok || !payload.data) {
    throw new Error(payload.error ?? "Failed to sync email recognitions.");
  }

  return {
    data: payload.data,
    source: payload.source ?? "database",
  };
}

export async function reviewEmailRecognitionFromApi({
  action,
  id,
  reviewer = "操作员",
}: {
  action: EmailRecognitionReviewAction;
  id: string;
  reviewer?: string;
}) {
  const response = await fetch(`/api/email-recognitions/${encodeURIComponent(id)}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, reviewer }),
  });
  const payload = await readJson<EmailRecognitionReviewResult>(response);

  if (!response.ok || !payload.data) {
    throw new Error(payload.error ?? "Failed to review email recognition.");
  }

  return {
    data: payload.data,
    source: payload.source ?? "database",
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
