# FreightFlow AI · 待办与优先级

> 稳定契约。本文件列出当前未完成任务、推荐执行顺序与验收标准。
> 任何对本文件内容的修改,都应同步追加变更说明到 [handover.md](./handover.md)。

优先级约定:

- **P0**:阻塞后续工作,不做就无法继续堆功能。
- **P1**:显著提升质量 / 减少返工,建议在 P0 之后立即做。
- **P2**:体验优化,可后续排期。
- **P3**:长期演进,本季度不一定动。

## 1. 数据层落地(P0)

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

## 2. 真实业务接入(P0/P1)

源自 [handover §6.5](./handover.md#65-真实业务接入顺序建议)。

### 2.1 真实邮件发送(P0)

- 状态:已完成最小邮件发送抽象、本地 mock provider、SMTP provider 与 IMAP 连接验证。
- 状态:已新增待发订舱计划第一版,支持按资料完整度筛选可生成草稿的 Shipment,并批量生成中文订舱草稿。
- 状态:已新增订舱计划/草稿 API: `GET /api/booking-plans`, `POST /api/booking-plans/batch-drafts`, `GET/PATCH /api/email-drafts/[draftId]`, `POST /api/email-drafts/[draftId]/send`。
- 状态:工作台已显示"待发订舱计划"面板;批量操作只生成草稿,不自动对外发送邮件。
- 已新增 `src/lib/services/email/*`,包含 provider 接口、mock provider、SMTP provider、IMAP verifier、输入校验、`shipment_email_logs` / `shipment_email_recipients` 保存服务。
- 已新增 `GET/POST /api/settings/email`,左侧“设置”可维护 IMAP/SMTP host、port、SSL/TLS、用户名、授权码、发件人和 Reply-To。
- `POST /api/settings/email` 带 `test: true` 时会同时测试 SMTP 与 IMAP 连接。
- 已新增 `GET /api/shipments/[shipmentId]/emails`,查询某票 shipment 的邮件日志与 recipients。
- 已新增 `POST /api/shipments/[shipmentId]/emails`,接收 `subject / body / attachmentName / to / cc / recipients`,先走 mock provider,再按 Prisma schema 保存 email log 与 recipients。
- 仍需在真实邮箱服务商后台开启 IMAP/SMTP 服务并填写授权码。候选:腾讯企业邮箱 / 自建 SMTP / 第三方服务。
- booking modal "发送"已接入 `/api/shipments/[id]/emails`,会优先调用邮件服务;数据库不可用或 shipment 未落库时回退本地演示状态,并继续后台尝试记录 `订舱邮件` action。
- 剩余验收:填入真实邮箱 IMAP/SMTP 配置并保存测试通过;真实 PostgreSQL migration/seed 后,确认待发订舱计划、草稿、邮件 API 可持久化,并确认 UI 刷新后计划、草稿、邮件状态与日志一致。
- 最终验收:订舱邮件真发出,`shipment_email_logs` 有记录,`shipment_email_recipients` 按 `TO / CC` 落库。

### 2.2 SO / 补料 / 申报文档流(P1)

- 状态:已完成最小可替换文档流服务层与 API 占位。
- 状态:已新增邮件识别队列第一版,支持中文/英文/中英混合邮件规则识别,包括 SO 回传、订舱回复、补料确认、催单回复、异常和未知。
- 状态:已新增邮件消息/识别结果 Prisma 模型与 API: `POST /api/email-sync/run`, `GET /api/email-recognitions`。
- 重要边界:当前邮件识别只入队并展示待确认项,不会自动写回 Shipment 状态;确认写回留到下一阶段。
- 已新增 `src/lib/services/documents/document-service.ts`,包含 SO 识别占位接口与补料模板生成占位接口。
- 已新增 `POST /api/shipments/[shipmentId]/documents/so-recognition`,接收 `fileName / mimeType / sourceText`,返回占位识别结果、置信度和待替换 OCR 提醒。
- 已新增 `POST /api/shipments/[shipmentId]/documents/supplement-template`,接收 `templateType / language / shipment`,返回 JSON 模板字段清单,为后续 Word / Excel 生成器预留数据结构。
- 仍需接入真实 IMAP 拉取、附件上传、文件存储、SO 文件解析(OCR / parser)、补料模板生成(Word / Excel)、申报回执管理。
- 最终验收:用户上传 SO 文件 → 自动识别柜号/船公司/ETD → 写入 shipment;用户可生成并下载真实补料模板文件。

### 2.3 AI 请求审计与历史(P1)

- 状态:API 层已完成基础审计写入。
- 状态:左侧“设置”已接入 OpenClaw 配置窗口,可维护 endpoint / API Key / model / timeout / enabled,并支持保存后测试连接。
- 状态:`/api/ai/openclaw` 会优先读取 `.freightflow/openclaw-config.json`,无本地配置时再回退 `.env` 中的 `OPENCLAW_API_URL / OPENCLAW_API_KEY`。
- `ai_requests` 表持久化 prompt、reply、shipmentId、context、provider/endpoint、耗时、状态、错误信息。
- `GET /api/ai/requests?shipmentId=...` 已提供基础历史查询,数据库不可用时返回降级空结果。
- AI 副驾面板增加"历史"tab。
- 剩余验收:用真实 OpenClaw endpoint 完成一次保存并测试;接入真实 DB 后确认每次 AI 调用都有审计记录可查,并在前端历史 tab 展示。

## 3. 前端结构整理(P1)

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

## 4. 测试与质量(P1/P2)

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

## 5. 工程基线(P2)

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

## 6. 体验优化(P3)

源自 [handover §5](./handover.md#5-未完成任务)。

- 看板列拖拽、列宽自适应
- 真实附件预览
- 暗色模式
- 移动端布局
- 多语言(目前 UI 全中文)

## 7. 执行顺序(下次开工建议)

```
Day 1:
  - [ ] 选定数据库与 ORM(NestJS + Prisma + PostgreSQL 推荐)
  - [ ] 跑通 schema 与 migration

Day 2:
  - [ ] shipments / contacts / action_logs 三表 CRUD
  - [x] 前端 fetch 接入(读接口 + 动作/联系人后台持久化尝试)

Day 3:
  - [ ] BookingModal 接入 `POST /api/shipments/[shipmentId]/emails`
  - [ ] 选定并接入真实 SMTP provider
  - [ ] SO 上传/OCR provider 与补料 Word / Excel 生成器接入

Day 4:
  - [ ] 纯函数单测 + AI 路由测试
  - [ ] 部署草图 + 监控占位
```

---

变更请追加到 [handover.md](./handover.md),本文件为稳定契约。
