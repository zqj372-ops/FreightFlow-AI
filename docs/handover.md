# FreightFlow AI Handover

最后更新：2026-06-14
当前分支：`codex/booking-plans-phase-1`
最新提交：以 `git log -1 --oneline` 为准

## 0. 2026-06-14 本次交接更新

### 2026-06-14 · Product Design · 货代自动化作业系统总说明入库

- **远程仓库纠正**:正确 GitHub 远程是 `https://github.com/zqj372-ops/FreightFlow-AI.git`;`NEW-FR-AI.git` 属于用户另一个项目,不得继续推送本项目代码。
- **产品说明入库**:用户提供的《货代自动订舱系统 · 设计文档》已作为 [product-design.md](./product-design.md) 纳入仓库。
- **产品定位更新**:FreightFlow AI 统一描述为货代自动化作业系统的 AI 工作台与自动化机器人中枢,目标是把货代日常 70% 的“催、抄、录、查”交给系统完成。
- **稳定文档同步**:README、[project-overview.md](./project-overview.md)、[business-rules.md](./business-rules.md)、[master-plan.md](./master-plan.md)、[todo.md](./todo.md) 已同步订舱、SO识别、补料、柜子跟踪、报关/清关、派送、财务识别和数据互通规划。
- **队列卡片产品方向**:队列卡片应作为“异常优先的订舱操作行卡”,只回答这票是谁、去哪、卡在哪、什么时候危险、下一步做什么;完整字段继续放详情弹窗编辑。
- **本地工具目录保护**:`.opencode/` 已加入 `.gitignore`,避免本地工具依赖被误提交。

### 2026-06-14 · Track B · IMAP 真拉信 + 邮件同步状态机

- **目标**:`/api/email-sync/run` 从 mock-only 切换为真 IMAP 拉信并实现完整的状态机。`runSync` 在无 IMAP 配置时仍然能跑通(走 `MockEmailPullProvider`)。
- **改动文件**:
  - `src/lib/services/email/types.ts` — 新增 `EmailPullProvider`、`EmailMessageMetadata`、`EmailMessageFull`、`EmailSearchOptions`、`SyncReport`、`SyncReportError`、`RunSyncOptions`。原 `EmailProvider`(send) 类型保持不变。
  - `src/lib/services/email/imap-pull-provider.ts` — 新增 `ImapPullProvider`,基于 `imapflow` 真实 `search` + `fetch`,支持 `since` 增量、`limit` 裁剪、mailbox 选择。注入式 `factory` 便于测试。
  - `src/lib/services/email/mock-pull-provider.ts` — 新增 `MockEmailPullProvider`,3 条固定 fixture,提供 `search` / `fetchFull`。
  - `src/lib/services/email/email-service.ts` — 新增 `runSync(options, deps?)`、`createPullProvider`、`defaultTriggerRecognition`、`drainInMemorySyncFailures`。原有 `sendShipmentEmail` / `listShipmentEmailLogs` 等发送侧 API 不变。
  - `src/app/api/email-sync/run/route.ts` — 改为接受 `POST { mailbox?, limit?, fullSync? }`,返回 `SyncReport` JSON;鉴权留待后续 Track。
  - `src/lib/services/email/email-service.test.ts` — 新增 10 个用例,覆盖 5 大场景:mock happy-path、dedupe(已存在 + 唯一约束冲突)、provider 抛错(search/fetch/persist 三类)、syncStatus 状态机 NEW→PARSED、config fallback。
  - `.env.example` — 在 `IMAP_*` 字段后追加 pull-sync 行为说明。
- **SyncReport 字段**:
  ```ts
  type SyncReport = {
    provider: string;            // "imap" | "mock-pull" | "stub-pull" | "unknown"
    scanned: number;             // provider.search 返回的元数据条数
    fetched: number;             // 成功 fetchFull 的条数
    newInserted: number;         // 写入 EmailMessage(syncStatus=NEW) 的条数
    duplicatesSkipped: number;   // 已存在 messageId 的条数
    errorCount: number;          // errors[].length 的快速读取
    startedAt: string;           // ISO 8601
    finishedAt: string;          // ISO 8601
    errors: SyncReportError[];   // { code, message, messageId?, stage }
  };
  ```
- **状态机**(沿用 schema `EmailMessageSyncStatus`):
  ```
  search → fetch → persist (NEW) → trigger → PARSED → [Track M3] QUEUED → CONFIRMED/IGNORED/FAILED
  ```
  - `defaultTriggerRecognition` 当前只把 `syncStatus` 切到 `PARSED`,Track M3 接入真正的分类器后,该 hook 会顺接 `QUEUED`。
  - FAILED 落库路径:DB schema 当前没有 `errorMessage` 列,失败记录先入 `inMemorySyncFailures` 并打 `DB column missing - TODO` 标记;后续 schema 升级再补字段(本轮不改 schema)。
- **Provider 选择策略**:
  - `.freightflow/email-config.json` 存在且 `enabled=true` 且 `imapHost + username + password` 齐全 → `ImapPullProvider`。
  - 否则读取 `IMAP_HOST + SMTP_USERNAME + SMTP_PASSWORD` env → `ImapPullProvider`。
  - 以上均不满足 → `MockEmailPullProvider`(dev/test 默认)。
  - **真实 IMAP 拉信失败必须显式报错**,严禁 silently 回退到 mock(provider 异常直接 throw 到 `runSync` 顶层,route 渲染 5xx)。
- **增量同步**:`runSync` 默认 `fullSync=false`,会查 `EmailMessage.findFirst({ orderBy: receivedAt desc })` 取最近一封 `receivedAt` 作为 `since` 过滤;`fullSync=true` 时跳过 `since` 拉整 INBOX。
- **测试**:`npm test` 现有 9 文件 / 66 用例 + 新增 1 文件 / 10 用例 = 10 文件 / 76 用例全部通过,新增文件 0 TS strict 错误;`npx tsc --noEmit` 中所有新增/修改文件无报错(预存在的 13 条报错位于 `src/components/workbench-shell.tsx` 与 `email-recognition-service.test.ts`,不在本 Track 范围)。
- **交付门**:Track B 交付不依赖 Track A(repositories/)。`runSync` 直接走 `prisma.emailMessage.*`;`repositories/` 后续 Track 接入时只需替换该层。

### 2026-06-14 · Track A · 订舱流程数据层抽象 (mock + prisma 可切换)

- **目标**:在不动前端 mock 演示体验的前提下,把订舱流程核心数据操作抽到 `src/lib/repositories/` 仓储层,`getRepositories()` 工厂根据 `DATABASE_URL` 自动选择 mock 或 prisma 适配器并打 INFO 日志;以前直接 `import mock-data` 的 API 路由改走仓储。
- **新增接口**(`src/lib/repositories/`,每个一个文件,导 type + interface):
  - `ShipmentRepository` — `list / getById / advanceStatus / recordActionLog`
  - `BookingPlanRepository` — `list / getByShipmentId / upsertForShipment / updateStatus / bindLastDraft`
  - `EmailDraftRepository` — `list / getById / create / update / markSent`
  - `EmailMessageRepository` — `list / getById / getByMessageId / create / updateSyncStatus`
  - `EmailRecognitionRepository` — `listPending / getById / create / updateStatus`
  - `ContactRepository` — `list / getByEmail`
- **新增 mock 适配器**(`src/lib/repositories/mock/`):模块级 `mock-store.ts` 共享 store,启动时 seed 6 条 Shipment + 派生 BookingPlan + EmailDraft + 3 条 EmailMessage + 对应 EmailRecognitionResult;`MockShipmentRepository.advanceStatus` 使用 `structuredClone` 防止调用方污染内部 store;`MockEmailDraftRepository.markSent` 写入 `sentEmailLogId + lastError` 并把 status 切换到 `sent`。
- **新增 prisma 适配器**(`src/lib/repositories/prisma/`):走 `@prisma/client` 真实表;统一处理 `DbBookingPlanStatus / DbEmailDraftStatus / DbEmailRecognitionStatus / DbEmailMessageSyncStatus / DbShipmentActionType / DbActionSource / DbContactRole` 的 enum 映射;`PrismaShipmentRepository.advanceStatus` 复用 `freightflow-data.ts` 中的 `shipmentUpdateData` 走 `documentProgress.upsert` + `exceptions/reminderFlags` 重写,与既有真实库行为一致。
- **工厂**(`src/lib/repositories/index.ts`):
  - `getRepositories()` 首次调用做 `DATABASE_URL` 探测:`$queryRaw SELECT 1`,失败则走 `mock` 模式(对 `isPrismaUnavailable` 的 catch 兼容)。
  - 缓存同一个 bundle 在模块级变量,避免多次新建;`__resetRepositoryCache()` 给测试用。
  - 打一行 `console.info("[repositories] using Prisma (DATABASE_URL detected) data layer")` 或 `... in-memory mock (DATABASE_URL not configured) data layer`。
  - barrel 同步 re-export 所有 repo 类型,call site 只需 `import { getRepositories, type BookingPlanRecord } from "@/lib/repositories"`。
