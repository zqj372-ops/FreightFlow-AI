import {
  CircleAlert,
  CircleX,
  Clock3,
  FileSearch,
  FileText,
  LayoutDashboard,
  Mail,
  RefreshCw,
  ScanSearch,
  Search,
  Settings2,
  ShieldCheck,
  ShipWheel,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import {
  getAlertLevel,
  mainNav,
  statusColumns,
  type AlertLevel,
  type ShipmentRecord,
} from "@/lib/mock-data";

type Tone = "cyan" | "emerald" | "amber" | "red" | "slate";

type SummaryData = {
  greenNormal: number;
  pendingDocs: number;
  redAlerts: number;
  total: number;
  waitingRelease: number;
  yellowAlerts: number;
};

type SidebarNavProps = {
  activeNav: string;
  onOpenSettings?: () => void;
  onSelect: (item: string) => void;
  summary: SummaryData;
};

type HeaderProps = {
  activeNav: string;
  onPrimaryAction: () => void;
  onRefresh: () => void;
  onSecondaryAction: (action: "订舱邮件" | "SO 识别") => void;
  primaryActionLabel?: string;
  selectedShipment: ShipmentRecord;
};

type MetricStripProps = {
  activeColumn: string;
  onSelectColumn: (columnKey: string) => void;
  summary: SummaryData;
};

type QueuePanelProps = {
  activeColumn: string;
  onClearFilters: () => void;
  onColumnChange: (columnKey: string) => void;
  onSearchChange: (value: string) => void;
  onSelectShipment: (shipmentId: string) => void;
  recordsForColumn: Map<string, ShipmentRecord[]>;
  searchTerm: string;
  selectedShipmentId: string;
  visibleShipments: ShipmentRecord[];
};

function cx(...classes: Array<false | null | string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function toneClasses(tone: Tone, active = false) {
  if (tone === "red") {
    return active
      ? "border-red-300 bg-red-50 text-red-900 shadow-sm shadow-red-100"
      : "border-red-200/80 bg-white text-red-900";
  }

  if (tone === "amber") {
    return active
      ? "border-amber-300 bg-amber-50 text-amber-950 shadow-sm shadow-amber-100"
      : "border-amber-200/80 bg-white text-amber-950";
  }

  if (tone === "emerald") {
    return active
      ? "border-emerald-300 bg-emerald-50 text-emerald-950 shadow-sm shadow-emerald-100"
      : "border-emerald-200/80 bg-white text-emerald-950";
  }

  if (tone === "cyan") {
    return active
      ? "border-cyan-300 bg-cyan-50 text-cyan-950 shadow-sm shadow-cyan-100"
      : "border-cyan-200/80 bg-white text-cyan-950";
  }

  return active
    ? "border-slate-300 bg-slate-100 text-slate-950 shadow-sm shadow-slate-200/70"
    : "border-slate-200 bg-white text-slate-900";
}

function levelBadge(level: AlertLevel) {
  if (level === "red") return "border-red-200 bg-red-50 text-red-700";
  if (level === "yellow") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function levelDot(level: AlertLevel) {
  if (level === "red") return "bg-red-500";
  if (level === "yellow") return "bg-amber-500";
  return "bg-emerald-500";
}

function describeWaitWindow(shipment: ShipmentRecord) {
  if (shipment.hoursToCutoff <= 6) return `截补料剩余 ${shipment.hoursToCutoff}h`;
  if (shipment.hoursWaitingRelease >= 4) return `已等待放舱 ${shipment.hoursWaitingRelease}h`;
  if (shipment.followUpCount > 0) return `已跟进 ${shipment.followUpCount} 次`;
  return `ETD ${shipment.etd}`;
}

const navMeta: Record<
  string,
  {
    description: string;
    icon: typeof LayoutDashboard;
  }
> = {
  "SO识别中心": {
    description: "接收回邮或上传 SO 后，识别放舱字段并回写 Shipment。",
    icon: ScanSearch,
  },
  "AI订舱工作台": {
    description: "生成订舱邮件、确认发送、等待 SO 回邮并推进 Shipment。",
    icon: LayoutDashboard,
  },
  "设置": {
    description: "配置 AI 大模型与 IMAP/SMTP 邮箱服务。",
    icon: Settings2,
  },
};

const navSecondaryBadges: Partial<Record<string, string>> = {
  "AI订舱工作台": "Booking",
  "SO识别中心": "SO",
};

const metricCards = [
  {
    columnKey: "waiting-release",
    detail: "需继续盯放舱与催单",
    icon: Clock3,
    label: "等待放舱",
    tone: "amber" as const,
    valueKey: "waitingRelease" as const,
  },
  {
    columnKey: "pending-docs",
    detail: "补料与申报仍未闭环",
    icon: FileSearch,
    label: "待补料",
    tone: "cyan" as const,
    valueKey: "pendingDocs" as const,
  },
  {
    columnKey: "exception",
    detail: "需要优先切入处理",
    icon: TriangleAlert,
    label: "红色异常",
    tone: "red" as const,
    valueKey: "redAlerts" as const,
  },
  {
    columnKey: "released",
    detail: "正常推进中的柜子",
    icon: ShieldCheck,
    label: "正常推进",
    tone: "emerald" as const,
    valueKey: "greenNormal" as const,
  },
] as const;

export function SidebarNav({ activeNav, onOpenSettings, onSelect, summary }: SidebarNavProps) {
  return (
    <aside className="border-b border-slate-200 bg-slate-950 text-slate-100 xl:min-h-dvh xl:border-b-0 xl:border-r">
      <div className="flex items-center justify-between gap-3 px-4 py-4 xl:flex-col xl:items-stretch xl:px-4 xl:py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300">
            <ShipWheel className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">FreightFlow-AI</p>
            <p className="text-xs text-slate-400">Booking + SO OCR</p>
          </div>
        </div>

        <div className="hidden items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-[11px] text-slate-300 xl:flex">
          <CircleAlert className="h-3.5 w-3.5 text-red-300" />
          <span className="tabular-nums">{summary.redAlerts}</span>
          <span className="text-slate-500">待人工确认</span>
        </div>
      </div>

      <div className="px-4 pb-4 xl:pb-5">
        <div className="mb-3 grid grid-cols-3 gap-2 xl:grid-cols-1">
          {[
            ["活跃", `${summary.total}`],
            ["放舱", `${summary.waitingRelease}`],
            ["SO待审", `${summary.redAlerts}`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
              <p className="text-[11px] text-slate-500">{label}</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-white">{value}</p>
            </div>
          ))}
        </div>

        <nav className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-1 xl:gap-1.5">
          {mainNav.map((item) => {
            const meta = navMeta[item] ?? navMeta["AI订舱工作台"];
            const Icon = meta.icon;
            const isActive = activeNav === item;
            const badge = item === "异常中心" ? `${summary.redAlerts}` : navSecondaryBadges[item];

            return (
              <button
                key={item}
                type="button"
                onClick={() => (item === "设置" ? onOpenSettings?.() ?? onSelect(item) : onSelect(item))}
                className={cx(
                  "flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 xl:min-h-10 xl:justify-between xl:gap-2 xl:border-transparent",
                  isActive
                    ? "border-cyan-400/30 bg-cyan-500/15 text-white"
                    : "border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700 hover:bg-slate-900 hover:text-white",
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Icon className={cx("h-4 w-4 shrink-0", isActive ? "text-cyan-300" : "text-slate-500")} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item}</p>
                    <p className="mt-0.5 hidden truncate text-[11px] text-slate-500 xl:block">{meta.description}</p>
                  </div>
                </div>

                {badge ? (
                  <span
                    className={cx(
                      "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                      item === "异常中心"
                        ? isActive
                          ? "bg-red-500/20 text-red-200"
                          : "bg-red-500/15 text-red-300"
                        : "bg-slate-800 text-slate-300",
                    )}
                  >
                    {badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

export function WorkbenchHeader({
  activeNav,
  onPrimaryAction,
  onRefresh,
  onSecondaryAction,
  primaryActionLabel = "AI 总结",
  selectedShipment,
}: HeaderProps) {
  const navInfo = navMeta[activeNav] ?? navMeta["AI订舱工作台"];
  const title = activeNav === "AI订舱工作台" ? "AI 订舱与 SO 识别工作台" : activeNav;

  return (
    <section className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/30">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-100 bg-cyan-50 px-2.5 py-1 text-[11px] font-medium text-cyan-700">
              <LayoutDashboard className="h-3.5 w-3.5" />
              AI 订舱邮件
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">
              <UserRound className="h-3.5 w-3.5" />
              {selectedShipment.operator}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">
              <Clock3 className="h-3.5 w-3.5" />
              SO OCR 回写
            </span>
          </div>

          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-slate-950">{title}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{navInfo.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
                onClick={onRefresh}
              >
                <RefreshCw className="h-4 w-4" />
                刷新
              </button>
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
                onClick={() => onSecondaryAction("订舱邮件")}
              >
                <Mail className="h-4 w-4" />
                订舱邮件
              </button>
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
                onClick={() => onSecondaryAction("SO 识别")}
              >
                <FileText className="h-4 w-4" />
                SO 识别
              </button>
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-3.5 text-sm font-medium text-white transition hover:bg-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/70"
                onClick={onPrimaryAction}
              >
                <Mail className="h-4 w-4" />
                {primaryActionLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function MetricStrip({ activeColumn, onSelectColumn, summary }: MetricStripProps) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {metricCards.map((card) => {
        const Icon = card.icon;
        const active = activeColumn === card.columnKey;

        return (
          <button
            key={card.label}
            type="button"
            onClick={() => onSelectColumn(card.columnKey)}
            className={cx(
              "rounded-lg border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60",
              toneClasses(card.tone, active),
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-500">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">{summary[card.valueKey]}</p>
              </div>
              <div className="rounded-lg bg-white/80 p-2 text-slate-600 shadow-sm shadow-slate-200/60">
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-600">{card.detail}</p>
          </button>
        );
      })}
    </div>
  );
}

export function QueuePanel({
  activeColumn,
  onClearFilters,
  onColumnChange,
  onSearchChange,
  onSelectShipment,
  recordsForColumn,
  searchTerm,
  selectedShipmentId,
  visibleShipments,
}: QueuePanelProps) {
  const hasSearch = searchTerm.trim().length > 0;

  return (
    <section className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/30">
      <div className="border-b border-slate-200 px-3 py-3 sm:px-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-slate-900">
            <p className="text-sm font-semibold">订舱任务</p>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                {visibleShipments.length} 柜
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">按订舱状态切换任务，优先处理邮件草稿、SO 回写和待补料节点。</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
              <Mail className="h-3.5 w-3.5" />
              订舱邮件优先
            </span>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 xl:flex-row xl:items-center">
          <label className="flex min-h-11 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 focus-within:border-cyan-500 focus-within:bg-white">
            <Search className="h-4 w-4" />
            <input
              value={searchTerm}
              onChange={(event) => onSearchChange(event.target.value)}
              className="w-full bg-transparent outline-none placeholder:text-slate-400"
              placeholder="搜索批次号 / SO / 柜号 / 目的港"
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
                aria-label="清空搜索"
              >
                <CircleX className="h-4 w-4" />
              </button>
            ) : null}
          </label>

          <div className="xl:w-[120px]">
            <button
              type="button"
              onClick={onClearFilters}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
            >
              <RefreshCw className="h-4 w-4" />
              重置
            </button>
          </div>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {statusColumns.map((column) => {
            const records = recordsForColumn.get(column.key) ?? [];
            const active = activeColumn === column.key;

            return (
              <button
                key={column.key}
                type="button"
                onClick={() => onColumnChange(column.key)}
                className={cx(
                  "min-w-[136px] rounded-lg border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60",
                  active
                    ? "border-cyan-600 bg-cyan-50 shadow-sm shadow-cyan-100"
                    : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-900">{column.title}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-600">
                    {records.length}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">{column.statuses.length} 个子状态</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2.5 sm:p-3">
        {visibleShipments.length === 0 ? (
          <div className="flex h-full min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm shadow-slate-200/70">
              <Search className="h-5 w-5" />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-900">当前队列没有匹配记录</p>
            <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
              {hasSearch ? "试试放宽搜索词。" : "当前状态列下暂无柜子，可切换到其他状态列继续处理。"}
            </p>
            <button
              type="button"
              onClick={onClearFilters}
              className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
            >
              <RefreshCw className="h-4 w-4" />
              清空筛选
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleShipments.map((shipment) => {
              const level = getAlertLevel(shipment);
              const selected = selectedShipmentId === shipment.id;

              return (
                <button
                  key={shipment.id}
                  type="button"
                  onClick={() => onSelectShipment(shipment.id)}
                  className={cx(
                    "relative w-full rounded-lg border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 sm:px-3.5",
                    selected
                      ? "border-cyan-600 bg-cyan-50/80 shadow-sm shadow-cyan-100"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                  )}
                >
                  {selected ? <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-cyan-600" /> : null}

                  <div className="flex items-start justify-between gap-3 pl-1">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                          {shipment.batchNo}
                        </p>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                          {describeWaitWindow(shipment)}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm font-semibold text-slate-950">{shipment.containerNo}</p>
                      <p className="mt-1 truncate text-xs text-slate-600">
                        SO {shipment.soNo} · {shipment.carrier} · {shipment.destinationPort}
                      </p>
                    </div>

                    <span
                      className={cx(
                        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium",
                        levelBadge(level),
                      )}
                    >
                      <span className={cx("h-1.5 w-1.5 rounded-full", levelDot(level))} />
                      {shipment.status}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-600 lg:grid-cols-4">
                    <div className="rounded-md bg-slate-50 px-2.5 py-2">
                      <p className="text-slate-400">ETD</p>
                      <p className="mt-1 truncate font-medium tabular-nums text-slate-700">{shipment.etd}</p>
                    </div>
                    <div className="rounded-md bg-slate-50 px-2.5 py-2">
                      <p className="text-slate-400">截补料</p>
                      <p className="mt-1 truncate font-medium tabular-nums text-slate-700">{shipment.cutoffTime}</p>
                    </div>
                    <div className="rounded-md bg-slate-50 px-2.5 py-2">
                      <p className="text-slate-400">负责人</p>
                      <p className="mt-1 truncate font-medium text-slate-700">{shipment.operator}</p>
                    </div>
                    <div className="rounded-md bg-slate-50 px-2.5 py-2">
                      <p className="text-slate-400">跟进</p>
                      <p className="mt-1 font-medium tabular-nums text-slate-700">{shipment.followUpCount} 次</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
