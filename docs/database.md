# FreightFlow AI · 数据模型

> 稳定契约。本文件描述当前数据状态、`ShipmentRecord` 字段、未来落库建议。
> 任何对本文件内容的修改,都应同步追加变更说明到 [handover.md](./handover.md)。

## 1. 当前事实

当前已选型 `PostgreSQL + Prisma`,并已创建基础 ORM 工程:

- [`prisma/schema.prisma`](../prisma/schema.prisma) — 核心表结构与枚举定义。
- [`prisma/migrations/20260611175000_initial/migration.sql`](../prisma/migrations/20260611175000_initial/migration.sql) — 由 Prisma schema 生成的初始 PostgreSQL DDL。
- [`prisma/seed.mjs`](../prisma/seed.mjs) — 从 `mock-data.ts` 写入 6 条 shipment 与派生联系人。
- [`prisma.config.ts`](../prisma.config.ts) — Prisma 7 配置,默认读取 `DATABASE_URL`。
- [`src/lib/prisma.ts`](../src/lib/prisma.ts) — API route 可复用的 `PrismaClient` 单例。
- [`src/lib/freightflow-data.ts`](../src/lib/freightflow-data.ts) — Prisma 结果与前端 `ShipmentRecord` / `ContactRecord` 的转换层,包含中英文枚举映射、fallback 判定与 shipment action 状态推进。

当前已新增 Next.js API 数据层:

| API | 数据源行为 | 备注 |
| --- | --- | --- |
| `GET /api/shipments` | 优先读 PostgreSQL;数据库不可用时返回 `mock-data.ts` | 响应含 `source: database/mock` |
| `GET /api/shipments/[id]` | 优先读 PostgreSQL;数据库不可用时按 id 返回 mock | 未找到返回 404 |
| `POST /api/shipments/[id]/actions` | 写入 shipment 状态变更与 `shipment_action_logs`;数据库不可用时返回 503 | 支持订舱邮件、催单、补料、SO 识别、AMS/ACI/ISF、异常标记 |
| `GET /api/contacts` | 优先读 PostgreSQL;数据库不可用时返回 mock 派生联系人 | 响应含 `source: database/mock` |
| `POST /api/contacts` | upsert `contacts`;数据库不可用时返回 503 | 校验 email / label / role |

当前 UI 仍主要来自:

- [`src/lib/mock-data.ts`](../src/lib/mock-data.ts) — 6 条 `ShipmentRecord` 样例,常量导出。
- 前端 `useState` — 内存中的 shipment 状态、通讯录、booking draft、toast 等。

刷新页面后,所有改动回到 mock 初始值。

`/api/ai/openclaw` 已接入 `ai_requests` 审计表:请求开始先记录 `loading`,成功或失败后更新 `success / error`、reply、耗时和错误信息。若数据库不可用,AI 路由会记录 server warning 并继续返回原有 stub/proxy 兼容结构。

`GET /api/ai/requests?shipmentId=...` 已预留给未来 AI 历史面板使用。若数据库不可用,返回空数组和 `degraded: true`。

本地 PostgreSQL 未启动时,读接口使用 mock fallback 保持可演示;写接口不做假持久化,会返回明确 503。若要落库验证,先确保 `DATABASE_URL` 指向可用 PostgreSQL,再执行:

```bash
npm run db:up
npm run prisma:generate
npm run prisma:migrate:deploy
npm run prisma:seed
```

本地 Docker 路径由 [`docker-compose.yml`](../docker-compose.yml) 提供,默认启动 `postgres:16-alpine` 并暴露 `127.0.0.1:5432`。

## 2. 逻辑数据模型

前端代码已经把业务对象定型为 TypeScript 类型。`ShipmentRecord`(定义在 `src/lib/mock-data.ts`)仍是当前 UI 权威类型;Prisma schema 已按该形状建立后端持久化草案。

