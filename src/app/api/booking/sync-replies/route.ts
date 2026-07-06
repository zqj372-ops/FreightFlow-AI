import { NextRequest, NextResponse } from "next/server";

import { readEmailConfig } from "@/lib/email-config";
import { findSoAttachments } from "@/lib/email/attachment-detector";
import { parseEmailMessages, type RawEmailMessage } from "@/lib/email/email-parser";
import { matchEmailToShipment } from "@/lib/email/email-thread-matcher";
import { fetchRecentEmailMessages } from "@/lib/email/imap-client";
import { isPrismaUnavailable, listShipmentsFromDatabase, mockShipments } from "@/lib/freightflow-data";
import { prisma } from "@/lib/prisma";

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
  const rawMessages = Array.isArray(body.messages)
    ? body.messages
    : await fetchRecentEmailMessages(config, 20);
  const messages = parseEmailMessages(rawMessages);
  const matches = messages.flatMap((message) => {
    const matched = matchEmailToShipment(message, shipments);
    if (!matched) return [];

    const soAttachments = findSoAttachments(message.attachments);

    return [{
      attachments: soAttachments,
      message,
      score: matched.score,
      shipment: matched.shipment,
    }];
  });
  const attachmentCount = matches.reduce((total, item) => total + item.attachments.length, 0);
  let syncLogId: string | null = null;
  const createdDocuments: Array<{ fileName: string; shipmentId: string; soDocumentId: string | null }> = [];

  try {
    const syncLog = await prisma.emailSyncLog.create({
      data: {
        mailbox: config.username || config.imapHost || "local-sample",
        status: "SUCCESS",
        matchedCount: matches.length,
        attachmentCount,
        startedAt,
        completedAt: new Date(),
      },
      select: { id: true },
    });
    syncLogId = syncLog.id;

    for (const match of matches) {
      for (const attachment of match.attachments) {
        const document = await prisma.soDocument.create({
          data: {
            shipmentId: match.shipment.id,
            fileName: attachment.fileName,
            mimeType: attachment.contentType ?? "application/octet-stream",
            storagePath: `email://${syncLog.id}/${attachment.fileName}`,
            source: "EMAIL_ATTACHMENT",
            ocrStatus: "PENDING",
          },
          select: { id: true },
        });
        createdDocuments.push({
          fileName: attachment.fileName,
          shipmentId: match.shipment.id,
          soDocumentId: document.id,
        });
      }
    }
  } catch (error) {
    if (!isPrismaUnavailable(error)) console.warn("Email sync persistence skipped", error);
    for (const match of matches) {
      for (const attachment of match.attachments) {
        createdDocuments.push({
          fileName: attachment.fileName,
          shipmentId: match.shipment.id,
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
      syncLogId,
      warning: config.enabled || body.messages ? undefined : "IMAP is not configured; pass sample messages or enable email settings.",
    },
  });
}
