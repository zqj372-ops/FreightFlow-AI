# FreightFlow AI

FreightFlow AI 是一套面向货代(Freight Forwarder)的自动化作业系统。产品目标是把货代日常 70% 的“催、抄、录、查”交给系统完成，并把订舱、SO 识别、补料、柜子跟踪、报关/清关、派送、财务识别整合成一个内部操作工作台与自动化机器人中枢。

当前仓库是该系统的 Web MVP：先跑通“订舱工作台 + IMAP 邮件识别 + 操作员确认 + 订舱/补料文档生成”的核心链路，再逐步扩展到 OpenClaw + MiniMax M3 识别、外部 API 和桌面端。

## 本地运行

```bash
npm install
npm run db:up
npm run prisma:migrate:deploy
npm run prisma:seed
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

> 没有 Docker 或没有配置 `DATABASE_URL` 时,应用会回退到本地 mock repository;上传文件仍会保存到 `.freightflow/storage`。

## 常用验证

```bash
npm run prisma:validate
npm run lint
npm test
npm run build
npm run e2e
```

`npm run e2e` 使用 Playwright 复用或自动启动 `127.0.0.1:3000`,覆盖首页、SO 上传 OCR 和邮件同步按钮。

## 当前 MVP 覆盖

- 订舱工作台首页、左侧二级菜单和顶部快捷操作
- 订舱队列、红黄绿异常分级、操作员筛选和搜索
- 单击队列卡片查看/编辑订舱跟踪详情
- 新建订舱计划弹窗、批量生成订舱草稿、操作员确认后发送
- IMAP 邮件拉取服务骨架、mock 拉信兜底和邮件识别队列
- 托书 Word 与补料 Excel 模板生成接口
- 真实附件上传、本地文件存储、图片/文本 OCR 和 SO 字段规则抽取
- PostgreSQL + Prisma 数据模型、Tokyo PostgreSQL SSH 隧道接入路径
- OpenClaw 配置入口和 AI 副驾审计基础

## 目录说明

- `docs/product-design.md`: 货代自动订舱系统完整产品设计说明
- `docs/project-overview.md`: 项目定位、范围、运行方式和当前 MVP 边界
- `src/features/freightflow/`: 订舱工作台、弹窗、详情面板、AI 副驾和业务 helper
- `src/lib/services/email/`: SMTP 发送、IMAP 拉取、mock provider 和同步服务
- `src/lib/services/documents/`: 托书 / 补料文档生成服务
- `src/lib/repositories/`: Prisma / mock repository 抽象层

## 下一步建议

1. 优先跑通 SO 识别闭环：IMAP 拉信 → M3/OCR 抽取 → 复核队列 → 操作员确认写回。
2. 完善订舱/催单机器人：2h 软催、4h 硬催、8h 弹窗电话提醒。
3. 扩展补料流程：提柜 + 收发通齐备后自动亮起补料表单，生成 SI Excel 并发送。
4. 补齐外部 API 文档：客户下单、报关行状态、国外代理清关、装载/派送回推。

## OpenClaw 接口占位

当前前端 AI 面板会调用：

- `POST /api/ai/openclaw`

环境变量：

- `OPENCLAW_API_URL`: 你的 OpenClaw 服务地址
- `OPENCLAW_API_KEY`: 可选，Bearer Token

未配置时，接口会返回本地 stub 文本，方便先把前端工作流做通。