### 2.1 主表字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 内部主键,如 `SHP-240610-001` |
| `batchNo` | string | 业务批次号,如 `FF-CA-240610-A01` |
| `soNo` | string | 装船指示号(Shipping Order) |
| `containerNo` | string | 柜号 |
| `bookingAgent` | string | 订舱代理 |
| `carrier` | string | 船公司 |
| `originPort` | string | 起运港(POL) |
| `transitPort` | string | 中转港;空字符串表示直达 |
| `destinationPort` | string | 目的港(POD) |
| `containerType` | string | 柜型,如 `40HQ / 40GP / 20GP` |
| `vesselVoyage` | string | 船名 + 航次 |
| `etd` | string | 预计开船时间 |
| `eta` | string | 预计到港时间 |
| `cutoffTime` | string | 截补料时间 |
| `pickupLocation` | string | 提柜点 |
| `returnLocation` | string | 还柜点 |
| `status` | `ShipmentStatus` | 见 [business-rules §1](./business-rules.md#1-shipmentstatus-状态机) |
| `operator` | string | 当前负责人 |
| `followUpCount` | number | 催单次数 |
| `lastEmailTime` | string | 最近邮件时间 |
| `hoursWaitingRelease` | number | 等待放舱小时数 |
| `hoursToCutoff` | number | 距离截补料小时数;负数表示已过 |
| `aiSummary` | string | AI 摘要 |
| `exceptions` | string[] | 异常条目 |
| `nextAction` | string | 下一步建议 |
| `reminderFlags` | string[] | 提醒标记 |

### 2.2 嵌套字段

| 字段 | 类型 | 取值 |
| --- | --- | --- |
| `documentProgress.ams` | enum | `待处理 / 草稿完成 / 已发送` |
| `documentProgress.aci` | enum | `待处理 / 草稿完成 / 已发送` |
| `documentProgress.isf` | enum | `待处理 / 草稿完成 / 已发送` |
| `mailStatus` | enum | `未发送 / 已发送 / 跟进中` |
| `soStatus` | enum | `待识别 / 已识别` |
| `documentStatus` | enum | `待生成 / 处理中 / 已发送 / 已确认` |

### 2.3 前端 UI 状态(非业务字段)

| 类型 | 用途 | 是否需要落库 |
| --- | --- | --- |
| `BookingDraft` | 订舱 modal 草稿 | 暂不落库(关掉 modal 即丢) |
| `ContactRecord` / `ContactDraft` | 通讯录 | 是 |
| `ToastState` | 顶部提示 | 不落库 |

## 3. 内存状态生命周期

`src/features/freightflow/workbench-page.tsx` 内的 `useState` 集合:

- `shipmentState` — 整柜列表
- `bookingDraft` / `recipientInput` / `ccInput` — 订舱表单
- `contactState` / `contactDraft` — 通讯录
- `aiInput` / `aiReply` / `aiRequestState` / `aiLastPrompt` / `aiLastCompletedAt` / `aiLastReplyLength` — AI 副驾
- `activeNav` / `activeColumn` / `alertFilter` / `ownerFilter` / `searchTerm` / `selectedShipmentId` — 视图状态
- `toast` — 临时反馈

页面刷新 = 全部回到 mock 初始值。

## 4. Prisma schema

源自 [handover §3.2](./handover.md#32-未来若落库建议拆分表)。

### 4.1 已建表草案

| 表名 | 承载字段(简述) | 备注 |
| --- | --- | --- |
| `shipments` | `ShipmentRecord` 主字段 | 1 行 = 1 个柜子 |
| `shipment_document_progress` | `documentProgress.{ams,aci,isf}` | 1 行 = 1 个柜子的 1 类文档 |
| `shipment_exceptions` | `exceptions[]` | 1 行 = 1 条异常 |
| `shipment_reminder_flags` | `reminderFlags[]` | 1 行 = 1 条提醒 |
| `shipment_email_logs` | 历史邮件(主题/正文/收件人/时间) | 已建模;订舱 action 可记录邮件主题/正文/收件人 |
| `shipment_email_recipients` | 邮件 to/cc 收件人 | 已建模 |
| `shipment_action_logs` | 动作流(订舱/催单/补料/...) | 已建模;`POST /api/shipments/[id]/actions` 写入 |
| `contacts` | `ContactRecord` | 已建模;`GET/POST /api/contacts` 读写 |
| `ai_requests` | AI 请求/响应/耗时/状态 | 已由 AI route 审计写入;当前 schema 中 `shipmentId` 外键指向 `shipments.id`,删除 shipment 时置空 |
| `shipment_attachments` | 上传附件、存储 key、checksum、OCR 结果 | 已建模;`POST /api/shipments/[id]/attachments` 写入 |

### 4.2 Schema 覆盖审计

`ShipmentRecord` 主字段已在 `shipments` 中 1:1 映射。嵌套字段拆表如下:

- `documentProgress.{ams,aci,isf}` → `shipment_document_progress`
- `exceptions[]` → `shipment_exceptions`
- `reminderFlags[]` → `shipment_reminder_flags`
- `mailStatus / soStatus / documentStatus` → `shipments` 枚举列

注意:Prisma Client 枚举值返回 `RELEASED` 等 schema 枚举名,不是 `@map` 后的中文数据库值。API 层必须通过 `src/lib/freightflow-data.ts` 转回 `ShipmentRecord` 的中文字面量,前端不可直接消费 Prisma 原始枚举。

### 4.3 落库时机

见 [todo.md §1](./todo.md#1-数据层落地p0)。优先级最高,因为后续所有动作(邮件发送、文档流、权限)都依赖持久化。

## 5. 接续时的注意事项

- **不要在 `mock-data.ts` 之外的位置新增 shipment 常量**。所有 mock 必须集中在该文件,便于落库时一次性替换。
- **TypeScript 类型是契约的真理**。后端实体生成时以 `ShipmentRecord` 为基准。
- **状态枚举的字面量值**(中文状态名)不要随意改,前端 UI 文案、筛选逻辑、看板列映射都依赖它们。
- **不要把内存 UI 状态(§3)误以为是业务字段**。区分清楚再设计表结构。

---

变更请追加到 [handover.md](./handover.md),本文件为稳定契约。
