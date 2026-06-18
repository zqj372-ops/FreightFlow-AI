# FreightFlow AI · 项目概览

> 稳定契约。本文件描述项目的目标、边界、结构和运行方式。
> 任何对本文件内容的修改,都应同步追加变更说明到 [handover.md](./handover.md)。

## 1. 项目定位

FreightFlow AI 是一套面向货代(Freight Forwarder)的自动化作业系统,也是内部操作员的 AI 工作台与自动化机器人中枢。产品目标是把货代日常 70% 的“催、抄、录、查”交给系统完成,让订舱、SO 识别、补料、柜子状态、报关/清关、派送和财务识别在同一张操作台里流转。

完整产品设计见 [product-design.md](./product-design.md)。当前仓库是 Web MVP,优先跑通订舱、IMAP 邮件识别、SO 复核、补料模板和操作员确认发送链路。

业务范围:

- 出口段:订舱 → 提柜 → 装柜 → 报关 → 补料 → 装船 → 离港。
- 进口段:到港 → 清关 → 提货 → 派送 → 还空柜。
- 自动化重点:自动订舱、自动催单、放舱 SO 自动识别、提柜后补料触发、全链路跟踪、账单结构化。

## 2. 业务范围与模块

完整规划包含 10 个业务模块:

| 模块 | 核心职责 |
| --- | --- |
| 订舱板块 | 建单、生成订舱邮件、预览发送、2h/4h/8h 催单、识别船代回复 |
| SO 识别 + M3 | IMAP 拉信、正文/PDF 识别、字段置信度、人工复核后落库 |
| 补料板块 | 提柜后收发通齐备时自动触发 SI,生成 Excel 附件并发送 |
| 柜子状态跟踪 | 从提柜到还空柜的全生命周期看板 |
| 报关板块 | 出口报关状态,报关行 API 优先、手动录入兜底 |
| 清关板块 | 中国端货代推资料给国外代理,接收清关状态回推 |
| 装载状态 | 排载、装船状态,来自爬虫或第三方 API |
| 派送板块 | 到港后派送状态跟踪,只跟踪不自营派车 |
| 财务板块 | 账单 PDF/Excel/扫描件识别、人工复核、海运费预估/最终差异 |
| 数据互通 | 看板统一、字段联动、SO/提单号/柜号/收发通主数据同步 |

当前 Web MVP 主操作台"订舱工作台"覆盖:

- 队列(Kanban)按状态列筛选整柜
- 单柜详情与动作流:订舱 / 催单 / 补料 / SO 识别 / AMS / ACI / ISF / 异常标记
- AI 副驾基于当前 shipment 给建议
- 通讯录与订舱邮件草稿

左侧导航另设 SO识别中心 / 补料中心 / AMS/ACI/ISF / 邮件中心 / 异常中心 / 设置等入口。当前这些主模块已接入对应工作面板,复用同一套 Shipment、邮件识别、订舱草稿和文档生成状态。

## 3. 技术栈

- **运行时**:Next.js 16.2.9(React 19.2.4)
- **语言**:TypeScript 5,`strict: true`
- **样式**:Tailwind CSS 4,通过 `@tailwindcss/postcss`
- **图标**:lucide-react
- **包管理**:npm,锁定 `package-lock.json`
- **字体**:Geist Sans / Geist Mono(next/font/google)

## 4. 目录结构

```text
freightflow-ai/
├── docs/
│   ├── handover.md          # 变更日志(流水账)
│   ├── project-overview.md  # 本文件
│   ├── business-rules.md    # 业务规则
│   ├── database.md          # 数据模型
│   ├── todo.md              # 待办与优先级
│   └── master-plan.md       # 5 个并行子项目总控计划
├── public/                  # 占位 SVG
├── src/
│   ├── app/
│   │   ├── api/ai/openclaw/route.ts   # AI 代理路由
│   │   ├── layout.tsx
│   │   ├── page.tsx                   # 路由壳,渲染 FreightflowWorkbenchPage
│   │   ├── globals.css
│   │   └── favicon.ico
│   ├── components/
│   │   └── workbench-shell.tsx        # SidebarNav / Header / MetricStrip / QueuePanel
│   ├── features/freightflow/
│   │   ├── workbench-page.tsx         # 主工作台状态、派生数据与事件编排
│   │   ├── module-panels.tsx          # SO/补料/申报/邮件/异常主模块面板
│   │   ├── booking-modal.tsx          # 订舱 modal 纯组件
│   │   ├── booking-plan-workflow.tsx  # 单票订舱计划、附件预览与草稿确认
│   │   ├── booking-plan-panel.tsx     # 待发订舱计划与批量草稿入口
│   │   ├── email-recognition-panel.tsx # 邮件识别队列与人工审核入口
│   │   ├── ai-copilot-panel.tsx       # AI 副驾纯组件
│   │   ├── detail-panels.tsx          # 单柜详情 / 字段 / 操作面板
│   │   ├── page-helpers.ts            # booking draft / 联系人 / 邮箱校验 / 状态推导
│   │   └── shared-ui.tsx              # SectionCard / StatusBadge / ActionTile 等共享 UI
│   └── lib/
│       ├── repositories/              # mock + Prisma repository 抽象
│       ├── services/                  # email / booking-plans / documents / recognition 服务
│       └── mock-data.ts               # 6 条 ShipmentRecord 样例
├── .env.example
├── README.md
├── next.config.ts
├── package.json
└── tsconfig.json
```

