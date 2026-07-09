import { CheckCircle2, CircleAlert, DatabaseZap } from "lucide-react";

import type { SoApplyResult, SoExtractionResult, SoFieldKey } from "@/lib/so/so-types";
import type { SoValidationResult } from "@/features/freightflow/api-client";
import { SectionCard } from "@/features/freightflow/shared-ui";

export const SO_FIELD_LABELS: Record<SoFieldKey, string> = {
  aciCutoff: "ACI Cutoff",
  amsCutoff: "AMS Cutoff",
  bookingAgent: "订舱代理",
  carrier: "船公司",
  containerQuantity: "柜量",
  containerType: "柜型",
  cutoffTime: "截关",
  cyClosing: "CY Closing",
  eta: "ETA",
  etd: "ETD",
  isfCutoff: "ISF Cutoff",
  pickupLocation: "提柜点",
  placeOfDelivery: "交货地",
  placeOfReceipt: "收货地",
  portOfDischarge: "POD",
  portOfLoading: "POL",
  remarks: "备注",
  returnLocation: "还柜点",
  siCutoff: "SI Cutoff",
  soNo: "SO No.",
  vessel: "船名",
  voyage: "航次",
};

export function confidenceLabel(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function SoExtractResultPanel({
  applyResult,
  extraction,
  onApply,
  validation,
  working,
}: {
  applyResult: (SoApplyResult & { persisted?: boolean }) | null;
  extraction: SoExtractionResult | null;
  onApply: () => void;
  validation: SoValidationResult | null;
  working: boolean;
}) {
  const visibleFields = extraction?.fields.filter((field) => field.value).slice(0, 12) ?? [];
  const emptyState = !extraction;

  return (
    <SectionCard title="SO 识别结果" kicker={extraction ? `置信度 ${confidenceLabel(extraction.confidence)}` : "等待上传"}>
      {emptyState ? (
        <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm leading-6 text-slate-500">
          识别结果会显示在这里，确认后可回写当前 Shipment。
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 min-[1700px]:grid-cols-3">
            {visibleFields.map((field) => (
              <div
                key={field.fieldKey}
                className={`rounded-xl border px-3 py-3 ${
                  field.needsReview ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium text-slate-500">{SO_FIELD_LABELS[field.fieldKey]}</p>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                      field.needsReview
                        ? "border-amber-200 bg-white text-amber-700"
                        : "border-emerald-200 bg-white text-emerald-700"
                    }`}
                  >
                    {confidenceLabel(field.confidence)}
                  </span>
                </div>
                <p className="mt-2 break-words text-sm font-semibold text-slate-900">{field.value}</p>
              </div>
            ))}
          </div>

          {validation?.missingFields.length ? (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-800">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>缺少字段：{validation.missingFields.map((key) => SO_FIELD_LABELS[key as SoFieldKey] ?? key).join("、")}</span>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm leading-6 text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>关键字段已识别，可回写 Shipment。</span>
            </div>
          )}

          {applyResult ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-700">
              已回写 {applyResult.appliedFields.length} 个字段，跳过 {applyResult.skippedFields.length} 个低置信字段。
            </div>
          ) : null}

          <button
            type="button"
            onClick={onApply}
            disabled={working || !extraction}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-3.5 text-sm font-medium text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/70 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <DatabaseZap className="h-4 w-4" />
            {working ? "回写中" : "确认回写 Shipment"}
          </button>
        </div>
      )}
    </SectionCard>
  );
}
