import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as listShipments } from "@/app/api/shipments/route";
import { GET as getShipment } from "@/app/api/shipments/[id]/route";
import { GET as listRecognitions } from "@/app/api/email-recognitions/route";
import { POST as runEmailSync } from "@/app/api/email-sync/run/route";

vi.mock("@/lib/services/email-recognition/email-recognition-service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/email-recognition/email-recognition-service")>(
    "@/lib/services/email-recognition/email-recognition-service",
  );
  return actual;
});

async function makeJsonRequest<T>(response: Response) {
  return (await response.json()) as T;
}

describe("shipments + email-recognitions API routes (mock data layer)", () => {
  const originalEnv = process.env.DATABASE_URL;

  beforeEach(async () => {
    delete process.env.DATABASE_URL;
    const { __resetRepositoryCache } = await import("@/lib/repositories");
    const { resetMockStore } = await import("@/lib/repositories/mock/mock-store");
    __resetRepositoryCache();
    resetMockStore();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalEnv;
    }
  });

  it("GET /api/shipments returns the mock shipments with a warning banner", async () => {
    const response = await listShipments();
    expect(response.status).toBe(200);
    const body = await makeJsonRequest<{
      data: Array<{ id: string }>;
      source: string;
      warning: string;
    }>(response);
    expect(body.source).toBe("mock");
    expect(body.warning).toMatch(/DATABASE_URL|mock/i);
    expect(body.data.map((shipment) => shipment.id)).toContain("SHP-240610-001");
  });

  it("GET /api/shipments/SHP-240610-002 returns the matching shipment", async () => {
    const response = await getShipment(
      new Request("http://localhost") as unknown as Parameters<typeof getShipment>[0],
      {
        params: Promise.resolve({ id: "SHP-240610-002" }),
      },
    );
    expect(response.status).toBe(200);
    const body = await makeJsonRequest<{ data: { id: string }; source: string }>(response);
    expect(body.data.id).toBe("SHP-240610-002");
    expect(body.source).toBe("mock");
  });

  it("GET /api/shipments/<missing> returns 404", async () => {
    const response = await getShipment(
      new Request("http://localhost") as unknown as Parameters<typeof getShipment>[0],
      {
        params: Promise.resolve({ id: "SHP-NOT-EXIST" }),
      },
    );
    expect(response.status).toBe(404);
    const body = await makeJsonRequest<{ error: string }>(response);
    expect(body.error).toMatch(/not found/i);
  });

  it("GET /api/email-recognitions returns pending recognitions in mock mode", async () => {
    const response = await listRecognitions();
    expect(response.status).toBe(200);
    const body = await makeJsonRequest<{
      data: Array<{ status: string }>;
      source: string;
    }>(response);
    expect(body.source).toBe("mock");
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data.every((item) => item.status === "pending_review")).toBe(true);
  });

  it("POST /api/email-sync/run returns the recognition sync envelope expected by the client", async () => {
    const response = await runEmailSync(new Request("http://localhost/api/email-sync/run", { method: "POST" }));

    expect(response.status).toBe(200);
    const body = await makeJsonRequest<{
      data: { duplicateCount: number; importedCount: number; recognitions: Array<{ id: string }> };
      source: string;
    }>(response);
    expect(body.source).toBe("mock");
    expect(typeof body.data.duplicateCount).toBe("number");
    expect(typeof body.data.importedCount).toBe("number");
    expect(Array.isArray(body.data.recognitions)).toBe(true);
  });
});
