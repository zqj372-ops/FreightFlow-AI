import { FileText, RefreshCw, UploadCloud, Wand2 } from "lucide-react";
import type { ChangeEvent } from "react";

import { SectionCard } from "@/features/freightflow/shared-ui";

export type SoUploadDraft = {
  fileBase64?: string;
  fileName: string;
  mimeType: string;
  sourceText: string;
};

export function SoUploadPanel({
  disabled,
  draft,
  onChange,
  onLoadSample,
  onRun,
  onSyncReplies,
  selectedBatchNo,
  statusText,
  syncing,
}: {
  disabled: boolean;
  draft: SoUploadDraft;
  onChange: (draft: SoUploadDraft) => void;
  onLoadSample: () => void;
  onRun: () => void;
  onSyncReplies: () => void;
  selectedBatchNo: string;
  statusText: string;
  syncing: boolean;
}) {
  function readFileAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
      reader.addEventListener("error", () => reject(reader.error ?? new Error("Failed to read file.")));
      reader.readAsDataURL(file);
    });
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const canReadAsText = file.type.startsWith("text/") || /\.(csv|eml|txt)$/i.test(file.name);
    const sourceText = canReadAsText ? await file.text() : "";
    const fileBase64 = canReadAsText ? undefined : await readFileAsDataUrl(file);

    onChange({
      fileBase64,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      sourceText,
    });
  }

  const canRun = (draft.sourceText.trim().length > 0 || Boolean(draft.fileBase64)) && !disabled;

  return (
    <SectionCard title="SO 上传识别" kicker={selectedBatchNo}>
      <div className="mt-3 grid gap-3 min-[1700px]:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-3">
          <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center transition hover:border-cyan-300 hover:bg-cyan-50/70">
            <UploadCloud className="h-5 w-5 text-cyan-600" />
            <span className="mt-2 text-sm font-medium text-slate-800">{draft.fileName || "选择 SO 文件"}</span>
            <span className="mt-1 text-xs text-slate-500">{draft.mimeType || "text/plain"}</span>
            <input
              type="file"
              accept=".txt,.eml,.csv,.pdf,.png,.jpg,.jpeg,.webp"
              className="sr-only"
              onChange={(event) => {
                void handleFileChange(event);
              }}
            />
          </label>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={onLoadSample}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
            >
              <FileText className="h-4 w-4" />
              示例 SO
            </button>
            <button
              type="button"
              onClick={onSyncReplies}
              disabled={syncing}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              同步回邮
            </button>
          </div>

          <button
            type="button"
            onClick={onRun}
            disabled={!canRun}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-3.5 text-sm font-medium text-white transition hover:bg-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/70 disabled:cursor-not-allowed disabled:bg-cyan-300"
          >
            <Wand2 className="h-4 w-4" />
            {disabled ? "识别中" : "上传并识别"}
          </button>
        </div>

        <label className="block min-w-0">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">OCR 文本</span>
          <textarea
            value={draft.sourceText}
            onChange={(event) => onChange({ ...draft, sourceText: event.target.value })}
            className="min-h-56 w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-sm leading-6 text-slate-900 outline-none focus:border-cyan-500"
            placeholder="SO / Booking No: OOLU8791320&#10;Carrier: OOCL&#10;Vessel: OOCL Rauma&#10;Voyage: 068E"
          />
          <p className="mt-2 min-h-5 text-xs leading-5 text-slate-500">
            {statusText}
            {draft.fileBase64 && !draft.sourceText.trim() ? " PDF/图片会发送到 OCR provider。" : ""}
          </p>
        </label>
      </div>
    </SectionCard>
  );
}
