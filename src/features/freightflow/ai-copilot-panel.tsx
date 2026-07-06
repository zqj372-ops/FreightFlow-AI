import type { KeyboardEvent, ReactNode } from "react";

import {
  Bot,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  MessageSquareQuote,
  Sparkles,
} from "lucide-react";

import type { ShipmentRecord } from "@/lib/mock-data";

import { quickPrompts } from "./page-helpers";

export type AiRequestState = "idle" | "loading" | "success" | "error";

type AiCopilotPanelProps = {
  aiInput: string;
  aiLastCompletedAt: string | null;
  aiLastPrompt: string | null;
  aiLastReplyLength: number;
  aiReply: string;
  aiRequestState: AiRequestState;
  onAiInputChange: (value: string) => void;
  onAiInputKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onQuickPrompt: (prompt: string) => void;
  onResetPrompt: () => void;
  onSend: () => void;
  selectedShipment: ShipmentRecord;
};

function getAiStateMeta(state: AiRequestState) {
  if (state === "loading") {
    return {
      badgeClass: "border-cyan-400/30 bg-cyan-400/10 text-cyan-100",
      label: "生成中",
      summary: "AI 正在生成订舱邮件或检查 SO 回写建议",
    };
  }

  if (state === "success") {
    return {
      badgeClass: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
      label: "已返回",
      summary: "已收到最新草稿或识别建议，可继续追问或改写 Prompt",
    };
  }

  if (state === "error") {
    return {
      badgeClass: "border-red-400/30 bg-red-400/10 text-red-100",
      label: "请求失败",
      summary: "接口没有成功返回，建议检查桥接服务后重试",
    };
  }

  return {
    badgeClass: "border-slate-700 bg-slate-900/90 text-slate-200",
    label: "待发送",
    summary: "选择订舱邮件或 SO 识别 Prompt",
  };
}

function renderAiReply(reply: string) {
  const lines = reply.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let paragraphBuffer: string[] = [];
  let listBuffer: Array<{ key: string; ordered: boolean; text: string }> = [];

  function flushParagraph() {
    if (paragraphBuffer.length === 0) return;

    blocks.push(
      <p key={`p-${blocks.length}`} className="text-sm leading-7 text-slate-100 break-words whitespace-pre-wrap">
        {paragraphBuffer.join(" ")}
      </p>,
    );

    paragraphBuffer = [];
  }

  function flushList() {
    if (listBuffer.length === 0) return;

    const ordered = listBuffer[0]?.ordered;
    const ListTag = ordered ? "ol" : "ul";

    blocks.push(
      <ListTag
        key={`list-${blocks.length}`}
        className={ordered ? "list-decimal space-y-2 pl-5 text-sm leading-7 text-slate-100" : "list-disc space-y-2 pl-5 text-sm leading-7 text-slate-100"}
      >
        {listBuffer.map((item) => (
          <li key={item.key} className="break-words whitespace-pre-wrap">
            {item.text}
          </li>
        ))}
      </ListTag>,
    );

    listBuffer = [];
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }

    const listMatch = trimmed.match(/^([-*•]|\d+\.)\s+(.*)$/);
    if (listMatch) {
      flushParagraph();

      const ordered = /\d+\./.test(listMatch[1] ?? "");
      if (listBuffer.length > 0 && listBuffer[0]?.ordered !== ordered) {
        flushList();
      }

      listBuffer.push({
        key: `${index}-${listMatch[2]}`,
        ordered,
        text: listMatch[2] ?? trimmed,
      });
      return;
    }

    flushList();
    paragraphBuffer.push(trimmed);
  });

  flushParagraph();
  flushList();

  if (blocks.length === 0) {
    return <p className="text-sm leading-7 text-slate-100 break-words whitespace-pre-wrap">{reply}</p>;
  }

  return blocks;
}

