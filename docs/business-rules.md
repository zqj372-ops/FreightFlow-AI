# FreightFlow AI · 业务规则

> 稳定契约。本文件描述 Shipment 状态机、看板列映射、告警分级、催单与截补料时间线。
> 任何对本文件内容的修改,都应同步追加变更说明到 [handover.md](./handover.md)。

## 1. ShipmentStatus 状态机

`ShipmentStatus` 是 `src/lib/mock-data.ts` 中定义的字符串字面量联合类型,共 19 个值,分布在 5 个看板列里。

### 1.1 全部枚举值

```
已发送订舱, 等待放舱, 已催放舱, 已放舱,
待补料, 已发送补料, 等待补料确认, 补料已确认,
待报关, 已报关,
待提柜, 已提柜, 已装柜, 已还柜,
已开船, 已到港, 已签收, 已完成,
异常处理中
```

### 1.2 看板列与状态映射

定义在 `statusColumns`(`src/lib/mock-data.ts`):

| 列 key | 标题 | 包含状态 |
| --- | --- | --- |
| `waiting-release` | 等待放舱 | `已发送订舱`, `等待放舱`, `已催放舱` |
| `released` | 已放舱 | `已放舱` |
| `pending-docs` | 待补料 | `待补料`, `已发送补料`, `等待补料确认`, `补料已确认` |
| `sailed` | 已开船 | `已开船`, `已到港`, `已签收`, `已完成` |
| `exception` | 异常 | `异常处理中` |

注:`待报关 / 已报关 / 待提柜 / 已提柜 / 已装柜 / 已还柜` 这 6 个状态当前没有看板列承载,需要显示时应新增列或归并到现有列。

## 2. 告警分级(红黄绿)

定义见 `getAlertLevel()`(`src/lib/mock-data.ts`):

| 级别 | 触发条件 |
| --- | --- |
| **red** | `exceptions.length > 0` 或 `hoursToCutoff <= 6` |
| **yellow** | `hoursToCutoff <= 24` 或 `followUpCount > 0` |
| **green** | 其它 |

色板对应:

- red:dot `bg-red-500`,边框 `border-red-200`
- yellow:dot `bg-amber-500`,边框 `border-amber-200`
- green:dot `bg-emerald-500`,边框 `border-emerald-200`

实现细节见 `levelDot` / `levelBadge`(`src/features/freightflow/page-helpers.ts`)。

## 3. 自动催单规则

产品目标规则:

- 订舱邮件采用“一笔一封”。
- 操作员必须预览正文 + 附件后手动确认发送,系统不得直接对外自动发送首封订舱邮件。
- 发送后进入 `订舱已发送 / 等待放舱`。
- T+2h 未读或未响应:软催邮件。
- T+4h 未回:硬催邮件,抄送主管。
- T+8h 仍未回:弹窗提示,操作员人工电话。
- 代理回信后由 M3 / 规则分类为:放舱、拒舱、改价/改时间、已读不回、异常。

当前 MVP 规则源自 `timelineRules`(`src/lib/mock-data.ts`):

- 等待放舱超过 4 小时自动发催单邮件,并累计 `followUpCount`。
- `hoursWaitingRelease >= 4` 不会直接触发红色异常,但会进入"等待放舱"列的持续跟踪视图。

## 4. 截补料提醒规则

源自 `timelineRules`(`src/lib/mock-data.ts`):

- 截补料前 24 / 12 / 6 小时分级提醒。
- 6 小时进入红色异常(`hoursToCutoff <= 6`)。

## 5. 文档状态机(AMS / ACI / ISF)

`documentProgress.{ams, aci, isf}` 共用同一组三态:

```
待处理 → 草稿完成 → 已发送
```

- 进入看板 `pending-docs` 列后,`documentProgress` 才会被实际推进。
- 推进路径由前端动作流驱动(AMS/ACI/ISF 动作按钮)。

## 6. 邮件状态机

`mailStatus` 三态:

```
未发送 → 已发送 → 跟进中
```

- 订舱 modal "确认发送"后将 `mailStatus` 从 `未发送` 推到 `已发送`。
- 代理回复慢时进入 `跟进中`(当前由 UI 判断,未持久化)。

