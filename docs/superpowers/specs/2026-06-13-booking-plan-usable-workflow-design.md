# Booking Plan Usable Workflow Design

## Goal

把首页从“展示型工作台”推进为可实际操作的订舱计划入口。用户选择方案 A:当前柜子只显示简介,明细点击进入抽屉查看;新建订舱计划放到顶部命令区,可以基于当前柜快速生成待发订舱草稿。

## Selected Flow

1. 操作员在左侧队列选中当前柜。
2. 中间区域显示当前柜简介:批次、SO、柜号、航线、柜型、船名航次、ETD/ETA、截补料时间、状态、AI 摘要、下一步。
3. 操作员点击 `查看明细`,右侧/弹层打开 Shipment 明细抽屉,查看基础字段、时间地点、单证进度、提醒/异常。
4. 操作员点击顶部 `新建订舱计划`,系统优先用当前柜创建/勾选订舱计划并生成中文订舱草稿。
5. 草稿生成后仍进入待发计划/草稿确认流程,不会自动发送邮件。

## Product Rules

- 当前柜简介不能把所有字段塞在主屏,只展示可决策的摘要。
- 明细抽屉必须可关闭,不改变当前选柜状态。
- 顶部 `新建订舱计划` 是实际动作,不是占位按钮。
- 若当前柜资料齐全且订舱邮件尚未实际发送,点击后调用现有批量草稿接口生成单票草稿；`跟进中` 仍可进入待发草稿确认。
- 若资料缺失或已发送,给出中文 toast,不生成草稿。
- 所有订舱草稿仍需人工确认后发送。

## UI Changes

- `WorkbenchHeader` 新增一个主操作按钮 `新建订舱计划`,使用 lucide 图标,放在顶部动作组最前或最醒目位置。
- `ShipmentDetailPanel` 改为简介卡,新增两个按钮:
  - `查看明细`
  - `用此柜新建订舱计划`
- 新增 `ShipmentDetailDrawer`,展示明细分组:
  - 基础信息
  - 航线与时效
  - 作业地点
  - 单证与提醒
- `BookingPlanPanel` 继续作为机器人中台里的待发队列,负责批量生成草稿。

## Data And Behavior

新增或复用纯函数:

- `buildShipmentBrief(shipment)`:生成简介卡字段。
- `buildShipmentDetailGroups(shipment)`:生成明细抽屉分组。
- `canCreateBookingPlanFromShipment(shipment)`:复用订舱计划 readiness 规则,返回可创建状态与中文原因。

顶部新建动作:

- 如果可创建,调用现有 `batchGenerateBookingDrafts([shipment.id])`。
- 成功后刷新 `bookingPlans`,toast 显示成功/跳过/失败数量。
- 失败时显示 API 错误,不改变本地 shipment 状态。

## Validation

- 为简介/明细/可创建判断写 Vitest 测试。
- `npm test`
- `npm run lint`
- `npm run build`
- 浏览器验证首页可见 `新建订舱计划`,当前柜卡片可见 `查看明细`,点击后出现 `当前柜子明细`,点击新建能触发草稿生成 toast 或明确提示。

## Out Of Scope

- 不新增真实 DB 表。
- 不新增完整新建 Shipment 表单。
- 不绕过人工确认发送邮件。
- 不重做邮件发送配置或真实 IMAP 拉取。
