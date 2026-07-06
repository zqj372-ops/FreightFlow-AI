# FreightFlow-AI

FreightFlow-AI 现在定位为 **AI 订舱与 SO 识别工作台**。当前版本是 Next.js 单体应用：前端工作台、Next API、Prisma 数据层、AI 大模型代理和 IMAP/SMTP 邮箱配置都在同一个仓库内。

- 左侧订舱任务队列
- 中间 Shipment 详情、订舱邮件入口、SO 状态
- 右侧 AI 订舱助手
- Shipment 主模型样例数据 + Prisma schema
- 自动订舱邮件草稿 / SO 识别 / Shipment 状态推进
- AI 大模型 / 邮箱服务本地配置入口

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
- Shipment / Contacts / Email settings / AI model settings API
- IMAP/SMTP 配置测试与订舱邮件发送服务骨架
- 共享 shipment 动作状态机，前端本地状态和 API 持久化共用同一套推进逻辑

## 目录说明

- `src/app/page.tsx`: 路由壳，渲染 FreightFlow 工作台
- `src/app/layout.tsx`: 页面 metadata 与字体
- `src/app/api`: Next API 路由，覆盖 AI、shipments、contacts、settings、documents、emails
- `src/features/freightflow`: 工作台页面、modal、AI panel、详情面板和页面 helper
- `src/features/booking`: SO 上传与识别结果面板
- `src/components/workbench-shell.tsx`: 左侧导航、头部和订舱任务队列
- `src/lib/booking`: 订舱邮件草稿、AI JSON 草稿增强和发送校验
- `src/lib/email`: IMAP 回邮解析、附件检测和 Shipment 匹配
- `src/lib/freightflow-domain.ts`: 共享业务类型与 shipment 动作状态机
- `src/lib/freightflow-data.ts`: Prisma ↔ UI 数据映射、API 输入校验和持久化动作
- `src/lib/mock-data.ts`: Shipment 样例数据、状态、提醒和统计逻辑
- `src/lib/so`: SO OCR 边界、AI JSON 抽取增强、字段校验与回写映射
- `src/lib/services`: 邮件与文档服务边界
- `prisma/schema.prisma`: PostgreSQL 数据模型
- `docs/booking-mvp.md`: 当前订舱 + SO OCR MVP 范围
- `AGENTS.md`: Agent 1/2/3 文件边界

## 下一步建议

1. 启动真实 PostgreSQL，跑 `prisma migrate deploy` + seed，验证刷新后状态和日志持久化。
2. 填真实 IMAP/SMTP 配置并保存测试，验证真实订舱邮件和回邮附件同步。
3. 接真实 OCR provider，替换 `src/lib/so/so-ocr.ts` 的 not-configured 分支。
4. 填真实 AI provider API Key，回归订舱 JSON 草稿和 SO JSON 抽取增强。

外部资源填好后跑:

```bash
npm run verify:external
```

OCR provider 需要兼容 JSON contract:请求体包含 `fileName / mimeType / fileBase64`,响应包含 `rawText` 或 `text`。

## AI 大模型接口

当前前端 AI 面板会调用：

- `POST /api/ai/openclaw`

环境变量：

- `AI_PROVIDER`: 供应商，例如 `openai / anthropic / gemini / deepseek / qwen / openrouter / custom`
- `AI_API_KEY`: 对应供应商 API Key
- `AI_MODEL`: 可选模型名；也可以在设置弹窗里保存 key 后自动拉取模型列表并切换
- `AI_BASE_URL`: 自定义或覆盖供应商 Base URL
- `AI_TIMEOUT_MS`: 可选，请求超时，默认 `30000`
- 兼容旧变量：`OPENCLAW_API_URL / OPENCLAW_API_KEY / OPENCLAW_MODEL / OPENCLAW_TIMEOUT_MS`

未配置时，接口会返回本地 stub 文本，订舱邮件和 SO 抽取会回退到本地确定性逻辑。