## 7. SO 识别状态机

`soStatus` 二态:

```
待识别 → 已识别
```

- 触发:SO 识别动作完成后推进。

产品目标识别规则:

- IMAP 每 15 分钟拉取专用邮箱。
- 邮件正文走 M3 文本识别,PDF 附件走视觉识别。
- SO 抽取至少覆盖:SO号、船公司、船名、航次、起运港、目的港、ETD、截单/截重/截关、柜型柜量、特殊说明。
- 字段校验采取“宽松,只标黄不阻断”。
- 复核界面应提供“原文/附件 + 字段表单 + 置信度 + 高亮定位”。
- 只有操作员确认后,SO 信息才允许写回 Shipment 并触发下游状态。

## 8. 补料文档状态机

`documentStatus` 四态:

```
待生成 → 处理中 → 已发送 → 已确认
```

- 待生成:初始。
- 处理中:操作员生成草稿。
- 已发送:已发送给代理或客户。
- 已确认:代理确认回邮。

产品目标补料触发规则:

- 提柜完成后,柜号 + 封号必须先入库。
- 发货人 / 收货人 / 通知人(收发通)必须齐备。
- 上述两个条件都满足后,后端事件触发(WebSocket 推前端),补料表单自动亮起。
- 操作员确认 / 补充后生成 SI Excel 附件。
- 代理回“确认”则通知操作员并推进状态;代理回“让改”则重新走完整补料流程。

## 8.1 主数据联动规则

| 字段 | 源头模块 | 下游规则 |
| --- | --- | --- |
| SO/提单号 | 订舱 / SO识别 | 其它模块只读;源头修改时弹窗确认后同步 |
| 柜号 | 提柜 | 其它模块只读;源头修改时弹窗确认后同步 |
| 收发通 | 补料 | 其它模块只读;源头修改时弹窗确认后同步 |

源头字段修改时,必须提示:“将同步给下游模块,是否继续?”。

## 8.2 柜子生命周期规则

目标生命周期:

```text
提柜(空柜出场) → 装柜 → 还柜/进港 → 报关放行 → 装船 → 中转 → 到港 → 卸船 → 提柜 → 还空柜 → 完结
```

看板应逐步从当前订舱状态列扩展为:提柜中、在途、到港、派送中、已提货。

## 8.3 财务识别规则

- 账单输入支持 PDF / Excel / 扫描件。
- PDF 和扫描件走 OCR + M3,Excel 直接读 cell。
- 账单识别结果必须强制人工复核再入账。
- 匹配方式同时支持 SO/提单号 与 柜号。
- 海运费展示分为预估与最终,差异 > 5% 标红。

## 9. 主操作台交互规则

- **状态列筛选**:点击顶部列切换 `activeColumn`,列表只显示该列下的 shipment。
- **搜索**:对 `batchNo / soNo / containerNo / carrier / destinationPort / operator / status` 做大小写不敏感的子串匹配。
- **负责人筛选**:从所有 `operator` 去重排序后生成下拉,`all` 表示不限。
- **告警筛选**:`all | red | yellow | green`。
- **推荐动作**:`pickRecommendedAction`(位于 `src/app/page.tsx`)根据 shipment 状态挑出一个推荐按钮。

## 10. AI 副驾交互规则

- 快捷 prompt 三条,定义在 `quickPrompts`(`src/features/freightflow/page-helpers.ts`)。
- 自定义 prompt 支持任意输入。
- 调用 `POST /api/ai/openclaw`,body 含 `prompt / shipmentId / context`。
- 路由行为:见 [project-overview.md §6](./project-overview.md#6-环境变量) 与 `src/app/api/ai/openclaw/route.ts`。

## 11. 规则演进约束

- 新增 `ShipmentStatus` 值时,必须同步更新 `statusColumns`,否则该状态会"无家可归"。
- 调整告警阈值时,`getAlertLevel` 是单一权威函数,所有 UI 直接消费它。
- 任何业务规则的改动都应附 1 条 mock-data 条目作为回归样例,并追加变更说明到 [handover.md](./handover.md)。

---

变更请追加到 [handover.md](./handover.md),本文件为稳定契约。
