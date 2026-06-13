import type { EmailRecognitionQueueItem } from "./api-client";

type EmailRecognitionPanelProps = {
  items: EmailRecognitionQueueItem[];
  onSync: () => void;
  syncing: boolean;
};

const recognitionLabel: Record<EmailRecognitionQueueItem["recognitionType"], string> = {
  BOOKING_REPLY: "订舱回复",
  EXCEPTION: "异常",
  FOLLOW_UP_REPLY: "催单回复",
  SO_RECEIVED: "SO 回传",
  SUPPLEMENT_CONFIRMED: "补料确认",
  UNKNOWN: "未知",
};

const recognitionClassName: Record<EmailRecognitionQueueItem["recognitionType"], string> = {
  BOOKING_REPLY: "border-slate-200 bg-slate-50 text-slate-700",
  EXCEPTION: "border-red-200 bg-red-50 text-red-700",
  FOLLOW_UP_REPLY: "border-amber-200 bg-amber-50 text-amber-700",
  SO_RECEIVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  SUPPLEMENT_CONFIRMED: "border-cyan-200 bg-cyan-50 text-cyan-700",
  UNKNOWN: "border-slate-200 bg-white text-slate-600",
};

export function EmailRecognitionPanel({ items, onSync, syncing }: EmailRecognitionPanelProps) {
  const exceptionCount = items.filter((item) => item.recognitionType === "EXCEPTION").length;

  return (
    <section className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/30">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-950">邮件识别队列</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            IMAP 邮件同步后先进入待确认队列；本阶段不会自动写回 Shipment。
          </p>
        </div>
        <button
          type="button"
          onClick={onSync}
          disabled={syncing}
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          {syncing ? "同步中..." : "同步邮箱"}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-slate-500">待确认</p>
          <p className="mt-1 text-lg font-semibold text-slate-950">{items.length}</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-red-700">异常</p>
          <p className="mt-1 text-lg font-semibold text-red-950">{exceptionCount}</p>
        </div>
        <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2">
          <p className="text-cyan-700">已匹配</p>
          <p className="mt-1 text-lg font-semibold text-cyan-950">
            {items.filter((item) => item.matchedShipmentId).length}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">
            当前没有待确认邮件。点击同步邮箱拉取最新回信。
          </div>
        ) : (
          items.slice(0, 4).map((item) => (
            <article key={item.id} className="rounded-lg border border-slate-200 px-3 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[11px] ${recognitionClassName[item.recognitionType]}`}>
                  {recognitionLabel[item.recognitionType]}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500">
                  置信度 {Math.round(item.confidence * 100)}%
                </span>
              </div>
              <p className="mt-2 break-words text-sm font-medium text-slate-950">{item.subject}</p>
              <p className="mt-1 text-xs text-slate-500">{item.from}</p>
              <p className="mt-2 text-xs leading-5 text-slate-600">{item.summary}</p>
              {item.riskFlags.length > 0 ? (
                <p className="mt-2 text-xs leading-5 text-red-600">{item.riskFlags.join(" / ")}</p>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
