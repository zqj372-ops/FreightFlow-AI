import { readFile } from "node:fs/promises";
import path from "node:path";

export type OcrResult = {
  confidence: number | null;
  engine: "tesseract.js" | "text";
  status: "failed" | "recognized" | "unsupported";
  text: string | null;
  warning?: string;
};

const imageMimeTypes = new Set([
  "image/bmp",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/webp",
]);

const imageExtensions = new Set([".bmp", ".gif", ".jpeg", ".jpg", ".png", ".tif", ".tiff", ".webp"]);

function isTextLike(mimeType: string, fileName: string) {
  return mimeType.startsWith("text/") || [".csv", ".log", ".txt"].includes(path.extname(fileName).toLowerCase());
}

function isImageLike(mimeType: string, fileName: string) {
  return imageMimeTypes.has(mimeType) || imageExtensions.has(path.extname(fileName).toLowerCase());
}

export async function runOcrForFile({
  fileName,
  filePath,
  mimeType,
}: {
  fileName: string;
  filePath: string;
  mimeType: string;
}): Promise<OcrResult> {
  if (isTextLike(mimeType, fileName)) {
    const text = await readFile(filePath, "utf8");
    return {
      confidence: text.trim() ? 1 : 0,
      engine: "text",
      status: "recognized",
      text,
    };
  }

  if (!isImageLike(mimeType, fileName)) {
    return {
      confidence: null,
      engine: "tesseract.js",
      status: "unsupported",
      text: null,
      warning: "当前 OCR 仅支持图片与文本文件；PDF/Office 文件已保存，后续可接入 PDF rasterize 或云 OCR。",
    };
  }

  try {
    const { recognize } = await import("tesseract.js");
    const languages = process.env.OCR_LANGUAGES?.trim() || "eng+chi_sim";
    const result = await recognize(filePath, languages);
    const confidence = Number.isFinite(result.data.confidence) ? result.data.confidence / 100 : null;

    return {
      confidence,
      engine: "tesseract.js",
      status: "recognized",
      text: result.data.text,
    };
  } catch (error) {
    return {
      confidence: null,
      engine: "tesseract.js",
      status: "failed",
      text: null,
      warning: error instanceof Error ? error.message : "OCR failed.",
    };
  }
}
