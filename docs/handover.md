# FreightFlow AI Handover

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
  - 选中单柜后展示当前上下文
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
- 已完成 `/api/ai/openclaw` 路由：
  - 未配置环境变量时返回 stub 响应
  - 配置 `OPENCLAW_API_URL` 后转发到外部服务
- 已完成第一版 Next.js API 数据层：
  - `GET /api/shipments`
  - `GET /api/shipments/[id]`
  - `POST /api/shipments/[id]/actions`
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
│   └── handover.md
├── public/
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── ai/
│   │   │       └── openclaw/
│   │   │           └── route.ts
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   └── workbench-shell.tsx
│   ├── features/
│   │   └── freightflow/
│   │       ├── page-helpers.ts
│   │       └── shared-ui.tsx
│   └── lib/
│       └── mock-data.ts
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
  carrier: string;
  originPort: string;
  transitPort: string;
  destinationPort: string;
  containerType: string;
  vesselVoyage: string;
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
- `/Users/autumn/Documents/Codex/freightflow-ai/src/app/api/contacts/route.ts`
- `/Users/autumn/Documents/Codex/freightflow-ai/src/app/api/shipments/route.ts`
- `/Users/autumn/Documents/Codex/freightflow-ai/src/app/api/shipments/[id]/route.ts`
- `/Users/autumn/Documents/Codex/freightflow-ai/src/app/api/shipments/[id]/actions/route.ts`
- `/Users/autumn/Documents/Codex/freightflow-ai/src/components/workbench-shell.tsx`
- `/Users/autumn/Documents/Codex/freightflow-ai/src/features/freightflow/page-helpers.ts`
- `/Users/autumn/Documents/Codex/freightflow-ai/src/features/freightflow/page-helpers.test.ts`
- `/Users/autumn/Documents/Codex/freightflow-ai/src/features/freightflow/shared-ui.tsx`
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
- booking modal 仍然是前端本地模拟发送，没有真实 SMTP / 邮件服务集成。
- 通讯录 API 已可持久化到 `contacts`,但 booking modal 尚未接入该 API。
- AI 接口虽然有代理路由，但未验证真实 OpenClaw 服务的返回协议稳定性。
- `OPENCLAW_API_URL`、`OPENCLAW_API_KEY` 仅预留，未形成完整部署说明。
- 页面仍然较大，`src/app/page.tsx` 还没有完全拆成 feature-level 组件。
- `src/features/freightflow/shared-ui.tsx` 中的 `ActionTile` 已创建，但当前主页面仍使用本地 `ActionTile` 实现，尚未统一。
- 已有 Vitest 最小单测基线,但尚未配置覆盖率报告 / 覆盖率阈值。
- 没有 E2E 测试。
- 没有权限、登录、用户体系。
- 已有第一版后端业务 API,但尚缺前端接入与 API 单测覆盖。
- 没有文件上传、真实附件管理、SO 文件解析、补料模板生成、申报回执管理。
- 没有部署配置、环境区分、监控与日志方案。

## 6. 下一步建议

### 6.1 先做数据层落地

建议优先完成：

1. 设计真实数据库 schema
2. 把 `ShipmentRecord` 映射为后端实体
3. 把 mock data 替换为 API + 持久化数据

优先级原因：

- 当前大部分交互已经可演示，但数据不可持久化
- 如果继续堆前端能力而不落数据层，后续返工成本会更高

### 6.2 再做页面拆分

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

### 6.3 统一共享组件边界

建议下一轮整理时：

- 将主页面内本地 `ActionTile` 与 `shared-ui.tsx` 统一
- 明确哪些 helper 属于：
  - 页面专用 helper
  - freightflow feature helper
  - 全局 UI helper

### 6.4 扩展测试基线

已完成最小基线：

- `mock-data` 的纯函数测试
- booking draft 生成测试
- email 校验 helper 测试
- AI route 的基础请求测试

建议继续补充：

- 覆盖率报告与最低阈值
- API 数据层在 mock/stub DB 下的单测
- Playwright E2E 覆盖订舱主链路

### 6.5 真实业务接入顺序建议

推荐顺序：

1. shipment 数据持久化
2. 联系人 / 通讯录持久化
3. 动作日志持久化
4. 真实邮件发送
5. SO / 补料 / 申报文档流
6. AI 请求审计与历史记录

## 补充说明

- 当前项目可以正常构建，最近一次验证已通过 `npm run build`。
- 当前测试基线可通过 `npm test` 运行,最近一次验证为 3 个测试文件 / 26 个用例通过。
- 当前项目已有 Prisma schema、初始 migration SQL、Prisma Client 单例和 seed 脚本。
- 当前 `npm run prisma:seed` 因本机 PostgreSQL 不可达失败:`P1001 Can't reach database server at 127.0.0.1:5432`。
- 当前项目更接近“高保真前端操作台原型 + AI 代理入口”，还不是完整的生产业务系统。

## 7. 变更日志

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

### 2026-07-06 · 马尾辫结构重整:共享 shipment 动作状态机

- 拉取 GitHub 仓库 `zqj372-ops/FreightFlow-AI` 到 `/Users/autumn/Documents/订舱邮件AI系统/FreightFlow-AI`。
- 新增 `src/lib/freightflow-domain.ts`:
  - 承接 `ContactRole / ContactRecord / DetailActionLabel / ShipmentActionRequest` 等共享业务类型。
  - 承接 `applyShipmentAction`,让前端本地演示状态和 API 持久化动作共用同一套 shipment 状态推进逻辑。
  - 承接 demo 邮箱格式化和动作时间格式化纯函数。
- 更新 `src/lib/freightflow-data.ts`:
  - 删除本文件内重复的 `ShipmentActionRequest` 与 `applyShipmentAction`。
  - 不再从 `src/features/freightflow/page-helpers.ts` 倒向导入类型。
  - 继续保留 Prisma 映射、API 输入校验、数据库读写和 mock fallback 边界。
- 更新 `src/features/freightflow/workbench-page.tsx`:
  - 删除本地重复 action switch 中的状态改写。
  - 除“订舱邮件打开 modal”外,所有动作统一通过 `applyShipmentAction` 更新本地状态,再后台尝试持久化。
  - 订舱邮件发送后的本地状态也改用同一动作状态机。
- 更新 `src/features/freightflow/page-helpers.ts` 与 `api-client.ts`:
  - 共享业务类型改从 `src/lib/freightflow-domain.ts` 来源。
  - 页面 helper 只保留 UI tone、booking draft、联系人候选、邮箱校验和推荐动作等页面相关逻辑。
- 新增 `src/lib/freightflow-domain.test.ts`:
  - 覆盖 demo 邮箱格式化、动作时间格式化、动作 label 校验、催单状态推进、异常标记/清除。
- 文档同步:
  - 更新 `README.md` 当前架构、目录说明和下一步建议。
  - 更新 `docs/project-overview.md` 目录结构、MVP 覆盖和已知限制。
- 验证结果:
  - `npm run prisma:generate` 通过
  - `npm run lint` 通过
  - `npm test` 通过,5 个测试文件 / 34 个用例
  - `npm run build` 通过
