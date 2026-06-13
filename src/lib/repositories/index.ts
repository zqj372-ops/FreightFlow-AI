/**
 * Repository barrel + factory.
 *
 * `getRepositories()` inspects `process.env.DATABASE_URL` and the
 * actual DB reachability once, then decides whether to wire up the
 * Prisma adapters (real DB) or the in-memory mock adapters. Callers
 * should use the same instance across a single request lifecycle to
 * avoid reading / writing two different stores.
 */
import { isPrismaUnavailable } from "@/lib/freightflow-data";
import { prisma } from "@/lib/prisma";

import type { BookingPlanRepository } from "./booking-plan-repository";
import type { ContactRepository } from "./contact-repository";
import type { EmailDraftRepository } from "./email-draft-repository";
import type { EmailMessageRepository } from "./email-message-repository";
import type { EmailRecognitionRepository } from "./email-recognition-repository";
import { MockBookingPlanRepository } from "./mock/booking-plan-repository";
import { MockContactRepository } from "./mock/contact-repository";
import { MockEmailDraftRepository } from "./mock/email-draft-repository";
import { MockEmailMessageRepository } from "./mock/email-message-repository";
import { MockEmailRecognitionRepository } from "./mock/email-recognition-repository";
import { MockShipmentRepository } from "./mock/shipment-repository";
import { PrismaBookingPlanRepository } from "./prisma/booking-plan-repository";
import { PrismaContactRepository } from "./prisma/contact-repository";
import { PrismaEmailDraftRepository } from "./prisma/email-draft-repository";
import { PrismaEmailMessageRepository } from "./prisma/email-message-repository";
import { PrismaEmailRecognitionRepository } from "./prisma/email-recognition-repository";
import { PrismaShipmentRepository } from "./prisma/shipment-repository";
import type { ShipmentRepository } from "./shipment-repository";

export type RepositoryMode = "mock" | "prisma";

export type RepositoryBundle = {
  bookingPlans: BookingPlanRepository;
  contacts: ContactRepository;
  drafts: EmailDraftRepository;
  emailMessages: EmailMessageRepository;
  emailRecognitions: EmailRecognitionRepository;
  mode: RepositoryMode;
  shipments: ShipmentRepository;
};

let cached: RepositoryBundle | null = null;
let modeLogged: RepositoryMode | null = null;

function logMode(mode: RepositoryMode) {
  if (modeLogged === mode) return;
  modeLogged = mode;
  const label = mode === "prisma" ? "Prisma (DATABASE_URL detected)" : "in-memory mock (DATABASE_URL not configured)";
  console.info(`[repositories] using ${label} data layer`);
}

function isDatabaseUrlConfigured() {
  return typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.trim().length > 0;
}

async function probePrisma(): Promise<boolean> {
  if (!isDatabaseUrlConfigured()) return false;
  try {
    // `$queryRaw` issues a real round trip and is the cheapest way to
    // verify connectivity without depending on which model exists.
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    if (isPrismaUnavailable(error)) {
      return false;
    }
    // Any other error (e.g. permission denied on a real prod DB) is
    // treated as a hard failure — let the caller surface it instead of
    // silently downgrading to mock.
    throw error;
  }
}

function buildMockBundle(): RepositoryBundle {
  return {
    bookingPlans: new MockBookingPlanRepository(),
    contacts: new MockContactRepository(),
    drafts: new MockEmailDraftRepository(),
    emailMessages: new MockEmailMessageRepository(),
    emailRecognitions: new MockEmailRecognitionRepository(),
    mode: "mock",
    shipments: new MockShipmentRepository(),
  };
}

function buildPrismaBundle(): RepositoryBundle {
  return {
    bookingPlans: new PrismaBookingPlanRepository(),
    contacts: new PrismaContactRepository(),
    drafts: new PrismaEmailDraftRepository(),
    emailMessages: new PrismaEmailMessageRepository(),
    emailRecognitions: new PrismaEmailRecognitionRepository(),
    mode: "prisma",
    shipments: new PrismaShipmentRepository(),
  };
}

export async function getRepositories(): Promise<RepositoryBundle> {
  if (cached) {
    logMode(cached.mode);
    return cached;
  }

  const probeResult = await probePrisma().catch(() => false);

  if (probeResult) {
    cached = buildPrismaBundle();
  } else {
    cached = buildMockBundle();
  }

  logMode(cached.mode);
  return cached;
}

/**
 * Test-only escape hatch. Forces the next call to `getRepositories()` to
 * rebuild the bundle. Used by unit tests that mutate env vars between
 * cases.
 */
export function __resetRepositoryCache(): void {
  cached = null;
  modeLogged = null;
}

export type {
  BookingPlanRecord,
  BookingPlanRepository,
  BookingPlanSnapshot,
  UpdatePlanStatusInput,
  UpsertBookingPlanInput,
} from "./booking-plan-repository";
export type {
  ContactRecord,
  ContactRepository,
  ContactRole,
  ContactWithMeta,
} from "./contact-repository";
export type {
  CreateEmailDraftInput,
  EmailDraftRecord,
  EmailDraftRepository,
  MarkSentInput,
  UpdateEmailDraftInput,
} from "./email-draft-repository";
export type {
  CreateEmailMessageInput,
  EmailMessageRecord,
  EmailMessageRepository,
  UpdateEmailMessageSyncInput,
} from "./email-message-repository";
export type {
  CreateEmailRecognitionInput,
  EmailRecognitionRecord,
  EmailRecognitionRepository,
  RecognitionWithEmail,
  UpdateEmailRecognitionStatusInput,
} from "./email-recognition-repository";
export type {
  AdvanceStatusInput,
  ShipmentActionLogInput,
  ShipmentRepository,
} from "./shipment-repository";
export type {
  BookingPlanStatus,
  EmailDraftStatus,
  EmailDraftType,
  EmailMessageSyncStatus,
  EmailRecognitionStatus,
  EmailRecognitionType,
} from "./types";
