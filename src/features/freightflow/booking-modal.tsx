import {
  CheckCircle2,
  CircleX,
  Mail,
  Plus,
  Send,
  UserRound,
  Users,
} from "lucide-react";

import type { ShipmentRecord } from "@/lib/mock-data";

import {
  actionButtonClass,
  contactRoleLabel,
  contactRoleBadgeClass,
  type BookingDraft,
  type ContactDraft,
  type ContactRole,
  type ContactRecord,
} from "@/features/freightflow/page-helpers";
import { DetailKeyValue, type DetailItem } from "@/features/freightflow/shared-ui";

function BookingAddressField({
  addresses,
  helper,
  inputValue,
  invalid,
  label,
  onAdd,
  onChange,
  onCommit,
  onKeyDown,
  onRemove,
  placeholder,
  required = false,
}: {
  addresses: string[];
  helper: string;
  inputValue: string;
  invalid: boolean;
  label: string;
  onAdd: () => void;
  onChange: (value: string) => void;
  onCommit: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onRemove: (email: string) => void;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">{label}</p>
            {required ? (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">必填</span>
            ) : null}
            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {addresses.length} 个地址
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p>
        </div>

        <button
          type="button"
          onClick={onAdd}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
        >
          <Plus className="h-4 w-4" />
          添加地址
        </button>
      </div>

      <div
        className={`mt-3 rounded-xl border bg-white px-3 py-3 shadow-sm ${
          invalid ? "border-red-300 shadow-red-100/70" : "border-slate-200 shadow-slate-100/70 focus-within:border-cyan-400"
        }`}
      >
        <div className="flex flex-wrap gap-2">
          {addresses.map((email) => (
            <button
              key={email}
              type="button"
              onClick={() => onRemove(email)}
              className="inline-flex min-h-9 max-w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
              aria-label={`移除 ${email}`}
            >
              <span className="truncate">{email}</span>
              <CircleX className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            </button>
          ))}

          <input
            value={inputValue}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
            onBlur={onCommit}
            className="min-w-[180px] flex-1 border-0 bg-transparent py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400 sm:min-w-[220px]"
            placeholder={placeholder}
            aria-label={label}
          />
        </div>

        {addresses.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
            {required ? "至少保留 1 位收件人，邮件才能发送。" : "没有抄送地址时可留空。"}
          </div>
        ) : null}
      </div>

      {invalid ? <p className="mt-2 text-xs text-red-600">请输入有效邮箱后再添加。</p> : null}
    </section>
  );
}