- **API 路由重构**:
  - `src/app/api/shipments/route.ts` — 改用 `repos.shipments.list()`,根据 `repos.mode` 返回 `{ data, source: "database" }` 或 `{ data, source: "mock", warning }`。
  - `src/app/api/shipments/[id]/route.ts` — 改用 `repos.shipments.getById()`,404 时根据 mode 返回 `"Shipment not found."` 或 `"Shipment not found in mock fallback."`,与原行为对齐。
  - `src/app/api/email-recognitions/route.ts` — 改用 `repos.emailRecognitions.listPending()`,mock 模式下回退到 `listMockEmailRecognitionQueue`。
  - `src/app/api/booking-plans/route.ts` / `src/app/api/booking-plans/batch-drafts/route.ts` / `src/app/api/email-drafts/[draftId]/route.ts` / `src/app/api/email-drafts/[draftId]/send/route.ts` / `src/app/api/email-recognitions/[id]/review/route.ts` — **保持现状**,继续走既有 service。service 内部使用 `prisma.$transaction` 处理多表一致(如 `sendEmailDraft` 同时更新 draft + plan + shipment),把交易型操作迁到仓储需要引入事务抽象(超出本 Track 范围,留待后续 Track 评估)。
- **新测试**(`src/lib/repositories/__tests__/` 共 6 个文件 / 29 个用例):
  - `factory.test.ts` — 工厂在 `DATABASE_URL` 缺失 / 不可达 / 配置正确时的 mode 选择,bundle 形状稳定,store seed 一致。
  - `booking-plan-repository.test.ts` — list / getByShipmentId / upsertForShipment / updateStatus / bindLastDraft / 未知 id 返回 null。
  - `email-draft-repository.test.ts` — list / getById / create / update / markSent / 未知 id 返回 null。
  - `shipment-repository.test.ts` — list / getById 深拷贝隔离 / advanceStatus / recordActionLog / 缺失 ID 返回 null。
  - `email-recognition-repository.test.ts` — 种子 EmailMessage + Recognition 关联 / `listPending` 过滤 / `updateStatus` 切到 confirmed 后从队列中消失。
  - `contact-repository.test.ts` — 列表 = `getFallbackContacts`,大小写不敏感 email 查找。
  - `src/app/api/shipments/route.test.ts` — `GET /api/shipments` 在 mock 模式返回 6 条 + warning;`GET /api/shipments/SHP-240610-002` 返回 200;`GET /api/shipments/<missing>` 返回 404;`GET /api/email-recognitions` 在 mock 模式返回 `pending_review` 队列。
- **强制约束验证**:
  - `npx tsc --noEmit` 4 条预存报错(均在 `email-recognition-service.test.ts` 与 `workbench-shell.tsx` 与本 Track 无关);新文件 0 报错。
  - `npm test`:基线 10 文件 / 76 用例 + 新增 7 文件 / 32 用例 = **17 文件 / 108 用例全过**。
  - `npx eslint src/lib/repositories src/app/api/shipments src/app/api/email-recognitions`:0 警告 0 错误。
  - 未引入新运行时依赖。
  - 仓储接口不依赖 `next/server` 或任何 next 专属类型。
  - mock 适配器复用 `mock-data.ts` 与 `getFallbackContacts()`,不写死假数据。
- **遗留问题 / 后续 Track**:
  - 5 个走 service 的 API 路由的 service 内部仍是 `prisma.*` 直接调用,后续 Track 评估是否把单表 CRUD 也走仓储 + 把 `prisma.$transaction` 抽成仓储事务。
  - `EmailRecognitionRepository.getById` / `MockEmailRecognitionRepository` 的 email message join 行为目前服务于识别队列,后续 Track 接入 review writeback 时可直接复用。
  - 数据库 schema 仍按既有定义,本 Track 未改 `prisma/schema.prisma`。




- 已确认正确 GitHub 远程仓库为 `https://github.com/zqj372-ops/FreightFlow-AI.git`;`NEW-FR-AI.git` 是用户的另一个项目,不得继续推送本项目代码。
- 已将用户提供的《货代自动订舱系统 · 设计文档》纳入仓库:[product-design.md](./product-design.md)。
- 已同步更新产品定位:FreightFlow AI 是货代自动化作业系统的 AI 工作台与自动化机器人中枢,目标是把货代日常 70% 的“催、抄、录、查”交给系统完成。
- 已更新 [project-overview.md](./project-overview.md)、[business-rules.md](./business-rules.md)、[master-plan.md](./master-plan.md)、[todo.md](./todo.md) 和 README,把订舱、SO识别、补料、柜子跟踪、报关/清关、派送、财务识别的产品规划写入稳定文档。
- 已启动两个智能体并完成只读分析:
  - 产品文档智能体:梳理产品定位、模块、流程和应写入仓库的文档结构。
  - UI 结构智能体:确认当前队列卡片应改为“异常优先的订舱操作行卡”,完整字段保留在详情弹窗。
- 已将队列卡片从“全量资料卡”调整为“操作队列行卡”:卡片只展示批次、状态、负责人、航线、船名航次、柜号、SO、订舱代理、单证状态、最近截止、ETD、件毛体、下一步和推荐动作;发货人/收货人/通知方/拖车行/报关行/完整截单截重截关等字段放回详情弹窗编辑。
- 已把 `.opencode/` 加入 `.gitignore`,避免本地工具目录和 node_modules 被误提交。

## 1. 已完成功能

- 已搭建 Next.js 16 + React 19 + TypeScript + Tailwind CSS 4 的前端项目骨架。
- 已完成 FreightFlow AI 主页面 `/`，当前是一个单页操作台。
- 已完成左侧导航与工作台头部组件化：
  - `SidebarNav`
  - `WorkbenchHeader`
  - `MetricStrip`
  - `QueuePanel`
- 已完成基于 mock data 的整柜操作台交互：
  - 队列按状态列筛选
  - 搜索批次号 / SO / 柜号 / 船公司 / 目的港 / 操作员 / 状态
  - 按负责人筛选
  - 按红黄绿告警等级筛选
  - 队列卡片已改为“订舱跟踪详情卡片”
  - 单击队列卡片打开可编辑详情弹窗
  - 已取消双击编辑逻辑
  - 点击 SO / 柜号链接可跳到船公司查询页，且不会误触发卡片弹窗
- 已完成订舱跟踪详情卡片第一版：
  - 保留浅蓝色卡片风格，并压缩回接近早期队列卡片的高度
  - 顶部展示批次号、截单 / 截重 / 截关灰色胶囊和当前状态标签
  - 第二行突出展示柜号、SO号、订舱代理、海运费报价
  - 中间表格展示柜型、船名 / 航次、件数 / 毛重 / 体积、ETD / ETA、拖车行、报关行、提单电放确认、当前状态
  - 空字段统一显示 `-`，避免出现 `undefined` / `null`
  - 提单电放确认状态按颜色区分：未确认灰色、待确认橙色、已确认绿色
- 已完成订舱跟踪详情编辑弹窗：
  - 标题为“订舱跟踪详情”
  - 支持人工修正状态、SO状态、SO号、柜号、船公司、船名、航次、ETD、ETA、截单、截重、截关
  - 支持人工录入海运费报价、件数、毛重、体积、拖车行、报关行、提单电放确认
  - 保存后更新当前工作台内的 Shipment 状态
- 已完成单柜动作流的前端状态推进：
  - 订舱邮件
  - 催单提醒
  - 补料文件
  - SO 识别
  - AMS / ACI / ISF
  - 异常标记
- 已完成 booking modal 的前端流程能力：
  - 收件人 / 抄送维护
  - 邮件主题 / 正文编辑
  - 通讯录新增联系人
  - 订舱检查项展示
  - 发送按钮与状态回写
- 已完成 AI 副驾区域前端交互：
  - 快捷 prompt
  - 自定义 prompt 输入
  - 请求状态展示（idle / loading / success / error）
  - AI 返回文本格式化渲染
