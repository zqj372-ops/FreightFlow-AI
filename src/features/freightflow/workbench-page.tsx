"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  FileText,
  Mail,
  RefreshCw,
  ShipWheel,
  TriangleAlert,
} from "lucide-react";
import {
  MetricStrip,
  QueuePanel,
  SidebarNav,
  WorkbenchHeader,
} from "@/components/workbench-shell";
import {
  getAlertLevel,
  mainNav,
  shipments,
  statusColumns,
  summarizeShipments,
  type AlertLevel,
  type ShipmentRecord,
} from "@/lib/mock-data";
import {
  buildBookingDraft,
  buildContacts,
  buildShipmentBrief,
  buildShipmentDetailGroups,
  canCreateBookingPlanFromShipment,
  cutoffTone,
  isValidEmail,
  normalizeEmail,
  pickRecommendedAction,
  progressTone,
  quickPrompts,
  toneClass,
  type BookingDraft,
  type ContactDraft,
  type ContactRecord,
  type DetailActionLabel,
  type ToastState,
} from "@/features/freightflow/page-helpers";
import {
  loadContactsFromApi,
  batchGenerateBookingDrafts,
  loadBookingPlansFromApi,
  loadEmailRecognitionsFromApi,
  loadEmailSettings,
  loadOpenClawSettings,
  loadShipmentsFromApi,
  persistContact,
  persistShipmentAction,
  reviewEmailRecognitionFromApi,
  saveEmailSettings,
  saveOpenClawSettings,
  sendBookingEmail,
  runEmailSyncFromApi,
  type EmailRecognitionReviewAction,
  type EmailRecognitionQueueItem,
  type EmailConnectionTest,
  type PublicEmailConfig,
  type OpenClawConnectionTest,
  type PublicOpenClawConfig,
} from "@/features/freightflow/api-client";
import { BookingPlanPanel } from "@/features/freightflow/booking-plan-panel";
import type { BookingPlanRecord } from "@/features/freightflow/booking-plan-rules";
import { EmailRecognitionPanel } from "@/features/freightflow/email-recognition-panel";
import {
  AiCopilotPanel,
  type AiRequestState,
} from "@/features/freightflow/ai-copilot-panel";
import { BookingModal } from "@/features/freightflow/booking-modal";
import {
  OpenClawSettingsModal,
  type EmailSettingsDraft,
  type OpenClawSettingsDraft,
  type SettingsTab,
} from "@/features/freightflow/openclaw-settings-modal";
import { type DetailItem } from "@/features/freightflow/shared-ui";
import {
  ShipmentActionPanel,
  ShipmentDetailPanel,
  ShipmentDetailDrawer,
  ShipmentFieldPanel,
} from "@/features/freightflow/detail-panels";

