import { ArrowRight, Bell, CircleAlert, FileCheck2, FilePlus2, PanelRightOpen, X } from "lucide-react";
import type { ComponentType } from "react";

import type { AlertLevel, ShipmentRecord, ShipmentStatus } from "@/lib/mock-data";
import type { BookingPlanCreateCheck, ShipmentBrief, ShipmentDetailGroup, ShipmentStatusEditDraft } from "./page-helpers";

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
  createBookingPlanCheck,
  nextAction,
  onCreateBookingPlan,
  onOpenDetails,
  shipmentBrief,
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
  createBookingPlanCheck: BookingPlanCreateCheck;
  nextAction: string;
  onCreateBookingPlan: () => void;
  onOpenDetails: () => void;
  shipmentBrief: ShipmentBrief;
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

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">柜子简介</p>
              <p className="mt-2 break-words text-base font-semibold text-slate-950">{shipmentBrief.route}</p>
              <p className="mt-1 break-words text-sm leading-6 text-slate-600">{shipmentBrief.primaryLine}</p>
              <p className="mt-1 break-words text-sm leading-6 text-slate-600">{shipmentBrief.timing}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onOpenDetails}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
              >
                <PanelRightOpen className="h-4 w-4" />
                查看明细
              </button>
              <button
                type="button"
                onClick={onCreateBookingPlan}
                disabled={!createBookingPlanCheck.canCreate}
                title={createBookingPlanCheck.message}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-3 text-sm font-medium text-white transition hover:bg-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/70 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              >
                <FilePlus2 className="h-4 w-4" />
                用此柜新建订舱计划
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 min-[1700px]:grid-cols-4">
            {shipmentBrief.summaryItems.map((item) => (
              <div key={item.label} className="rounded-lg bg-white px-3 py-2.5">
                <p className="text-[11px] text-slate-500">{item.label}</p>
                <p className="mt-1 break-words text-sm font-medium text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
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

export function ShipmentDetailDrawer({
  groups,
  isOpen,
  onClose,
  shipmentBrief,
}: {
  groups: ShipmentDetailGroup[];
  isOpen: boolean;
  onClose: () => void;
  shipmentBrief: ShipmentBrief;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="当前柜子明细">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/30"
        onClick={onClose}
        aria-label="关闭柜子明细"
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[560px] flex-col border-l border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-700">当前柜子明细</p>
              <h2 className="mt-2 break-words text-lg font-semibold text-slate-950">{shipmentBrief.route}</h2>
              <p className="mt-1 break-words text-sm leading-6 text-slate-600">{shipmentBrief.primaryLine}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
              aria-label="关闭"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-4">
            {groups.map((group) => (
              <section key={group.title} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm font-semibold text-slate-950">{group.title}</p>
                <div className="mt-3 space-y-2">
                  {group.items.map((item) => (
                    <div key={`${group.title}-${item.label}`} className="flex items-start justify-between gap-4 rounded-lg bg-white px-3 py-2.5">
                      <span className="shrink-0 text-sm text-slate-500">{item.label}</span>
                      <span className="break-words text-right text-sm font-medium text-slate-900">{item.value}</span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

const shipmentStatusOptions: ShipmentStatus[] = [
  "已发送订舱",
  "等待放舱",
  "已催放舱",
  "已放舱",
  "待补料",
  "已发送补料",
  "等待补料确认",
  "补料已确认",
  "待报关",
  "已报关",
  "待提柜",
  "已提柜",
  "已装柜",
  "已还柜",
  "已开船",
  "已到港",
  "已签收",
  "已完成",
  "异常处理中",
];

function StatusEditInput({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block text-sm text-slate-700">
      <span className="mb-1.5 block text-xs font-medium text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-cyan-500"
      />
    </label>
  );
}

export function ShipmentStatusEditDrawer({
  draft,
  isOpen,
  onChangeDraft,
  onClose,
  onSave,
  shipment,
}: {
  draft: ShipmentStatusEditDraft;
  isOpen: boolean;
  onChangeDraft: (draft: ShipmentStatusEditDraft) => void;
  onClose: () => void;
  onSave: () => void;
  shipment: ShipmentRecord | null;
}) {
  if (!isOpen || !shipment) return null;

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="柜子状态明细">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/30"
        onClick={onClose}
        aria-label="关闭柜子状态明细"
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[720px] flex-col border-l border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-700">订舱跟踪详情</p>
              <h2 className="mt-2 break-words text-lg font-semibold text-slate-950">{shipment.batchNo}</h2>
              <p className="mt-1 break-words text-sm leading-6 text-slate-600">
                单击队列卡片后可在这里查看并修正状态、SO、柜号和订舱跟踪字段。
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
              aria-label="关闭"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm leading-6 text-cyan-800">
            等待放舱阶段先使用内部批次号跟进；代理放舱回传后，邮件识别队列会识别 SO 号码并写回。海运费、件毛体、拖车行、报关行和电放确认也可人工录入。
          </div>

          <section className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-sm font-semibold text-slate-950">状态字段</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-sm text-slate-700">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">主状态</span>
                <select
                  value={draft.status}
                  onChange={(event) => onChangeDraft({ ...draft, status: event.target.value as ShipmentStatus })}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-cyan-500"
                >
                  {shipmentStatusOptions.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>

              <label className="block text-sm text-slate-700">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">邮件状态</span>
                <select
                  value={draft.mailStatus}
                  onChange={(event) => onChangeDraft({ ...draft, mailStatus: event.target.value as ShipmentRecord["mailStatus"] })}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-cyan-500"
                >
                  {(["未发送", "跟进中", "已发送"] as const).map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>

              <label className="block text-sm text-slate-700">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">SO 状态</span>
                <select
                  value={draft.soStatus}
                  onChange={(event) => onChangeDraft({ ...draft, soStatus: event.target.value as ShipmentRecord["soStatus"] })}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-cyan-500"
                >
                  {(["待识别", "已识别"] as const).map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>

              <label className="block text-sm text-slate-700">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">补料状态</span>
                <select
                  value={draft.documentStatus}
                  onChange={(event) => onChangeDraft({ ...draft, documentStatus: event.target.value as ShipmentRecord["documentStatus"] })}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-cyan-500"
                >
                  {(["待生成", "处理中", "已发送", "已确认"] as const).map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>

              <label className="block text-sm text-slate-700">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">提单电放确认</span>
                <select
                  value={draft.blTelexStatus || "未确认"}
                  onChange={(event) => onChangeDraft({ ...draft, blTelexStatus: event.target.value as ShipmentStatusEditDraft["blTelexStatus"] })}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-cyan-500"
                >
                  {(["未确认", "待确认", "已确认"] as const).map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-sm font-semibold text-slate-950">基础与时效字段</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StatusEditInput label="柜号" value={draft.containerNo} onChange={(value) => onChangeDraft({ ...draft, containerNo: value })} />
              <StatusEditInput label="SO（代理放舱后识别写回）" value={draft.soNo} onChange={(value) => onChangeDraft({ ...draft, soNo: value })} />
              <StatusEditInput label="船公司" value={draft.carrier} onChange={(value) => onChangeDraft({ ...draft, carrier: value })} />
              <StatusEditInput label="船名" value={draft.vesselName} onChange={(value) => onChangeDraft({ ...draft, vesselName: value })} />
              <StatusEditInput label="航次" value={draft.voyageNo} onChange={(value) => onChangeDraft({ ...draft, voyageNo: value })} />
              <StatusEditInput label="ETD" value={draft.etd} onChange={(value) => onChangeDraft({ ...draft, etd: value })} />
              <StatusEditInput label="ETA" value={draft.eta} onChange={(value) => onChangeDraft({ ...draft, eta: value })} />
              <StatusEditInput label="截单时间" value={draft.cutoffTime} onChange={(value) => onChangeDraft({ ...draft, cutoffTime: value })} />
              <StatusEditInput label="截重时间" value={draft.cutWeightTime} onChange={(value) => onChangeDraft({ ...draft, cutWeightTime: value })} />
              <StatusEditInput label="截关时间" value={draft.cutCustomsTime} onChange={(value) => onChangeDraft({ ...draft, cutCustomsTime: value })} />
              <StatusEditInput label="负责人" value={draft.operator} onChange={(value) => onChangeDraft({ ...draft, operator: value })} />
              <StatusEditInput label="跟进次数" value={draft.followUpCount} onChange={(value) => onChangeDraft({ ...draft, followUpCount: value })} />
            </div>
          </section>

          <section className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-sm font-semibold text-slate-950">订舱跟踪字段</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StatusEditInput label="海运费报价" value={draft.oceanFreightPrice} onChange={(value) => onChangeDraft({ ...draft, oceanFreightPrice: value })} />
              <StatusEditInput label="件数" value={draft.packages} onChange={(value) => onChangeDraft({ ...draft, packages: value })} />
              <StatusEditInput label="毛重" value={draft.grossWeight} onChange={(value) => onChangeDraft({ ...draft, grossWeight: value })} />
              <StatusEditInput label="体积" value={draft.cbm} onChange={(value) => onChangeDraft({ ...draft, cbm: value })} />
              <StatusEditInput label="拖车行" value={draft.truckingCompany} onChange={(value) => onChangeDraft({ ...draft, truckingCompany: value })} />
              <StatusEditInput label="报关行" value={draft.customsBroker} onChange={(value) => onChangeDraft({ ...draft, customsBroker: value })} />
            </div>

            <label className="mt-3 block text-sm text-slate-700">
              <span className="mb-1.5 block text-xs font-medium text-slate-500">下一步动作</span>
              <textarea
                value={draft.nextAction}
                onChange={(event) => onChangeDraft({ ...draft, nextAction: event.target.value })}
                className="min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 outline-none focus:border-cyan-500"
              />
            </label>
          </section>
        </div>

        <div className="border-t border-slate-200 px-5 py-4">
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
            >
              取消
            </button>
            <button
              type="button"
              onClick={onSave}
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-cyan-600 px-3.5 text-sm font-medium text-white transition hover:bg-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/70"
            >
              保存人工修正
            </button>
          </div>
        </div>
      </aside>
    </div>
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
    <SectionCard title="提醒与字段" kicker="提醒优先级与关键单证">
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">申报进度</p>
            <p className="mt-1 text-xs text-slate-500">按节点拆分文档状态</p>
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
    <SectionCard title="操作面板" kicker="建议动作在前，状态动作在后">
      <div className="mt-3 grid grid-cols-1 gap-3 min-[1700px]:grid-cols-[minmax(0,0.98fr)_minmax(0,1.02fr)]">
        <div className="rounded-xl border border-cyan-200 bg-cyan-50/80 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-700">建议优先处理</p>
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
              追加催单
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
