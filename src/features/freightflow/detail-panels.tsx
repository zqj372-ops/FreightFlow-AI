import { ArrowRight, Bell, CircleAlert, FileCheck2 } from "lucide-react";
import type { ComponentType } from "react";

import type { AlertLevel } from "@/lib/mock-data";

import { ActionTile, DetailKeyValue, SectionCard, StatusBadge, type DetailItem } from "./shared-ui";

type DetailMetricCard = {
  className: string;
  detail: string;
  label: string;
  value: string;
};

type ReminderChip = {
  className: string;
  label: string;
};

type ProgressItem = {
  className: string;
  label: string;
  value: string;
};

type OverviewInfoItem = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
};

type ActionItem = {
  detail: string;
  highlight?: boolean;
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  status: string;
  statusClassName: string;
};

export function ShipmentDetailPanel({
  aiSummary,
  batchNo,
  containerNo,
  cutoffBadgeClassName,
  cutoffLabel,
  detailItems,
  nextAction,
  soNo,
  status,
  statusLevel,
  vesselVoyage,
}: {
  aiSummary: string;
  batchNo: string;
  containerNo: string;
  cutoffBadgeClassName: string;
  cutoffLabel: string;
  detailItems: OverviewInfoItem[];
  nextAction: string;
  soNo: string;
  status: string;
  statusLevel: AlertLevel;
  vesselVoyage: string;
}) {
  return (
    <SectionCard title="当前柜子" kicker="当前处理上下文">
      <div className="mt-3 flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">当前柜子</p>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600">
                {vesselVoyage}
              </span>
            </div>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">{batchNo}</h2>
            <p className="mt-1 text-sm text-slate-600">SO {soNo} · 柜号 {containerNo}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={status} level={statusLevel} size="md" />
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${cutoffBadgeClassName}`}>
              {cutoffLabel}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 min-[1800px]:grid-cols-4">
          {detailItems.map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="flex items-center gap-2 text-slate-500">
                <Icon className="h-4 w-4" />
                <p className="text-[11px] font-medium">{label}</p>
              </div>
              <p className="mt-2 break-words text-sm font-medium leading-6 text-slate-900">{value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 min-[1700px]:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
          <div className="rounded-xl border border-cyan-100 bg-cyan-50/80 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-700">当前判断</p>
            <p className="mt-2 break-words text-sm leading-6 text-slate-700">{aiSummary}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">建议下一步</p>
            <div className="mt-2 flex items-start gap-2 text-sm leading-6 text-slate-800">
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
              <span className="break-words">{nextAction}</span>
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

export function ShipmentTimelinePanel({
  locationItems,
  metrics,
}: {
  locationItems: DetailItem[];
  metrics: DetailMetricCard[];
}) {
  return (
    <SectionCard title="时效与节点" kicker="执行窗口与作业地点">
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 min-[1700px]:grid-cols-4">
        {metrics.map((item) => (
          <div key={item.label} className={`rounded-xl border px-3 py-3 ${item.className}`}>
            <p className="text-[11px] font-medium opacity-80">{item.label}</p>
            <p className="mt-2 break-words text-sm font-semibold text-current">{item.value}</p>
            <p className="mt-1 break-words text-[11px] leading-5 opacity-80">{item.detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {locationItems.map((item) => (
          <DetailKeyValue key={item.label} label={item.label} value={item.value} stacked />
        ))}
      </div>
    </SectionCard>
  );
}

export function ShipmentFieldPanel({
  fieldItems,
  progressItems,
  reminders,
}: {
  fieldItems: DetailItem[];
  progressItems: ProgressItem[];
  reminders: ReminderChip[];
}) {
  return (
    <SectionCard title="SO 与关键字段" kicker="识别状态、提醒和待补料字段">
      <div className="mt-3 flex flex-wrap gap-2">
        {reminders.length > 0 ? (
          reminders.map((item) => (
            <span
              key={item.label}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${item.className}`}
            >
              <CircleAlert className="h-3.5 w-3.5" />
              {item.label}
            </span>
          ))
        ) : (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] text-emerald-700">
            当前无额外提醒
          </span>
        )}
      </div>

      <div className="mt-4 space-y-2.5 text-sm text-slate-700">
        {fieldItems.map((item) => (
          <DetailKeyValue key={item.label} label={item.label} value={item.value} stacked />
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">SO 后续节点</p>
            <p className="mt-1 text-xs text-slate-500">SO 识别后再推进补料和申报字段</p>
          </div>
          <FileCheck2 className="h-4 w-4 text-slate-400" />
        </div>

        <div className="mt-3 space-y-2">
          {progressItems.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2.5">
              <span className="break-words text-sm text-slate-600">{item.label}</span>
              <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-medium ${item.className}`}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

export function ShipmentActionPanel({
  actionItems,
  nextAction,
  onFollowUp,
  onRunRecommended,
  recommendedAction,
}: {
  actionItems: ActionItem[];
  nextAction: string;
  onFollowUp: () => void;
  onRunRecommended: () => void;
  recommendedAction: {
    detail: string;
    label: string;
    status: string;
    statusClassName: string;
  };
}) {
  return (
    <SectionCard title="订舱与 SO 闭环" kicker="先生成邮件，再识别 SO，最后回写 Shipment">
      <div className="mt-3 grid grid-cols-1 gap-3 min-[1700px]:grid-cols-[minmax(0,0.98fr)_minmax(0,1.02fr)]">
        <div className="rounded-xl border border-cyan-200 bg-cyan-50/80 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-700">建议下一步</p>
              <p className="mt-2 break-words text-base font-semibold text-slate-950">{recommendedAction.label}</p>
              <p className="mt-2 break-words text-sm leading-6 text-slate-700">{recommendedAction.detail}</p>
            </div>
            <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-medium ${recommendedAction.statusClassName}`}>
              {recommendedAction.status}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-3.5 text-sm font-medium text-white transition hover:bg-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/70" onClick={onRunRecommended}>
              <ArrowRight className="h-4 w-4" />
              执行建议动作
            </button>
            <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60" onClick={onFollowUp}>
              <Bell className="h-4 w-4" />
              跟进回邮
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">动作说明</p>
          <div className="mt-2 flex items-start gap-2 text-sm leading-6 text-slate-700">
            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <span className="break-words">{nextAction}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {actionItems.map((item) => (
          <ActionTile key={item.label} {...item} />
        ))}
      </div>
    </SectionCard>
  );
}
