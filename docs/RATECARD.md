# 数据卡格式（ratecard.json）

**简体中文** · [English](./en/RATECARD.md)

数据卡是官方定价事实与订阅供应商查询 spec 的带版本来源。内置卡位于 `src/pricing/ratecard.json`；导入/拉取的生效卡存于宿主 storage，启动时先于首次折叠应用，**应用始终手动**（面板见[配置 → 数据包](./CONFIGURATION.md#数据包运行时价格更新)）。校验在宿主边界（`src/pricing/card-schema.js` 的 `validateCard`），错误按 `字段路径: 原因` 单行给出。

- [顶层字段](#顶层字段)
- [pricing](#pricing)
- [calendar](#calendar)
- [providers](#providers)

## 顶层字段

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `cardSchema` | 字面量 `3` | 语法代际的判定依据；新增字段必须递增 |
| `version` | 正整数 | 内容版本；改价时递增，面板显示核对日 |
| `checkedAt` | `YYYY-MM-DD` | 官方价核对日期 |
| `source` | 字符串 | 官方价来源 URL |

## pricing

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `usdToCny` | 正数 | USD→CNY 折算初值（默认 6.8） |
| `peakHours` | 0–23 整数数组 | 北京时间高峰小时（默认 `[9,10,11,14,15,16,17]`） |
| `auxPriceAs` | 字符串 | 辅助调用按哪个模型计价（默认 `deepseek-flash`） |
| `auxShape` | `{miss, hit, out}` 非负 | 辅助调用 token 形状初值 |
| `modelAliases` | `旧id → 规范id` | 已下线 id 的别名（如 `deepseek-v4-flash → deepseek-flash`） |
| `schedules` | 数组，≥1 | 生效日价目，**最新在前**（`from` 降序） |
| `feeWindows` | 数组 | 按次费窗口 |

**`schedules[]`** = `{ from: "YYYY-MM-DD", rules: [...] }`，每条 rule：

| 字段 | 必填 | 含义 |
| --- | --- | --- |
| `model` | ✓ | 模型 id |
| `input` / `cacheRead` / `output` | ✓ | 谷时三价，**每百万 token**，非负 |
| `peak` | | `{input, cacheRead, output}` 峰时三价；缺席即平价 |
| `weekdaysOnly` | | 高峰是否仅工作日，默认 `true`（缺席即 true）；`false` 则高峰每天算 |
| `currency` | | `CNY`（默认）或 `USD` |

**`feeWindows[]`** = `{ appliesTo, from: "YYYY-MM-DD", until, cnyPerCall }`：

- `until` 必须带**显式 UTC 偏移**（如 `2026-11-18T12:00:00+08:00`）且晚于 `from`。无偏移的时间戳按宿主本地时区解析，同一张卡在 UTC 与 UTC+8 机器上会算出不同的费用。
- `appliesTo: "server-side-search"` 必须**恰一条**；derive 只读第一条匹配，多出的窗口会被静默忽略。

## calendar

`holidays`：`YYYY-MM-DD` 数组（中国国务院历）。节假日与周末一样按**谷价**计：峰谷判定把两者都视为非工作日。

## providers

`providers[]` 是订阅供应商的**声明式查询 spec**，由 `src/quota-adapters/spec-engine.js` 解析为归一化结果。内置四个：`zai-coding` / `kimi-coding` / `minimax` / `opencode-go`（路由与返回见[配置 → 订阅额度](./CONFIGURATION.md#订阅额度)）。

每个 spec 描述接口事实：路由认领、host 变体、认证、端点路径、字段别名链与口径变换。端点漂移改卡即可，不用发版。**完整字段语法以 `src/pricing/card-schema.js`（`providerSpecSchema`）与 `spec-engine.js` 头注释为权威**，本文不重复。骨架与硬约束：

- 必填：`id` / `label` / `routes` / `hosts` / `auth`（`bearer` | `raw`）/ `requests`。
- 可选：`windows[]`（窗口）、`extras[]`（辅助计数）、`plan`（套餐名/档位/费用）、`errorGate`、`envKeys`。
- host 必须 http(s) URL，**http 仅接受环回地址**：`auth: bearer` 把凭据放进每个请求的 Authorization 头，明文 http 等于把凭据直接暴露在网络上。
- request id 唯一；每个 `request` 引用必须指向已声明端点。
- 供应商 id 唯一；同一路由不得被两个 spec 认领。

改 `routes` / `hosts` / `auth` / `envKeys` 的卡会改变凭据去向，应用前要在预览里逐行确认，见[配置 → 数据包](./CONFIGURATION.md#数据包运行时价格更新)。

自定义第三方路由走设置表单（保存为 `quotaSpecs`），不必改卡；语法无法表达的形状，仍可编写遵循 `src/quota-adapters/types.js` 契约的代码适配器。