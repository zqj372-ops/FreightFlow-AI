import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ensureStoredFileExists,
  getShipmentAttachment,
  listShipmentAttachments,
  storeShipmentAttachment,
  updateAttachmentOcr,
} from "./attachment-storage-service";

describe("attachment storage service", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalStorageDir = process.env.FREIGHTFLOW_STORAGE_DIR;
  let storageDir = "";

  beforeEach(async () => {
    delete process.env.DATABASE_URL;
    storageDir = await mkdtemp(path.join(tmpdir(), "freightflow-storage-"));
    process.env.FREIGHTFLOW_STORAGE_DIR = storageDir;
  });

  afterEach(async () => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
    if (originalStorageDir === undefined) {
      delete process.env.FREIGHTFLOW_STORAGE_DIR;
    } else {
      process.env.FREIGHTFLOW_STORAGE_DIR = originalStorageDir;
    }
    await rm(storageDir, { force: true, recursive: true });
  });

  it("stores, lists, reads, and updates OCR metadata in local mode", async () => {
    const stored = await storeShipmentAttachment({
      buffer: Buffer.from("SO released: OOLU8791320"),
      documentType: "so",
      mimeType: "text/plain",
      originalName: "SO 回传.txt",
      shipmentId: "SHP-240610-001",
      uploadedBy: "测试员",
    });

    expect(stored.source).toBe("local");
    expect(stored.data).toMatchObject({
      documentType: "so",
      mimeType: "text/plain",
      originalName: "SO_回传.txt",
      shipmentId: "SHP-240610-001",
      uploadedBy: "测试员",
    });
    await expect(ensureStoredFileExists(stored.data)).resolves.toContain(stored.data.storageKey);

    const listed = await listShipmentAttachments("SHP-240610-001");
    expect(listed.data).toHaveLength(1);

    const updated = await updateAttachmentOcr("SHP-240610-001", stored.data.id, {
      ocrConfidence: 1,
      ocrStatus: "recognized",
      ocrText: "SO released: OOLU8791320",
    });
    expect(updated?.data).toMatchObject({
      ocrConfidence: 1,
      ocrStatus: "recognized",
      ocrText: "SO released: OOLU8791320",
    });

    const fetched = await getShipmentAttachment("SHP-240610-001", stored.data.id);
    expect(fetched?.data.ocrStatus).toBe("recognized");
  });
});
