export type ShipmentStatus =
  | "待订舱"
  | "已发送订舱"
  | "等待放舱"
  | "已催放舱"
  | "已放舱"
  | "待补料"
  | "已发送补料"
  | "等待补料确认"
  | "补料已确认"
  | "待报关"
  | "已报关"
  | "待提柜"
  | "已提柜"
  | "已装柜"
  | "已还柜"
  | "已开船"
  | "已到港"
  | "已签收"
  | "已完成"
  | "异常处理中";

export type AlertLevel = "red" | "yellow" | "green";

export type BlTelexStatus = "未确认" | "待确认" | "已确认" | "";

export type ShipmentRecord = {
  id: string;
  batchNo: string;
  soNo: string;
  containerNo: string;
  bookingAgent: string;
  blTelexStatus?: BlTelexStatus;
  cbm?: string;
  carrier: string;
  originPort: string;
  transitPort: string;
  destinationPort: string;
  containerType: string;
  customsBroker?: string;
  cutCustomsTime?: string;
  cutWeightTime?: string;
  grossWeight?: string;
  oceanFreightPrice?: string;
  packages?: string;
  truckingCompany?: string;
  vesselName?: string;
  vesselVoyage: string;
  voyageNo?: string;
  etd: string;
  eta: string;
  cutoffTime: string;
  pickupLocation: string;
  returnLocation: string;
  status: ShipmentStatus;
  operator: string;
  followUpCount: number;
  lastEmailTime: string;
  hoursWaitingRelease: number;
  hoursToCutoff: number;
  aiSummary: string;
  exceptions: string[];
  nextAction: string;
  reminderFlags: string[];
  documentProgress: {
    ams: "待处理" | "草稿完成" | "已发送";
    aci: "待处理" | "草稿完成" | "已发送";
    isf: "待处理" | "草稿完成" | "已发送";
  };
  mailStatus: "未发送" | "已发送" | "跟进中";
  soStatus: "待识别" | "已识别";
  documentStatus: "待生成" | "处理中" | "已发送" | "已确认";
};

export const statusColumns: Array<{
  key: string;
  title: string;
  statuses: ShipmentStatus[];
}> = [
  {
    key: "booking-draft",
    title: "待订舱",
    statuses: ["待订舱"],
  },
  {
    key: "waiting-release",
    title: "等待放舱",
    statuses: ["已发送订舱", "等待放舱", "已催放舱"],
  },
  {
    key: "released",
    title: "已放舱",
    statuses: ["已放舱"],
  },
  {
    key: "pending-docs",
    title: "待补料",
    statuses: ["待补料", "已发送补料", "等待补料确认", "补料已确认"],
  },
  {
    key: "sailed",
    title: "已开船",
    statuses: ["已开船", "已到港", "已签收", "已完成"],
  },
  {
    key: "exception",
    title: "异常",
    statuses: ["异常处理中"],
  },
];