export function FreightflowWorkbenchPage() {
  const [shipmentState, setShipmentState] = useState<ShipmentRecord[]>(shipments);
  const [activeNav, setActiveNav] = useState(mainNav[0] ?? "订舱工作台");
  const [activeColumn, setActiveColumn] = useState(statusColumns[0]?.key ?? "waiting-release");
  const [alertFilter, setAlertFilter] = useState<AlertLevel | "all">("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [selectedShipmentId, setSelectedShipmentId] = useState(shipments[0]?.id ?? "");
  const [searchTerm, setSearchTerm] = useState("");
  const [aiInput, setAiInput] = useState<string>(quickPrompts[0]);
  const [aiReply, setAiReply] = useState(
    "选中单柜后，AI 会带着当前 Shipment 的状态、提醒和下一步动作一起分析。",
  );
  const [aiRequestState, setAiRequestState] = useState<AiRequestState>("idle");
  const [aiLastPrompt, setAiLastPrompt] = useState<string | null>(null);
  const [aiLastCompletedAt, setAiLastCompletedAt] = useState<string | null>(null);
  const [aiLastReplyLength, setAiLastReplyLength] = useState(0);
  const [toast, setToast] = useState<null | ToastState>(null);
  const [bookingShipmentId, setBookingShipmentId] = useState<string | null>(null);
  const [bookingDraft, setBookingDraft] = useState<BookingDraft>(() => buildBookingDraft(shipments[0]));
  const [recipientInput, setRecipientInput] = useState("");
  const [ccInput, setCcInput] = useState("");
  const [bookingSending, setBookingSending] = useState(false);
  const [contactState, setContactState] = useState<ContactRecord[]>(() => buildContacts(shipments[0]));
  const [bookingPlans, setBookingPlans] = useState<BookingPlanRecord[]>([]);
  const [emailRecognitions, setEmailRecognitions] = useState<EmailRecognitionQueueItem[]>([]);
  const [selectedBookingPlanIds, setSelectedBookingPlanIds] = useState<Set<string>>(() => new Set());
  const [bookingDraftGenerating, setBookingDraftGenerating] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [emailSyncing, setEmailSyncing] = useState(false);
  const [reviewingEmailRecognitionId, setReviewingEmailRecognitionId] = useState<string | null>(null);
  const [contactDraft, setContactDraft] = useState<ContactDraft>({
    email: "",
    label: "",
    role: "booking_agent",
  });
  const [openClawSettingsOpen, setOpenClawSettingsOpen] = useState(false);
  const [openClawConfig, setOpenClawConfig] = useState<PublicOpenClawConfig | null>(null);
  const [openClawDraft, setOpenClawDraft] = useState<OpenClawSettingsDraft>({
    apiKey: "",
    endpoint: "",
    enabled: false,
    model: "",
    timeoutMs: 30000,
  });
  const [openClawSettingsLoading, setOpenClawSettingsLoading] = useState(false);
  const [openClawSettingsError, setOpenClawSettingsError] = useState<string | null>(null);
  const [openClawTestResult, setOpenClawTestResult] = useState<OpenClawConnectionTest | null>(null);
  const [showOpenClawApiKey, setShowOpenClawApiKey] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("openclaw");
  const [emailConfig, setEmailConfig] = useState<PublicEmailConfig | null>(null);
  const [emailDraft, setEmailDraft] = useState<EmailSettingsDraft>({
    enabled: false,
    fromEmail: "",
    fromName: "FreightFlow AI",
    imapHost: "",
    imapPort: 993,
    imapSecure: true,
    password: "",
    replyTo: "",
    smtpHost: "",
    smtpPort: 587,
    smtpSecure: false,
    username: "",
  });
  const [emailSettingsLoading, setEmailSettingsLoading] = useState(false);
  const [emailSettingsError, setEmailSettingsError] = useState<string | null>(null);
  const [emailTestResult, setEmailTestResult] = useState<EmailConnectionTest | null>(null);
  const [showEmailPassword, setShowEmailPassword] = useState(false);

  const summary = useMemo(() => summarizeShipments(shipmentState), [shipmentState]);

  const recordsForColumn = useMemo(() => {
    const mapping = new Map<string, ShipmentRecord[]>();

    statusColumns.forEach((column) => {
      mapping.set(
        column.key,
        shipmentState.filter((shipment) => column.statuses.includes(shipment.status)),
      );
    });

    return mapping;
  }, [shipmentState]);

  const ownerOptions = useMemo(() => {
    const owners = Array.from(new Set(shipmentState.map((shipment) => shipment.operator))).sort((a, b) =>
      a.localeCompare(b),
    );

    return ["all", ...owners];
  }, [shipmentState]);

  const visibleShipments = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const records = recordsForColumn.get(activeColumn) ?? [];

    return records.filter((shipment) => {
      if (ownerFilter !== "all" && shipment.operator !== ownerFilter) {
        return false;
      }

      if (alertFilter !== "all" && getAlertLevel(shipment) !== alertFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        shipment.batchNo,
        shipment.soNo,
        shipment.containerNo,
        shipment.carrier,
        shipment.destinationPort,
        shipment.operator,
        shipment.status,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [activeColumn, alertFilter, ownerFilter, recordsForColumn, searchTerm]);

  const selectedShipment = useMemo(() => {
    return (
      visibleShipments.find((shipment) => shipment.id === selectedShipmentId) ??
      visibleShipments[0] ??
      shipmentState[0]
    );
  }, [selectedShipmentId, shipmentState, visibleShipments]);

  const bookingShipment = useMemo(() => {
    if (!bookingShipmentId) return null;

    return shipmentState.find((shipment) => shipment.id === bookingShipmentId) ?? null;
  }, [bookingShipmentId, shipmentState]);

  const selectedShipmentLevel = getAlertLevel(selectedShipment);
  const shipmentBrief = buildShipmentBrief(selectedShipment);
  const shipmentDetailGroups = buildShipmentDetailGroups(selectedShipment);
  const bookingPlanCreateCheck = canCreateBookingPlanFromShipment(selectedShipment);
  const fieldItems = [
    { label: "订舱代理", value: selectedShipment.bookingAgent },
    { label: "操作员", value: selectedShipment.operator },
    { label: "中转港", value: selectedShipment.transitPort || "直达" },
  ] satisfies ReadonlyArray<DetailItem>;

  const documentProgressItems = [
    { className: toneClass(progressTone(selectedShipment.documentProgress.ams)), label: "AMS", value: selectedShipment.documentProgress.ams },
    { className: toneClass(progressTone(selectedShipment.documentProgress.aci)), label: "ACI", value: selectedShipment.documentProgress.aci },
    { className: toneClass(progressTone(selectedShipment.documentProgress.isf)), label: "ISF", value: selectedShipment.documentProgress.isf },
  ] satisfies ReadonlyArray<{ className: string; label: string; value: string }>;

  const recommendedAction = pickRecommendedAction(selectedShipment);
  const reminderItems = [...selectedShipment.reminderFlags, ...selectedShipment.exceptions];
  const reminderChips = reminderItems.map((item) => ({
    className:
      item.includes("红色") || item.includes("异常") || item.includes("超过")
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-amber-200 bg-amber-50 text-amber-700",
    label: item,
  }));
  const robotHubMetrics = {
    bookingPlans: bookingPlans.length,
    emailRecognitions: emailRecognitions.length,
    exceptionEmails: emailRecognitions.filter((item) => item.recognitionType === "EXCEPTION").length,
  };
  const detailActions = [
    {
      detail: selectedShipment.mailStatus === "未发送" ? "当前还未生成邮件建议" : `最后发送时间 ${selectedShipment.lastEmailTime}`,
      icon: Mail,
      label: "订舱邮件" as const,
      status: selectedShipment.mailStatus,
    },
    {
      detail:
        selectedShipment.followUpCount > 0
          ? `已人工跟进 ${selectedShipment.followUpCount} 次`
          : "当前尚未追加催单记录",
      icon: Bell,
      label: "催单提醒" as const,
      status: `${selectedShipment.followUpCount} 次`,
    },
    {
      detail: `距离截补料 ${selectedShipment.hoursToCutoff} 小时`,
      icon: FileText,
      label: "补料文件" as const,
      status: selectedShipment.documentStatus,
    },
    {
      detail: selectedShipment.soStatus === "待识别" ? "SO 尚未回写到系统" : `SO ${selectedShipment.soNo} 已同步`,
      icon: ShipWheel,
      label: "SO 识别" as const,
      status: selectedShipment.soStatus,
    },
    {
      detail: `AMS ${selectedShipment.documentProgress.ams} / ACI ${selectedShipment.documentProgress.aci} / ISF ${selectedShipment.documentProgress.isf}`,
      icon: RefreshCw,
      label: "AMS/ACI/ISF" as const,
      status: selectedShipment.documentProgress.ams,
    },
    {
      detail:
        selectedShipment.exceptions.length > 0
          ? `已记录 ${selectedShipment.exceptions.length} 条异常或人工标记`
          : "当前无异常记录",
      icon: TriangleAlert,
      label: "异常标记" as const,
      status: selectedShipment.exceptions.length > 0 ? "处理中" : "正常",
    },
  ] satisfies ReadonlyArray<{
    detail: string;
    icon: React.ComponentType<{ className?: string }>;
    label: DetailActionLabel;
    status: string;
  }>;
  const recommendedActionCard = detailActions.find((item) => item.label === recommendedAction) ?? detailActions[0];
  const actionPanelItems = detailActions.map((item) => ({
    ...item,
    highlight: item.label === recommendedAction,
    onClick: () => handleAction(item.label),
    statusClassName: toneClass(progressTone(item.status)),
  }));
  const aiLoading = aiRequestState === "loading";
  const aiCanSend = aiInput.trim().length > 0 && !aiLoading;
  const normalizedRecipientInput = normalizeEmail(recipientInput);
  const normalizedCcInput = normalizeEmail(ccInput);
  const normalizedContactEmail = normalizeEmail(contactDraft.email);
  const recipientInputInvalid = normalizedRecipientInput.length > 0 && !isValidEmail(normalizedRecipientInput);
  const ccInputInvalid = normalizedCcInput.length > 0 && !isValidEmail(normalizedCcInput);
  const contactExists = contactState.some(
    (contact) => contact.email.toLowerCase() === normalizedContactEmail.toLowerCase(),
  );
  const contactEmailInvalid = normalizedContactEmail.length > 0 && !isValidEmail(normalizedContactEmail);
  const contactReady =
    contactDraft.label.trim().length > 0 &&
    normalizedContactEmail.length > 0 &&
    !contactEmailInvalid &&
    !contactExists;
  const bookingChecklistItems = [
    { label: "订舱代理", value: bookingShipment?.bookingAgent ?? "-" },
    { label: "船公司", value: bookingShipment?.carrier ?? "-" },
    { label: "柜型", value: bookingShipment?.containerType ?? "-" },
    { label: "起运港 / 目的港", value: bookingShipment ? `${bookingShipment.originPort} / ${bookingShipment.destinationPort}` : "-" },
    { label: "ETD", value: bookingShipment?.etd ?? "-" },
    { label: "附件", value: bookingDraft.attachmentName },
  ] satisfies ReadonlyArray<DetailItem>;

  const refreshWorkbenchData = useCallback(async (showToast = false) => {
    try {
      const [shipmentResult, contactResult] = await Promise.all([
        loadShipmentsFromApi(),
        loadContactsFromApi(),
      ]);

      if (shipmentResult.data.length > 0) {
        setShipmentState(shipmentResult.data);
        setSelectedShipmentId((current) =>
          shipmentResult.data.some((shipment) => shipment.id === current)
            ? current
            : shipmentResult.data[0]?.id ?? "",
        );
      }

      setContactState((current) => mergeContacts(contactResult.data, current));

      setAiReply((current) =>
        current.startsWith("选中单柜后")
          ? `${shipmentResult.source === "database" ? "数据库" : "服务端 mock"} 数据已载入。可让 AI 总结当前异常、补料缺口，或直接给出下一步催办动作。`
          : current,
      );

      if (showToast) {
        setToast({
          tone: shipmentResult.source === "database" ? "success" : "info",
          message:
            shipmentResult.source === "database"
              ? "已从数据库刷新队列"
              : "数据库不可用，已使用服务端 mock 队列",
        });
      }
    } catch (error) {
      if (showToast) {
        setToast({
          tone: "info",
          message: error instanceof Error ? error.message : "刷新失败，继续使用本地 mock 数据",
        });
      }
    }
  }, []);

  const refreshBookingPlans = useCallback(async () => {
    try {
      const result = await loadBookingPlansFromApi();
      setBookingPlans(result.data);
      setSelectedBookingPlanIds((current) => {
        const available = new Set(result.data.map((plan) => plan.shipmentId));
        return new Set(Array.from(current).filter((id) => available.has(id)));
      });
    } catch (error) {
      setToast({
        tone: "info",
        message: error instanceof Error ? error.message : "待发订舱计划加载失败",
      });
    }
  }, []);

  const refreshEmailRecognitions = useCallback(async () => {
    try {
      const result = await loadEmailRecognitionsFromApi();
      setEmailRecognitions(result.data);
    } catch (error) {
      setToast({
        tone: "info",
        message: error instanceof Error ? error.message : "邮件识别队列加载失败",
      });
    }
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshWorkbenchData();
      void refreshBookingPlans();
      void refreshEmailRecognitions();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [refreshBookingPlans, refreshEmailRecognitions, refreshWorkbenchData]);

  useEffect(() => {
    void Promise.allSettled([loadOpenClawSettings(), loadEmailSettings()]).then(([openClawResult, emailResult]) => {
      if (openClawResult.status === "fulfilled") {
        const config = openClawResult.value;
        setOpenClawConfig(config);
        setOpenClawDraft({
          apiKey: "",
          endpoint: config.endpoint,
          enabled: config.enabled,
          model: config.model,
          timeoutMs: config.timeoutMs,
        });
      } else {
        setOpenClawSettingsError(openClawResult.reason instanceof Error ? openClawResult.reason.message : "OpenClaw 配置读取失败");
      }

      if (emailResult.status === "fulfilled") {
        const config = emailResult.value;
        setEmailConfig(config);
        setEmailDraft({
          enabled: config.enabled,
          fromEmail: config.fromEmail,
          fromName: config.fromName,
          imapHost: config.imapHost,
          imapPort: config.imapPort,
          imapSecure: config.imapSecure,
          password: "",
          replyTo: config.replyTo,
          smtpHost: config.smtpHost,
          smtpPort: config.smtpPort,
          smtpSecure: config.smtpSecure,
          username: config.username,
        });
      } else {
        setEmailSettingsError(emailResult.reason instanceof Error ? emailResult.reason.message : "邮箱配置读取失败");
      }
    });
  }, []);

  useEffect(() => {
    if (!bookingShipmentId) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !bookingSending) {
        setBookingShipmentId(null);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [bookingShipmentId, bookingSending]);

  function updateShipment(mutator: (shipment: ShipmentRecord) => ShipmentRecord, successMessage: string) {
    if (!selectedShipment) return;

    setShipmentState((current) =>
      current.map((shipment) => (shipment.id === selectedShipment.id ? mutator(shipment) : shipment)),
    );
    setToast({ tone: "success", message: successMessage });
  }

  function persistActionInBackground(action: DetailActionLabel, shipmentId = selectedShipment.id, draft?: BookingDraft) {
    void persistShipmentAction({ action, draft, shipmentId }).catch((error) => {
      setToast({
        tone: "info",
        message: error instanceof Error ? `${error.message} 已保留本地演示状态。` : "动作未持久化，已保留本地演示状态。",
      });
    });
  }

  function resetAiPanel(nextShipment: ShipmentRecord | undefined) {
    if (!nextShipment) return;

    setAiRequestState("idle");
    setAiLastPrompt(null);
    setAiLastCompletedAt(null);
    setAiLastReplyLength(0);
    setAiReply(
      `已切换到 ${nextShipment.batchNo}。可让 AI 总结当前异常、补料缺口，或直接给出下一步催办动作。`,
    );
  }

  function handleColumnChange(columnKey: string) {
    const nextRecords = recordsForColumn.get(columnKey) ?? [];
    setActiveColumn(columnKey);
    setSelectedShipmentId(nextRecords[0]?.id ?? "");
    resetAiPanel(nextRecords[0]);
  }

  function handleNavSelect(item: string) {
    if (item === "设置") {
      openOpenClawSettings();
      return;
    }

    setActiveNav(item);
  }

  function openOpenClawSettings() {
    setOpenClawSettingsOpen(true);
    setOpenClawSettingsError(null);
    setOpenClawTestResult(null);
    setEmailSettingsError(null);
    setEmailTestResult(null);
  }

  async function handleSaveOpenClawSettings(test: boolean) {
    setOpenClawSettingsLoading(true);
    setOpenClawSettingsError(null);
    setOpenClawTestResult(null);

    try {
      const result = await saveOpenClawSettings({ ...openClawDraft, test });
      setOpenClawConfig(result.config);
      setOpenClawDraft({
        apiKey: "",
        endpoint: result.config.endpoint,
        enabled: result.config.enabled,
        model: result.config.model,
        timeoutMs: result.config.timeoutMs,
      });
      setOpenClawTestResult(result.test ?? null);
      setToast({
        tone: result.test?.ok === false ? "info" : "success",
        message: test ? result.test?.message ?? "OpenClaw 配置已保存" : "OpenClaw 配置已保存",
      });
    } catch (error) {
      setOpenClawSettingsError(error instanceof Error ? error.message : "OpenClaw 配置保存失败");
    } finally {
      setOpenClawSettingsLoading(false);
    }
  }

  async function handleSaveEmailSettings(test: boolean) {
    setEmailSettingsLoading(true);
    setEmailSettingsError(null);
    setEmailTestResult(null);

    try {
      const result = await saveEmailSettings({ ...emailDraft, test });
      setEmailConfig(result.config);
      setEmailDraft({
        enabled: result.config.enabled,
        fromEmail: result.config.fromEmail,
        fromName: result.config.fromName,
        imapHost: result.config.imapHost,
        imapPort: result.config.imapPort,
        imapSecure: result.config.imapSecure,
        password: "",
        replyTo: result.config.replyTo,
        smtpHost: result.config.smtpHost,
        smtpPort: result.config.smtpPort,
        smtpSecure: result.config.smtpSecure,
        username: result.config.username,
      });
      setEmailTestResult(result.test ?? null);
      setToast({
        tone: result.test?.ok === false ? "info" : "success",
        message: test ? result.test?.message ?? "邮箱配置已保存" : "邮箱配置已保存",
      });
    } catch (error) {
      setEmailSettingsError(error instanceof Error ? error.message : "邮箱配置保存失败");
    } finally {
      setEmailSettingsLoading(false);
    }
  }

  function handleSelectShipment(shipmentId: string) {
    const nextShipment = visibleShipments.find((shipment) => shipment.id === shipmentId);
    setSelectedShipmentId(shipmentId);
    resetAiPanel(nextShipment);
  }

  function handleToggleBookingPlan(shipmentId: string) {
    const plan = bookingPlans.find((item) => item.shipmentId === shipmentId);
    if (plan?.planStatus !== "ready_to_draft") return;

    setSelectedBookingPlanIds((current) => {
      const next = new Set(current);
      if (next.has(shipmentId)) {
        next.delete(shipmentId);
      } else {
        next.add(shipmentId);
      }
      return next;
    });
  }

  async function handleBatchGenerateBookingDrafts() {
    const shipmentIds = Array.from(selectedBookingPlanIds);
    if (shipmentIds.length === 0 || bookingDraftGenerating) return;

    setBookingDraftGenerating(true);
    try {
      const result = await batchGenerateBookingDrafts(shipmentIds);
      setToast({
        tone: result.data.failedCount > 0 ? "info" : "success",
        message: `草稿生成完成：成功 ${result.data.successCount}，跳过 ${result.data.skippedCount}，失败 ${result.data.failedCount}`,
      });
      setSelectedBookingPlanIds(new Set());
      await refreshBookingPlans();
    } catch (error) {
      setToast({
        tone: "info",
        message: error instanceof Error ? error.message : "批量生成订舱草稿失败",
      });
    } finally {
      setBookingDraftGenerating(false);
    }
  }

  async function handleCreateBookingPlanForShipment(shipment: ShipmentRecord) {
    if (bookingDraftGenerating) return;

    const createCheck = canCreateBookingPlanFromShipment(shipment);
    if (!createCheck.canCreate) {
      setToast({ tone: "info", message: createCheck.message });
      return;
    }

    setBookingDraftGenerating(true);
    try {
      const result = await batchGenerateBookingDrafts([shipment.id]);
      setSelectedBookingPlanIds(new Set());
      await refreshBookingPlans();
      setToast({
        tone: result.data.successCount > 0 ? "success" : "info",
        message:
          result.data.successCount > 0
            ? `已为 ${shipment.batchNo} 生成待确认订舱草稿`
            : result.data.items[0]?.message ?? "未生成订舱草稿",
      });
    } catch (error) {
      setToast({
        tone: "info",
        message: error instanceof Error ? error.message : "新建订舱计划失败",
      });
    } finally {
      setBookingDraftGenerating(false);
    }
  }

  async function handleRunEmailSync() {
    if (emailSyncing) return;

    setEmailSyncing(true);
    try {
      const result = await runEmailSyncFromApi();
      setToast({
        tone: "success",
        message: `邮箱同步完成：新增 ${result.data.importedCount}，重复 ${result.data.duplicateCount}`,
      });
      await refreshEmailRecognitions();
    } catch (error) {
      setToast({
        tone: "info",
        message: error instanceof Error ? error.message : "邮箱同步失败",
      });
    } finally {
      setEmailSyncing(false);
    }
  }

  async function handleReviewEmailRecognition(id: string, action: EmailRecognitionReviewAction) {
    if (reviewingEmailRecognitionId) return;

    setReviewingEmailRecognitionId(id);
    try {
      const result = await reviewEmailRecognitionFromApi({ action, id, reviewer: "操作员" });
      setToast({ tone: "success", message: result.data.summary });
      await Promise.all([refreshEmailRecognitions(), refreshWorkbenchData()]);
    } catch (error) {
      setToast({
        tone: "info",
        message: error instanceof Error ? error.message : "邮件识别审核失败",
      });
    } finally {
      setReviewingEmailRecognitionId(null);
    }
  }

  function handleResetQueueFilters() {
    setSearchTerm("");
    setOwnerFilter("all");
    setAlertFilter("all");
  }

  function openBookingModal(shipment: ShipmentRecord) {
    setBookingShipmentId(shipment.id);
    setBookingDraft(buildBookingDraft(shipment));
    setRecipientInput("");
    setCcInput("");
    setContactDraft({ email: "", label: "", role: "booking_agent" });
    setContactState((current) => mergeContacts(current, buildContacts(shipment)));
  }

  function handleCloseBooking() {
    if (bookingSending) return;

    setBookingShipmentId(null);
  }

  function mergeContacts(current: ContactRecord[], incoming: ContactRecord[]) {
    const seen = new Set(current.map((contact) => contact.email.toLowerCase()));
    const additions = incoming.filter((contact) => {
      const key = contact.email.toLowerCase();
      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    });

    return [...current, ...additions];
  }

  function addAddress(field: "to" | "cc", value: string) {
    const normalized = normalizeEmail(value);
    if (!normalized || !isValidEmail(normalized)) return;

    setBookingDraft((current) => {
      const existing = current[field].map((email) => email.toLowerCase());
      if (existing.includes(normalized.toLowerCase())) return current;

      return { ...current, [field]: [...current[field], normalized] };
    });

    if (field === "to") {
      setRecipientInput("");
    } else {
      setCcInput("");
    }
  }

  function removeAddress(field: "to" | "cc", email: string) {
    setBookingDraft((current) => ({
      ...current,
      [field]: current[field].filter((item) => item !== email),
    }));
  }

  function handleAddressKeyDown(field: "to" | "cc", event: React.KeyboardEvent<HTMLInputElement>) {
    if (!["Enter", ",", ";"].includes(event.key)) return;

    event.preventDefault();
    addAddress(field, field === "to" ? recipientInput : ccInput);
  }

  function handleAddContact() {
    if (!contactReady) return;

    const nextContact = {
      email: normalizedContactEmail,
      label: contactDraft.label.trim(),
      role: contactDraft.role,
    } satisfies ContactRecord;

    setContactState((current) => [...current, nextContact]);
    setContactDraft({ email: "", label: "", role: "booking_agent" });

    void persistContact(nextContact).catch((error) => {
      setToast({
        tone: "info",
        message: error instanceof Error ? `${error.message} 已保留本地联系人。` : "联系人未持久化，已保留本地联系人。",
      });
    });
  }

  async function handleSendBooking() {
    if (!bookingShipment || bookingDraft.to.length === 0 || bookingSending) return;

    setBookingSending(true);
    let emailPersisted = false;

    try {
      await sendBookingEmail({ draft: bookingDraft, shipmentId: bookingShipment.id });
      emailPersisted = true;
    } catch (error) {
      setToast({
        tone: "info",
        message: error instanceof Error ? `${error.message} 已保留本地演示状态。` : "邮件未持久化，已保留本地演示状态。",
      });
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    }

    setShipmentState((current) =>
      current.map((shipment) =>
        shipment.id === bookingShipment.id
          ? {
              ...shipment,
              lastEmailTime: new Date().toLocaleString("zh-CN", { hour12: false }),
              mailStatus: "已发送",
              status: shipment.mailStatus === "未发送" ? "已发送订舱" : shipment.status,
            }
          : shipment,
      ),
    );
    setBookingSending(false);
    setBookingShipmentId(null);
    setToast({
      tone: emailPersisted ? "success" : "info",
      message: emailPersisted ? "订舱邮件已发送并记录" : "订舱邮件已完成本地演示发送",
    });
    persistActionInBackground("订舱邮件", bookingShipment.id, bookingDraft);
  }

  function handleAction(action: string) {
    switch (action) {
      case "订舱邮件":
        openBookingModal(selectedShipment);
        setToast({ tone: "info", message: "已打开订舱邮件草稿" });
        break;
      case "催单提醒":
        updateShipment(
          (shipment) => ({
            ...shipment,
            followUpCount: shipment.followUpCount + 1,
            mailStatus: "跟进中",
            status:
              shipment.status === "等待放舱" || shipment.status === "已发送订舱"
                ? "已催放舱"
                : shipment.status,
            reminderFlags: Array.from(new Set(["已手动催单", ...shipment.reminderFlags])),
          }),
          "已增加一次催单记录",
        );
        persistActionInBackground("催单提醒");
        break;
      case "补料文件":
        updateShipment(
          (shipment) => ({
            ...shipment,
            documentStatus: "已发送",
            status: shipment.status === "待补料" ? "已发送补料" : shipment.status,
          }),
          "补料文件状态已推进",
        );
        persistActionInBackground("补料文件");
        break;
      case "SO 识别":
        updateShipment(
          (shipment) => ({
            ...shipment,
            soStatus: "已识别",
            status: shipment.status === "已催放舱" ? "已放舱" : shipment.status,
          }),
          "SO 识别状态已更新",
        );
        persistActionInBackground("SO 识别");
        break;
      case "AMS/ACI/ISF":
        updateShipment(
          (shipment) => ({
            ...shipment,
            documentProgress: {
              ams: "已发送",
              aci:
                shipment.documentProgress.aci === "待处理"
                  ? "草稿完成"
                  : shipment.documentProgress.aci,
              isf: "已发送",
            },
          }),
          "AMS / ACI / ISF 进度已刷新",
        );
        persistActionInBackground("AMS/ACI/ISF");
        break;
      case "异常标记":
        updateShipment(
          (shipment) => ({
            ...shipment,
            status: shipment.status === "异常处理中" ? "待补料" : "异常处理中",
            exceptions:
              shipment.status === "异常处理中"
                ? []
                : Array.from(new Set(["人工标记异常", ...shipment.exceptions])),
          }),
          "异常状态已切换",
        );
        persistActionInBackground("异常标记");
        break;
      default:
        setToast({ tone: "info", message: `暂未实现动作：${action}` });
    }
  }

  async function sendToAi(prompt: string) {
    const normalizedPrompt = prompt.trim();
    if (!selectedShipment || !normalizedPrompt) return;

    setAiRequestState("loading");
    setAiLastPrompt(normalizedPrompt);
    setAiReply("AI 正在整理当前柜子的操作建议...");

    try {
      const response = await fetch("/api/ai/openclaw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: normalizedPrompt,
          shipmentId: selectedShipment.id,
          context: {
            batchNo: selectedShipment.batchNo,
            soNo: selectedShipment.soNo,
            containerNo: selectedShipment.containerNo,
            status: selectedShipment.status,
            nextAction: selectedShipment.nextAction,
            exceptions: selectedShipment.exceptions,
          },
        }),
      });

      const data = await response.json();
      const reply = data.reply ?? data.data?.reply ?? data.message ?? "AI 已返回，但没有可显示文本。";
      setAiReply(reply);
      setAiRequestState("success");
      setAiLastReplyLength(reply.length);
      setAiLastCompletedAt(new Date().toLocaleTimeString("zh-CN", { hour12: false }));
    } catch {
      setAiReply("AI 接口请求失败，请检查本地服务或 OpenClaw 地址配置。");
      setAiRequestState("error");
      setAiLastReplyLength(0);
    }
  }

  function handleAiInputKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      if (!aiCanSend) return;
      void sendToAi(aiInput);
    }
  }

  return (
    <main className="min-h-dvh bg-slate-100 text-slate-950">
      {toast ? (
        <div className="fixed right-4 top-4 z-50" aria-live="polite" aria-atomic="true">
          <div
            role="status"
            className={`rounded-xl border px-4 py-3 text-sm shadow-lg ${
              toast.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-slate-200 bg-white text-slate-800"
            }`}
          >
            {toast.message}
          </div>
        </div>
      ) : null}

      <div className="mx-auto grid min-h-dvh w-full max-w-[1760px] grid-cols-1 xl:grid-cols-[208px_minmax(0,1fr)]">
        <SidebarNav
          activeNav={activeNav}
          onOpenSettings={openOpenClawSettings}
          onSelect={handleNavSelect}
          summary={summary}
        />

        <section className="flex min-h-screen flex-col px-3 py-3 sm:px-4 xl:px-5">
          <WorkbenchHeader
            activeNav={activeNav}
            onPrimaryAction={() => void sendToAi(aiInput)}
            primaryActionLabel="AI 总结"
            onRefresh={() => void refreshWorkbenchData(true)}
            onSecondaryAction={(action) => handleAction(action)}
            onTopCreateBookingPlan={() => void handleCreateBookingPlanForShipment(selectedShipment)}
            selectedShipment={selectedShipment}
            topCreateBookingPlanDisabled={bookingDraftGenerating || !bookingPlanCreateCheck.canCreate}
            topCreateBookingPlanTitle={bookingPlanCreateCheck.message}
          />

          <div className="mt-3">
            <MetricStrip activeColumn={activeColumn} onSelectColumn={handleColumnChange} summary={summary} />
          </div>

          <div className="mt-3 grid min-h-0 flex-1 grid-cols-1 gap-3 min-[1500px]:grid-cols-[minmax(300px,360px)_minmax(0,1fr)_minmax(360px,400px)]">
            <QueuePanel
              activeColumn={activeColumn}
              alertFilter={alertFilter}
              onAlertFilterChange={setAlertFilter}
              onClearFilters={handleResetQueueFilters}
              onColumnChange={handleColumnChange}
              onOwnerFilterChange={setOwnerFilter}
              onSearchChange={setSearchTerm}
              onSelectShipment={handleSelectShipment}
              ownerFilter={ownerFilter}
              ownerOptions={ownerOptions}
              recordsForColumn={recordsForColumn}
              searchTerm={searchTerm}
              selectedShipmentId={selectedShipment.id}
              visibleShipments={visibleShipments}
            />

            <section className="grid min-h-0 min-w-0 grid-cols-1 gap-3 xl:grid-rows-[auto_auto_minmax(0,1fr)]">
              <ShipmentDetailPanel
                aiSummary={selectedShipment.aiSummary}
                batchNo={selectedShipment.batchNo}
                containerNo={selectedShipment.containerNo}
                createBookingPlanCheck={bookingPlanCreateCheck}
                cutoffBadgeClassName={toneClass(cutoffTone(selectedShipment.hoursToCutoff))}
                cutoffLabel={`截补料 ${selectedShipment.hoursToCutoff}h`}
                nextAction={selectedShipment.nextAction}
                onCreateBookingPlan={() => void handleCreateBookingPlanForShipment(selectedShipment)}
                onOpenDetails={() => setDetailDrawerOpen(true)}
                shipmentBrief={shipmentBrief}
                soNo={selectedShipment.soNo}
                status={selectedShipment.status}
                statusLevel={selectedShipmentLevel}
                vesselVoyage={selectedShipment.vesselVoyage}
              />

              <ShipmentFieldPanel
                fieldItems={fieldItems}
                progressItems={documentProgressItems}
                reminders={reminderChips}
              />

              <ShipmentActionPanel
                actionItems={actionPanelItems}
                nextAction={selectedShipment.nextAction}
                onFollowUp={() => handleAction("催单提醒")}
                onRunRecommended={() => handleAction(recommendedActionCard.label)}
                recommendedAction={{
                  detail: recommendedActionCard.detail,
                  label: recommendedActionCard.label,
                  status: recommendedActionCard.status,
                  statusClassName: toneClass(progressTone(recommendedActionCard.status)),
                }}
              />
            </section>

            <aside className="grid min-h-0 min-w-0 grid-cols-1 gap-3 content-start">
              <section className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/30">
                <div>
                  <p className="text-sm font-semibold text-slate-950">机器人中台</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">订舱草稿、邮件识别和人工确认写回集中处理。</p>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-[11px] text-slate-500">待发计划</p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">{robotHubMetrics.bookingPlans}</p>
                  </div>
                  <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2">
                    <p className="text-[11px] text-cyan-700">待审邮件</p>
                    <p className="mt-1 text-lg font-semibold text-cyan-950">{robotHubMetrics.emailRecognitions}</p>
                  </div>
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                    <p className="text-[11px] text-red-700">异常邮件</p>
                    <p className="mt-1 text-lg font-semibold text-red-950">{robotHubMetrics.exceptionEmails}</p>
                  </div>
                </div>
              </section>

              <BookingPlanPanel
                generating={bookingDraftGenerating}
                onGenerateDrafts={() => void handleBatchGenerateBookingDrafts()}
                onTogglePlan={handleToggleBookingPlan}
                plans={bookingPlans}
                selectedIds={selectedBookingPlanIds}
              />

              <EmailRecognitionPanel
                items={emailRecognitions}
                onReview={(id, action) => void handleReviewEmailRecognition(id, action)}
                onSync={() => void handleRunEmailSync()}
                reviewingId={reviewingEmailRecognitionId}
                syncing={emailSyncing}
              />

              <AiCopilotPanel
                aiInput={aiInput}
                aiLastCompletedAt={aiLastCompletedAt}
                aiLastPrompt={aiLastPrompt}
                aiLastReplyLength={aiLastReplyLength}
                aiReply={aiReply}
                aiRequestState={aiRequestState}
                onAiInputChange={setAiInput}
                onAiInputKeyDown={handleAiInputKeyDown}
                onQuickPrompt={(prompt) => {
                  setAiInput(prompt);
                  void sendToAi(prompt);
                }}
                onResetPrompt={() => setAiInput(quickPrompts[0])}
                onSend={() => void sendToAi(aiInput)}
                selectedShipment={selectedShipment}
              />
            </aside>
          </div>
        </section>
      </div>

      <BookingModal
        bookingChecklistItems={bookingChecklistItems}
        bookingContacts={contactState}
        bookingDraft={bookingDraft}
        bookingSending={bookingSending}
        ccInput={ccInput}
        ccInputInvalid={ccInputInvalid}
        contactDraft={contactDraft}
        contactEmailInvalid={contactEmailInvalid}
        contactExists={contactExists}
        contactReady={contactReady}
        isOpen={Boolean(bookingShipmentId)}
        onAddCcAddress={() => addAddress("cc", ccInput)}
        onAddContact={handleAddContact}
        onAddRecipientAddress={() => addAddress("to", recipientInput)}
        onCcKeyDown={(event) => handleAddressKeyDown("cc", event)}
        onChangeBody={(body) => setBookingDraft((current) => ({ ...current, body }))}
        onChangeCcInput={setCcInput}
        onChangeContactDraft={setContactDraft}
        onChangeRecipientInput={setRecipientInput}
        onChangeSubject={(subject) => setBookingDraft((current) => ({ ...current, subject }))}
        onClose={handleCloseBooking}
        onCommitCcAddress={() => addAddress("cc", ccInput)}
        onCommitRecipientAddress={() => addAddress("to", recipientInput)}
        onContactAddCc={(email) => addAddress("cc", email)}
        onContactAddRecipient={(email) => addAddress("to", email)}
        onRecipientKeyDown={(event) => handleAddressKeyDown("to", event)}
        onRemoveCcAddress={(email) => removeAddress("cc", email)}
        onRemoveRecipientAddress={(email) => removeAddress("to", email)}
        onSend={() => void handleSendBooking()}
        recipientInput={recipientInput}
        recipientInputInvalid={recipientInputInvalid}
        shipment={bookingShipment}
      />

      <ShipmentDetailDrawer
        groups={shipmentDetailGroups}
        isOpen={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        shipmentBrief={shipmentBrief}
      />

      <OpenClawSettingsModal
        activeTab={settingsTab}
        emailDraft={emailDraft}
        emailError={emailSettingsError}
        emailLoading={emailSettingsLoading}
        emailSavedConfig={emailConfig}
        emailTestResult={emailTestResult}
        isOpen={openClawSettingsOpen}
        onChangeEmail={setEmailDraft}
        onChangeOpenClaw={setOpenClawDraft}
        onClose={() => setOpenClawSettingsOpen(false)}
        onSaveEmail={(test) => void handleSaveEmailSettings(test)}
        onSaveOpenClaw={(test) => void handleSaveOpenClawSettings(test)}
        onTabChange={setSettingsTab}
        openClawDraft={openClawDraft}
        openClawError={openClawSettingsError}
        openClawLoading={openClawSettingsLoading}
        openClawSavedConfig={openClawConfig}
        openClawTestResult={openClawTestResult}
        showEmailPassword={showEmailPassword}
        showOpenClawApiKey={showOpenClawApiKey}
        toggleShowEmailPassword={() => setShowEmailPassword((current) => !current)}
        toggleShowOpenClawApiKey={() => setShowOpenClawApiKey((current) => !current)}
      />
    </main>
  );
}