- 已完成邮件识别人工审核闭环：
  - 邮件识别队列提供“确认写入 / 标记异常 / 忽略”中文操作
  - `POST /api/email-recognitions/[id]/review` 统一处理审核动作
  - SO 回传、补料确认、订舱/催单回复、异常邮件均需操作员确认后才写回 Shipment
  - 忽略动作只关闭识别项,不写回 Shipment
- 已完成邮件同步入口和订舱机器人中台雏形：
  - 邮件识别队列作为顶部二级页面入口
  - 支持“同步邮箱”入口，当前仍为 mock 入队
  - AI 副驾作为顶部入口，打开后进入对应二级工作区
- 已完成订舱计划工作流前端能力：
  - 顶部保留“新建订舱计划”快捷按钮
  - 新建订舱计划使用弹窗表单，而不是跳转二级页面
  - 支持批量生成订舱草稿
  - 支持操作员手动确认后发送订舱邮件
  - 支持等待代理放舱阶段生成内部批次号
  - SO 信息等待代理回传后再由邮件识别写回
- 已完成 `/api/ai/openclaw` 路由：
  - 未配置环境变量时返回 stub 响应
  - 配置 `OPENCLAW_API_URL` 后转发到外部服务
- 已完成第一版 Next.js API 数据层：
  - `GET /api/shipments`
  - `GET /api/shipments/[id]`
  - `POST /api/shipments/[id]/actions`
  - `GET /api/booking-plans`
  - `POST /api/booking-plans`
  - `POST /api/booking-plans/batch-drafts`
  - `GET /api/email-recognitions`
  - `POST /api/email-sync/run`
  - `POST /api/email-drafts/[draftId]/send`
  - `GET /api/settings/email`
  - `POST /api/settings/email`
  - `GET /api/contacts`
  - `POST /api/contacts`
- 已完成 Prisma 数据层落库路径：
  - PostgreSQL + Prisma schema
  - 初始 migration SQL
  - mock shipment / contacts seed 脚本
  - 无数据库时读接口 mock fallback,写接口 503 明确失败
- 已完成最小测试基线：
  - 使用 Vitest 运行单测
  - `npm test` 可在无 PostgreSQL / SMTP / OpenClaw 的环境下运行
  - 已覆盖核心纯函数与 `/api/ai/openclaw` 的基础分支
- 已完成一轮结构整理与共享组件抽离：
  - 页面 helper 抽到 `src/features/freightflow/page-helpers.ts`
  - 通用展示组件抽到 `src/features/freightflow/shared-ui.tsx`

## 2. 当前目录结构

```text
freightflow-ai/
├── docs/
│   ├── business-rules.md
│   ├── database.md
│   ├── handover.md
│   ├── master-plan.md
│   ├── project-overview.md
│   ├── superpowers/
│   │   ├── plans/
│   │   └── specs/
│   └── todo.md
├── prisma/
│   ├── migrations/
│   ├── schema.prisma
│   └── seed.mjs
├── public/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── ai/
│   │   │   ├── booking-plans/
│   │   │   ├── contacts/
│   │   │   ├── email-drafts/
│   │   │   ├── email-recognitions/
│   │   │   ├── email-sync/
│   │   │   ├── settings/
│   │   │   └── shipments/
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   └── workbench-shell.tsx
│   ├── features/
│   │   └── freightflow/
│   │       ├── detail-panels.tsx
│   │       ├── page-helpers.ts
│   │       ├── page-helpers.test.ts
│   │       ├── workbench-page.tsx
│   │       └── shared-ui.tsx
│   └── lib/
│       ├── freightflow-data.ts
│       ├── mock-data.ts
│       └── prisma.ts
├── .env.example
├── .gitignore
├── README.md
├── eslint.config.mjs
├── next-env.d.ts
├── next.config.ts
├── package-lock.json
├── package.json
├── postcss.config.mjs
└── tsconfig.json
```

## 3. 数据库结构

当前项目已建立 `PostgreSQL + Prisma` 数据层骨架,但当前工作站尚未连接到可用 PostgreSQL 服务。

现状说明：

- Prisma schema 已覆盖 shipment / document progress / exceptions / reminder flags / contacts / action logs / email logs / AI requests。
- 已有 `prisma/migrations/20260611175000_initial/migration.sql` 和 `prisma/seed.mjs`。
- 已有 API 数据层读取/写入 Prisma;读接口在数据库不可用时回退 mock,写接口返回 503。
- 前端主工作台当前仍主要使用 `src/lib/mock-data.ts` + `useState`,尚未切到这些 API。
- 刷新页面后,前端本地动作仍会回到 mock 初始值,直到前端接入 API。

当前可视为“逻辑数据模型”的结构如下：

### 3.1 ShipmentRecord

```ts
type ShipmentRecord = {
  id: string;
  batchNo: string;
  soNo: string;
  containerNo: string;
  bookingAgent: string;
  oceanFreightPrice?: string;
  carrier: string;
  originPort: string;
  transitPort: string;
  destinationPort: string;
  containerType: string;
  vesselName?: string;
  voyageNo?: string;
  vesselVoyage: string;
  packages?: string;
  grossWeight?: string;
  cbm?: string;
  etd: string;
  eta: string;
  cutoffTime: string;
  cutWeightTime?: string;
  cutCustomsTime?: string;
  pickupLocation: string;
  returnLocation: string;
  truckingCompany?: string;
  customsBroker?: string;
  blTelexStatus?: "未确认" | "待确认" | "已确认";
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
```

### 3.2 Prisma 已建表

- `shipments`
- `shipment_document_progress`
- `shipment_exceptions`
- `shipment_reminder_flags`
- `shipment_email_logs`
- `shipment_email_recipients`
- `shipment_action_logs`
- `contacts`
- `ai_requests`

初始 DDL 已生成到 migration 文件。当前本机 `DATABASE_URL` 默认指向 `127.0.0.1:5432/freightflow_ai`,但验证时该 PostgreSQL 服务不可达,因此 seed 未能实际写入。

## 4. 已创建文件

以下为当前项目中的主要业务相关文件：

- `/Users/autumn/Documents/Codex/freightflow-ai/src/app/page.tsx`
- `/Users/autumn/Documents/Codex/freightflow-ai/src/app/layout.tsx`
- `/Users/autumn/Documents/Codex/freightflow-ai/src/app/globals.css`
- `/Users/autumn/Documents/Codex/freightflow-ai/src/app/api/ai/openclaw/route.ts`
- `/Users/autumn/Documents/Codex/freightflow-ai/src/app/api/ai/openclaw/route.test.ts`
- `/Users/autumn/Documents/Codex/freightflow-ai/src/app/api/booking-plans/route.ts`
- `/Users/autumn/Documents/Codex/freightflow-ai/src/app/api/booking-plans/batch-drafts/route.ts`
- `/Users/autumn/Documents/Codex/freightflow-ai/src/app/api/contacts/route.ts`
- `/Users/autumn/Documents/Codex/freightflow-ai/src/app/api/email-drafts/[draftId]/send/route.ts`
- `/Users/autumn/Documents/Codex/freightflow-ai/src/app/api/email-recognitions/[id]/review/route.ts`
- `/Users/autumn/Documents/Codex/freightflow-ai/src/app/api/email-recognitions/route.ts`
- `/Users/autumn/Documents/Codex/freightflow-ai/src/app/api/email-sync/run/route.ts`
- `/Users/autumn/Documents/Codex/freightflow-ai/src/app/api/settings/email/route.ts`
- `/Users/autumn/Documents/Codex/freightflow-ai/src/app/api/shipments/route.ts`
- `/Users/autumn/Documents/Codex/freightflow-ai/src/app/api/shipments/[id]/route.ts`
- `/Users/autumn/Documents/Codex/freightflow-ai/src/app/api/shipments/[id]/actions/route.ts`
- `/Users/autumn/Documents/Codex/freightflow-ai/src/app/api/shipments/[id]/documents/so-recognition/route.ts`
- `/Users/autumn/Documents/Codex/freightflow-ai/src/app/api/shipments/[id]/documents/supplement-template/route.ts`
- `/Users/autumn/Documents/Codex/freightflow-ai/src/app/api/shipments/[id]/emails/route.ts`
- `/Users/autumn/Documents/Codex/freightflow-ai/src/components/workbench-shell.tsx`
- `/Users/autumn/Documents/Codex/freightflow-ai/src/features/freightflow/detail-panels.tsx`
- `/Users/autumn/Documents/Codex/freightflow-ai/src/features/freightflow/page-helpers.ts`
- `/Users/autumn/Documents/Codex/freightflow-ai/src/features/freightflow/page-helpers.test.ts`
- `/Users/autumn/Documents/Codex/freightflow-ai/src/features/freightflow/shared-ui.tsx`
- `/Users/autumn/Documents/Codex/freightflow-ai/src/features/freightflow/workbench-page.tsx`
- `/Users/autumn/Documents/Codex/freightflow-ai/src/lib/mock-data.ts`
- `/Users/autumn/Documents/Codex/freightflow-ai/src/lib/mock-data.test.ts`
- `/Users/autumn/Documents/Codex/freightflow-ai/src/lib/freightflow-data.ts`
- `/Users/autumn/Documents/Codex/freightflow-ai/src/lib/prisma.ts`
- `/Users/autumn/Documents/Codex/freightflow-ai/prisma/schema.prisma`
- `/Users/autumn/Documents/Codex/freightflow-ai/prisma/migrations/20260611175000_initial/migration.sql`
- `/Users/autumn/Documents/Codex/freightflow-ai/prisma/seed.mjs`
- `/Users/autumn/Documents/Codex/freightflow-ai/vitest.config.ts`
- `/Users/autumn/Documents/Codex/freightflow-ai/.env.example`
- `/Users/autumn/Documents/Codex/freightflow-ai/docs/handover.md`

