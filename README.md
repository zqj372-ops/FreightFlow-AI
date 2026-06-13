# FreightFlow AI

FreightFlow AI 是一个面向加拿大、美国海运整柜与空运操作的 AI 工作台 MVP。当前版本先把 PRD 里的核心操作面板落到前端，包括：

- 左侧物流操作菜单
- 中间 Kanban 看板
- 右侧 AI 助手与优先事项
- Shipment 主模型样例数据
- 自动催单 / 截补料提醒 / 异常中心摘要

这版先做前端业务骨架，方便你确认信息架构和操作节奏；后续可继续接 NestJS、PostgreSQL、IMAP/SMTP、OCR 与模板生成。

## 本地运行

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 当前 MVP 覆盖

- 订舱工作台首页
- 柜子主视图和状态流转分栏
- 红黄绿异常分级
- 补料 / AMS / ACI / ISF 进度概览
- AI 助手示例入口

## 目录说明

- `src/app/page.tsx`: FreightFlow AI 操作台主页
- `src/lib/mock-data.ts`: Shipment 样例数据、状态、提醒和统计逻辑
- `src/app/globals.css`: 全局主题和基础样式

## 下一步建议

1. 新建 NestJS API，先把 `shipments / emails / reminders / documents / users` 跑通。
2. 接 PostgreSQL，把当前 `mock-data.ts` 替换成真实接口。
3. 新增邮件中心服务，接腾讯企业邮箱 IMAP / SMTP。
4. 接 SO 识别与 Word / Excel 补料模板生成。

## OpenClaw 接口占位

当前前端 AI 面板会调用：

- `POST /api/ai/openclaw`

环境变量：

- `OPENCLAW_API_URL`: 你的 OpenClaw 服务地址
- `OPENCLAW_API_KEY`: 可选，Bearer Token

未配置时，接口会返回本地 stub 文本，方便先把前端工作流做通。
