import {
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  Mail,
  PlugZap,
  Save,
  Settings2,
  X,
  XCircle,
} from "lucide-react";

import type {
  EmailConnectionTest,
  EmailSettingsPayload,
  OpenClawConnectionTest,
  OpenClawSettingsPayload,
  PublicEmailConfig,
  PublicOpenClawConfig,
} from "@/features/freightflow/api-client";

export type OpenClawSettingsDraft = Omit<OpenClawSettingsPayload, "test">;
export type EmailSettingsDraft = Omit<EmailSettingsPayload, "test">;
export type SettingsTab = "openclaw" | "email";

type OpenClawSettingsModalProps = {
  activeTab: SettingsTab;
  emailDraft: EmailSettingsDraft;
  emailError: string | null;
  emailLoading: boolean;
  emailSavedConfig: PublicEmailConfig | null;
  emailTestResult: EmailConnectionTest | null;
  isOpen: boolean;
  onChangeEmail: (draft: EmailSettingsDraft) => void;
  onChangeOpenClaw: (draft: OpenClawSettingsDraft) => void;
  onClose: () => void;
  onSaveEmail: (test: boolean) => void;
  onSaveOpenClaw: (test: boolean) => void;
  onTabChange: (tab: SettingsTab) => void;
  openClawDraft: OpenClawSettingsDraft;
  openClawError: string | null;
  openClawLoading: boolean;
  openClawSavedConfig: PublicOpenClawConfig | null;
  openClawTestResult: OpenClawConnectionTest | null;
  showEmailPassword: boolean;
  showOpenClawApiKey: boolean;
  toggleShowEmailPassword: () => void;
  toggleShowOpenClawApiKey: () => void;
};

