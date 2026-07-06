# FreightFlow AI · 待办与优先级

> 稳定契约。本文件列出当前未完成任务、推荐执行顺序与验收标准。
> 任何对本文件内容的修改,都应同步追加变更说明到 [handover.md](./handover.md)。

优先级约定:

- **P0**:阻塞后续工作,不做就无法继续堆功能。
- **P1**:显著提升质量 / 减少返工,建议在 P0 之后立即做。
- **P2**:体验优化,可后续排期。
- **P3**:长期演进,本季度不一定动。

## 1. 当前 MVP 闭环(P0)

当前第一优先级不再是报价、复杂看板或尾端派送,而是做完一条能帮操作节省时间的闭环:

```text
AI 生成订舱邮件
→ SMTP 发送
→ IMAP 同步回邮
→ 检测 SO 附件
→ OCR / 大模型抽取 SO 字段
→ 高置信度结果回写 Shipment
```

### 1.1 AI 大模型自动订舱邮件(P0)

- 状态:已新增 `src/lib/booking/**` 草稿上下文、prompt、validator。
- 状态:已新增 `POST /api/booking/draft`,返回 `subject / body / to / cc / missingFields / riskNotes / canSend`。
- 状态:AI 只生成草稿,发送仍要求人工点击确认。
- 状态:缺起运港、目的港、柜型、柜量或预计 ETD 时,会阻止 confirmed send。

### 1.2 SMTP 发送 + IMAP 回邮同步(P0)

- 状态:已新增 `src/lib/email/**` 附件检测、邮件解析、Shipment 匹配、IMAP 抓取边界。
- 状态:IMAP 同步会读取正文片段和 bodyStructure 附件文件名,可识别真实 SO 附件名。
- 状态:已新增 `POST /api/booking/send`,要求 `confirmed === true`。
- 状态:已新增 `POST /api/booking/sync-replies`,可拉取回邮或接收 sample messages 并识别 SO 附件。
- 状态:confirmed send 会写 `ShipmentEmailLog` 与 `ShipmentActionLog`;邮件已发但日志失败时返回 warning,避免误重发。

### 1.3 SO OCR 与结构化抽取(P0)

- 状态:已新增 `src/lib/so/**` OCR 边界、extractor、validator、field mapper。
- 状态:已新增 OpenClaw JSON 增强,endpoint 可用时可用大模型补强 SO 字段抽取。
- 状态:已新增 `POST /api/so/upload`、`/api/so/ocr`、`/api/so/extract`、`/api/so/apply-to-shipment`。
- 状态:OCR 未配置时返回明确 not_configured;当前 MVP 支持文本/文本文件直通识别。
- 状态:低置信度字段不会自动覆盖 Shipment。

### 1.4 Shipment 回写(P0)

- 状态:SO 识别成功后 `soStatus` 改为 `已识别`。
- 状态:`等待放舱 / 已催放舱` 可推进到 `已放舱`。
- 状态:当前会把 `待生成` 补料状态推进为 `处理中`,并提示检查补料字段。
- 状态:数据库可用时每次回写创建 `ShipmentActionLog`;不可用时返回本地预览。

## 2. 支撑性数据层(P0/P1)