export function AiCopilotPanel({
  aiInput,
  aiLastCompletedAt,
  aiLastPrompt,
  aiLastReplyLength,
  aiReply,
  aiRequestState,
  onAiInputChange,
  onAiInputKeyDown,
  onQuickPrompt,
  onResetPrompt,
  onSend,
  selectedShipment,
}: AiCopilotPanelProps) {
  const aiLoading = aiRequestState === "loading";
  const aiPromptLength = aiInput.trim().length;
  const aiCanSend = aiPromptLength > 0 && !aiLoading;
  const aiStateMeta = getAiStateMeta(aiRequestState);
  const aiSignalCount = selectedShipment.exceptions.length + selectedShipment.reminderFlags.length;

  return (
    <section className="min-w-0 rounded-[20px] border border-slate-900 bg-slate-950 p-3 text-slate-100 shadow-[0_16px_40px_rgba(15,23,42,0.18)]">
      <div className="flex h-full min-h-[680px] min-w-0 flex-col rounded-[16px] border border-slate-800 bg-[linear-gradient(180deg,#111827_0%,#0f172a_100%)] p-4 sm:p-5">
        <div className="border-b border-slate-800/90 pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-white">AI 订舱助手</p>
                  <span className="rounded-full border border-slate-700 bg-slate-900/80 px-2 py-0.5 text-[11px] text-slate-300">
                    Booking draft + SO review
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  OpenClaw bridge / 当前 Shipment 上下文会自动注入，优先用于生成订舱邮件、检查缺失字段和判断 SO 回写。
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${aiStateMeta.badgeClass}`}>
                {aiStateMeta.label}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-[11px] text-slate-300">
                <Clock3 className="h-3.5 w-3.5" />
                {aiLastCompletedAt ? `上次返回 ${aiLastCompletedAt}` : "尚未发送请求"}
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 min-[1800px]:grid-cols-4">
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/70 px-3 py-3">
              <p className="text-[11px] text-slate-500">当前柜子</p>
              <p className="mt-2 text-sm font-medium text-slate-100 break-words">{selectedShipment.batchNo}</p>
              <p className="mt-2 text-[11px] leading-5 text-slate-400 break-words">{selectedShipment.containerNo} · SO {selectedShipment.soNo}</p>
            </div>
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/70 px-3 py-3">
              <p className="text-[11px] text-slate-500">当前状态</p>
              <p className="mt-2 text-sm font-medium text-slate-100 break-words">{selectedShipment.status}</p>
              <p className="mt-2 text-[11px] leading-5 text-slate-400">提醒 / 异常 {aiSignalCount} 条</p>
            </div>
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/70 px-3 py-3">
              <p className="text-[11px] text-slate-500">建议焦点</p>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-100 break-words">{selectedShipment.nextAction}</p>
            </div>
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/70 px-3 py-3">
              <p className="text-[11px] text-slate-500">最近一次请求</p>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-100 break-words">{aiLastPrompt ?? "等待本次输入"}</p>
              <p className="mt-2 text-[11px] leading-5 text-slate-400">{aiLastReplyLength > 0 ? `返回 ${aiLastReplyLength} 字` : "发送后会记录最近一次 Prompt"}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid min-h-0 flex-1 grid-cols-1 gap-4 min-[1800px]:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)]">
          <div className="flex min-h-0 flex-col gap-4">
            <section className="rounded-2xl border border-slate-800/90 bg-slate-900/55 px-4 py-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">订舱 Prompts</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">一键生成邮件草稿或检查 SO 回写风险，也可以点选后继续改写。</p>
                </div>
                <span className="rounded-full border border-slate-700 bg-slate-950/80 px-2.5 py-1 text-[11px] text-slate-300">
                  {quickPrompts.length} 条推荐
                </span>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 min-[1800px]:grid-cols-2">
                {quickPrompts.map((prompt) => {
                  const activePrompt = aiInput.trim() === prompt;

                  return (
                    <button
                      key={prompt}
                      onClick={() => onQuickPrompt(prompt)}
                      disabled={aiLoading}
                      className={`flex min-h-[72px] flex-col items-start justify-between rounded-xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900/50 disabled:text-slate-500 ${
                        activePrompt
                          ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-50"
                          : "border-slate-700 bg-slate-950/50 text-slate-200 hover:border-slate-600 hover:bg-slate-900"
                      }`}
                    >
                      <span className="text-sm leading-6 break-words">{prompt}</span>
                      <span className="text-[11px] text-slate-400">点按后带当前 Shipment 上下文发送</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-800/90 bg-slate-900/55 px-4 py-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Prompt 编辑区</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">发送时会自动附带订舱代理、航线、柜型、SO 状态和当前动作。</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                  <span className="rounded-full border border-slate-700 bg-slate-950/80 px-2.5 py-1 text-slate-300">
                    {aiPromptLength} 字
                  </span>
                  <span className="rounded-full border border-slate-700 bg-slate-950/80 px-2.5 py-1 text-slate-300">
                    Ctrl / Cmd + Enter 发送
                  </span>
                </div>
              </div>

              <div className={`mt-3 flex min-h-[250px] flex-1 flex-col rounded-xl border px-3 py-3 ${
                aiLoading ? "border-slate-800 bg-slate-950/70" : "border-slate-700 bg-slate-950/85 focus-within:border-cyan-400/70"
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <p className="text-xs font-medium text-slate-400">POST /api/ai/openclaw</p>
                  <span className="rounded-full border border-slate-800 bg-slate-900/90 px-2 py-0.5 text-[11px] text-slate-400">
                    {selectedShipment.destinationPort} · {selectedShipment.containerType}
                  </span>
                </div>

                <textarea
                  value={aiInput}
                  onChange={(event) => onAiInputChange(event.target.value)}
                  onKeyDown={onAiInputKeyDown}
                  disabled={aiLoading}
                  className="mt-3 min-h-[180px] flex-1 resize-none bg-transparent text-sm leading-7 text-slate-100 outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:text-slate-500"
                  placeholder="例如：基于当前 Shipment 生成一封可人工确认的英文订舱邮件草稿，并列出缺失字段。"
                />

                <div className="mt-3 flex flex-col gap-3 border-t border-slate-800 pt-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-300">{aiStateMeta.summary}</p>
                    <p className="text-xs leading-5 text-slate-500">AI 只生成草稿或识别建议，发送邮件仍需人工确认。</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={onResetPrompt}
                      disabled={aiLoading}
                      className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-950/80 px-3 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900/50 disabled:text-slate-500"
                    >
                      恢复推荐 Prompt
                    </button>
                    <button
                      onClick={onSend}
                      className="inline-flex h-10 min-w-[118px] items-center justify-center gap-2 rounded-lg bg-cyan-500 px-3.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:bg-cyan-900/60 disabled:text-slate-400"
                      disabled={!aiCanSend}
                    >
                      {aiLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {aiLoading ? "发送中" : "发送到 AI"}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <section className="min-h-0 rounded-2xl border border-slate-800/90 bg-slate-900/45">
            <div className="flex flex-col gap-3 border-b border-slate-800/90 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <MessageSquareQuote className="h-4 w-4 text-cyan-300" />
                  <p className="text-sm font-semibold text-white">AI 输出区</p>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-400">草稿、缺失字段和 SO 回写建议会按段落 / 列表渲染。</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                {aiLastReplyLength > 0 ? (
                  <span className="rounded-full border border-slate-700 bg-slate-950/80 px-2.5 py-1 text-slate-300">
                    {aiLastReplyLength} 字
                  </span>
                ) : null}
                <span className={`rounded-full border px-2.5 py-1 ${aiStateMeta.badgeClass}`}>{aiStateMeta.label}</span>
              </div>
            </div>

            <div className="flex min-h-[320px] flex-col px-4 py-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                <span className="break-words">{aiLastPrompt ? `最近一次 Prompt: ${aiLastPrompt}` : "发送后会保留最近一次 Prompt 供对照"}</span>
                {aiLastCompletedAt && aiRequestState === "success" ? (
                  <span className="inline-flex items-center gap-1 text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {aiLastCompletedAt} 返回
                  </span>
                ) : null}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto pr-1" aria-live="polite" aria-busy={aiLoading}>
                {aiLoading ? (
                  <div className="space-y-4 rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-4">
                    <div className="flex items-center gap-2 text-sm text-cyan-100">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      AI 正在读取当前 Shipment 并生成订舱/SO 建议
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 w-full animate-pulse rounded-full bg-slate-800" />
                      <div className="h-3 w-[88%] animate-pulse rounded-full bg-slate-800" />
                      <div className="h-3 w-[72%] animate-pulse rounded-full bg-slate-800" />
                      <div className="h-3 w-[64%] animate-pulse rounded-full bg-slate-800" />
                    </div>
                  </div>
                ) : (
                  <div
                    className={`space-y-4 rounded-xl border px-4 py-4 ${
                      aiRequestState === "error"
                        ? "border-red-400/25 bg-red-400/5"
                        : "border-slate-800 bg-slate-950/60"
                    }`}
                  >
                    {renderAiReply(aiReply)}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
