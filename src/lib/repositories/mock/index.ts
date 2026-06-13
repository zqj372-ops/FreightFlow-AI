/**
 * Mock adapter barrel. Re-exports the 6 mock repositories so callers
 * can do `import { MockShipmentRepository } from "@/lib/repositories/mock"`.
 */
export { MockBookingPlanRepository } from "./booking-plan-repository";
export { MockContactRepository } from "./contact-repository";
export { MockEmailDraftRepository } from "./email-draft-repository";
export { MockEmailMessageRepository } from "./email-message-repository";
export { MockEmailRecognitionRepository } from "./email-recognition-repository";
export { MockShipmentRepository } from "./shipment-repository";
export { getMockStore, resetMockStore, setMockStore } from "./mock-store";
export type { MockStore } from "./mock-store";
