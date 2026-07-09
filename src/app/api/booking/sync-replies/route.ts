import { NextRequest, NextResponse } from "next/server";

import { readEmailConfig } from "@/lib/email-config";
import { parseEmailMessages, type RawEmailMessage } from "@/lib/email/email-parser";
import {
  getEmailMailboxName,
  loadShipmentThreadSignals,
  persistEmailSyncItems,
  prepareEmailSyncItems,
} from "@/lib/email/email-sync-service";
import { fetchRecentEmailMessages } from "@/lib/email/imap-client";
import { isPrismaUnavailable, listShipmentsFromDatabase, mockShipments } from "@/lib/freightflow-data";

type SyncBody = {
  messages?: RawEmailMessage[];
};

async function loadShipments() {
  try {
    const data = await listShipmentsFromDatabase();
    return data.length > 0 ? data : mockShipments;
  } catch (error) {
    if (isPrismaUnavailable(error)) return mockShipments;
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as SyncBody;
  const startedAt = new Date();
  const config = await readEmailConfig();
  const shipments = await loadShipments();
  const mailbox = getEmailMailboxName(config);
  const rawMessages = Array.isArray(body.messages)
    ? body.messages
    : await fetchRecentEmailMessages(config, 20);
  const messages = parseEmailMessages(rawMessages);
  let threadSignals: Awaited<ReturnType<typeof loadShipmentThreadSignals>> = [];
  let warning: string | undefined =
    config.enabled || body.messages ? undefined : "IMAP is not configured; pass sample messages or enable email settings.";

  try {
    threadSignals = await loadShipmentThreadSignals();
  } catch (error) {
    if (!isPrismaUnavailable(error)) console.warn("Email thread signal loading skipped", error);
  }

  const syncItems = prepareEmailSyncItems({ messages, shipments, threadSignals });
  const matches = syncItems.flatMap((item) => {
    if (!item.match) return [];

    return [{
      attachments: item.soAttachments,
      message: item.message,
      messageId: item.dedupeMessageId,
      score: item.match.score,
      shipment: item.match.shipment,
    }];
  });
  let syncLogId: string | null = null;
  const createdDocuments: Array<{ fileName: string; shipmentId: string; soDocumentId: string | null }> = [];
  let storedMessageCount = 0;
  let skippedDuplicateCount = 0;

  try {
    const persistence = await persistEmailSyncItems({
      items: syncItems,
      mailbox,
      startedAt,
    });
    syncLogId = persistence.syncLogId;
    storedMessageCount = persistence.storedMessageCount;
    skippedDuplicateCount = persistence.duplicateMessages.length;
    createdDocuments.push(
      ...persistence.createdDocuments.map((document) => ({
        fileName: document.fileName,
        shipmentId: document.shipmentId,
        soDocumentId: document.soDocumentId,
      })),
    );
  } catch (error) {
    if (!isPrismaUnavailable(error)) console.warn("Email sync persistence skipped", error);
    warning =
      error instanceof Error
        ? `Email messages were parsed, but sync persistence was skipped: ${error.message}`
        : "Email messages were parsed, but sync persistence was skipped.";

    for (const item of syncItems) {
      if (!item.match) continue;

      for (const attachment of item.soAttachments) {
        createdDocuments.push({
          fileName: attachment.fileName,
          shipmentId: item.match.shipment.id,
          soDocumentId: null,
        });
      }
    }
  }

  return NextResponse.json({
    data: {
      configured: config.enabled,
      createdDocuments,
      matchedCount: matches.length,
      matches,
      messageCount: messages.length,
      skippedDuplicateCount,
      storedMessageCount,
      syncLogId,
      warning,
    },
  });
}