function BookingContactCard({
  contact,
  inCc,
  inTo,
  onAddCc,
  onAddTo,
}: {
  contact: ContactRecord;
  inCc: boolean;
  inTo: boolean;
  onAddCc: () => void;
  onAddTo: () => void;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm shadow-slate-100/70">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">{contact.label}</p>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${contactRoleBadgeClass(contact.role)}`}>
              {contactRoleLabel[contact.role]}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-slate-500">{contact.email}</p>
        </div>

        <div className="rounded-full bg-slate-50 p-2 text-slate-500">
          <Users className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onAddTo}
          disabled={inTo}
          className={
            inTo
              ? "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-700"
              : "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
          }
        >
          {inTo ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
          {inTo ? "已在收件人" : "加入收件人"}
        </button>
        <button
          type="button"
          onClick={onAddCc}
          disabled={inCc}
          className={
            inCc
              ? "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-700"
              : "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
          }
        >
          {inCc ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
          {inCc ? "已在抄送" : "加入抄送"}
        </button>
      </div>
    </article>
  );
}

type BookingModalProps = {
  bookingChecklistItems: ReadonlyArray<DetailItem>;
  bookingContacts: ContactRecord[];
  bookingDraft: BookingDraft;
  bookingSending: boolean;
  ccInput: string;
  ccInputInvalid: boolean;
  contactDraft: ContactDraft;
  contactEmailInvalid: boolean;
  contactExists: boolean;
  contactReady: boolean;
  isOpen: boolean;
  onAddCcAddress: () => void;
  onAddContact: () => void;
  onAddRecipientAddress: () => void;
  onChangeBody: (value: string) => void;
  onChangeCcInput: (value: string) => void;
  onChangeContactDraft: (next: ContactDraft) => void;
  onChangeRecipientInput: (value: string) => void;
  onChangeSubject: (value: string) => void;
  onClose: () => void;
  onCommitCcAddress: () => void;
  onCommitRecipientAddress: () => void;
  onContactAddCc: (email: string) => void;
  onContactAddRecipient: (email: string) => void;
  onRecipientKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onRemoveCcAddress: (email: string) => void;
  onRemoveRecipientAddress: (email: string) => void;
  onSend: () => void;
  onCcKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  recipientInput: string;
  recipientInputInvalid: boolean;
  shipment: ShipmentRecord | null;
};

export function BookingModal({
  bookingChecklistItems,
  bookingContacts,
  bookingDraft,
  bookingSending,
  ccInput,
  ccInputInvalid,
  contactDraft,
  contactEmailInvalid,
  contactExists,
  contactReady,
  isOpen,
  onAddCcAddress,
  onAddContact,
  onAddRecipientAddress,
  onChangeBody,
  onChangeCcInput,
  onChangeContactDraft,
  onChangeRecipientInput,
  onChangeSubject,
  onClose,
  onCommitCcAddress,
  onCommitRecipientAddress,
  onContactAddCc,
  onContactAddRecipient,
  onRecipientKeyDown,
  onRemoveCcAddress,
  onRemoveRecipientAddress,
  onSend,
  onCcKeyDown,
  recipientInput,
  recipientInputInvalid,
  shipment,
}: BookingModalProps) {
  if (!isOpen || !shipment) return null;

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/45 px-3 py-3 backdrop-blur-sm sm:px-4 sm:py-6">
      <div className="mx-auto flex min-h-full w-full max-w-6xl items-start justify-center sm:items-center">
        <div className="flex max-h-[calc(100vh-1.5rem)] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 sm:max-h-[calc(100vh-3rem)]">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">订舱流程</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-950">{shipment.batchNo}</h3>
              <p className="mt-1 text-sm text-slate-600">
                {shipment.originPort} - {shipment.destinationPort} · {shipment.containerType}
              </p>
            </div>
            <button
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
              onClick={onClose}
            >
              关闭
            </button>
          </div>

          <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <div className="min-h-0 overflow-y-auto border-b border-slate-200 p-4 sm:p-5 xl:border-b-0 xl:border-r">
              <div className="space-y-4">
                <BookingAddressField
                  addresses={bookingDraft.to}
                  helper="支持输入多个邮箱；回车、逗号或分号会自动入列。"
                  inputValue={recipientInput}
                  invalid={recipientInputInvalid}
                  label="收件人"
                  onAdd={onAddRecipientAddress}
                  onChange={onChangeRecipientInput}
                  onCommit={onCommitRecipientAddress}
                  onKeyDown={onRecipientKeyDown}
                  onRemove={onRemoveRecipientAddress}
                  placeholder="输入邮箱后回车，例如 booking@agent.com"
                  required
                />

                <BookingAddressField
                  addresses={bookingDraft.cc}
                  helper="可选，常用于操作、业务或报关协同同步。"
                  inputValue={ccInput}
                  invalid={ccInputInvalid}
                  label="抄送"
                  onAdd={onAddCcAddress}
                  onChange={onChangeCcInput}
                  onCommit={onCommitCcAddress}
                  onKeyDown={onCcKeyDown}
                  onRemove={onRemoveCcAddress}
                  placeholder="输入抄送邮箱后回车"
                />
              </div>

              <label className="mt-3 block text-sm text-slate-700">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">邮件主题</span>
                <input
                  value={bookingDraft.subject}
                  onChange={(event) => onChangeSubject(event.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-cyan-500"
                />
              </label>

              <label className="mt-3 block text-sm text-slate-700">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">邮件正文</span>
                <textarea
                  value={bookingDraft.body}
                  onChange={(event) => onChangeBody(event.target.value)}
                  className="min-h-64 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-mono text-sm leading-6 outline-none focus:border-cyan-500 sm:min-h-72"
                />
              </label>
            </div>

            <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">通讯录</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">维护常用联系人，并一键加入收件人或抄送。</p>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
                    {bookingContacts.length} 位联系人
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">新增联系人</p>
                      <p className={`mt-1 text-xs leading-5 ${contactExists || contactEmailInvalid ? "text-amber-700" : "text-slate-500"}`}>
                        {contactExists
                          ? "该联系人邮箱已存在于当前通讯录。"
                          : contactEmailInvalid
                            ? "请输入有效的联系人邮箱。"
                            : "新增后可立即加入收件人或抄送。"}
                      </p>
                    </div>
                    <div className="rounded-full bg-slate-50 p-2 text-slate-500">
                      <UserRound className="h-4 w-4" />
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                    <input
                      value={contactDraft.label}
                      onChange={(event) => onChangeContactDraft({ ...contactDraft, label: event.target.value })}
                      className="h-10 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-cyan-500"
                      placeholder="联系人名称"
                      aria-label="联系人名称"
                    />
                    <input
                      value={contactDraft.email}
                      onChange={(event) => onChangeContactDraft({ ...contactDraft, email: event.target.value })}
                      className={`h-10 rounded-xl border px-3 text-sm outline-none ${contactExists || contactEmailInvalid ? "border-amber-300 focus:border-amber-400" : "border-slate-200 focus:border-cyan-500"}`}
                      placeholder="联系人邮箱"
                      aria-label="联系人邮箱"
                    />
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] xl:grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_auto]">
                    <select
                      value={contactDraft.role}
                      onChange={(event) => onChangeContactDraft({
                        ...contactDraft,
                        role: event.target.value as ContactRole,
                      })}
                      className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-cyan-500"
                    >
                      {Object.entries(contactRoleLabel).map(([role, label]) => (
                        <option key={role} value={role}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={onAddContact}
                      disabled={!contactReady}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-3 text-sm font-medium text-white transition hover:bg-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 disabled:cursor-not-allowed disabled:bg-cyan-300"
                    >
                      <Plus className="h-4 w-4" />
                      新增联系人
                    </button>
                  </div>
                </div>

                <div className="mt-3 max-h-[340px] space-y-2 overflow-y-auto pr-1">
                  {bookingContacts.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
                      当前没有可用联系人，请先新增联系人。
                    </div>
                  ) : (
                    bookingContacts.map((contact) => (
                      <BookingContactCard
                        key={contact.email}
                        contact={contact}
                        inCc={bookingDraft.cc.includes(contact.email)}
                        inTo={bookingDraft.to.includes(contact.email)}
                        onAddCc={() => onContactAddCc(contact.email)}
                        onAddTo={() => onContactAddRecipient(contact.email)}
                      />
                    ))
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">订舱检查项</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">发送前确认代理、船公司、柜型与附件是否匹配。</p>
                  </div>
                  <div className="rounded-full bg-white p-2 text-slate-500">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  {bookingChecklistItems.map((item) => (
                    <DetailKeyValue key={item.label} label={item.label} value={item.value} stacked />
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                当前流程已覆盖收件人、主题、正文、通讯录和发送确认。托书附件可在新建订舱计划弹窗中按模板生成并下载。
              </div>

              <div className="mt-4 grid gap-2 sm:flex">
                <button className={actionButtonClass()} onClick={onClose} disabled={bookingSending}>
                  取消
                </button>
                <button className={actionButtonClass(true)} onClick={onSend} disabled={bookingSending || bookingDraft.to.length === 0}>
                  <Send className="h-4 w-4" />
                  {bookingSending ? "发送中" : "确认发送订舱"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
