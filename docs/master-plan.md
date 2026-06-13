# FreightFlow AI · 总控计划

> 总控契约。本文件记录 5 个并行子项目的职责、依赖、验收顺序和线程映射。
> 每个子项目完成后,必须更新相关稳定文档并追加 [handover.md](./handover.md) 变更记录。

## 1. 当前基线

总控检查时间:2026-06-11。

已确认:

- 项目目录:`/Users/autumn/Documents/Codex/freightflow-ai`
- 当前目录不是 git 仓库。
- `npm run prisma:validate` 通过。
- `npm run lint` 通过。
- 已存在 Prisma 数据层文件:
  - `prisma/schema.prisma`
  - `prisma.config.ts`
  - `src/lib/prisma.ts`
- `prisma/schema.prisma` 已覆盖 `docs/database.md` 提议的核心表:
  - `shipments`
  - `shipment_document_progress`
  - `shipment_exceptions`
  - `shipment_reminder_flags`
  - `contacts`
  - `shipment_action_logs`
  - `shipment_email_logs`
  - `shipment_email_recipients`
  - `ai_requests`

## 2. 5 个并行子项目

| 子项目 | 负责人线程 | 目标 | 主要边界 |
| --- | --- | --- | --- |
| 1. 数据层/API | `019eb60b-d19e-7c01-a522-dc5c6891a638` | Prisma schema 审核、shipments/contacts/action APIs、seed/migration 路径 | 不大改 `page.tsx` |
| 2. 邮件与文档流 | `019eb60b-f90f-7871-ae81-db5d10799f11` | 邮件发送抽象、email log API 形状、SO/补料文档抽象 | 不接真实 SMTP/OCR,先做可替换接口 |
| 3. 前端拆分 | `019eb60c-1c1b-7380-918c-dff865d8cf2b` | 拆 `page.tsx`、抽 BookingModal/AiCopilotPanel/详情面板、统一 ActionTile | 不改 Prisma/API |
| 4. AI 审计 | `019eb60c-3e23-7cf0-b78c-540552c7aeea` | `openclaw` 路由审计、`ai_requests` 记录、历史查询接口 | 保持 stub 模式和前端兼容 |
| 5. 测试发布基线 | `019eb60c-60b2-73e0-9ae0-9f1ae0af5943` | Vitest/单测/AI route 测试、`npm test`、lint/build/test 三件套 | 不依赖真实 DB/SMTP/OpenClaw |

## 3. 合并与验收顺序

推荐顺序:

1. **子项目 5** 先落测试基线,因为其它子项目可以立即复用测试脚本。
2. **子项目 1** 完成数据/API,为邮件、AI 审计提供写入层。
3. **子项目 4** 接 AI 审计,依赖 `ai_requests` 模型与 Prisma client。
4. **子项目 2** 接邮件/文档服务抽象,依赖 email log/action log 形状。
5. **子项目 3** 前端拆分,最后再选择是否接入真实 API。

## 4. 全局验收命令

最终交付前至少运行:

```bash
npm run prisma:validate
npm run lint
npm test
npm run build
```

如缺少数据库服务导致 migration/seed 不能跑,必须在 [handover.md](./handover.md) 写明阻塞原因与本地启动方式。

## 5. 文档同步要求

- 数据/API 变化:更新 [database.md](./database.md)、[todo.md](./todo.md)、[handover.md](./handover.md)。
- 业务规则变化:更新 [business-rules.md](./business-rules.md)、[handover.md](./handover.md)。
- 前端结构变化:更新 [project-overview.md](./project-overview.md)、[handover.md](./handover.md)。
- 新测试/命令:更新 [project-overview.md](./project-overview.md)、[todo.md](./todo.md)、[handover.md](./handover.md)。

---

本文件是总控入口。新会话先读 [project-overview.md](./project-overview.md),再读本文件。