## 5. 未完成任务

- 本机尚无可用 PostgreSQL 服务,因此 Prisma migration / seed 未实际落库验证。
- 前端主工作台尚未从 mock/useState 切到 shipment/contact API。
- 真实 IMAP 拉信尚未接入识别服务,当前同步接口仍用 mock message 入队。
- 邮件发送接口已有草稿发送路径，但真实 SMTP / 企业邮箱发送凭据尚未接入生产验证。
- 订舱附件生成目前是前端/接口模拟预览，尚未接入真实文件模板、文件上传和对象存储。
- 通讯录 API 已可持久化到 `contacts`,但 booking modal 尚未接入该 API。
- AI 接口虽然有代理路由，但未验证真实 OpenClaw 服务的返回协议稳定性。
- `OPENCLAW_API_URL`、`OPENCLAW_API_KEY` 仅预留，未形成完整部署说明。
- 页面已拆出 `workbench-page.tsx`、`detail-panels.tsx`、`workbench-shell.tsx` 等模块，但仍需继续收敛状态管理边界。
- `src/features/freightflow/shared-ui.tsx` 中的 `ActionTile` 已创建，但当前主页面仍使用本地 `ActionTile` 实现，尚未统一。
- 已有 Vitest 最小单测基线,但尚未配置覆盖率报告 / 覆盖率阈值。
- 没有 E2E 测试。
- 没有权限、登录、用户体系。
- 已有第一版后端业务 API,但尚缺前端接入与 API 单测覆盖。
- 没有文件上传、真实附件管理、SO 文件解析、补料模板生成、申报回执管理。
- 没有部署配置、环境区分、监控与日志方案。

## 6. 下一步建议

### 6.1 先做真实 IMAP / SMTP 闭环

建议优先完成：

1. 接入 IMAP 拉信并写入 email recognition 队列
2. 接入 SMTP 或企业邮箱 API 发送订舱邮件
3. 将“操作员确认后发送”记录成可审计日志
4. 将 SO 回传邮件识别结果写回 Shipment

优先级原因：

- 当前产品核心是内部操作工作台 + 自动化机器人中台
- 订舱邮件发送和代理 SO 回传是最小业务闭环
- 没有真实邮箱接入时，只能做演示，不能进入试运营

### 6.2 再做数据层落地

建议优先完成：

1. 设计真实数据库 schema
2. 把 `ShipmentRecord` 映射为后端实体
3. 把 mock data 替换为 API + 持久化数据

优先级原因：

- 当前大部分交互已经可演示，但数据不可持久化
- 如果继续堆前端能力而不落数据层，后续返工成本会更高

### 6.3 再做页面拆分

建议将 `src/app/page.tsx` 继续拆分为：

- `ShipmentDetailPanel`
- `ShipmentTimelinePanel`
- `ShipmentFieldPanel`
- `ShipmentActionPanel`
- `BookingModal`
- `AiCopilotPanel`

注意：

- 拆分时先抽纯展示组件，再抽交互逻辑
- booking modal 和 AI panel 都已经有较多状态，适合独立为 feature 组件

### 6.4 统一共享组件边界

建议下一轮整理时：

- 将主页面内本地 `ActionTile` 与 `shared-ui.tsx` 统一
- 明确哪些 helper 属于：
  - 页面专用 helper
  - freightflow feature helper
  - 全局 UI helper

### 6.5 扩展测试基线

已完成最小基线：

- `mock-data` 的纯函数测试
- booking draft 生成测试
- email 校验 helper 测试
- AI route 的基础请求测试

建议继续补充：

- 覆盖率报告与最低阈值
- API 数据层在 mock/stub DB 下的单测
- Playwright E2E 覆盖订舱主链路

### 6.6 真实业务接入顺序建议

推荐顺序：

1. shipment 数据持久化
2. 联系人 / 通讯录持久化
3. 动作日志持久化
4. 真实邮件发送
5. SO / 补料 / 申报文档流
6. AI 请求审计与历史记录

## 7. 最近验证记录

最近一次推送前验证：

```text
npm test      -> 8 files passed, 63 tests passed
npm run lint  -> passed
npm run build -> passed
```

最近相关提交：

```text
6f28469 fix: compact tracking cards and edit on click
246964a feat: show booking tracking details in queue cards
d100f59 fix: use modals for booking and shipment details
6174ed1 fix: keep queue page focused on shipment list
e466fcf feat: defer SO entry until release recognition
```

## 补充说明

- 当前项目可以正常构建，最近一次验证已通过 `npm run build`。
- 当前测试基线可通过 `npm test` 运行,最近一次验证为 3 个测试文件 / 26 个用例通过。
- 当前项目已有 Prisma schema、初始 migration SQL、Prisma Client 单例和 seed 脚本。
- 当前 `npm run prisma:seed` 因本机 PostgreSQL 不可达失败:`P1001 Can't reach database server at 127.0.0.1:5432`。
- 当前项目更接近“高保真前端操作台原型 + AI 代理入口”，还不是完整的生产业务系统。

## 8. 变更日志

### 2026-06-11 · P0 / 数据层/API / shipments 与 contacts

- 审核 Prisma schema 与 `ShipmentRecord` / `docs/database.md` 映射:主字段已在 `shipments` 1:1 覆盖;`documentProgress`、`exceptions`、`reminderFlags` 已拆表;`mailStatus`、`soStatus`、`documentStatus` 已用 enum 列覆盖;contacts/action logs/email logs/AI requests 已建模。
- 当前实际 schema 中 `AiRequest.shipmentId` 是外键并在 shipment 删除时置空;若后续仍需要 mock shipment 阶段写 AI 审计,需先确保 seed 已写入对应 shipment,或调整该外键约束。
- 新增 `src/lib/freightflow-data.ts`,集中处理:
  - Prisma 枚举名与前端中文字面量之间的转换。
  - Prisma shipment relations 到 `ShipmentRecord` 的序列化。
  - contacts 序列化与输入校验。
  - shipment action 状态推进与 action log 写入。
  - 数据库不可用时的 fallback 判定。
- 新增 API routes:
  - `GET /api/shipments`
  - `GET /api/shipments/[id]`
  - `POST /api/shipments/[id]/actions`
  - `GET /api/contacts`
  - `POST /api/contacts`
- 新增 `prisma/migrations/20260611175000_initial/migration.sql`,由 Prisma schema diff 生成初始 PostgreSQL DDL。
- 新增 `prisma/seed.mjs`,可从 `src/lib/mock-data.ts` 写入 6 条 shipment 和派生联系人。
- 更新 `docs/database.md`,记录 API 数据层、fallback 行为、migration/seed 路径和 Prisma enum 映射注意事项。
- 本轮未重构主工作台页面,未删除 `mock-data.ts`,前端仍可继续使用现有 mock/useState 工作流。
- 验证结果:
  - `npm run prisma:generate` 通过。
  - `npm run prisma:validate` 通过。
  - `npm run lint` 通过。
  - `npm run build` 通过。
  - `npm run prisma:seed` 未通过,阻塞原因是本机 PostgreSQL 不可达:`P1001 Can't reach database server at 127.0.0.1:5432`。

### 2026-06-11 · P1 / 测试、质量、发布基线

