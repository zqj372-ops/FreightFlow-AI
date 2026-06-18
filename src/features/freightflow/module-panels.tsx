import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Mail,
  PenLine,
  RefreshCw,
  ScanSearch,
  Send,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import type { ReactNode } from "react";

import type { ShipmentRecord } from "@/lib/mock-data";

import type { EmailRecognitionQueueItem } from "./api-client";
import { BookingPlanPanel } from "./booking-plan-panel";
import type { BookingPlanRecord } from "./booking-plan-rules";
import { EmailRecognitionPanel } from "./email-recognition-panel";
import type { DetailActionLabel } from "./page-helpers";

type ModulePanelProps = {
  activeNav: string;
  bookingDraftGenerating: boolean;
  bookingPlans: BookingPlanRecord[];
  emailRecognitions: EmailRecognitionQueueItem[];
  emailSyncing: boolean;
  onDownloadSupplementTemplate: (shipment: ShipmentRecord) => void;
  onGenerateBookingDrafts: () => void;
  onOpenBookingPlanWorkflow: () => void;
  onOpenSettings: (tab?: "email" | "openclaw") => void;
  onOpenStatusEditor: (shipmentId: string) => void;
  onReviewEmailRecognition: (id: string, action: "confirm" | "ignore" | "mark_exception") => void;
  onRunAction: (action: DetailActionLabel) => void;
  onRunEmailSync: () => void;
  onToggleBookingPlan: (shipmentId: string) => void;
  onUploadSoAttachment: (file: File) => void;
  reviewingEmailRecognitionId: string | null;
  selectedBookingPlanIds: Set<string>;
  selectedShipment: ShipmentRecord;
  shipments: ShipmentRecord[];
  soAttachmentUploading: boolean;
};

type StatItem = {
  label: string;
  tone: "amber" | "cyan" | "emerald" | "red" | "slate";
  value: string | number;
};

