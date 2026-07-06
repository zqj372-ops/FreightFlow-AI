# FreightFlow-AI

FreightFlow-AI 现在定位为 **AI 订舱与 SO 识别工作台**。当前版本是 Next.js 单体应用：前端工作台、Next API、Prisma 数据层、OpenClaw 代理和 IMAP/SMTP 邮箱配置都在同一个仓库内。

- 左侧订舱任务队列
- 中间 Shipment 详情、订舱邮件入口、SO 状态
- 右侧 AI 订舱助手
- Shipment 主模型样例数据 + Prisma schema
- 自动订舱邮件草稿 / SO 识别 / Shipment 状态推进
- OpenClaw / 邮箱服务本地配置入口

无 PostgreSQL 时，读接口会回退 mock 数据，写接口会明确返回不可持久化错误，前端保留本地演示状态。

## 本地运行

```bash
npm install
npm run prisma:generate
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 当前 MVP 覆盖

- AI 订舱与 SO 识别首页
- Shipment 队列、详情、订舱邮件、SO 状态
- AI 订舱助手入口与 `/api/ai/openclaw` 代理
- Shipment / Contacts / Email settings / OpenClaw settings API
- IMAP/SMTP 配置测试与订舱邮件发送服务骨架
- 共享 shipment 动作状态机，前端本地状态和 API 持久化共用同一套推进逻辑

## 目录说明

- `src/app/page.tsx`: 路由壳，渲染 FreightFlow 工作台
- `src/app/layout.tsx`: 页面 metadata 与字体
- `src/app/api`: Next API 路由，覆盖 AI、shipments、contacts、settings、documents、emails
- `src/features/freightflow`: 工作台页面、modal、AI panel、详情面板和页面 helper
- `src/components/workbench-shell.tsx`: 左侧导航、头部和订舱任务队列
- `src/lib/freightflow-domain.ts`: 共享业务类型与 shipment 动作状态机
- `src/lib/freightflow-data.ts`: Prisma ↔ UI 数据映射、API 输入校验和持久化动作
- `src/lib/mock-data.ts`: Shipment 样例数据、状态、提醒和统计逻辑
- `src/lib/services`: 邮件与文档服务边界
- `prisma/schema.prisma`: PostgreSQL 数据模型
- `docs/booking-mvp.md`: 当前订舱 + SO OCR MVP 范围
- `AGENTS.md`: Agent 1/2/3 文件边界

## 下一步建议

1. Agent 2：新增 AI 订舱邮件草稿 API、SMTP 发送确认、IMAP 回邮同步与 SO 附件检测。
2. Agent 3：新增 SO 上传、OCR provider 边界、结构化抽取和高置信度字段回写。
3. Integration：订舱邮件发送 → 回邮发现 SO → OCR / 抽取 → 回写 Shipment。
4. 补 API route 单测和一条关键 E2E。

## OpenClaw 接口占位

当前前端 AI 面板会调用：

- `POST /api/ai/openclaw`

环境变量：

- `OPENCLAW_API_URL`: 你的 OpenClaw 服务地址
- `OPENCLAW_API_KEY`: 可选，Bearer Token

未配置时，接口会返回本地 stub 文本，方便先把前端工作流做通。