- 新增 Vitest 测试框架与 `npm test` 脚本。
- 新增 `vitest.config.ts`,配置 Node 测试环境和 `@/*` 路径别名。
- 新增纯函数测试:
  - `src/lib/mock-data.test.ts` 覆盖 `summarizeShipments` / `getAlertLevel`。
  - `src/features/freightflow/page-helpers.test.ts` 覆盖 `buildBookingDraft` / `buildContacts` / `normalizeEmail` / `isValidEmail` / `pickRecommendedAction`。
- 新增 OpenClaw route 测试:
  - `src/app/api/ai/openclaw/route.test.ts` 覆盖缺失 prompt、未配置 endpoint 的 stub 分支、配置 endpoint 的转发分支、fetch 失败的 502 分支。
  - route 测试使用 Vitest mock `fetch`,不依赖真实 OpenClaw 服务。
- 本轮测试不依赖 PostgreSQL、SMTP 或真实 OpenClaw;未修改 Prisma schema。
- 更新 `docs/todo.md` 与 `docs/project-overview.md`,将测试状态改为“已有最小基线,剩余覆盖率 / E2E / CI 缺口”。
- 验证结果:
  - `npm test` 通过:3 个测试文件 / 26 个用例。
  - `npm run lint` 通过。
  - `npm run build` 通过。

### 2026-06-11 · P1 / 前端结构整理 / 3.3 抽取其他详情面板

- 新增 `src/features/freightflow/detail-panels.tsx`,将单柜详情区拆成独立 feature 文件。
- 本轮拆出的 detail 组件包括:
  - `ShipmentDetailPanel`
  - `ShipmentTimelinePanel`
  - `ShipmentFieldPanel`
  - `ShipmentActionPanel`
  - `ShipmentCadencePanel`
- `src/app/page.tsx` 中原本内联的 detail 区块已改为组件装配,覆盖范围仅限:
  - 当前柜子
  - 时效与节点
  - 提醒与字段
  - 操作面板
  - 订舱节奏
- 页面层仍保留 `selectedShipment` 派生、推荐动作计算、节奏判断和点击事件编排,因此没有改变现有信息层级、文案表达或动作行为。
- booking modal、AI 面板、队列导航、数据库层未在本轮扩张改动。
- 顺手清理了 detail 区拆分后 `page.tsx` 中部分不再使用的常量与引用。
- 验证结果:
  - `npm run build` 未能完成,阻塞原因是当前环境对 `.next/trace-build` 的写入权限限制(`EPERM`),不是本轮 detail 组件拆分导致的页面编译报错。
  - 追加执行 `./node_modules/.bin/tsc --noEmit --incremental false` 后,未再暴露本轮 detail 拆分新增的页面类型错误。
  - 当前剩余 TypeScript 报错为项目既有问题:`src/lib/prisma.ts` 中 `@prisma/client` 未导出 `PrismaClient`,说明 Prisma 生成物或依赖状态与源码不一致,不属于本轮前端 detail 拆分回归。

### 2026-06-11 · P1 / 前端结构整理 / 3.1 抽取 BookingModal

- 将 booking modal 从 `src/app/page.tsx` 抽离到独立 feature 文件:
  - 新增 `src/features/freightflow/booking-modal.tsx`
- `BookingModal` 内部一并收纳了原本内联在 `page.tsx` 的局部视图块:
  - `BookingAddressField`
  - `BookingContactCard`
- `src/app/page.tsx` 现在仅保留 booking modal 的状态、派生数据与事件处理函数,底部改为通过 `<BookingModal />` 进行渲染。
- 本轮未改 AI 副驾、队列导航、数据库层或业务规则,目标仅为前端结构整理。
- 行为约束:
  - 保持原有 UI 结构不变
  - 保持原有收件人 / 抄送 / 通讯录 / 检查项 / 发送交互不变
  - 未调整 booking modal 的业务规则与状态推进逻辑
- 验证结果:
  - `npm run build` 未通过,失败原因仍为 `next/font/google` 拉取 `Geist` / `Geist Mono` 时的网络错误,不是本轮 `BookingModal` 拆分导致。
  - `npm run lint` 未通过,现有阻塞项来自 `src/app/page.tsx` 中 AI 相关历史问题与项目内 `src/lib/prisma.ts` 的既有问题,不属于本轮 modal 拆分引入。
  - `npx tsc --noEmit` 对本轮拆分后的页面与新 modal 文件未暴露新的 booking modal 类型错误;当前唯一报错为项目既有的 `src/lib/prisma.ts` 与 `@prisma/client` 现状不匹配。
  - 后续收尾再次执行 `npm run lint` 后,`BookingModal` 拆分带来的无用 import 已清理完毕;当前仅剩 3 条既有 warning:
    - `src/app/page.tsx` 中 `Search` 未使用
    - `src/app/page.tsx` 中 AI 相关 `useEffect` 缺少 `handleCloseBooking` 依赖
    - `src/lib/prisma.ts` 中无效的 eslint-disable 指令

### 2026-06-11 · P1 / 前端结构整理 / 3.4 统一共享组件边界

- 统一了 `ActionTile` 的实现来源:删除 `src/app/page.tsx` 内本地 `ActionTile`,改为统一使用 `src/features/freightflow/shared-ui.tsx` 导出的 `ActionTile`。
- 扩展了 `shared-ui.tsx` 中 `ActionTile` 的能力,使其承载页面所需的 `highlight` 和 `status` 展示,从而成为唯一 UI 来源。
- 清理了 helper 归属:
  - 将 `pickRecommendedAction` 从 `src/app/page.tsx` 下沉到 `src/features/freightflow/page-helpers.ts`
  - 将 `toneClass / toneBadgeClass / progressTone / waitingTone / cutoffTone / contactRoleBadgeClass` 统一收口到 `src/features/freightflow/page-helpers.ts`
- 当前边界约定更新为:
  - `src/features/freightflow/page-helpers.ts`:freightflow 业务 helper、状态推导、样式语义映射
  - `src/features/freightflow/shared-ui.tsx`:freightflow 共享展示组件
  - `src/app/page.tsx`:页面装配、状态组织、事件编排
- 本轮未修改 booking modal 的流程逻辑、AI 面板结构、数据库层或 API 协议。
- 验证结果:
  - 代码搜索确认 `ActionTile` 仅剩 `src/features/freightflow/shared-ui.tsx` 一处实现来源。
  - 运行 `npm run build` 时,代码本身未暴露新的类型错误,但构建在 `next/font/google` 拉取 `Geist` / `Geist Mono` 阶段失败,原因是当前环境无法访问 Google Fonts,属于网络依赖问题而非本轮结构整理回归。

### 2026-06-11 · 文档体系搭建

- 新增 `docs/project-overview.md`(项目边界、技术栈、目录、运行命令、已知限制)。
- 新增 `docs/business-rules.md`(19 个 `ShipmentStatus`、5 个看板列映射、红黄绿告警阈值、催单 / 截补料 / 各状态机)。
- 新增 `docs/database.md`(当前无 DB 事实、`ShipmentRecord` 字段表、未来 8 张表草案)。
- 新增 `docs/todo.md`(P0–P3 待办 + 验收标准 + 下次开工顺序)。
- 约定:本 `handover.md` 作为变更日志,4 份新文档为稳定契约,任何契约级变更都需同步追加一条本节记录。

### 2026-06-11 · 5 个并行子项目总控启动

- 新增 `docs/master-plan.md`,记录 5 个并行子项目职责、线程 ID、依赖顺序与全局验收命令。
- 创建并固定 5 个 Codex 子线程:
  - `019eb60b-d19e-7c01-a522-dc5c6891a638`:数据层/API
  - `019eb60b-f90f-7871-ae81-db5d10799f11`:邮件与文档流
  - `019eb60c-1c1b-7380-918c-dff865d8cf2b`:前端拆分
  - `019eb60c-3e23-7cf0-b78c-540552c7aeea`:AI 审计
  - `019eb60c-60b2-73e0-9ae0-9f1ae0af5943`:测试发布基线
- 总控检查发现当前代码库已新增 Prisma 数据层文件:`prisma/schema.prisma`、`prisma.config.ts`、`src/lib/prisma.ts`。
- 已验证 `npm run prisma:validate` 通过,`npm run lint` 通过。
- 更新 `docs/project-overview.md`,补充 `master-plan.md` 入口和 Prisma 脚本说明。

### 2026-06-11 · P0 数据层落地第 1 步: Prisma 基础工程