`@/*` 路径别名指向 `src/*`。

## 5. 运行命令

`package.json` 中的脚本:

| 命令 | 用途 |
| --- | --- |
| `npm install` | 安装依赖 |
| `npm run dev` | 启动开发服务器,默认 http://localhost:3000 |
| `npm run build` | 生产构建 |
| `npm run start` | 启动生产服务器 |
| `npm run lint` | ESLint 检查 |
| `npm test` | Vitest 最小单测基线 |
| `npm run prisma:generate` | 生成 Prisma Client |
| `npm run prisma:validate` | 验证 Prisma schema |
| `npm run prisma:format` | 格式化 Prisma schema |
| `npm run prisma:migrate:dev` | 本地开发 migration |
| `npm run prisma:migrate:deploy` | 部署环境 migration |
| `npm run db:up` | 用 Docker Compose 启动本地 PostgreSQL |
| `npm run e2e` | Playwright 浏览器 smoke |

当前已有测试、Prisma 与本地 PostgreSQL 启动脚本。是否能执行 migration 取决于本机是否安装 Docker 或是否已配置可用 `DATABASE_URL`。

## 6. 环境变量

参考 `.env.example`:

- `OPENCLAW_API_URL`:外部 OpenClaw 服务地址。未配置时 AI 路由返回本地 stub。
- `OPENCLAW_API_KEY`:可选,Bearer Token。配置后在请求头里带 `Authorization: Bearer ...`。
- `OPENCLAW_MODEL`:可选,转发给 OpenClaw 的模型名。
- `OPENCLAW_TIMEOUT_MS`:可选,OpenClaw 请求超时时间,默认 `30000`。
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE`:发信 SMTP 服务配置。
- `IMAP_HOST` / `IMAP_PORT` / `IMAP_SECURE`:收信 IMAP 服务配置。
- `SMTP_USERNAME` / `SMTP_PASSWORD`:邮箱账号与授权码/密码,同时用于 IMAP/SMTP 登录。
- `SMTP_FROM_EMAIL` / `SMTP_FROM_NAME` / `SMTP_REPLY_TO`:发件人和回信地址。
- `FREIGHTFLOW_STORAGE_DIR`:附件本地存储目录;为空时使用 `.freightflow/storage`。
- `OCR_LANGUAGES`:Tesseract OCR 语言,默认 `eng+chi_sim`。

左侧“设置”里的 OpenClaw 配置窗口会优先写入/读取 `.freightflow/openclaw-config.json`;存在本地配置时优先于上述环境变量。`.freightflow/` 已加入 `.gitignore`,用于保存本机运行配置和 API Key。
左侧“设置”里的邮箱服务模块会优先写入/读取 `.freightflow/email-config.json`;存在本地配置时优先于上述 SMTP/IMAP 环境变量。使用前需要在邮箱服务商后台开启 IMAP/SMTP 服务并使用授权码。

## 7. MVP 当前覆盖

已完成:

- 主页面 `/` 单页操作台
- 左侧物流操作菜单(设置 / SO识别中心 / 补料中心 / AMS/ACI/ISF / 邮件中心 / 异常中心均有工作面板)
- 中间 Kanban 看板(状态分列 + 搜索 + 负责人 + 告警分级筛选)
- 右侧 AI 助手与优先事项
- Shipment 主模型样例数据(6 条)
- 订舱 modal(收件人/抄送/主题/正文/通讯录/检查项)
- 单票订舱计划 workflow(订舱字段复核、附件预览、托书下载、邮件草稿确认发送)
- 待发订舱计划面板(资料完整度、可生成草稿、批量生成中文订舱草稿)
- 邮件识别队列面板(手动同步邮箱、展示待确认识别结果、异常/匹配统计、人工确认后写回 Shipment)
- SO识别中心(待识别 SO、识别邮件队列、人工复核入口)
- 补料中心(补料状态汇总、补料 Excel 生成下载、单柜明细入口)
- SO 附件上传、本地文件存储、文本/图片 OCR、SO 字段规则抽取
- AMS/ACI/ISF 面板(三类申报进度汇总、单柜推进入口)
- 邮件中心(待发订舱计划、批量草稿、邮箱设置、邮件识别队列)
- 异常中心(红色异常、黄色预警、当前柜异常切换、单柜明细入口)
- AI 副驾(快捷 prompt / 自定义 / 状态徽标 / 段落列表渲染)
- `/api/booking-plans` / `/api/booking-plans/batch-drafts` / `/api/email-drafts/[draftId]` / `/api/email-drafts/[draftId]/send` 订舱计划与草稿 API
- `/api/email-sync/run` / `/api/email-recognitions` 邮件同步与识别队列 API
- `/api/email-recognitions/[id]/review` 邮件识别人工审核 API,支持确认写入、标记异常、忽略
- `/api/ai/openclaw`(stub 模式 + 转发模式)
- 一轮结构整理(workbench 页面下沉、BookingModal / AiCopilotPanel / detail panels 抽离、ActionTile 统一)
- Vitest 测试基线(纯函数 + OpenClaw route stub/proxy/error 分支 + mock 服务/API 操作链路)
- Playwright smoke(首页、SO 上传 OCR、邮件中心同步)

## 8. 已知限制

- **真实数据库需要运行环境**:已提供 `docker-compose.yml`、migration 与 seed;当前机器未安装 Docker,所以 PostgreSQL 容器未在本机实际启动。详见 [database.md](./database.md)。
- **邮箱真发需要外部开通**:系统已支持 IMAP/SMTP 配置与连接测试,但需要在邮箱服务商后台开启 IMAP/SMTP 并填写授权码。email log 持久化仍依赖 PostgreSQL 中存在对应 shipment。
- **真实 IMAP 拉信已接入**:`POST /api/email-sync/run` 在有数据库时调用 `runSync`,根据配置选择真实 IMAP 或 mock pull,并创建识别结果。真实邮箱账号与授权码仍需外部提供。
- **附件流仍是本地 MVP 形态**:已支持本地上传、存储、下载、文本/图片 OCR 与 SO 字段规则抽取;PDF rasterize、云对象存储、模板后台维护和 M3 二次抽取仍待补。
- **没有登录、权限、用户体系**。
- **测试仍不完整**:已有 Vitest 单测、mock 服务/API 操作链路与 Playwright smoke,但没有覆盖率阈值和完整业务浏览器 E2E。
- **`src/features/freightflow/workbench-page.tsx` 仍较大**,后续可继续拆分看板状态、订舱状态 hook 或动作流 reducer。
- **Prisma 7 使用 Postgres adapter 初始化**:`src/lib/prisma.ts` 通过 `@prisma/adapter-pg` + `pg` 创建 `PrismaClient`,构建期不会再因缺少 adapter 阻塞;真实数据库不可用时,相关 API 仍需各自 fallback。
- **开源参考仅做架构借鉴**:已查看 `loadpartner/tms`、`fleetbase/fleetbase`、`AgileShift/cargo_management`、`MustafaYamin/logistics-crm-nextjs` 等项目。因许可证为 AGPL、Other 或未声明许可证,当前没有直接复制外部代码,只参考模块边界和工作流组织方式。

## 9. 接续入口

新接手本项目的开发者/Agent,建议按以下顺序阅读:

1. 本文件 — 了解项目边界
2. [business-rules.md](./business-rules.md) — 理解状态机与告警分级
3. [database.md](./database.md) — 理解数据模型与未来落库方向
4. [todo.md](./todo.md) — 了解下一阶段任务与优先级
5. [master-plan.md](./master-plan.md) — 查看 5 个并行子项目与验收顺序
6. [handover.md](./handover.md) — 查看历史变更

---

变更请追加到 [handover.md](./handover.md),本文件为稳定契约。
