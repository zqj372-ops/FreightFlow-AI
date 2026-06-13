# FreightFlow AI · 项目概览

> 稳定契约。本文件描述项目的目标、边界、结构和运行方式。
> 任何对本文件内容的修改,都应同步追加变更说明到 [handover.md](./handover.md)。

## 1. 项目定位

FreightFlow AI 是一个面向加拿大、美国海运整柜(FCL)与空运操作的 AI 工作台 MVP。
当前版本已完成前端业务骨架、Prisma 数据模型、基础 API、AI 代理/审计入口、邮件/文档流占位接口与最小测试基线;真实 PostgreSQL、SMTP、OCR 和文件生成仍需接入生产服务。

## 2. 业务范围与模块

主操作台"订舱工作台"覆盖:

- 队列(Kanban)按状态列筛选整柜
- 单柜详情与动作流:订舱 / 催单 / 补料 / SO 识别 / AMS / ACI / ISF / 异常标记
- AI 副驾基于当前 shipment 给建议
- 通讯录与订舱邮件草稿

左侧导航另设 6 个入口(SO识别中心 / 补料中心 / AMS/ACI/ISF / 邮件中心 / 异常中心 / 设置),当前只有"订舱工作台"激活,其它为占位。

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
│   │   ├── booking-modal.tsx          # 订舱 modal 纯组件
│   │   ├── ai-copilot-panel.tsx       # AI 副驾纯组件
│   │   ├── detail-panels.tsx          # 单柜详情 / 字段 / 操作面板
│   │   ├── page-helpers.ts            # booking draft / 联系人 / 邮箱校验 / 状态推导
│   │   └── shared-ui.tsx              # SectionCard / StatusBadge / ActionTile 等共享 UI
│   └── lib/
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

当前已有最小测试脚本,无部署脚本。Prisma 脚本已存在,但是否能执行 migration 取决于本地 PostgreSQL / `DATABASE_URL`。

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

左侧“设置”里的 OpenClaw 配置窗口会优先写入/读取 `.freightflow/openclaw-config.json`;存在本地配置时优先于上述环境变量。`.freightflow/` 已加入 `.gitignore`,用于保存本机运行配置和 API Key。
左侧“设置”里的邮箱服务模块会优先写入/读取 `.freightflow/email-config.json`;存在本地配置时优先于上述 SMTP/IMAP 环境变量。使用前需要在邮箱服务商后台开启 IMAP/SMTP 服务并使用授权码。

## 7. MVP 当前覆盖

已完成:

- 主页面 `/` 单页操作台
- 左侧物流操作菜单(“设置”已接入 OpenClaw 与 IMAP/SMTP 邮箱配置,其余业务入口仍以当前工作台为主)
- 中间 Kanban 看板(状态分列 + 搜索 + 负责人 + 告警分级筛选)
- 右侧 AI 助手与优先事项
- Shipment 主模型样例数据(6 条)
- 订舱 modal(收件人/抄送/主题/正文/通讯录/检查项)
- 待发订舱计划面板(资料完整度、可生成草稿、批量生成中文订舱草稿)
- AI 副驾(快捷 prompt / 自定义 / 状态徽标 / 段落列表渲染)
- `/api/booking-plans` / `/api/booking-plans/batch-drafts` / `/api/email-drafts/[draftId]` / `/api/email-drafts/[draftId]/send` 订舱计划与草稿 API
- `/api/ai/openclaw`(stub 模式 + 转发模式)
- 一轮结构整理(workbench 页面下沉、BookingModal / AiCopilotPanel / detail panels 抽离、ActionTile 统一)
- Vitest 最小测试基线(纯函数 + OpenClaw route stub/proxy/error 分支)

## 8. 已知限制

- **真实数据库尚未接入前端工作台**:Prisma schema 已存在,但主工作台仍由 `mock-data.ts` 驱动,刷新页面即丢失所有前端操作改动。详见 [database.md](./database.md)。
- **真实数据库尚未启动**:主工作台会优先请求 `/api/shipments` 与 `/api/contacts`;无 PostgreSQL 时 API 回退服务端 mock,前端动作仍保留本地演示状态并提示未持久化。详见 [database.md](./database.md)。
- **邮箱真发需要外部开通**:系统已支持 IMAP/SMTP 配置与连接测试,但需要在邮箱服务商后台开启 IMAP/SMTP 并填写授权码。email log 持久化仍依赖 PostgreSQL 中存在对应 shipment。
- **没有真实附件 / 文档流**:附件名是占位字符串。
- **没有登录、权限、用户体系**。
- **测试仍不完整**:已有 Vitest 最小单测基线,但没有覆盖率阈值和 E2E。
- **`src/features/freightflow/workbench-page.tsx` 仍较大**,后续可继续拆分看板状态、订舱状态 hook 或动作流 reducer。
- **Prisma 7 使用 Postgres adapter 初始化**:`src/lib/prisma.ts` 通过 `@prisma/adapter-pg` + `pg` 创建 `PrismaClient`,构建期不会再因缺少 adapter 阻塞;真实数据库不可用时,相关 API 仍需各自 fallback。

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
