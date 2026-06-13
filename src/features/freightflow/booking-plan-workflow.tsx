import { CheckCircle2, FileText, MailCheck, Paperclip, Save, Send, ShipWheel } from "lucide-react";

import type { ShipmentRecord } from "@/lib/mock-data";
import type { BookingDraft, BookingFormDraft, BookingPlanAttachmentPreview } from "./page-helpers";

type BookingPlanWorkflowProps = {
  attachmentPreview: BookingPlanAttachmentPreview;
  draft: BookingDraft;
  form: BookingFormDraft;
  hasPersistedDraft: boolean;
  onBackToQueue: () => void;
  onChangeDraft: (draft: BookingDraft) => void;
  onChangeForm: (form: BookingFormDraft) => void;
  onGenerateDraft: () => void;
  onSendDraft: () => void;
  saving: boolean;
  sending: boolean;
  shipment: ShipmentRecord;
  statusMessage: string | null;
};

const formFields: Array<{
  key: keyof BookingFormDraft;
  label: string;
  required?: boolean;
}> = [
  { key: "bookingAgent", label: "订舱代理", required: true },
  { key: "carrier", label: "船公司", required: true },
  { key: "containerType", label: "柜型", required: true },
  { key: "originPort", label: "起运港", required: true },
  { key: "destinationPort", label: "目的港", required: true },
  { key: "etd", label: "预计 ETD", required: true },
  { key: "vesselVoyage", label: "船名航次" },
  { key: "pickupLocation", label: "提柜地点" },
  { key: "returnLocation", label: "还柜地点" },
];

function splitAddresses(value: string) {
  return value
    .split(/[;,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinAddresses(value: string[]) {
  return value.join("; ");
}

export function BookingPlanWorkflow({
  attachmentPreview,
  draft,
  form,
  hasPersistedDraft,
  onBackToQueue,
  onChangeDraft,
  onChangeForm,
  onGenerateDraft,
  onSendDraft,
  saving,
  sending,
  shipment,
  statusMessage,
}: BookingPlanWorkflowProps) {
  const missingRequired = formFields.some((field) => field.required && form[field.key].trim().length === 0);
  const canGenerate = !missingRequired && !saving;
  const canSend = hasPersistedDraft && draft.to.length > 0 && !saving && !sending;

  return (
    <section className="min-h-0 rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/30">
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-medium text-cyan-700">
                <ShipWheel className="h-3.5 w-3.5" />
                订舱工作台 / 新建订舱计划
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">
                {shipment.batchNo}
              </span>
            </div>
            <h2 className="mt-3 text-xl font-semibold text-slate-950">填写订舱资料并生成草稿</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {shipment.originPort} → {shipment.destinationPort} · {shipment.containerType} · 操作员 {shipment.operator}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onBackToQueue}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
            >
              返回柜子队列
            </button>
            <button
              type="button"
              onClick={onGenerateDraft}
              disabled={!canGenerate}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-3.5 text-sm font-medium text-white transition hover:bg-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/70 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            >
              <Save className="h-4 w-4" />
              {saving ? "更新中" : "生成附件并更新草稿"}
            </button>
          </div>
        </div>

        {statusMessage ? (
          <div className="mt-3 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm text-cyan-800">
            {statusMessage}
          </div>
        ) : null}
      </div>

      <div className="grid min-h-0 grid-cols-1 gap-0 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="border-b border-slate-200 p-4 xl:border-b-0 xl:border-r">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">订舱表单</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">默认带入当前柜信息，可在生成草稿前调整。</p>
              </div>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {formFields.map((field) => (
                <label key={field.key} className="block text-sm text-slate-700">
                  <span className="mb-1.5 block text-xs font-medium text-slate-500">
                    {field.label}{field.required ? " *" : ""}
                  </span>
                  <input
                    value={form[field.key]}
                    onChange={(event) => onChangeForm({ ...form, [field.key]: event.target.value })}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-cyan-500"
                  />
                </label>
              ))}
            </div>

            <label className="mt-3 block text-sm text-slate-700">
              <span className="mb-1.5 block text-xs font-medium text-slate-500">备注</span>
              <textarea
                value={form.remarks}
                onChange={(event) => onChangeForm({ ...form, remarks: event.target.value })}
                className="min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 outline-none focus:border-cyan-500"
              />
            </label>
          </div>

          <div className="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">附件预览</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">生成草稿时会把该附件名写入邮件草稿。</p>
              </div>
              <Paperclip className="h-4 w-4 text-slate-500" />
            </div>
            <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3">
              <p className="break-words text-sm font-medium text-slate-950">{attachmentPreview.fileName}</p>
              <div className="mt-3 space-y-1.5 text-xs leading-5 text-slate-600">
                {attachmentPreview.lines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">邮件草稿</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">确认发送前可编辑收件人、主题与正文。</p>
              </div>
              <FileText className="h-4 w-4 text-slate-500" />
            </div>

            <label className="mt-4 block text-sm text-slate-700">
              <span className="mb-1.5 block text-xs font-medium text-slate-500">收件人 *</span>
              <input
                value={joinAddresses(draft.to)}
                onChange={(event) => onChangeDraft({ ...draft, to: splitAddresses(event.target.value) })}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-cyan-500"
              />
            </label>

            <label className="mt-3 block text-sm text-slate-700">
              <span className="mb-1.5 block text-xs font-medium text-slate-500">抄送</span>
              <input
                value={joinAddresses(draft.cc)}
                onChange={(event) => onChangeDraft({ ...draft, cc: splitAddresses(event.target.value) })}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-cyan-500"
              />
            </label>

            <label className="mt-3 block text-sm text-slate-700">
              <span className="mb-1.5 block text-xs font-medium text-slate-500">主题</span>
              <input
                value={draft.subject}
                onChange={(event) => onChangeDraft({ ...draft, subject: event.target.value })}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-cyan-500"
              />
            </label>

            <label className="mt-3 block text-sm text-slate-700">
              <span className="mb-1.5 block text-xs font-medium text-slate-500">正文</span>
              <textarea
                value={draft.body}
                onChange={(event) => onChangeDraft({ ...draft, body: event.target.value })}
                className="min-h-80 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm leading-6 outline-none focus:border-cyan-500"
              />
            </label>

            <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
              <span className="text-slate-500">附件：</span>{draft.attachmentName || attachmentPreview.fileName}
            </div>

            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
              发送动作只在操作员点击确认后执行。发送成功后进入等待代理回传 SO，后续由 IMAP 识别队列承接。
              {!hasPersistedDraft ? " 当前草稿尚未持久化，需先生成并更新草稿。" : ""}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onSendDraft}
                disabled={!canSend}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3.5 text-sm font-medium text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/70 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
              >
                <Send className="h-4 w-4" />
                {sending ? "发送中" : "确认发送订舱邮件"}
              </button>
              <span className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-600">
                <MailCheck className="h-4 w-4" />
                发送后等待 SO 回传
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
