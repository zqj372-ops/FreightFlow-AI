# Ops Console Robot Hub UI Design

## Goal

把 FreightFlow AI 首页调整为更明确的内部操作工作台:左侧找柜,中间处理当前柜,右侧集中处理自动化机器人生成的待办。页面必须保持中文优先、高信息密度、人工确认边界清晰,并避免营销页或大面积装饰风格。

## Selected Direction

用户选择方案 C: **操作台 + 机器人中台栏**。

布局含义:

- 左侧:Shipment 队列,用于搜索、筛选、定位当前柜。
- 中间:当前柜执行区,用于展示状态、下一步、关键字段和人工动作。
- 右侧:机器人中台栏,集中展示待发订舱计划、邮件识别队列和 AI 副驾。

## Product Principles

- 自动化只生成待办和建议,不能绕过人工确认。
- 操作员必须能在一个屏幕内看到“当前柜 + 待发订舱 + 邮件识别”。
- 视觉风格应是安静、密集、可扫描的 SaaS 操作台,不是宣传型 landing page。
- 卡片圆角保持 8px 左右,按钮高度满足可点击性,图标来自 lucide-react。
- 文案继续中文化,尤其是机器人中台边界:确认写入、标记异常、忽略、批量生成草稿。

## Layout Design

Desktop 宽屏采用三列:

- Sidebar navigation:现有左侧深色导航保留。
- Main work area:`QueuePanel` + 当前柜执行区。
- Robot hub rail:宽度约 360-420px,包含待发订舱计划、邮件识别队列、AI 副驾。

在 1280-1799px 范围内,主内容采用 `QueuePanel` + 中间详情 + 下方机器人模块的混合布局,避免过窄右栏导致文本挤压。

移动端顺序:

1. Header 和指标条
2. Shipment 队列
3. 当前柜详情和动作面板
4. 机器人中台模块
5. AI 副驾

## Component Changes

### Workbench Page

`src/features/freightflow/workbench-page.tsx` 应新增语义分区:

- `queue` 区域:只放 `QueuePanel`。
- `execution` 区域:放 `ShipmentDetailPanel`、`ShipmentFieldPanel`、`ShipmentActionPanel`。
- `robot hub` 区域:放 `BookingPlanPanel`、`EmailRecognitionPanel`、`AiCopilotPanel`。

### Robot Hub Header

新增一个小型右栏标题块,展示:

- 标题:`机器人中台`
- 副文案:`订舱草稿、邮件识别和人工确认写回集中处理`
- 指标:待发计划数、待确认邮件数、异常邮件数。

### Booking Plan Panel

将面板视觉改为更紧凑的队列风格:

- 顶部保留批量生成按钮。
- 列表项突出批次号、状态、航线、资料风险。
- 可勾选项应有清晰 hover/focus/disabled 状态。

### Email Recognition Panel

更新说明文案为: `IMAP 邮件同步后进入待确认队列;操作员确认后才写回 Shipment。`

动作按钮保持三类:

- `确认写入`:主按钮。
- `标记异常`:危险/红色次按钮。
- `忽略`:普通次按钮。

未匹配 Shipment 或 UNKNOWN 时禁用确认写入。

## Visual System

- 背景用浅灰 `bg-slate-100` 或 `bg-slate-50`,工作区卡片白底。
- 主色继续使用 cyan,但减少大面积 cyan 卡片,避免单色主题。
- 异常使用 red,可生成/成功使用 emerald,待处理使用 amber,普通状态使用 slate。
- 主内容卡片边框统一 `border-slate-200`,阴影轻量。
- 文本不使用负字距;小标签使用正常 letter spacing 或现有 uppercase 标签。

## Validation

实现后必须验证:

- `npm run lint`
- `npm test`
- `npm run build`
- 本地浏览器打开首页,确认可见中文文案:`机器人中台`、`待发订舱计划`、`邮件识别队列`、`确认写入`。
- 截图或 DOM 检查确认桌面布局没有重叠和明显横向溢出。

## Out Of Scope

- 不接入真实 IMAP 拉取。
- 不新增登录权限。
- 不重做全部视觉品牌。
- 不新增复杂拖拽或多页面路由。