- 新增 `prisma/schema.prisma`,选型落地为 `PostgreSQL + Prisma`。
- 在 schema 中建立了核心枚举与核心表:
  - `shipments`
  - `shipment_document_progress`
  - `shipment_exceptions`
  - `shipment_reminder_flags`
  - `contacts`
  - `shipment_action_logs`
  - `shipment_email_logs`
  - `shipment_email_recipients`
  - `ai_requests`
- `Shipment` 主字段已按 `ShipmentRecord` 对齐,其中 `documentProgress` 拆为独立表,`exceptions` / `reminderFlags` 拆为明细表。
- 新增 `src/lib/prisma.ts` 作为 PrismaClient 单例入口,但尚未接入任何真实后端 API 或前端 fetch 流程。
- 扩展 `.env.example`,新增 `DATABASE_URL`。
- 扩展 `package.json` Prisma 脚本:
  - `prisma:generate`
  - `prisma:validate`
  - `prisma:format`
  - `prisma:migrate:dev`
  - `prisma:migrate:deploy`
- 本轮未改现有前端业务行为,仍然使用 `src/lib/mock-data.ts` 驱动 UI。
- 本轮验证以本地 Prisma 工程校验为主;未创建真实数据库,也未执行 migration 到外部 Postgres。
- 验证结果:
  - `npm run prisma:validate` 通过。
  - `npm run prisma:format` 未完成,受当前线程文件系统权限限制(`EPERM`)影响。
  - `npm run prisma:generate` 未完成,受当前线程对 `node_modules/.prisma` 写入限制(`EPERM`)影响。

### 2026-06-11 · Prisma schema 验证续跑

- 补充了本地 `.env` 以提供 `DATABASE_URL`,让 Prisma 7 CLI 可以稳定加载 `prisma.config.ts`。
- 再次确认 `npm run prisma:validate` 通过,说明当前 `prisma/schema.prisma` 结构有效。
- `npm run prisma:generate` 仍失败,原因未变化:当前线程对 `node_modules/.prisma` 目录无写权限(`EPERM`),不是 schema 语法问题。

### 2026-06-11 · P1 / 前端结构整理 / 3.2 抽取 AiCopilotPanel

- 按 `docs/todo.md` 中 `3.2 抽取 AiCopilotPanel` 执行,将 AI 副驾面板从 `src/app/page.tsx` 抽离到独立 feature 文件:
  - 新增 `src/features/freightflow/ai-copilot-panel.tsx`
- 新组件保留了原有 AI 交互与表现:
  - 快捷 prompts
  - 自定义 prompt 编辑
  - 请求状态展示(`idle / loading / success / error`)
  - 长文本回复的段落 / 列表渲染
  - 响应式布局与加载态 skeleton
- `src/app/page.tsx` 现在仅保留 AI 的状态、请求逻辑与事件分发,通过 props 将状态和行为传给 `AiCopilotPanel`。
- 为适配当前 ESLint 规则,将“切换 shipment 时重置 AI 状态”的逻辑从 `useEffect` 改为显式事件驱动:
  - 在 `handleColumnChange` 中重置
  - 在 `handleSelectShipment` 中重置
- 本轮未修改 booking modal、队列导航组件、数据库层或业务规则。
- 本轮涉及文件:
  - `src/app/page.tsx`
  - `src/features/freightflow/ai-copilot-panel.tsx`
- 验证结果:
  - `npm run lint` 无 error; 当前仅剩 2 条项目 warning:
    - `src/app/page.tsx` 中 booking 相关 `useEffect` 的 `react-hooks/exhaustive-deps` warning
    - `src/lib/prisma.ts` 中 1 条 unused eslint-disable warning
  - `npm run build` 未通过,失败原因仍为 `next/font/google` 拉取 `Geist` / `Geist Mono` 失败,属于当前环境网络问题,不是本轮 AI 面板拆分导致的代码错误。

### 2026-06-11 · 主线程集成收口

- 已将并行线程产出的 5 组改动纳入当前主线代码树:
  - `P0 / Prisma schema`
  - `P1 / 抽取 BookingModal`
  - `P1 / 抽取 AiCopilotPanel`
  - `P1 / 抽取其他详情面板`
  - `P1 / 统一共享组件边界`
- 当前 `src/features/freightflow/` 已稳定包含:
  - `booking-modal.tsx`
  - `ai-copilot-panel.tsx`
  - `detail-panels.tsx`
  - `page-helpers.ts`
  - `shared-ui.tsx`
- 当前 `prisma/` 已落成 `schema.prisma`,并补齐 `prisma.config.ts` 与 `src/lib/prisma.ts`。
- 本轮主线程额外清理了 2 个非阻塞 warning:
  - `src/app/page.tsx` 中 booking modal Escape 监听 effect 的依赖问题
  - `src/lib/prisma.ts` 中多余的 `eslint-disable` 指令
- 当前主线程验证结果:
  - `npm run lint` 通过
  - `npm run prisma:validate` 通过
  - 本地开发服务器首页返回 `200 OK`

### 2026-06-11 · 订舱工作台整体模块下沉

- 为避免 `src/app/page.tsx` 再次膨胀,已将整块“订舱工作台”页面主体下沉为 feature 模块:
  - 新增 `src/features/freightflow/workbench-page.tsx`
  - `src/app/page.tsx` 现在仅作为 5 行的路由壳文件,负责渲染 `FreightflowWorkbenchPage`
- 本轮未改变业务行为,仅做结构调整:
  - 队列筛选
  - 单柜详情
  - booking modal
  - AI 副驾
  - 动作流与 toast
  均保持原有交互和状态逻辑
- 本轮目标是把“路由入口文件”与“工作台实现”分离,后续继续拆分看板或状态逻辑时,不再把复杂度堆回 `src/app/page.tsx`
- 验证结果:
  - `npm run lint` 通过

### 2026-06-11 · P1 / 前端拆分接入收口

- 确认当前 `src/app/page.tsx` 已是 5 行路由壳,主工作台实现位于 `src/features/freightflow/workbench-page.tsx`。
- 修复集成后遗漏的 booking modal 接入:
  - `订舱邮件` 动作重新打开 `BookingModal`
  - 恢复收件人 / 抄送输入、通讯录新增、联系人加入收件人 / 抄送、Escape 关闭、发送中锁定和模拟发送
  - 发送仍为前端本地模拟,只更新内存中的 `mailStatus`、`lastEmailTime` 与必要时的 `status`,未接真实 API / SMTP
- 继续统一 `ActionTile` 边界:
  - 删除 `detail-panels.tsx` 中的局部动作卡片实现
  - 扩展 `shared-ui.tsx` 的 `ActionTile` 支持 `statusClassName`,保留 detail 面板原有状态徽标样式
  - 代码搜索确认 `ActionTile` 只有 `shared-ui.tsx` 一个实现来源
- 更新文档:
  - `docs/project-overview.md` 同步当前 feature 文件结构
  - `docs/todo.md` 将前端拆分项更新为已完成 / 后续真实接入
  - `docs/database.md` 同步工作台状态位置从 `src/app/page.tsx` 改为 `workbench-page.tsx`
- 验证结果:
  - `npm run lint` 通过
  - `npm test` 通过,3 个测试文件 / 26 个用例全部通过
  - `npm run build` 通过

### 2026-06-11 · P1 / AI 副驾请求审计

- 审核并增强 `src/app/api/ai/openclaw/route.ts`:
  - 保留原有 stub 模式响应结构: `mode / message / reply / forwarded / shipmentId`
  - 保留原有 proxy 模式响应结构: `mode / forwarded / status / data`
  - 请求开始写入 `ai_requests` 为 `LOADING`
  - stub / proxy 成功后更新为 `SUCCESS`,记录 reply 与 `responseTimeMs`
  - 外部 OpenClaw 非 2xx 或 fetch 异常时更新为 `ERROR`,记录 `errorMessage` 与耗时
- 审计字段覆盖: `prompt`、`shipmentId`、`requestContext`、`provider`、`endpoint`、`reply`、`responseTimeMs`、`errorMessage`、`createdAt`、`completedAt`。
- 审计写入采用优雅降级:数据库不可用时仅输出 server warning,不影响 `/api/ai/openclaw` 的 stub/proxy 返回。
- 新增 `src/app/api/ai/requests/route.ts`:
  - 支持 `GET /api/ai/requests?shipmentId=...`
  - 默认最多返回最近 50 条
  - 数据库不可用时返回 `{ requests: [], degraded: true }`,供未来 AI 历史面板安全接入
