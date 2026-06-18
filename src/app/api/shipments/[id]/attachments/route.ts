import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";

import { isPrismaUnavailable } from "@/lib/freightflow-data";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { recognizeShippingOrder } from "@/lib/services/documents/document-service";
import { runOcrForFile } from "@/lib/services/documents/ocr-service";
import {
  listShipmentAttachments,
  storeShipmentAttachment,
  updateAttachmentOcr,
} from "@/lib/services/storage/attachment-storage-service";
import { ActionSource, MailStatus, ShipmentActionType, ShipmentStatus, SoStatus } from "@prisma/client";

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

async function writeBackSoAttachmentRecognition(
  shipmentId: string,
  recognition: Awaited<ReturnType<typeof recognizeShippingOrder>>,
) {
  if (!isDatabaseConfigured() || recognition.status !== "recognized") return null;

  const fields = recognition.extractedFields;

  try {
    const updated = await prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        ...(fields.carrier ? { carrier: fields.carrier } : {}),
        ...(fields.containerNo ? { containerNo: fields.containerNo } : {}),
        ...(fields.containerType ? { containerType: fields.containerType } : {}),
        ...(fields.soNo ? { soNo: fields.soNo } : {}),
        ...(fields.vesselVoyage ? { vesselVoyage: fields.vesselVoyage } : {}),
        aiSummary: fields.soNo
          ? `SO ${fields.soNo} 已由附件 OCR 识别并写回，放舱节点已闭环。`
          : "SO 附件已 OCR 识别并写回，放舱节点已闭环。",
        hoursWaitingRelease: 0,
        mailStatus: MailStatus.SENT,
        nextAction: "核对 SO 附件字段后推进补料、截关和 AMS/ACI/ISF 申报准备。",
        soStatus: SoStatus.RECOGNIZED,
        status: ShipmentStatus.RELEASED,
      },
      select: { id: true },
    });

    await Promise.all([
      prisma.shipmentException.deleteMany({
        where: {
          shipmentId,
          OR: [
            { message: { contains: "等待放舱" } },
            { message: { contains: "放舱超过" } },
            { message: { contains: "SO 尚未" } },
            { message: { contains: "尚未返回 SO" } },
          ],
        },
      }),
      prisma.shipmentReminderFlag.deleteMany({
        where: {
          shipmentId,
          OR: [
            { message: { contains: "催单" } },
            { message: { contains: "放舱" } },
            { message: { contains: "SO" } },
          ],
        },
      }),
      prisma.shipmentActionLog.create({
        data: {
          actionType: ShipmentActionType.SO_RECOGNITION,
          actorName: "OCR",
          shipmentId,
          source: ActionSource.SYSTEM,
          summary: fields.soNo
            ? `SO 附件 OCR 已识别并写回：${fields.soNo}`
            : "SO 附件 OCR 已识别并写回。",
        },
      }),
    ]);

    return updated;
  } catch (error) {
    if (isPrismaUnavailable(error)) return null;
    throw error;
  }
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
        await writeBackSoAttachmentRecognition(id, soRecognition);
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
