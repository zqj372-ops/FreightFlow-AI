import { CheckCircle2, CircleAlert, DatabaseZap, FileSearch, RefreshCw, RotateCcw } from "lucide-react";

import { SectionCard } from "@/features/freightflow/shared-ui";
import { SO_FIELD_TO_SHIPMENT } from "@/lib/so/so-field-mapper";
import type {
  SoDocumentCenterRecord,
  SoDocumentStatusBucket,
  SoExtractedField,
  SoFieldKey,
} from "@/lib/so/so-types";

import { confidenceLabel, SO_FIELD_LABELS } from "./so-extract-result-panel";

export type SoReviewDraft = Partial<Record<SoFieldKey, { apply: boolean; confirmed: boolean; value: string }>>;

const BUCKETS: Array<{ bucket: SoDocumentStatusBucket; label: string }> = [
  { bucket: "pending", label: "待识别" },
  { bucket: "review", label: "待复核" },
  { bucket: "applied", label: "已回写" },
  { bucket: "failed", label: "失败" },
];

function canWriteBack(fieldKey: SoFieldKey) {
  return Boolean(SO_FIELD_TO_SHIPMENT[fieldKey]) || fieldKey === "vessel" || fieldKey === "voyage";
}

function shipmentValue(document: SoDocumentCenterRecord, fieldKey: SoFieldKey) {
  const shipment = document.shipment;
  if (!shipment) return "-";
  if (fieldKey === "vessel" || fieldKey === "voyage") return shipment.vesselVoyage || "-";

  const shipmentKey = SO_FIELD_TO_SHIPMENT[fieldKey];
  if (!shipmentKey) return "不回写";

  return String(shipment[shipmentKey] ?? "") || "-";
}

function visibleFields(document: SoDocumentCenterRecord | null) {
  return document?.extractedFields.filter((field) => field.value) ?? [];
}

export function buildSoReviewDraft(document: SoDocumentCenterRecord | null): SoReviewDraft {
  const draft: SoReviewDraft = {};

  for (const field of visibleFields(document)) {
    const writable = canWriteBack(field.fieldKey);
    draft[field.fieldKey] = {
      apply: writable && !field.needsReview,
      confirmed: writable && !field.needsReview,
      value: field.value ?? "",
    };
  }

  return draft;
}