export const shipments: ShipmentRecord[] = [
  {
    id: "SHP-240610-001",
    batchNo: "FF-CA-240610-A01",
    soNo: "OOLU8791320",
    containerNo: "TEMU9088771",
    bookingAgent: "Seabay Logistics",
    blTelexStatus: "待确认",
    cbm: "68.5 CBM",
    carrier: "OOCL",
    originPort: "Yantian",
    transitPort: "Busan",
    destinationPort: "Vancouver",
    containerType: "40HQ",
    customsBroker: "Yantian Customs Desk",
    cutCustomsTime: "2026-06-11 16:00",
    cutWeightTime: "2026-06-11 14:00",
    grossWeight: "18,240 KG",
    oceanFreightPrice: "USD 2,450",
    packages: "860 CTNS",
    truckingCompany: "Shenzhen Port Trucking",
    vesselName: "OOCL Rauma",
    vesselVoyage: "OOCL Rauma 068E",
    voyageNo: "068E",
    etd: "2026-06-12 23:00",
    eta: "2026-06-28 09:00",
    cutoffTime: "2026-06-11 18:00",
    pickupLocation: "Yantian Depot 3",
    returnLocation: "Yantian Terminal 7",
    status: "已催放舱",
    operator: "Ava",
    followUpCount: 2,
    lastEmailTime: "2026-06-10 13:25",
    hoursWaitingRelease: 6,
    hoursToCutoff: 28,
    aiSummary: "代理尚未返回 SO，已连续两次催放舱，离截补料只剩 28 小时。",
    exceptions: ["等待放舱超过 4 小时"],
    nextAction: "17:30 前再次发送催单，并电话确认舱位是否 released。",
    reminderFlags: ["自动催单已触发", "24h 补料提醒待发送"],
    documentProgress: { ams: "待处理", aci: "待处理", isf: "待处理" },
    mailStatus: "跟进中",
    soStatus: "待识别",
    documentStatus: "待生成",
  },
  {
    id: "SHP-240610-002",
    batchNo: "FF-US-240610-B03",
    soNo: "COSU5519028",
    containerNo: "MSCU3381274",
    bookingAgent: "Apex Forwarding",
    carrier: "COSCO",
    originPort: "Ningbo",
    transitPort: "",
    destinationPort: "Los Angeles",
    containerType: "40GP",
    vesselVoyage: "CSCL Spring 021E",
    etd: "2026-06-13 16:30",
    eta: "2026-06-29 13:00",
    cutoffTime: "2026-06-11 11:00",
    pickupLocation: "Ningbo CY 5",
    returnLocation: "Ningbo Phase II",
    status: "待补料",
    operator: "Leo",
    followUpCount: 0,
    lastEmailTime: "2026-06-10 09:40",
    hoursWaitingRelease: 0,
    hoursToCutoff: 13,
    aiSummary: "SO 已写回，需在今天晚上前完成补料和 AMS Draft。",
    exceptions: [],
    nextAction: "生成 Word 补料模板并发送给代理。",
    reminderFlags: ["12h 补料提醒已触发"],
    documentProgress: { ams: "草稿完成", aci: "待处理", isf: "草稿完成" },
    mailStatus: "已发送",
    soStatus: "已识别",
    documentStatus: "处理中",
  },
  {
    id: "SHP-240610-003",
    batchNo: "FF-CA-240610-C08",
    soNo: "EMCU1065239",
    containerNo: "EISU7710265",
    bookingAgent: "Northern Bridge",
    carrier: "EMC",
    originPort: "Shanghai",
    transitPort: "Kaohsiung",
    destinationPort: "Toronto",
    containerType: "40HQ",
    vesselVoyage: "Ever Lunar 112E",
    etd: "2026-06-14 21:00",
    eta: "2026-07-03 10:00",
    cutoffTime: "2026-06-12 10:00",
    pickupLocation: "Waigaoqiao 4",
    returnLocation: "Waigaoqiao 5",
    status: "已发送补料",
    operator: "Ava",
    followUpCount: 1,
    lastEmailTime: "2026-06-10 15:10",
    hoursWaitingRelease: 0,
    hoursToCutoff: 42,
    aiSummary: "补料已发，等待代理确认柜号与封条号，ACI 可继续同步。",
    exceptions: [],
    nextAction: "明早 09:30 前检查补料确认回邮。",
    reminderFlags: ["补料确认等待中"],
    documentProgress: { ams: "待处理", aci: "草稿完成", isf: "待处理" },
    mailStatus: "已发送",
    soStatus: "已识别",
    documentStatus: "已发送",
  },
  {
    id: "SHP-240610-004",
    batchNo: "FF-US-240610-D12",
    soNo: "MAEU7721901",
    containerNo: "MAEU5538129",
    bookingAgent: "Prime Ocean",
    carrier: "MAERSK",
    originPort: "Qingdao",
    transitPort: "",
    destinationPort: "New York",
    containerType: "20GP",
    vesselVoyage: "Maersk Saratoga 034E",
    etd: "2026-06-10 20:00",
    eta: "2026-06-26 11:00",
    cutoffTime: "2026-06-09 20:00",
    pickupLocation: "Qingdao Depot 1",
    returnLocation: "Qingdao Qianwan",
    status: "已开船",
    operator: "Nina",
    followUpCount: 0,
    lastEmailTime: "2026-06-09 17:20",
    hoursWaitingRelease: 0,
    hoursToCutoff: -18,
    aiSummary: "已开船，ISF 已发送，后续只需盯目的港节点和签收。",
    exceptions: [],
    nextAction: "等待靠港后同步 POD 与签收。",
    reminderFlags: ["目的港 ETA 跟踪中"],
    documentProgress: { ams: "已发送", aci: "待处理", isf: "已发送" },
    mailStatus: "已发送",
    soStatus: "已识别",
    documentStatus: "已确认",
  },
  {
    id: "SHP-240610-005",
    batchNo: "FF-CA-240610-E15",
    soNo: "HLCU8812309",
    containerNo: "TCLU6623419",
    bookingAgent: "Blue Anchor",
    carrier: "Hapag-Lloyd",
    originPort: "Xiamen",
    transitPort: "",
    destinationPort: "Montreal",
    containerType: "40HQ",
    vesselVoyage: "Montreal Express 019E",
    etd: "2026-06-15 18:00",
    eta: "2026-07-05 14:00",
    cutoffTime: "2026-06-11 23:00",
    pickupLocation: "Xiamen CY 2",
    returnLocation: "Xiamen Haitian",
    status: "异常处理中",
    operator: "Leo",
    followUpCount: 1,
    lastEmailTime: "2026-06-10 12:00",
    hoursWaitingRelease: 0,
    hoursToCutoff: 7,
    aiSummary: "SO 与托书柜型不一致，当前代理回邮要求改 40GP，需人工确认客户需求。",
    exceptions: ["SO 柜型与托书不一致", "6h 截补料提醒已进入红色区间"],
    nextAction: "立即联系客户确认是否换柜型，再决定是否重发补料。",
    reminderFlags: ["6h 红色预警"],
    documentProgress: { ams: "待处理", aci: "待处理", isf: "待处理" },
    mailStatus: "跟进中",
    soStatus: "已识别",
    documentStatus: "处理中",
  },
  {
    id: "SHP-240610-006",
    batchNo: "FF-US-240610-F21",
    soNo: "YMLU2287102",
    containerNo: "YMLU5563210",
    bookingAgent: "Harbor Chain",
    carrier: "YML",
    originPort: "Shenzhen",
    transitPort: "",
    destinationPort: "Houston",
    containerType: "40HQ",
    vesselVoyage: "YM Uniform 009E",
    etd: "2026-06-16 07:00",
    eta: "2026-07-01 16:00",
    cutoffTime: "2026-06-12 15:00",
    pickupLocation: "Shekou CY 8",
    returnLocation: "Shekou Phase III",
    status: "待订舱",
    operator: "Nina",
    followUpCount: 0,
    lastEmailTime: "",
    hoursWaitingRelease: 0,
    hoursToCutoff: 33,
    aiSummary: "托书资料已齐，尚未发送首封订舱邮件，适合生成订舱计划并人工确认发送。",
    exceptions: [],
    nextAction: "生成订舱计划草稿，核对附件后发送给 Harbor Chain。",
    reminderFlags: [],
    documentProgress: { ams: "待处理", aci: "待处理", isf: "待处理" },
    mailStatus: "未发送",
    soStatus: "待识别",
    documentStatus: "待生成",
  },
];