源自 [handover §6.1](./handover.md#61-先做数据层落地) + §6.5。

### 1.1 设计数据库 schema

- 状态:已完成第一版,选型为 `PostgreSQL + Prisma`。
- 表结构参见 [database.md §4](./database.md#4-prisma-schema)。
- 后续:补 migration 落库、seed/mock 同步脚本、真实 Postgres 验证。

### 1.2 把 mock data 替换为 API + 持久化

- 状态:Next API 已覆盖 `GET /api/shipments`、`GET /api/shipments/[id]`、`POST /api/shipments/[id]/actions`。
- 状态:前端工作台已新增 `src/features/freightflow/api-client.ts`,启动/刷新时优先读取 `/api/shipments`。
- 当前无 PostgreSQL 时,API 返回服务端 mock fallback,前端继续可演示。
- 剩余验收:启动真实 PostgreSQL 并完成 migration/seed 后,刷新页面后确认动作(订舱发送、催单计数)从数据库保留。

### 1.3 联系人 / 通讯录持久化

- 状态:已完成 `contacts` 表 + `GET /api/contacts` + `POST /api/contacts`。
- 状态:前端工作台启动时优先读取 `/api/contacts`,无数据库时回退服务端 mock contacts。
- 状态:booking modal 新增联系人会先更新本地列表,再后台尝试 `POST /api/contacts`。
- 剩余验收:真实 PostgreSQL 可用后,刷新后新增联系人仍在。

### 1.4 动作日志持久化

- `shipment_action_logs` 表,记录谁、什么动作、何时、对哪个 shipment。
- 状态:前端动作流会后台尝试 `POST /api/shipments/[id]/actions`。
- 无数据库时写入返回 503,前端提示未持久化但保留本地演示状态。
- 剩余验收:真实 PostgreSQL 可用后,任何前端状态推进都对应一条 log。

## 3. 真实业务接入(P0/P1)

源自 [handover §6.5](./handover.md#65-真实业务接入顺序建议)。

### 2.1 真实邮件发送(P0)

- 状态:已完成最小邮件发送抽象、本地 mock provider、SMTP provider 与 IMAP 连接验证。
- 已新增 `src/lib/services/email/*`,包含 provider 接口、mock provider、SMTP provider、IMAP verifier、输入校验、`shipment_email_logs` / `shipment_email_recipients` 保存服务。
- 已新增 `GET/POST /api/settings/email`,左侧“设置”可维护 IMAP/SMTP host、port、SSL/TLS、用户名、授权码、发件人和 Reply-To。
- `POST /api/settings/email` 带 `test: true` 时会同时测试 SMTP 与 IMAP 连接。
- 已新增 `GET /api/shipments/[shipmentId]/emails`,查询某票 shipment 的邮件日志与 recipients。
- 已新增 `POST /api/shipments/[shipmentId]/emails`,接收 `subject / body / attachmentName / to / cc / recipients`,先走 mock provider,再按 Prisma schema 保存 email log 与 recipients。
- 仍需在真实邮箱服务商后台开启 IMAP/SMTP 服务并填写授权码。候选:腾讯企业邮箱 / 自建 SMTP / 第三方服务。
- booking modal "发送"已接入 `/api/shipments/[id]/emails`,会优先调用邮件服务;数据库不可用或 shipment 未落库时回退本地演示状态,并继续后台尝试记录 `订舱邮件` action。
- 剩余验收:填入真实邮箱 IMAP/SMTP 配置并保存测试通过;真实 PostgreSQL migration/seed 后,确认邮件 API 可保存 `shipment_email_logs` / `shipment_email_recipients`,并确认 UI 刷新后邮件状态与日志一致。
- 最终验收:订舱邮件真发出,`shipment_email_logs` 有记录,`shipment_email_recipients` 按 `TO / CC` 落库。

### 2.2 SO / 补料 / 申报文档流(P1)

- 状态:已完成最小可替换文档流服务层与 API 占位。
- 已新增 `src/lib/services/documents/document-service.ts`,包含 SO 识别占位接口与补料模板生成占位接口。
- 已新增 `POST /api/shipments/[shipmentId]/documents/so-recognition`,接收 `fileName / mimeType / sourceText`,返回占位识别结果、置信度和待替换 OCR 提醒。
- 已新增 `POST /api/shipments/[shipmentId]/documents/supplement-template`,接收 `templateType / language / shipment`,返回 JSON 模板字段清单,为后续 Word / Excel 生成器预留数据结构。
- 仍需接入真实附件上传、文件存储、SO 文件解析(OCR / parser)、补料模板生成(Word / Excel)、申报回执管理。
- 最终验收:用户上传 SO 文件 → 自动识别柜号/船公司/ETD → 写入 shipment;用户可生成并下载真实补料模板文件。

### 2.3 AI 请求审计与历史(P1)

- 状态:API 层已完成基础审计写入。
- 状态:左侧“设置”已接入 OpenClaw 配置窗口,可维护 endpoint / API Key / model / timeout / enabled,并支持保存后测试连接。
- 状态:`/api/ai/openclaw` 会优先读取 `.freightflow/openclaw-config.json`,无本地配置时再回退 `.env` 中的 `OPENCLAW_API_URL / OPENCLAW_API_KEY`。
- `ai_requests` 表持久化 prompt、reply、shipmentId、context、provider/endpoint、耗时、状态、错误信息。
- `GET /api/ai/requests?shipmentId=...` 已提供基础历史查询,数据库不可用时返回降级空结果。
- AI 副驾面板增加"历史"tab。
- 剩余验收:用真实 OpenClaw endpoint 完成一次保存并测试;接入真实 DB 后确认每次 AI 调用都有审计记录可查,并在前端历史 tab 展示。

## 4. 前端结构整理(P1)

源自 [handover §6.2 / §6.3](./handover.md#62-再做页面拆分)。

### 3.1 抽取 BookingModal(P1)

- 已拆为 `src/features/freightflow/booking-modal.tsx`。
- 已由 `src/features/freightflow/workbench-page.tsx` 负责状态与事件接入。
- 状态:booking modal 发送按钮已接入邮件 API,并保留数据库不可用时的本地 demo 回退。
- 后续验收重点:接真实 SMTP provider 时保持当前回退行为与错误提示不退化。

### 3.2 抽取 AiCopilotPanel(P1)

- 已拆为 `src/features/freightflow/ai-copilot-panel.tsx`。
- 页面层保留 AI 请求状态与 `POST /api/ai/openclaw` 事件分发。
- 后续验收重点:接 AI 历史 tab 时不破坏快捷 prompt / 自定义 prompt。

### 3.3 抽取其他详情面板(P1)

- 已抽到 `src/features/freightflow/detail-panels.tsx`。
- 当前包括 `ShipmentDetailPanel`、`ShipmentFieldPanel`、`ShipmentActionPanel`。
- `src/app/page.tsx` 已降为 5 行路由壳;工作台主体在 `workbench-page.tsx`。

### 3.4 统一共享组件边界(P1)

- 已统一到 `src/features/freightflow/shared-ui.tsx` 的 `ActionTile`。
- `detail-panels.tsx` 不再保留本地动作卡片实现。
- 后续整理重点:继续将 `workbench-page.tsx` 中的状态编排拆成小 hook 或 reducer。

## 5. 测试与质量(P1/P2)

源自 [handover §6.4](./handover.md#64-补充最基本测试)。

### 4.1 纯函数单测(P1)

- 状态:已完成最小单测基线,使用 Vitest。
- 已覆盖:`summarizeShipments` / `getAlertLevel` / `pickRecommendedAction`。
- 已覆盖:`buildBookingDraft` / `buildContacts` / `isValidEmail` / `normalizeEmail`。
- 当前验收:`npm test` 跑通,不依赖 PostgreSQL / SMTP / OpenClaw。
- 剩余缺口:尚未接入覆盖率报告,后续可补 `@vitest/coverage-v8` 并设置最低覆盖阈值。

### 4.2 AI 路由基础测试(P1)

- 状态:已完成最小 route 测试。
- 已覆盖:`POST /api/ai/openclaw` 的缺失 prompt、stub 模式、转发模式、错误模式。
- 验收:`fetch` 使用 Vitest mock,不依赖真实 OpenClaw 服务。
- 剩余缺口:尚未覆盖真实 OpenClaw 返回协议兼容性、非 JSON 响应细节、请求审计落库链路。

### 4.3 E2E(P2)

- Playwright 跑订舱流程主链路。
- 验收:打开首页 → 选中柜子 → 打开 booking modal → 填收件人 → 发送。

### 4.4 CI 质量门禁(P2)

- 将 `npm test && npm run lint && npm run build` 接入 CI。
- 验收:任一环节失败时阻止合并 / 发布。

## 6. 工程基线(P2)

源自 [handover §5](./handover.md#5-未完成任务)。

### 5.1 部署配置与环境区分(P2)

- `dev / staging / prod` 三套环境变量模板。
- CI(可选 GitHub Actions)跑 `lint + build + test`。

### 5.2 监控与日志(P2)

- 前端错误上报(Sentry 或自建)。
- 后端 API 访问日志、错误日志。

### 5.3 权限 / 登录 / 用户体系(P2/P3)

- 当前完全无权限模型;一旦上线必须先加。
- 最小方案:邮箱 + 邀请码 + session。

## 7. 体验优化(P3)

源自 [handover §5](./handover.md#5-未完成任务)。

- 看板列拖拽、列宽自适应
- 真实附件预览
- 暗色模式
- 移动端布局
- 多语言(目前 UI 全中文)

## 8. 执行顺序(下次开工建议)

```
Step 1:
  - [x] Agent 1:收窄 UI + 新增 AGENTS.md + 新增 docs/booking-mvp.md

Step 2:
  - [x] Agent 2:AI 订舱邮件草稿 / SMTP 发送 / IMAP 回邮同步 / SO 附件检测

Step 3:
  - [x] Agent 3:SO 上传 / OCR provider / 大模型结构化抽取 / 高置信度回写

Step 4:
  - [x] Integration:订舱邮件发送 → 回邮发现 SO → OCR/抽取 → 回写 Shipment
```

---

变更请追加到 [handover.md](./handover.md),本文件为稳定契约。