function statusTone(bucket: SoDocumentStatusBucket) {
  if (bucket === "failed") return "border-red-200 bg-red-50 text-red-700";
  if (bucket === "review") return "border-amber-200 bg-amber-50 text-amber-700";
  if (bucket === "applied") return "border-emerald-200 bg-emerald-50 text-emerald-700";

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function fieldTone(field: SoExtractedField) {
  if (field.needsReview) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export function SoRecognitionCenter({
  activeBucket,
  applying,
  documents,
  loading,
  onApplyReview,
  onBucketChange,
  onRefresh,
  onReviewDraftChange,
  onSelectDocument,
  reviewDraft,
  selectedDocument,
}: {
  activeBucket: SoDocumentStatusBucket;
  applying: boolean;
  documents: SoDocumentCenterRecord[];
  loading: boolean;
  onApplyReview: () => void;
  onBucketChange: (bucket: SoDocumentStatusBucket) => void;
  onRefresh: () => void;
  onReviewDraftChange: (fieldKey: SoFieldKey, patch: { apply?: boolean; confirmed?: boolean; value?: string }) => void;
  onSelectDocument: (documentId: string) => void;
  reviewDraft: SoReviewDraft;
  selectedDocument: SoDocumentCenterRecord | null;
}) {
  const counts = new Map<SoDocumentStatusBucket, number>();
  for (const bucket of BUCKETS) counts.set(bucket.bucket, documents.filter((document) => document.statusBucket === bucket.bucket).length);

  const filteredDocuments = documents.filter((document) => document.statusBucket === activeBucket);
  const fields = visibleFields(selectedDocument);
  const selectedIsReviewable = selectedDocument?.statusBucket === "review";
  const canApply = Boolean(
    selectedDocument &&
      selectedIsReviewable &&
      fields.some((field) => canWriteBack(field.fieldKey) && reviewDraft[field.fieldKey]?.apply),
  );

  return (
    <section className="grid min-h-0 flex-1 grid-cols-1 gap-3 2xl:grid-cols-[420px_minmax(0,1fr)]">
      <SectionCard title="SO 识别中心" kicker="按 OCR 与复核状态处理 SO 文档">
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {BUCKETS.map((item) => {
            const active = activeBucket === item.bucket;

            return (
              <button
                key={item.bucket}
                type="button"
                onClick={() => onBucketChange(item.bucket)}
                className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 ${
                  active ? "border-cyan-500 bg-cyan-50 text-cyan-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {item.label}
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] tabular-nums text-slate-600">
                  {counts.get(item.bucket) ?? 0}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="ml-auto inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            刷新
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {filteredDocuments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
              <FileSearch className="mx-auto h-5 w-5 text-slate-400" />
              <p className="mt-3 text-sm font-medium text-slate-900">当前分组没有 SO 文档</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">上传、同步回邮或切换状态后继续处理。</p>
            </div>
          ) : (
            filteredDocuments.map((document) => {
              const selected = selectedDocument?.id === document.id;

              return (
                <button
                  key={document.id}
                  type="button"
                  onClick={() => onSelectDocument(document.id)}
                  className={`w-full rounded-lg border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 ${
                    selected ? "border-cyan-500 bg-cyan-50" : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">{document.fileName}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {document.batchNo ?? document.shipmentId} · {document.source}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium ${statusTone(document.statusBucket)}`}>
                      {document.statusLabel}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-slate-600">
                    <div className="rounded-md bg-slate-50 px-2 py-2">
                      <p className="text-slate-400">字段</p>
                      <p className="mt-1 font-medium tabular-nums">{document.extractedFields.filter((field) => field.value).length}</p>
                    </div>
                    <div className="rounded-md bg-slate-50 px-2 py-2">
                      <p className="text-slate-400">低置信</p>
                      <p className="mt-1 font-medium tabular-nums">{document.reviewFields.length}</p>
                    </div>
                    <div className="rounded-md bg-slate-50 px-2 py-2">
                      <p className="text-slate-400">置信度</p>
                      <p className="mt-1 font-medium tabular-nums">
                        {typeof document.confidence === "number" ? confidenceLabel(document.confidence) : "-"}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="SO 复核页"
        kicker={selectedDocument ? `${selectedDocument.batchNo ?? selectedDocument.shipmentId} · ${selectedDocument.statusLabel}` : "选择左侧 SO 文档"}
      >
        {!selectedDocument ? (
          <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
            选择一个 SO 文档后查看 OCR 文本、抽取字段、Shipment 当前字段和回写状态。
          </div>
        ) : (
          <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Shipment 当前字段</p>
                    <p className="mt-2 break-words text-sm font-semibold text-slate-950">
                      {selectedDocument.shipment?.batchNo ?? selectedDocument.shipmentId}
                    </p>
                    <p className="mt-1 break-words text-xs leading-5 text-slate-600">
                      SO {selectedDocument.shipment?.soNo ?? "-"} · {selectedDocument.shipment?.carrier ?? "-"} ·{" "}
                      {selectedDocument.shipment?.vesselVoyage ?? "-"}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium ${statusTone(selectedDocument.statusBucket)}`}>
                    {selectedDocument.statusLabel}
                  </span>
                </div>

                {selectedDocument.appliedAt ? (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm leading-6 text-emerald-800">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>已回写 {selectedDocument.appliedFields.length} 个字段，时间 {selectedDocument.appliedAt}</span>
                  </div>
                ) : null}

                {selectedDocument.failedReason ? (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm leading-6 text-red-800">
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{selectedDocument.failedReason}</span>
                  </div>
                ) : null}
              </div>

              <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">OCR 文本</p>
                <pre className="mt-2 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 px-3 py-3 font-mono text-xs leading-6 text-slate-100">
                  {selectedDocument.rawText?.trim() || "OCR 还未产生文本。"}
                </pre>
              </div>
            </div>

            <div className="space-y-3">
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="grid grid-cols-[minmax(96px,0.74fr)_minmax(140px,1fr)_minmax(120px,0.9fr)_104px] gap-0 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <span>抽取字段</span>
                  <span>OCR 值</span>
                  <span>Shipment 当前值</span>
                  <span>是否回写</span>
                </div>

                {fields.length === 0 ? (
                  <div className="px-3 py-8 text-center text-sm text-slate-500">暂无抽取字段，先完成 OCR 和字段抽取。</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {fields.map((field) => {
                      const draft = reviewDraft[field.fieldKey] ?? { apply: false, confirmed: false, value: field.value ?? "" };
                      const writable = canWriteBack(field.fieldKey);
                      const locked = selectedDocument.statusBucket === "applied" || selectedDocument.statusBucket === "failed";

                      return (
                        <div
                          key={field.fieldKey}
                          className="grid grid-cols-1 gap-2 px-3 py-3 text-sm md:grid-cols-[minmax(96px,0.74fr)_minmax(140px,1fr)_minmax(120px,0.9fr)_104px] md:items-center"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900">{SO_FIELD_LABELS[field.fieldKey]}</p>
                            <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${fieldTone(field)}`}>
                              {confidenceLabel(field.confidence)}
                            </span>
                          </div>

                          <input
                            value={draft.value}
                            onChange={(event) =>
                              onReviewDraftChange(field.fieldKey, {
                                apply: writable,
                                confirmed: writable,
                                value: event.target.value,
                              })
                            }
                            disabled={!selectedIsReviewable || !writable || locked}
                            className="min-h-10 min-w-0 rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-cyan-500 disabled:bg-slate-50 disabled:text-slate-500"
                          />

                          <p className="min-w-0 break-words rounded-lg bg-slate-50 px-3 py-2.5 text-sm leading-5 text-slate-700">
                            {shipmentValue(selectedDocument, field.fieldKey)}
                          </p>

                          <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={selectedDocument.statusBucket === "applied" ? selectedDocument.appliedFields.includes(field.fieldKey) : Boolean(draft.apply)}
                              disabled={!selectedIsReviewable || !writable || locked}
                              onChange={(event) =>
                                onReviewDraftChange(field.fieldKey, {
                                  apply: event.target.checked,
                                  confirmed: event.target.checked,
                                })
                              }
                              className="h-4 w-4 accent-cyan-600"
                            />
                            {writable ? "回写" : "不回写"}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => selectedDocument && onSelectDocument(selectedDocument.id)}
                  disabled={!selectedDocument || applying}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <RotateCcw className="h-4 w-4" />
                  重置复核
                </button>
                <button
                  type="button"
                  onClick={onApplyReview}
                  disabled={!canApply || applying}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3.5 text-sm font-medium text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/70 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <DatabaseZap className="h-4 w-4" />
                  {applying ? "回写中" : "人工确认并回写"}
                </button>
              </div>
            </div>
          </div>
        )}
      </SectionCard>
    </section>
  );
}
