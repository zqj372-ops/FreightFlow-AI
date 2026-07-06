import { applyShipmentAction } from "@/lib/freightflow-domain";
import type { ShipmentRecord } from "@/lib/mock-data";

import { AUTO_APPLY_CONFIDENCE } from "./so-confidence";
import type { SoApplyResult, SoExtractionResult, SoFieldKey } from "./so-types";

const FIELD_TO_SHIPMENT: Partial<Record<SoFieldKey, keyof ShipmentRecord>> = {
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

function vesselVoyage(result: SoExtractionResult) {
  const vessel = result.fields.find((field) => field.fieldKey === "vessel");
  const voyage = result.fields.find((field) => field.fieldKey === "voyage");

  if (!vessel?.value || vessel.confidence < AUTO_APPLY_CONFIDENCE) return null;
  if (!voyage?.value || voyage.confidence < AUTO_APPLY_CONFIDENCE) return vessel.value;

  return `${vessel.value} ${voyage.value}`;
}

export function applySoExtractionToShipment(shipment: ShipmentRecord, result: SoExtractionResult): SoApplyResult {
  const appliedFields: string[] = [];
  const skippedFields: string[] = [];
  let nextShipment = { ...shipment };

  for (const field of result.fields) {
    if (!field.value) continue;

    const shipmentKey = FIELD_TO_SHIPMENT[field.fieldKey];
    if (!shipmentKey) continue;

    if (field.confidence < AUTO_APPLY_CONFIDENCE) {
      skippedFields.push(field.fieldKey);
      continue;
    }

    nextShipment = { ...nextShipment, [shipmentKey]: field.value };
    appliedFields.push(field.fieldKey);
  }

  const nextVesselVoyage = vesselVoyage(result);
  if (nextVesselVoyage) {
    nextShipment = { ...nextShipment, vesselVoyage: nextVesselVoyage };
    appliedFields.push("vesselVoyage");
  }

  nextShipment = applyShipmentAction(nextShipment, { action: "SO 识别", source: "SYSTEM" }).record;

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