export const mainNav = [
  "订舱工作台",
  "SO识别中心",
  "补料中心",
  "AMS/ACI/ISF",
  "邮件中心",
  "异常中心",
  "设置",
];

export const aiPrompts = [
  "帮我催所有超过4小时未放舱的柜子",
  "帮我查看今天哪些柜子需要补料",
  "帮我找出本周异常柜子",
];

export const timelineRules = [
  "等待放舱超过 4 小时自动发催单邮件，并累计催单次数。",
  "截补料前 24 / 12 / 6 小时分级提醒，6 小时进入红色异常。",
  "待提柜、待还柜超时进入异常中心，并保留操作日志。",
];

export function summarizeShipments(records: ShipmentRecord[]) {
  const redAlerts = records.filter(
    (record) => record.exceptions.length > 0 || record.hoursToCutoff <= 6,
  ).length;
  const yellowAlerts = records.filter(
    (record) => record.exceptions.length === 0 && record.hoursToCutoff > 6 && record.hoursToCutoff <= 24,
  ).length;
  const waitingRelease = records.filter((record) =>
    ["已发送订舱", "等待放舱", "已催放舱"].includes(record.status),
  ).length;
  const pendingDocs = records.filter((record) =>
    ["待补料", "已发送补料", "等待补料确认"].includes(record.status),
  ).length;

  return {
    total: records.length,
    redAlerts,
    yellowAlerts,
    greenNormal: Math.max(records.length - redAlerts - yellowAlerts, 0),
    waitingRelease,
    pendingDocs,
  };
}

export function getAlertLevel(record: ShipmentRecord): AlertLevel {
  if (record.exceptions.length > 0 || record.hoursToCutoff <= 6) {
    return "red";
  }

  if (record.hoursToCutoff <= 24 || record.followUpCount > 0) {
    return "yellow";
  }

  return "green";
}

export function getShipmentsByColumn(columnKey: string) {
  const column = statusColumns.find((item) => item.key === columnKey);
  if (!column) {
    return shipments;
  }

  return shipments.filter((shipment) => column.statuses.includes(shipment.status));
}