- 调整 `prisma/schema.prisma` 中 `AiRequest.shipmentId` 为逻辑关联字段,暂不强制外键到 `shipments`,避免当前 mock shipment 尚未落库时审计写入失败。
- 修复 Prisma 7 client 初始化:新增 `@prisma/adapter-pg` 与 `pg`,并在 `src/lib/prisma.ts` 用 `PrismaPg` adapter 构造 `PrismaClient`,消除 `npm run build` 收集 API route 时的 adapter 缺失错误。
- 更新 `docs/database.md` 与 `docs/todo.md`,同步当前 Prisma 与 AI 审计事实。
- 验证结果:
  - `npm run prisma:generate` 通过
  - `npm run prisma:validate` 通过
  - `npm run lint` 通过
  - `npx tsc --noEmit --incremental false` 通过
  - `npm run build` 通过

### 2026-06-11 · P0/P1 / 邮件与文档流最小抽象

- 新增最小可用的邮件发送抽象,供 booking modal 后续接入:
  - `src/lib/services/email/types.ts`
  - `src/lib/services/email/mock-provider.ts`
  - `src/lib/services/email/email-service.ts`
- 邮件服务当前默认使用本地 `mock-local` provider,不连接真实 SMTP;provider 返回 `providerMessageId / accepted / rejected / sentAt`。
- 邮件服务已按 Prisma schema 保存:
  - `shipment_email_logs.subject / body / attachmentName / sentAt`
  - `shipment_email_recipients.email / recipientType(TO / CC)`
- 新增邮件 API:
  - `GET /api/shipments/[shipmentId]/emails` 查询某票邮件日志与 recipients
  - `POST /api/shipments/[shipmentId]/emails` 接收 `subject / body / attachmentName / to / cc / recipients`,发送 mock 邮件后保存 log
- 注意:邮件 API 当前要求真实数据库中存在对应 `shipmentId`,因为 `shipment_email_logs.shipmentId` 仍按 schema 外键关联 `shipments`;真实 DB 未 seed shipment 时会返回 Prisma 写入错误。
- 新增最小可替换文档流服务层:
  - `src/lib/services/documents/document-service.ts`
- 新增文档流占位 API:
  - `POST /api/shipments/[shipmentId]/documents/so-recognition` 接收 `fileName / mimeType / sourceText`,返回 SO 识别占位结果、置信度与 OCR 待接入提醒
  - `POST /api/shipments/[shipmentId]/documents/supplement-template` 接收 `templateType / language / shipment`,返回补料模板 JSON 字段清单
- 本轮未修改 `src/app/page.tsx`,避免与前端拆分线程冲突;booking modal 尚未接入新邮件 API。
- 仍未完成:
  - 真实 SMTP / 邮件中心 provider
  - IMAP 收件箱同步
  - 附件上传与文件存储
  - 真实 OCR / SO parser
  - Word / Excel 补料模板文件生成
- 更新 `docs/todo.md`,将邮件与文档流条目标为“最小抽象已完成,真实 SMTP/OCR 仍需接入”。
- 验证结果:
  - `npm run prisma:generate` 通过
  - `npm run prisma:validate` 通过
  - `npm run lint` 通过
  - `./node_modules/.bin/tsc --noEmit --incremental false` 通过
  - `npm run build` 通过

### 2026-06-12 · 前端工作台接入 API fallback

- 新增 `src/features/freightflow/api-client.ts`,封装前端 API 调用:
  - `loadShipmentsFromApi()` → `GET /api/shipments`
  - `loadContactsFromApi()` → `GET /api/contacts`
  - `persistContact()` → `POST /api/contacts`
  - `persistShipmentAction()` → `POST /api/shipments/[id]/actions`
- 更新 `src/features/freightflow/workbench-page.tsx`:
  - 页面启动后异步读取 shipments / contacts API
  - 点击刷新按钮时重新读取 API
  - 无 PostgreSQL 时接收服务端 mock fallback,页面继续可演示
  - 新增联系人先更新本地通讯录,再后台尝试持久化;失败时 toast 提示并保留本地状态
  - 催单 / 补料 / SO / AMS/ACI/ISF / 异常动作先更新本地 UI,再后台尝试写 action log;失败时 toast 提示未持久化
  - booking modal 发送后仍保留本地演示状态,并后台尝试记录 `订舱邮件` 动作
- 运行时验证:
  - `GET /api/shipments` 在无 PostgreSQL 时返回 `{ source: "mock", count: 6 }`
  - `GET /api/contacts` 在无 PostgreSQL 时返回 `{ source: "mock", count: 12 }`
  - 浏览器首页正常渲染,AI 面板显示服务端 mock 已载入,控制台无 error/warn
- 验证结果:
  - `npm run prisma:validate` 通过
  - `npm run lint` 通过
  - `npm test` 通过,3 个测试文件 / 26 个用例
  - `npm run build` 通过

### 2026-06-12 · BookingModal 接入邮件 API

- 更新 `src/features/freightflow/api-client.ts`:
  - 新增 `sendBookingEmail()`
  - 调用 `POST /api/shipments/[id]/emails`
  - 发送 `subject / body / attachmentName / to / cc`
- 更新 `src/features/freightflow/workbench-page.tsx`:
  - booking modal 点击“确认发送订舱”时优先调用邮件 API
  - API 成功时提示“订舱邮件已发送并记录”
  - API 失败时仍保留本地演示发送状态,并提示未持久化原因
  - 继续后台尝试 `POST /api/shipments/[id]/actions` 记录 `订舱邮件` 动作
- 当前限制:
  - 邮件 provider 仍为 `mock-local`,尚未接真实 SMTP
  - 因 `shipment_email_logs.shipmentId` 是真实外键,无 PostgreSQL 或未 seed shipment 时邮件 API 会失败;前端已回退本地演示状态
- 下一步建议:
  - 启动 PostgreSQL,执行 migration/seed,验证 booking modal 发送后 email log 与 recipients 落库
  - 再接真实 SMTP provider,并保留 mock/local fallback 作为开发模式
- 验证结果:
  - `npm run prisma:validate` 通过
  - `npm run lint` 通过
  - `npm test` 通过,3 个测试文件 / 26 个用例
  - `npm run build` 通过

### 2026-06-12 · 左侧设置接入 OpenClaw 配置窗口

- 新增 `src/lib/openclaw-config.ts`:
  - 本地配置文件路径为 `.freightflow/openclaw-config.json`
  - 配置项:`enabled / endpoint / apiKey / model / timeoutMs / updatedAt`
  - `.freightflow/` 已加入 `.gitignore`,避免 API Key 被误提交
  - 无本地配置时回退 `.env` 中的 `OPENCLAW_API_URL / OPENCLAW_API_KEY / OPENCLAW_MODEL / OPENCLAW_TIMEOUT_MS`
- 新增 `src/app/api/settings/openclaw/route.ts`:
  - `GET /api/settings/openclaw` 返回脱敏配置,仅暴露 `apiKeyConfigured`
  - `POST /api/settings/openclaw` 保存配置
  - `POST` 带 `test: true` 时会真实向 endpoint 发测试请求,返回 `ok / status / responseTimeMs / message`
- 更新 `src/app/api/ai/openclaw/route.ts`:
  - 优先读取设置窗口保存的本地配置
  - 仅当 `enabled && endpoint` 时转发到 OpenClaw
  - 请求会带 `Authorization: Bearer <apiKey>` 与可选 `model`
  - 支持 `timeoutMs` 超时中断
- 新增 `src/features/freightflow/openclaw-settings-modal.tsx`:
  - 左侧导航“设置”点击后打开 OpenClaw 配置弹窗
  - 支持启用开关、endpoint、API Key 显隐、model、timeout、保存、保存并测试
- 更新 `src/features/freightflow/workbench-page.tsx` 与 `src/features/freightflow/api-client.ts`:
  - 页面启动读取当前 OpenClaw 设置
  - 保存后 toast 提示并即时影响 AI 副驾后续请求
- 更新 `next.config.ts`:
  - 加入 `allowedDevOrigins: ["127.0.0.1"]`,解决内置浏览器通过 `127.0.0.1:3000` 访问 Next dev 时 HMR/dev 资源被拦导致交互不可用的问题
- 测试补充:
  - `src/app/api/ai/openclaw/route.test.ts` 增加“保存配置优先于环境变量”的用例
  - 当前测试总数 27 个
- UI 验证:
  - 通过浏览器打开 `http://127.0.0.1:3000`
  - 点击左侧“设置”后可见 `OpenClaw 配置 / 服务地址 Endpoint / 保存并测试`
  - 浏览器控制台无 error/warn
