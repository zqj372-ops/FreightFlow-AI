import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";

import { recognizeShippingOrder } from "@/lib/services/documents/document-service";
import { runOcrForFile } from "@/lib/services/documents/ocr-service";
import {
  listShipmentAttachments,
  storeShipmentAttachment,
  updateAttachmentOcr,
} from "@/lib/services/storage/attachment-storage-service";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isUploadFile(value: FormDataEntryValue | null): value is File {
  return Boolean(value && typeof value === "object" && "arrayBuffer" in value && "name" in value);
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    const result = await listShipmentAttachments(id);
    return NextResponse.json(result);
  } catch (error) {
    console.error(`GET /api/shipments/${id}/attachments failed`, error);
    return NextResponse.json({ error: "Failed to list attachments." }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!isUploadFile(file)) {
      return NextResponse.json({ error: "file is required." }, { status: 400 });
    }

    const documentType = getFormString(formData, "documentType") || "attachment";
    const uploadedBy = getFormString(formData, "uploadedBy") || null;
    const shouldRunOcr = getFormString(formData, "ocr") !== "false";
    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storeShipmentAttachment({
      buffer,
      documentType,
      mimeType: file.type,
      originalName: file.name,
      shipmentId: id,
      uploadedBy,
    });

    let attachment = stored.data;
    let ocr = null;
    let soRecognition = null;

    if (shouldRunOcr) {
      ocr = await runOcrForFile({
        fileName: attachment.originalName,
        filePath: stored.filePath,
        mimeType: attachment.mimeType,
      });
      const updated = await updateAttachmentOcr(id, attachment.id, {
        ocrConfidence: ocr.confidence,
        ocrStatus: ocr.status,
        ocrText: ocr.text,
      });
      attachment = updated?.data ?? attachment;

      if (documentType === "so" || documentType === "shipping_order") {
        soRecognition = await recognizeShippingOrder({
          fileName: attachment.originalName,
          mimeType: attachment.mimeType,
          shipmentId: id,
          sourceText: ocr.text,
        });
      }
    }

    return NextResponse.json({
      data: {
        attachment,
        ocr,
        soRecognition,
      },
      source: stored.source,
    });
  } catch (error) {
    console.error(`POST /api/shipments/${id}/attachments failed`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload attachment." },
      { status: 500 },
    );
  }
}
