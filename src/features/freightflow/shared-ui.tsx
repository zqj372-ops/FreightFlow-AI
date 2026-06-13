import type { ComponentType, ReactNode } from "react";

import type { AlertLevel } from "@/lib/mock-data";

import { levelBadge, levelDot, metricTone, progressTone, toneBadgeClass } from "./page-helpers";

export type DetailItem = {
  label: string;
  value: string;
};

type SectionCardProps = {
  children: ReactNode;
  kicker?: string;
  title: string;
};

type DetailKeyValueProps = DetailItem & {
  stacked?: boolean;
};

type StatusBadgeProps = {
  label: string;
  level: AlertLevel;
  size?: "md" | "sm";
};

type MetricCardProps = {
  detail: string;
  label: string;
  value: string;
};

type InfoTileProps = DetailItem & {
  valueClassName?: string;
};

type ActionTileProps = {
  detail: string;
  highlight?: boolean;
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  status?: string;
  statusClassName?: string;
};

export function DetailKeyValue({ label, stacked = false, value }: DetailKeyValueProps) {
  return (
    <div
      className={
        stacked
          ? "flex flex-col gap-1 rounded-lg bg-slate-50 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
          : "flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5"
      }
    >
      <span className="text-slate-500">{label}</span>
      <span className={stacked ? "font-medium text-slate-900 sm:text-right" : "text-right font-medium text-slate-900"}>
        {value}
      </span>
    </div>
  );
}

export function SectionCard({ children, kicker, title }: SectionCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/30">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          {kicker ? <p className="mt-1 text-[11px] text-slate-500">{kicker}</p> : null}
        </div>
      </div>
      {children}
    </div>
  );
}

export function StatusBadge({ label, level, size = "sm" }: StatusBadgeProps) {
  const dotSize = size === "md" ? "h-2 w-2" : "h-1.5 w-1.5";
  const textSize = size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-1 text-[11px]";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${levelBadge(level)} ${textSize}`}>
      <span className={`rounded-full ${levelDot(level)} ${dotSize}`} />
      {label}
    </span>
  );
}

export function MetricCard({ detail, label, value }: MetricCardProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm shadow-slate-200/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className={`mt-2 text-2xl font-semibold ${metricTone(label)}`}>{value}</p>
        </div>
        <span className="text-[11px] text-slate-400">{detail}</span>
      </div>
    </section>
  );
}

export function InfoTile({ label, value, valueClassName }: InfoTileProps) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2.5">
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className={`mt-1 text-sm font-medium text-slate-800 ${valueClassName ?? ""}`.trim()}>{value}</p>
    </div>
  );
}

export function ActionTile({
  detail,
  highlight = false,
  icon: Icon,
  label,
  onClick,
  status,
  statusClassName,
}: ActionTileProps) {
  return (
    <button
      className={`min-w-0 rounded-xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 ${
        highlight
          ? "border-cyan-300 bg-cyan-50 shadow-sm shadow-cyan-100/70 hover:border-cyan-400 hover:bg-cyan-100/70"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-slate-800">
          <span
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${
              highlight ? "bg-cyan-100 text-cyan-700" : "bg-slate-100 text-slate-600"
            }`}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="break-words text-sm font-medium text-slate-900">{label}</p>
            <p className="mt-1 break-words text-[11px] leading-5 text-slate-500">{detail}</p>
          </div>
        </div>
        {status ? (
          <span
            className={`inline-flex shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium ${
              statusClassName ?? toneBadgeClass(progressTone(status))
            }`}
          >
            {status}
          </span>
        ) : null}
      </div>
    </button>
  );
}