function cx(...classes: Array<false | null | string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function statTone(tone: StatItem["tone"]) {
  if (tone === "red") return "border-red-200 bg-red-50 text-red-950";
  if (tone === "amber") return "border-amber-200 bg-amber-50 text-amber-950";
  if (tone === "emerald") return "border-emerald-200 bg-emerald-50 text-emerald-950";
  if (tone === "cyan") return "border-cyan-200 bg-cyan-50 text-cyan-950";
  return "border-slate-200 bg-white text-slate-950";
}

function progressClass(value: string) {
  if (value.includes("异常") || value.includes("待识别") || value.includes("未发送")) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (value.includes("待") || value.includes("处理中") || value.includes("草稿") || value.includes("跟进")) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (value.includes("已发送") || value.includes("已识别") || value.includes("已确认") || value.includes("已完成")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function PanelShell({
  children,
  icon: Icon,
  kicker,
  title,
}: {
  children: ReactNode;
  icon: typeof ScanSearch;
  kicker: string;
  title: string;
}) {
  return (
    <section className="mt-3 grid min-h-0 flex-1 grid-cols-1 gap-3">
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/30">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-700">{kicker}</p>
              <h2 className="mt-1 break-words text-lg font-semibold text-slate-950">{title}</h2>
            </div>
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}

function StatStrip({ items }: { items: StatItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className={cx("rounded-lg border px-4 py-3", statTone(item.tone))}>
          <p className="text-xs opacity-75">{item.label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function ShipmentModuleRow({
  actionLabel,
  children,
  onAction,
  onOpen,
  shipment,
}: {
  actionLabel?: string;
  children?: React.ReactNode;
  onAction?: () => void;
  onOpen: () => void;
  shipment: ShipmentRecord;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white px-3.5 py-3 shadow-sm shadow-slate-200/20">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="break-words text-sm font-semibold text-slate-950">{shipment.batchNo}</p>
            <span className={cx("rounded-full border px-2 py-0.5 text-[11px] font-medium", progressClass(shipment.status))}>
              {shipment.status}
            </span>
          </div>
          <p className="mt-1 break-words text-xs leading-5 text-slate-500">
            {shipment.originPort} → {shipment.destinationPort} · {shipment.carrier} · {shipment.containerType}
          </p>
          <p className="mt-1 break-words text-xs leading-5 text-slate-600">{shipment.nextAction}</p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {actionLabel && onAction ? (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-3 text-sm font-medium text-white transition hover:bg-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/70"
            >
              <Send className="h-4 w-4" />
              {actionLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
          >
            <PenLine className="h-4 w-4" />
            明细
          </button>
        </div>
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </article>
  );
}

function EmptyModuleState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
      {label}
    </div>
  );
}

function SoRecognitionCenter({
  emailRecognitions,
  emailSyncing,
  onOpenStatusEditor,
  onReviewEmailRecognition,
  onRunAction,
  onRunEmailSync,
  onUploadSoAttachment,
  reviewingEmailRecognitionId,
  selectedShipment,
  shipments,
  soAttachmentUploading,
}: Pick<
  ModulePanelProps,
  | "emailRecognitions"
  | "emailSyncing"
  | "onOpenStatusEditor"
  | "onReviewEmailRecognition"
  | "onRunAction"
  | "onRunEmailSync"
  | "onUploadSoAttachment"
  | "reviewingEmailRecognitionId"
  | "selectedShipment"
  | "shipments"
  | "soAttachmentUploading"
>) {
  const pendingSoShipments = shipments.filter((shipment) => shipment.soStatus === "待识别");
  const soRecognitions = emailRecognitions.filter((item) =>
    ["SO_RECEIVED", "BOOKING_REPLY", "EXCEPTION"].includes(item.recognitionType),
  );

  return (
    <PanelShell icon={ScanSearch} kicker="SO recognition" title="SO 识别中心">
      <StatStrip
        items={[
          { label: "待识别 SO", tone: "amber", value: pendingSoShipments.length },
          { label: "已识别 SO", tone: "emerald", value: shipments.filter((shipment) => shipment.soStatus === "已识别").length },
          { label: "待确认邮件", tone: "cyan", value: soRecognitions.length },
          { label: "当前柜", tone: "slate", value: selectedShipment.soStatus },
        ]}
      />

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(380px,460px)]">
        <section className="space-y-2">
          <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-cyan-950">上传 SO / 放舱附件</p>
                <p className="mt-1 text-xs leading-5 text-cyan-800">
                  当前柜 {selectedShipment.batchNo} · 支持图片 OCR、文本解析和文件存储
                </p>
              </div>
              <label className={cx(
                "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-cyan-600 px-3.5 text-sm font-medium text-white transition hover:bg-cyan-700 focus-within:outline-none focus-within:ring-2 focus-within:ring-cyan-500/70",
                soAttachmentUploading && "pointer-events-none opacity-60",
              )}>
                <UploadCloud className="h-4 w-4" />
                {soAttachmentUploading ? "上传识别中" : "上传 OCR"}
                <input
                  className="sr-only"
                  type="file"
                  accept="image/*,.txt,.csv,.pdf,.doc,.docx,.xls,.xlsx"
                  disabled={soAttachmentUploading}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = "";
                    if (file) onUploadSoAttachment(file);
                  }}
                />
              </label>
            </div>
          </div>

          {pendingSoShipments.length === 0 ? (
            <EmptyModuleState label="当前没有待识别 SO。" />
          ) : (
            pendingSoShipments.map((shipment) => (
              <ShipmentModuleRow
                key={shipment.id}
                actionLabel={shipment.id === selectedShipment.id ? "标记识别" : undefined}
                onAction={shipment.id === selectedShipment.id ? () => onRunAction("SO 识别") : undefined}
                onOpen={() => onOpenStatusEditor(shipment.id)}
                shipment={shipment}
              >
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <span className="rounded-lg bg-slate-50 px-3 py-2">SO {shipment.soNo || "-"}</span>
                  <span className="rounded-lg bg-slate-50 px-3 py-2">柜号 {shipment.containerNo || "-"}</span>
                  <span className="rounded-lg bg-slate-50 px-3 py-2">截单 {shipment.cutoffTime}</span>
                  <span className={cx("rounded-lg border px-3 py-2", progressClass(shipment.soStatus))}>{shipment.soStatus}</span>
                </div>
              </ShipmentModuleRow>
            ))
          )}
        </section>

        <EmailRecognitionPanel
          items={soRecognitions}
          onReview={onReviewEmailRecognition}
          onSync={onRunEmailSync}
          reviewingId={reviewingEmailRecognitionId}
          syncing={emailSyncing}
        />
      </div>
    </PanelShell>
  );
}

function SupplementCenter({
  onDownloadSupplementTemplate,
  onOpenStatusEditor,
  onRunAction,
  selectedShipment,
  shipments,
}: Pick<
  ModulePanelProps,
  "onDownloadSupplementTemplate" | "onOpenStatusEditor" | "onRunAction" | "selectedShipment" | "shipments"
>) {
  const activeSupplements = shipments.filter((shipment) => shipment.documentStatus !== "已确认");

  return (
    <PanelShell icon={FileSpreadsheet} kicker="supplement documents" title="补料中心">
      <StatStrip
        items={[
          { label: "待生成", tone: "amber", value: shipments.filter((shipment) => shipment.documentStatus === "待生成").length },
          { label: "处理中", tone: "cyan", value: shipments.filter((shipment) => shipment.documentStatus === "处理中").length },
          { label: "已发送", tone: "emerald", value: shipments.filter((shipment) => shipment.documentStatus === "已发送").length },
          { label: "已确认", tone: "slate", value: shipments.filter((shipment) => shipment.documentStatus === "已确认").length },
        ]}
      />

      <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-cyan-950">{selectedShipment.batchNo}</p>
            <p className="mt-1 text-xs leading-5 text-cyan-800">
              {selectedShipment.documentStatus} · {selectedShipment.containerNo} · 截补料 {selectedShipment.hoursToCutoff}h
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRunAction("补料文件")}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-3.5 text-sm font-medium text-white transition hover:bg-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/70"
          >
            <FileSpreadsheet className="h-4 w-4" />
            生成当前补料
          </button>
        </div>
      </div>

      <section className="space-y-2">
        {activeSupplements.length === 0 ? (
          <EmptyModuleState label="当前没有待处理补料。" />
        ) : (
          activeSupplements.map((shipment) => (
            <ShipmentModuleRow
              key={shipment.id}
              actionLabel="下载补料"
              onAction={() => onDownloadSupplementTemplate(shipment)}
              onOpen={() => onOpenStatusEditor(shipment.id)}
              shipment={shipment}
            >
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <span className={cx("rounded-lg border px-3 py-2", progressClass(shipment.documentStatus))}>
                  {shipment.documentStatus}
                </span>
                <span className="rounded-lg bg-slate-50 px-3 py-2">件数 {shipment.packages || "-"}</span>
                <span className="rounded-lg bg-slate-50 px-3 py-2">毛重 {shipment.grossWeight || "-"}</span>
                <span className="rounded-lg bg-slate-50 px-3 py-2">体积 {shipment.cbm || "-"}</span>
              </div>
            </ShipmentModuleRow>
          ))
        )}
      </section>
    </PanelShell>
  );
}

function DeclarationCenter({
  onOpenStatusEditor,
  onRunAction,
  selectedShipment,
  shipments,
}: Pick<ModulePanelProps, "onOpenStatusEditor" | "onRunAction" | "selectedShipment" | "shipments">) {
  const pendingCount = shipments.filter((shipment) =>
    Object.values(shipment.documentProgress).some((value) => value !== "已发送"),
  ).length;

  return (
    <PanelShell icon={ShieldCheck} kicker="customs filing" title="AMS/ACI/ISF">
      <StatStrip
        items={[
          { label: "未闭环柜", tone: "amber", value: pendingCount },
          { label: "AMS 已发送", tone: "emerald", value: shipments.filter((shipment) => shipment.documentProgress.ams === "已发送").length },
          { label: "ACI 已发送", tone: "cyan", value: shipments.filter((shipment) => shipment.documentProgress.aci === "已发送").length },
          { label: "ISF 已发送", tone: "slate", value: shipments.filter((shipment) => shipment.documentProgress.isf === "已发送").length },
        ]}
      />

      <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-cyan-950">{selectedShipment.batchNo}</p>
            <p className="mt-1 text-xs leading-5 text-cyan-800">
              AMS {selectedShipment.documentProgress.ams} / ACI {selectedShipment.documentProgress.aci} / ISF {selectedShipment.documentProgress.isf}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRunAction("AMS/ACI/ISF")}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-3.5 text-sm font-medium text-white transition hover:bg-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/70"
          >
            <ShieldCheck className="h-4 w-4" />
            推进当前申报
          </button>
        </div>
      </div>

      <section className="space-y-2">
        {shipments.map((shipment) => (
          <ShipmentModuleRow key={shipment.id} onOpen={() => onOpenStatusEditor(shipment.id)} shipment={shipment}>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {(["ams", "aci", "isf"] as const).map((key) => (
                <span key={key} className={cx("rounded-lg border px-3 py-2 uppercase", progressClass(shipment.documentProgress[key]))}>
                  {key} {shipment.documentProgress[key]}
                </span>
              ))}
            </div>
          </ShipmentModuleRow>
        ))}
      </section>
    </PanelShell>
  );
}

function MailCenter({
  bookingDraftGenerating,
  bookingPlans,
  emailRecognitions,
  emailSyncing,
  onGenerateBookingDrafts,
  onOpenBookingPlanWorkflow,
  onOpenSettings,
  onReviewEmailRecognition,
  onRunEmailSync,
  onToggleBookingPlan,
  reviewingEmailRecognitionId,
  selectedBookingPlanIds,
  shipments,
}: Pick<
  ModulePanelProps,
  | "bookingDraftGenerating"
  | "bookingPlans"
  | "emailRecognitions"
  | "emailSyncing"
  | "onGenerateBookingDrafts"
  | "onOpenBookingPlanWorkflow"
  | "onOpenSettings"
  | "onReviewEmailRecognition"
  | "onRunEmailSync"
  | "onToggleBookingPlan"
  | "reviewingEmailRecognitionId"
  | "selectedBookingPlanIds"
  | "shipments"
>) {
  return (
    <PanelShell icon={Mail} kicker="mail operations" title="邮件中心">
      <StatStrip
        items={[
          { label: "待发计划", tone: "amber", value: bookingPlans.length },
          { label: "草稿待确认", tone: "cyan", value: bookingPlans.filter((plan) => plan.planStatus === "draft_ready").length },
          { label: "邮件待复核", tone: "slate", value: emailRecognitions.length },
          { label: "已发柜", tone: "emerald", value: shipments.filter((shipment) => shipment.mailStatus === "已发送").length },
        ]}
      />

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="space-y-3">
          <BookingPlanPanel
            generating={bookingDraftGenerating}
            onGenerateDrafts={onGenerateBookingDrafts}
            onTogglePlan={onToggleBookingPlan}
            plans={bookingPlans}
            selectedIds={selectedBookingPlanIds}
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <button
              type="button"
              onClick={onOpenBookingPlanWorkflow}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3.5 text-sm font-medium text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/70"
            >
              <Send className="h-4 w-4" />
              单票订舱
            </button>
            <button
              type="button"
              onClick={() => onOpenSettings("email")}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
            >
              <RefreshCw className="h-4 w-4" />
              邮箱设置
            </button>
          </div>
        </div>

        <EmailRecognitionPanel
          items={emailRecognitions}
          onReview={onReviewEmailRecognition}
          onSync={onRunEmailSync}
          reviewingId={reviewingEmailRecognitionId}
          syncing={emailSyncing}
        />
      </div>
    </PanelShell>
  );
}

function ExceptionCenter({
  onOpenStatusEditor,
  onRunAction,
  selectedShipment,
  shipments,
}: Pick<ModulePanelProps, "onOpenStatusEditor" | "onRunAction" | "selectedShipment" | "shipments">) {
  const exceptionShipments = shipments.filter((shipment) => shipment.exceptions.length > 0 || shipment.hoursToCutoff <= 6);
  const warningShipments = shipments.filter(
    (shipment) => shipment.exceptions.length === 0 && shipment.hoursToCutoff > 6 && shipment.hoursToCutoff <= 24,
  );

  return (
    <PanelShell icon={AlertTriangle} kicker="exception desk" title="异常中心">
      <StatStrip
        items={[
          { label: "红色异常", tone: "red", value: exceptionShipments.length },
          { label: "黄色预警", tone: "amber", value: warningShipments.length },
          { label: "当前柜跟进", tone: "cyan", value: selectedShipment.followUpCount },
          { label: "正常推进", tone: "emerald", value: shipments.length - exceptionShipments.length - warningShipments.length },
        ]}
      />

      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-red-950">{selectedShipment.batchNo}</p>
            <p className="mt-1 text-xs leading-5 text-red-800">
              {selectedShipment.exceptions.join(" / ") || selectedShipment.nextAction}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRunAction("异常标记")}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-red-600 px-3.5 text-sm font-medium text-white transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/70"
          >
            <AlertTriangle className="h-4 w-4" />
            切换当前异常
          </button>
        </div>
      </div>

      <section className="space-y-2">
        {[...exceptionShipments, ...warningShipments].length === 0 ? (
          <EmptyModuleState label="当前没有异常或黄色预警。" />
        ) : (
          [...exceptionShipments, ...warningShipments].map((shipment) => (
            <ShipmentModuleRow key={shipment.id} onOpen={() => onOpenStatusEditor(shipment.id)} shipment={shipment}>
              <div className="flex flex-wrap gap-2 text-xs">
                {(shipment.exceptions.length > 0 ? shipment.exceptions : shipment.reminderFlags).map((item) => (
                  <span key={item} className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-red-700">
                    {item}
                  </span>
                ))}
                <span className={cx("rounded-full border px-2.5 py-1", shipment.hoursToCutoff <= 6 ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700")}>
                  截补料 {shipment.hoursToCutoff}h
                </span>
              </div>
            </ShipmentModuleRow>
          ))
        )}
      </section>
    </PanelShell>
  );
}

export function FreightflowModulePanel(props: ModulePanelProps) {
  if (props.activeNav === "SO识别中心") {
    return <SoRecognitionCenter {...props} />;
  }

  if (props.activeNav === "补料中心") {
    return <SupplementCenter {...props} />;
  }

  if (props.activeNav === "AMS/ACI/ISF") {
    return <DeclarationCenter {...props} />;
  }

  if (props.activeNav === "邮件中心") {
    return <MailCenter {...props} />;
  }

  if (props.activeNav === "异常中心") {
    return <ExceptionCenter {...props} />;
  }

  return (
    <PanelShell icon={CheckCircle2} kicker="module" title={props.activeNav}>
      <EmptyModuleState label="请选择左侧模块。" />
    </PanelShell>
  );
}
