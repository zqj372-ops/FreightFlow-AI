import type { ShipmentRecord } from "@/lib/mock-data";

export type BookingEmailRecipient = {
  email: string;
  type: "to" | "cc";
};

export type BookingEmailContext = {
  attachmentName: string;
  bookingAgent: string;
  cargoName: string;
  containerQuantity: number;
  containerType: string;
  customerName: string;
  destinationPort: string;
  etd: string;
  originPort: string;
  shipment: ShipmentRecord;
  specialRequirements: string;
  volume: string;
  weight: string;
};

export type BookingEmailDraft = {
  attachmentName: string;
  body: string;
  cc: string[];
  subject: string;
  to: string[];
};

export type BookingDraftValidation = {
  canSend: boolean;
  missingFields: string[];
  riskNotes: string[];
};

export type BookingDraftResponse = BookingDraftValidation & {
  aiRequestId?: string | null;
  draft: BookingEmailDraft;
  draftId?: string | null;
  persisted: boolean;
  source: "local" | "openclaw";
  warning?: string;
};
