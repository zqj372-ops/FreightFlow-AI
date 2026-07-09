import { applyShipmentAction } from "@/lib/freightflow-domain";
import type { ShipmentRecord } from "@/lib/mock-data";

import { AUTO_APPLY_CONFIDENCE, needsReview } from "./so-confidence";
import { soFieldKeys, type SoApplyResult, type SoExtractionResult, type SoFieldKey, type SoFieldReviewPatch } from "./so-types";

export const SO_FIELD_TO_SHIPMENT: Partial<Record<SoFieldKey, keyof ShipmentRecord>> = {
  bookingAgent: "bookingAgent",
  carrier: "carrier",
  containerType: "containerType",
  cutoffTime: "cutoffTime",
  eta: "eta",
  etd: "etd",
  pickupLocation: "pickupLocation",
  portOfDischarge: "destinationPort",
  portOfLoading: "originPort",
  returnLocation: "returnLocation",
  soNo: "soNo",
};

type ApplyOptions = {
  confirmedFieldKeys?: SoFieldKey[];
  fieldOverrides?: SoFieldReviewPatch[];
};

function normalizeConfidence(value: unknown, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;

  return Math.min(Math.max(numeric, 0), 1);
}

function patchedFields(result: SoExtractionResult, fieldOverrides: SoFieldReviewPatch[] | undefined) {
  if (!fieldOverrides?.length) return result.fields;

  const fields = new Map(result.fields.map((field) => [field.fieldKey, field]));

  for (const patch of fieldOverrides) {
    const current = fields.get(patch.fieldKey);
    const rawValue = patch.apply === false ? null : patch.value;
    const value = rawValue === undefined ? current?.value ?? null : rawValue?.trim() || null;
    const confidence = normalizeConfidence(
      patch.confidence,
      patch.confirmed || patch.apply ? Math.max(current?.confidence ?? 0, AUTO_APPLY_CONFIDENCE) : current?.confidence ?? 0,
    );

    fields.set(patch.fieldKey, {
      confidence,
      fieldKey: patch.fieldKey,
      needsReview: Boolean(value) && !patch.confirmed && needsReview(confidence),
      sourceText: patch.sourceText ?? current?.sourceText ?? "人工复核",
      value,
    });
  }

  return soFieldKeys.map((fieldKey) => fields.get(fieldKey)).filter((field): field is SoExtractionResult["fields"][number] => Boolean(field));
}

export function applyReviewPatches(result: SoExtractionResult, fieldOverrides: SoFieldReviewPatch[] | undefined): SoExtractionResult {
  const fields = patchedFields(result, fieldOverrides);
  const foundConfidences = fields.filter((field) => field.value).map((field) => field.confidence);
  const confidence =
    foundConfidences.length === 0
      ? 0
      : foundConfidences.reduce((sum, value) => sum + value, 0) / foundConfidences.length;

  return {
    ...result,
    confidence,
    fields,
    status: fields.some((field) => field.value && field.needsReview) ? "NEED_REVIEW" : "EXTRACTED",
  };
}

function isConfirmed(fieldKey: SoFieldKey, options?: ApplyOptions) {
  if (options?.confirmedFieldKeys?.includes(fieldKey)) return true;

  return options?.fieldOverrides?.some((patch) => patch.fieldKey === fieldKey && patch.apply !== false && patch.confirmed) ?? false;
}

function canApplyField(field: { confidence: number; fieldKey: SoFieldKey; value: string | null }, options?: ApplyOptions) {
  if (!field.value) return false;
  return field.confidence >= AUTO_APPLY_CONFIDENCE || isConfirmed(field.fieldKey, options);
}

function vesselVoyage(result: SoExtractionResult, options?: ApplyOptions) {
  const vessel = result.fields.find((field) => field.fieldKey === "vessel");
  const voyage = result.fields.find((field) => field.fieldKey === "voyage");

  if (!vessel || !canApplyField(vessel, options)) return null;
  if (!voyage || !canApplyField(voyage, options)) return vessel.value;

  return `${vessel.value} ${voyage.value}`;
}

export function applySoExtractionToShipment(
  shipment: ShipmentRecord,
  result: SoExtractionResult,
  options: ApplyOptions = {},
): SoApplyResult {
  const appliedFields: string[] = [];
  const skippedFields: string[] = [];
  let nextShipment = { ...shipment };
  const reviewedResult = applyReviewPatches(result, options.fieldOverrides);

  for (const field of reviewedResult.fields) {
    if (!field.value) continue;

    const shipmentKey = SO_FIELD_TO_SHIPMENT[field.fieldKey];
    if (!shipmentKey) {
      if (["vessel", "voyage"].includes(field.fieldKey) && !canApplyField(field, options)) {
        skippedFields.push(field.fieldKey);
      }
      continue;
    }

    if (!canApplyField(field, options)) {
      skippedFields.push(field.fieldKey);
      continue;
    }

    nextShipment = { ...nextShipment, [shipmentKey]: field.value };
    appliedFields.push(field.fieldKey);
  }

  const nextVesselVoyage = vesselVoyage(reviewedResult, options);
  if (nextVesselVoyage) {
    nextShipment = { ...nextShipment, vesselVoyage: nextVesselVoyage };
    appliedFields.push("vesselVoyage");
  }

  nextShipment = applyShipmentAction(nextShipment, { action: "SO 识别", soStage: "applied", source: "SYSTEM" }).record;

  if (nextShipment.status === "已放舱") {
    nextShipment = {
      ...nextShipment,
      documentStatus: nextShipment.documentStatus === "待生成" ? "处理中" : nextShipment.documentStatus,
      nextAction: "SO 已识别并回写 Shipment，下一步检查补料字段并准备发送补料。",
    };
  }

  return {
    appliedFields,
    skippedFields,
    shipment: nextShipment,
  };
}