- 验证结果:
  - `npm run prisma:validate` 通过
  - `npm run lint` 通过
  - `npx tsc --noEmit --incremental false` 通过
  - `npm test` 通过,3 个测试文件 / 27 个用例
  - `npm run build` 通过

### 2026-06-13 · 设置接入 IMAP/SMTP 邮箱模块

- 新增/更新邮箱配置能力:
  - `src/lib/email-config.ts` 支持 `.freightflow/email-config.json`
  - 配置项覆盖 `enabled / smtpHost / smtpPort / smtpSecure / imapHost / imapPort / imapSecure / username / password / fromEmail / fromName / replyTo / updatedAt`
  - 无本地配置时回退 `.env` 中的 SMTP/IMAP 环境变量
  - 兼容早期 `host / port / secure` 字段,自动映射为 SMTP 字段
- 新增依赖:
  - `nodemailer` / `@types/nodemailer`
  - `imapflow` / `@types/imapflow`
- 新增/更新服务层:
  - `src/lib/services/email/smtp-provider.ts` 使用 SMTP 真发送
  - `src/lib/services/email/imap-client.ts` 使用 IMAP 登录并打开 INBOX 验证收信服务
  - `src/lib/services/email/mock-provider.ts` 会根据邮箱配置选择 `smtp` 或 `mock-local`
- 新增 `src/app/api/settings/email/route.ts`:
  - `GET /api/settings/email` 返回脱敏邮箱配置,仅暴露 `passwordConfigured`
  - `POST /api/settings/email` 保存配置
  - `POST` 带 `test: true` 时同时测试 SMTP 与 IMAP,返回总结果和分项结果
- 更新设置 UI:
  - `src/features/freightflow/openclaw-settings-modal.tsx` 由 OpenClaw 单页弹窗升级为“集成配置”弹窗
  - 左侧 tab 包含 `OpenClaw` 与 `邮箱服务`
  - 邮箱页包含“发信 SMTP”和“收信 IMAP”两组 host/port/SSL 配置,以及用户名、授权码、发件人、Reply-To
  - 按钮文案改为“保存并测试 IMAP/SMTP”
- 更新前端接线:
  - `src/features/freightflow/api-client.ts` 增加 email settings API client 类型和函数
  - `src/features/freightflow/workbench-page.tsx` 页面启动读取邮箱配置,保存后 toast 提示
- 运行时说明:
  - 邮箱服务商后台必须开启 IMAP/SMTP 服务;多数企业邮箱/QQ/163/Gmail 需要使用授权码而不是登录密码
  - SMTP 用于订舱邮件真发送,IMAP 为后续收回执、同步回复、SO 邮件识别打基础
  - PostgreSQL 未启动或 shipment 未 seed 时,email log 外键写入仍会失败,前端保持本地演示回退
- UI 验证:
  - 通过浏览器打开 `http://127.0.0.1:3000`
  - 点击左侧“设置”→“邮箱服务”后可见 `启用 IMAP / SMTP 邮箱服务 / 发信 SMTP / 收信 IMAP / 保存并测试 IMAP/SMTP`
  - 浏览器控制台无 error/warn
- 验证结果:
  - `npm run lint` 通过
  - `npx tsc --noEmit --incremental false` 通过
  - `npm test` 通过,4 个测试文件 / 29 个用例
  - `npm run build` 通过
# 2026-06-13 · 待发订舱计划 Phase 1

- 新增产品设计文档: `docs/superpowers/specs/2026-06-13-freightflow-ai-ops-mail-workbench-design.md`。
- 新增实施计划: `docs/superpowers/plans/2026-06-13-booking-plans-phase-1.md`。
- 新增待发订舱计划纯规则: `src/features/freightflow/booking-plan-rules.ts`,覆盖资料完整度、中文订舱草稿和批量结果统计。
- 新增待发订舱计划面板: `src/features/freightflow/booking-plan-panel.tsx`,工作台可查看待处理、可生成、草稿待确认数量并批量生成草稿。
- 新增 Prisma 模型和迁移: `booking_plans`, `email_drafts`, `booking_draft_batches`。
- 新增 API: `GET /api/booking-plans`, `POST /api/booking-plans/batch-drafts`, `GET/PATCH /api/email-drafts/[draftId]`, `POST /api/email-drafts/[draftId]/send`。
- 重要边界:批量操作只生成中文订舱草稿,不会自动发送;发送仍走单票人工确认。
- 验证: `npm run prisma:validate`, `npm run lint`, `npm test`, `npm run build` 均通过。

# 2026-06-13 · IMAP 邮件识别队列 Phase 2

- 新增实施计划: `docs/superpowers/plans/2026-06-13-imap-recognition-phase-2.md`。
- 新增邮件识别纯规则: `src/features/freightflow/email-recognition-rules.ts`,覆盖 SO 回传、订舱回复、补料确认、催单回复、异常、未知。
- 新增邮件识别服务: `src/lib/services/email-recognition/email-recognition-service.ts`,支持 mock 同步、messageId 去重、识别结果入队和数据库不可用 fallback。
- 新增 Prisma 模型和迁移: `email_messages`, `email_recognition_results`。
- 新增 API: `POST /api/email-sync/run`, `GET /api/email-recognitions`。
- 新增工作台面板: `src/features/freightflow/email-recognition-panel.tsx`,显示待确认、异常、已匹配统计和同步邮箱按钮。
- 重要边界:本阶段只同步、识别、入队和展示,不自动写回 Shipment。
- 验证: `npm run lint`, `npm test`, `npm run build` 均通过。

# 2026-06-18 · 模块整合与左侧主入口收口

- 重新拉取 GitHub 仓库并在 `codex/complete-modules` 分支整合远端 `codex/booking-plans-phase-1` 增强基线。
- 新增/吸收模块:
  - 订舱计划与邮件草稿: `booking_plans`, `email_drafts`, `booking_draft_batches`, 批量生成草稿与单票确认发送。
  - 邮件识别: `email_messages`, `email_recognition_results`, IMAP/mock 拉信、规则识别、人工审核写回。
  - Repository 层: mock + Prisma 双实现,覆盖 shipment / contact / booking plan / email draft / email message / recognition。
  - 文档生成: DOCX 托书与 XLSX 补料表下载 API,新增 `docx` / `xlsx` 依赖与模板文件。
- 新增 `src/features/freightflow/module-panels.tsx`:
  - `SO识别中心`:待识别 SO、SO/订舱回复邮件队列、人工审核入口。
  - `补料中心`:补料状态汇总、当前柜生成补料、逐票下载补料表。
  - `AMS/ACI/ISF`:申报进度汇总、当前柜推进申报、逐票明细入口。
  - `邮件中心`:待发订舱计划、批量生成草稿、邮箱设置入口、邮件识别队列。
  - `异常中心`:红色异常、黄色预警、当前柜异常切换、逐票明细入口。
- 更新 `src/features/freightflow/workbench-page.tsx`:
  - 左侧主导航不再只切换标题;除订舱工作台外,其它主模块会进入对应工作面板。
  - 增加待发订舱计划多选状态与批量草稿生成处理。
  - 设置弹窗支持从邮件中心直达邮箱 tab。
- 更新数据库 fallback:
  - `src/lib/prisma.ts` 导出 `isDatabaseConfigured()`。
  - `src/lib/repositories/index.ts` 与 `src/app/api/contacts/route.ts` 使用同一配置判断。
  - 未配置 `DATABASE_URL` 时联系人 API 直接返回 mock/503,不再先触发 Prisma 连接错误日志。
- 开源参考扫描:
  - 查看 `loadpartner/tms`、`fleetbase/fleetbase`、`AgileShift/cargo_management`、`MustafaYamin/logistics-crm-nextjs`、邮件摄取类 TypeScript 项目。
  - 结论:其中 AGPL、Other 或无许可证项目较多,本次只参考 TMS 模块边界、邮件摄取队列和操作台组织方式,未复制外部代码。
- 文档更新:
  - `docs/project-overview.md` 标记左侧主模块已接入真实面板,并记录开源参考取舍。
  - `docs/todo.md` 更新文档生成、主模块入口和 E2E 验收建议。
- 验证结果:
  - `npm install` 成功。
  - `npm run prisma:generate` 成功。
  - `npm run prisma:validate` 通过。
  - `npm run lint` 通过。
  - `npm test` 通过,17 个测试文件 / 108 个用例。
  - `npm run build` 通过。
  - 本地 dev server `http://127.0.0.1:3000` 启动成功;首页 200,`/api/shipments`、`/api/contacts`、`/api/email-recognitions` 均以 mock source 返回正常数据。