function formatUpdatedAt(value: string | null) {
  if (!value) return "尚未保存";

  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function ResultBanner({ result }: { result: EmailConnectionTest | OpenClawConnectionTest | null }) {
  if (!result) return null;

  const serviceResults = "smtp" in result || "imap" in result ? [result.smtp, result.imap].filter(Boolean) : [];

  return (
    <div
      className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm leading-6 ${
        result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"
      }`}
    >
      {result.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
      <span>
        {result.message}
        {"responseTimeMs" in result && typeof result.responseTimeMs === "number" ? ` 用时 ${result.responseTimeMs}ms。` : ""}
        {serviceResults.length > 0 ? (
          <span className="mt-1 block text-xs leading-5">
            {serviceResults.map((item) => `${item?.service.toUpperCase()}: ${item?.ok ? "通过" : item?.message}`).join(" / ")}
          </span>
        ) : null}
      </span>
    </div>
  );
}

function ErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;

  return (
    <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
      <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{error}</span>
    </div>
  );
}

export function OpenClawSettingsModal({
  activeTab,
  emailDraft,
  emailError,
  emailLoading,
  emailSavedConfig,
  emailTestResult,
  isOpen,
  onChangeEmail,
  onChangeOpenClaw,
  onClose,
  onSaveEmail,
  onSaveOpenClaw,
  onTabChange,
  openClawDraft,
  openClawError,
  openClawLoading,
  openClawSavedConfig,
  openClawTestResult,
  showEmailPassword,
  showOpenClawApiKey,
  toggleShowEmailPassword,
  toggleShowOpenClawApiKey,
}: OpenClawSettingsModalProps) {
  if (!isOpen) return null;

  const openClawCanSave = !openClawLoading && (!openClawDraft.enabled || openClawDraft.endpoint.trim().length > 0);
  const emailCanSave =
    !emailLoading &&
    (!emailDraft.enabled ||
      (emailDraft.smtpHost.trim().length > 0 &&
        emailDraft.imapHost.trim().length > 0 &&
        emailDraft.username.trim().length > 0 &&
        (emailDraft.password?.trim().length ?? 0) > 0 &&
        emailDraft.fromEmail.trim().length > 0));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-6">
      <div className="mx-auto flex min-h-full w-full max-w-4xl items-start justify-center sm:items-center">
        <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20">
          <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
                <Settings2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">系统设置</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">集成配置</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  管理 AI 与邮箱发送通道。保存后立即影响后续请求；未启用的模块会保持本地 mock / stub 模式。
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
              aria-label="关闭系统设置"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="grid min-h-[620px] grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="border-b border-slate-200 bg-slate-50 p-3 md:border-b-0 md:border-r">
              {[
                { key: "openclaw" as const, icon: PlugZap, label: "OpenClaw", summary: openClawSavedConfig?.enabled ? "已启用" : "未启用" },
                { key: "email" as const, icon: Mail, label: "邮箱服务", summary: emailSavedConfig?.enabled ? "IMAP/SMTP 已启用" : "Mock 模式" },
              ].map((item) => {
                const Icon = item.icon;
                const selected = activeTab === item.key;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onTabChange(item.key)}
                    className={`mb-2 flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 ${
                      selected ? "border-cyan-200 bg-white text-cyan-900 shadow-sm" : "border-transparent text-slate-700 hover:bg-white"
                    }`}
                  >
                    <Icon className={selected ? "h-4 w-4 text-cyan-700" : "h-4 w-4 text-slate-500"} />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{item.label}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">{item.summary}</span>
                    </span>
                  </button>
                );
              })}
            </aside>

            <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
              {activeTab === "openclaw" ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <label className="flex items-start justify-between gap-4">
                      <span>
                        <span className="block text-sm font-semibold text-slate-900">启用 OpenClaw 代理</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500">
                          开启后 `/api/ai/openclaw` 会转发到下方 endpoint；关闭时返回本地 stub。
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={openClawDraft.enabled}
                        onChange={(event) => onChangeOpenClaw({ ...openClawDraft, enabled: event.target.checked })}
                        className="mt-1 h-5 w-5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                      />
                    </label>
                  </div>

                  <label className="block text-sm text-slate-700">
                    <span className="mb-1.5 block text-xs font-medium text-slate-500">服务地址 Endpoint</span>
                    <input
                      value={openClawDraft.endpoint}
                      onChange={(event) => onChangeOpenClaw({ ...openClawDraft, endpoint: event.target.value })}
                      className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10"
                      placeholder="例如 http://127.0.0.1:8080/api/chat"
                    />
                  </label>

                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
                    <label className="block text-sm text-slate-700">
                      <span className="mb-1.5 block text-xs font-medium text-slate-500">API Key</span>
                      <div className="flex h-11 overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/10">
                        <input
                          value={openClawDraft.apiKey ?? ""}
                          onChange={(event) => onChangeOpenClaw({ ...openClawDraft, apiKey: event.target.value })}
                          type={showOpenClawApiKey ? "text" : "password"}
                          className="min-w-0 flex-1 px-3 text-sm outline-none"
                          placeholder={openClawSavedConfig?.apiKeyConfigured ? "已保存密钥；留空将清空" : "可选 Bearer Token"}
                        />
                        <button
                          type="button"
                          onClick={toggleShowOpenClawApiKey}
                          className="inline-flex w-11 items-center justify-center border-l border-slate-200 text-slate-500 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
                          aria-label={showOpenClawApiKey ? "隐藏 API Key" : "显示 API Key"}
                        >
                          {showOpenClawApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </label>

                    <label className="block text-sm text-slate-700">
                      <span className="mb-1.5 block text-xs font-medium text-slate-500">超时毫秒</span>
                      <input
                        value={openClawDraft.timeoutMs}
                        onChange={(event) => onChangeOpenClaw({ ...openClawDraft, timeoutMs: Number(event.target.value) })}
                        type="number"
                        min={5000}
                        max={120000}
                        step={1000}
                        className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10"
                      />
                    </label>
                  </div>

                  <label className="block text-sm text-slate-700">
                    <span className="mb-1.5 block text-xs font-medium text-slate-500">模型名</span>
                    <input
                      value={openClawDraft.model}
                      onChange={(event) => onChangeOpenClaw({ ...openClawDraft, model: event.target.value })}
                      className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10"
                      placeholder="可选，例如 openclaw-default"
                    />
                  </label>

                  <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600 sm:grid-cols-3">
                    <div><p className="font-medium text-slate-900">当前状态</p><p className="mt-1">{openClawSavedConfig?.enabled ? "已启用" : "未启用"}</p></div>
                    <div><p className="font-medium text-slate-900">密钥</p><p className="mt-1">{openClawSavedConfig?.apiKeyConfigured ? "已配置" : "未配置"}</p></div>
                    <div><p className="font-medium text-slate-900">最近保存</p><p className="mt-1">{formatUpdatedAt(openClawSavedConfig?.updatedAt ?? null)}</p></div>
                  </div>

                  <ErrorBanner error={openClawError} />
                  <ResultBanner result={openClawTestResult} />

                  <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
                    <button type="button" onClick={() => onSaveOpenClaw(false)} disabled={!openClawCanSave} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-4 text-sm font-medium text-cyan-800 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"><Save className="h-4 w-4" />保存配置</button>
                    <button type="button" onClick={() => onSaveOpenClaw(true)} disabled={!openClawCanSave} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 text-sm font-medium text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-cyan-300">{openClawLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}保存并测试</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <label className="flex items-start justify-between gap-4">
                      <span>
                        <span className="block text-sm font-semibold text-slate-900">启用 IMAP / SMTP 邮箱服务</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500">
                          SMTP 用于发送订舱邮件；IMAP 用于后续收取回执、同步回复与识别 SO 邮件。关闭时继续使用 mock-local。
                        </span>
                      </span>
                      <input type="checkbox" checked={emailDraft.enabled} onChange={(event) => onChangeEmail({ ...emailDraft, enabled: event.target.checked })} className="mt-1 h-5 w-5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500" />
                    </label>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-sm font-semibold text-slate-900">发信 SMTP</p>
                    <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_150px_120px]">
                      <label className="block text-sm text-slate-700"><span className="mb-1.5 block text-xs font-medium text-slate-500">SMTP Host</span><input value={emailDraft.smtpHost} onChange={(event) => onChangeEmail({ ...emailDraft, smtpHost: event.target.value })} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-cyan-500" placeholder="smtp.example.com" /></label>
                      <label className="block text-sm text-slate-700"><span className="mb-1.5 block text-xs font-medium text-slate-500">SMTP 端口</span><input value={emailDraft.smtpPort} onChange={(event) => onChangeEmail({ ...emailDraft, smtpPort: Number(event.target.value) })} type="number" min={1} max={65535} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-cyan-500" /></label>
                      <label className="flex items-end gap-2 pb-2 text-sm text-slate-700"><input type="checkbox" checked={emailDraft.smtpSecure} onChange={(event) => onChangeEmail({ ...emailDraft, smtpSecure: event.target.checked })} className="h-5 w-5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500" /><span className="pb-0.5">SSL/TLS</span></label>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-sm font-semibold text-slate-900">收信 IMAP</p>
                    <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_150px_120px]">
                      <label className="block text-sm text-slate-700"><span className="mb-1.5 block text-xs font-medium text-slate-500">IMAP Host</span><input value={emailDraft.imapHost} onChange={(event) => onChangeEmail({ ...emailDraft, imapHost: event.target.value })} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-cyan-500" placeholder="imap.example.com" /></label>
                      <label className="block text-sm text-slate-700"><span className="mb-1.5 block text-xs font-medium text-slate-500">IMAP 端口</span><input value={emailDraft.imapPort} onChange={(event) => onChangeEmail({ ...emailDraft, imapPort: Number(event.target.value) })} type="number" min={1} max={65535} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-cyan-500" /></label>
                      <label className="flex items-end gap-2 pb-2 text-sm text-slate-700"><input type="checkbox" checked={emailDraft.imapSecure} onChange={(event) => onChangeEmail({ ...emailDraft, imapSecure: event.target.checked })} className="h-5 w-5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500" /><span className="pb-0.5">SSL/TLS</span></label>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block text-sm text-slate-700"><span className="mb-1.5 block text-xs font-medium text-slate-500">SMTP 用户名</span><input value={emailDraft.username} onChange={(event) => onChangeEmail({ ...emailDraft, username: event.target.value })} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-cyan-500" placeholder="通常是邮箱账号" /></label>
                    <label className="block text-sm text-slate-700">
                      <span className="mb-1.5 block text-xs font-medium text-slate-500">SMTP 密码 / 授权码</span>
                      <div className="flex h-11 overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-cyan-500">
                        <input value={emailDraft.password ?? ""} onChange={(event) => onChangeEmail({ ...emailDraft, password: event.target.value })} type={showEmailPassword ? "text" : "password"} className="min-w-0 flex-1 px-3 text-sm outline-none" placeholder={emailSavedConfig?.passwordConfigured ? "已保存；留空将清空" : "邮箱授权码"} />
                        <button type="button" onClick={toggleShowEmailPassword} className="inline-flex w-11 items-center justify-center border-l border-slate-200 text-slate-500 transition hover:bg-slate-50" aria-label={showEmailPassword ? "隐藏 SMTP 密码" : "显示 SMTP 密码"}>{showEmailPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                      </div>
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block text-sm text-slate-700"><span className="mb-1.5 block text-xs font-medium text-slate-500">发件人名称</span><input value={emailDraft.fromName} onChange={(event) => onChangeEmail({ ...emailDraft, fromName: event.target.value })} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-cyan-500" placeholder="FreightFlow AI" /></label>
                    <label className="block text-sm text-slate-700"><span className="mb-1.5 block text-xs font-medium text-slate-500">发件邮箱</span><input value={emailDraft.fromEmail} onChange={(event) => onChangeEmail({ ...emailDraft, fromEmail: event.target.value })} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-cyan-500" placeholder="ops@example.com" /></label>
                  </div>

                  <label className="block text-sm text-slate-700"><span className="mb-1.5 block text-xs font-medium text-slate-500">Reply-To</span><input value={emailDraft.replyTo} onChange={(event) => onChangeEmail({ ...emailDraft, replyTo: event.target.value })} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-cyan-500" placeholder="可选，留空则使用发件邮箱" /></label>

                  <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600 sm:grid-cols-3">
                    <div><p className="font-medium text-slate-900">邮箱模式</p><p className="mt-1">{emailSavedConfig?.enabled ? "IMAP/SMTP" : "mock-local"}</p></div>
                    <div><p className="font-medium text-slate-900">密码</p><p className="mt-1">{emailSavedConfig?.passwordConfigured ? "已配置" : "未配置"}</p></div>
                    <div><p className="font-medium text-slate-900">最近保存</p><p className="mt-1">{formatUpdatedAt(emailSavedConfig?.updatedAt ?? null)}</p></div>
                  </div>

                  <ErrorBanner error={emailError} />
                  <ResultBanner result={emailTestResult} />

                  <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
                    <button type="button" onClick={() => onSaveEmail(false)} disabled={!emailCanSave} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-4 text-sm font-medium text-cyan-800 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"><Save className="h-4 w-4" />保存邮箱</button>
                    <button type="button" onClick={() => onSaveEmail(true)} disabled={!emailCanSave} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 text-sm font-medium text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-cyan-300">{emailLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}保存并测试 IMAP/SMTP</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
