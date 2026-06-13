import type { BookingPlanRecord } from "./booking-plan-rules";

type BookingPlanPanelProps = {
  generating: boolean;
  onGenerateDrafts: () => void;
  onTogglePlan: (shipmentId: string) => void;
  plans: BookingPlanRecord[];
  selectedIds: Set<string>;
};

const planStatusLabel: Record<BookingPlanRecord["planStatus"], string> = {
  draft_ready: "草稿待确认",
  missing_info: "资料缺失",
  ready_to_draft: "可生成草稿",
  send_failed: "发送失败",
  sent: "已发送",
};

const planStatusClassName: Record<BookingPlanRecord["planStatus"], string> = {
  draft_ready: "border-cyan-200 bg-cyan-50 text-cyan-700",
  missing_info: "border-amber-200 bg-amber-50 text-amber-700",
  ready_to_draft: "border-emerald-200 bg-emerald-50 text-emerald-700",
  send_failed: "border-red-200 bg-red-50 text-red-700",
  sent: "border-slate-200 bg-slate-50 text-slate-600",
};

export function BookingPlanPanel({
  generating,
  onGenerateDrafts,
  onTogglePlan,
  plans,
  selectedIds,
}: BookingPlanPanelProps) {
  const readyCount = plans.filter((plan) => plan.planStatus === "ready_to_draft").length;
  const draftReadyCount = plans.filter((plan) => plan.planStatus === "draft_ready").length;

  return (
    <section className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/30">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-950">待发订舱计划</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            勾选资料齐全的 Shipment，批量生成中文订舱草稿；发送仍需逐票人工确认。
          </p>
        </div>
        <button
          type="button"
          onClick={onGenerateDrafts}
          disabled={selectedIds.size === 0 || generating}
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-cyan-600 px-3.5 text-sm font-medium text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
        >
          {generating ? "生成中..." : `批量生成草稿 (${selectedIds.size})`}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-slate-500">待处理</p>
          <p className="mt-1 text-lg font-semibold text-slate-950">{plans.length}</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <p className="text-emerald-700">可生成</p>
          <p className="mt-1 text-lg font-semibold text-emerald-950">{readyCount}</p>
        </div>
        <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2">
          <p className="text-cyan-700">草稿待确认</p>
          <p className="mt-1 text-lg font-semibold text-cyan-950">{draftReadyCount}</p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {plans.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">
            当前没有待发订舱计划。
          </div>
        ) : (
          plans.slice(0, 5).map((plan) => {
            const selectable = plan.planStatus === "ready_to_draft";
            const checked = selectedIds.has(plan.shipmentId);

            return (
              <label
                key={plan.shipmentId}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-3 py-3 transition hover:border-cyan-200 hover:bg-cyan-50/30"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!selectable || generating}
                  onChange={() => onTogglePlan(plan.shipmentId)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-slate-950">{plan.batchNo}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] ${planStatusClassName[plan.planStatus]}`}>
                      {planStatusLabel[plan.planStatus]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {plan.originPort} → {plan.destinationPort} · {plan.containerType || "未填柜型"} · {plan.bookingAgent || "未填代理"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    {plan.riskFlags.join(" / ") || "资料齐全"}
                  </p>
                </div>
              </label>
            );
          })
        )}
      </div>
    </section>
  );
}
