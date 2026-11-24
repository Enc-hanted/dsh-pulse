# 配置参考

**简体中文** · [English](./en/CONFIGURATION.md)

日常配置都在 Web 界面的 **设置 → 用量观测台** 里完成。本页是完整参考。

- [设置页](#设置页)
- [按 profile 覆盖](#按-profile-覆盖)
- [费用模型](#费用模型)
- [数据包（运行时价格更新）](#数据包运行时价格更新)
- [官方余额](#官方余额)
- [订阅额度](#订阅额度)
- [常驻快显](#常驻快显)
- [手动检查更新](#手动检查更新)
- [数据与存储](#数据与存储)

## 设置页

设置 → 用量观测台 分三个标签页：

- **定价与费用 (Pricing & cost)**：编辑单价。模型行只来自 Models 设置页的模型配置，DeepSeek 官方价自动回填；只保存你改过的行，未改的跟随官方默认，「恢复官方价」把某行重置为未修改状态。每行设谷时三价、CNY/USD 选择器与高峰条（默认官方窗口，全取消即平价）；供应商分组带「月付费」开关；底部可配模型颜色或恢复自动。
- **方案对比 (Compare plans)**：在可调的用量场景下比较各模型费率的预估成本；方案取自定价页的有效规则，随费率改动同步。可临时添加方案、逐个显隐，场景可取自真实用量窗口。
- **设置 (Settings)**：面板显隐与侧栏余额开关、主题（蓝 / 粉 / 橙 / 黑白，各带亮暗两版）、按供应商关闭订阅额度查询、「常驻快显来源」选择器、「用量/金额查询接口」自定义接口面板，以及底部「关于」面板的手动检查更新。

**月度预算 (Monthly budget)** 是仪表盘上的一张卡片：设定 CNY 预算，显示本月已用、进度条与按日均速率外推的月底预测。

主题、面板开关、预算、对比方案与浮层宽度存浏览器 localStorage（`dsh-pulse:*`）；其余经宿主设置服务保存。保存立即生效，重启后仍然保留；过期写入返回 HTTP 409，编辑器自动刷新本地副本供重试。宿主没有设置服务时页面只读。

## 按 profile 覆盖

默认值由 bundle 自行注入活跃 profile patch。要覆盖，就在 `cordis.patch.yml` 里加一行 `pulse`：

```yaml
- insert:
    - id: pulse
      name: 'dsh-pulse'
      config:
        defaultDays: 30   # window served when the client sends none
        topProjects: 8    # ranked-project row cap
        projectDepth: 1   # path segments kept in a project label (1..3)
        costEnabled: true # false hides the cost figures
        usdToCny: 6.8     # USD→CNY rate for the unified CNY total
        monthlyProviders: []   # monthly-subscription provider route ids; their models cost 0
        monthlyFee: {}         # provider route id → monthly fee (CNY/mo), surfaced in plan comparison
        quotaOff: []           # provider route ids with subscription-quota queries switched off
        footSource: ""         # quick-display source: "" = auto, "official", or a provider route id
        quotaSpecs: {}         # route id → custom query spec (the card's declarative wire grammar)
        searchShape: {}        # manual search-call shape {miss, hit, out} (tokens per call); empty = self-calibrating
        pricing:          # per-model overrides of the built-in defaults
          - model: deepseek-v4-pro
            input: 4.5
            cacheRead: 0.15
            output: 13.5
            peak:         # peak-hour rates (official windows by default)
              input: 9
              cacheRead: 0.3
              output: 27
            currency: CNY
          - model: third-party-x        # flat USD rule with custom peak hours
            input: 0.5
            output: 2
            currency: USD
            peakHours: [0, 1, 2, 3, 4, 5]   # Beijing-time hours billed at peak
          - model: weekend-peak         # these hours count as peak every day (weekends included)
            input: 1
            output: 2
            peak: { input: 2, output: 4 }
            peakHours: [9, 10, 11]
            weekdaysOnly: false
          - provider: pi-ai             # prices only that provider's same-named model
            model: deepseek-v4-flash
            input: 2
            output: 4
```

## 费用模型

单价为**每百万 token 的 CNY 金额**；默认值来自官方价格页
<https://api-docs.deepseek.com/zh-cn/quick_start/pricing/>（核对于 2026-11-18）。
DeepSeek 按峰谷时段计费：北京时间 **09:00–12:00** 与 **14:00–18:00** 为高峰，**仅周一至周五**；其余时段（含整个周末）谷价 = 峰价的一半。

| 模型 | 时段 | 未缓存输入 | 缓存命中输入 | 输出 |
|---|---|---|---|---|
| deepseek-flash | 高峰 | 2 | 0.04 | 8 |
| deepseek-flash | 谷时 | 1 | 0.02 | 4 |
| deepseek-v4-pro | 高峰 | 9 | 0.3 | 27 |
| deepseek-v4-pro | 谷时 | 4.5 | 0.15 | 13.5 |

单价放在带版本的数据卡（`src/pricing/ratecard.json`）里，调价即发新版本。已下线的旧 id（`deepseek-v4-flash`、`deepseek-v4-flash-vision-exp`）按 Flash 档计价。

规则可以更细：

- 高峰时段默认**仅工作日**生效；`weekdaysOnly: false` 让某条规则的高峰每天都算，`peakHours: []` 仍表示平价。
- 按**供应商**限定：`provider` 填供应商 route id 时只对该供应商的同名模型生效（精确匹配优先），留空则通配该模型 id 的所有供应商。
- 供应商可整体标记为**月付费**（`monthlyProviders`）：该供应商所有模型无需单价、费用按 0 边际计；可选的**月付金额**（`monthlyFee`）不进按量估算，只在方案对比里作为订阅行展示。

官方 `web_search` 与会话标题生成等辅助 LLM 调用本地没有 usage 事件；观测台按会话日志计数，合并为一行「辅助调用（估算）」，按事件当日官方价计费。面板根据官方余额序列自校准估算形状；手写 `searchShape`（键 `miss`/`hit`/`out`）可固定形状、停止自校准。服务端搜索的按次费仅在数据卡 `feeWindows` 指定的窗口内生效。

币种：自定义单价以 **CNY**（默认）或 **USD** 计价，官方价保留发布币种；USD 经 `usdToCny`（默认 6.8，定价页可改）折算，内部总额恒为单一 CNY 数字。**显示币种**（`displayCurrency`，设置页可切）让所有金额在同一处换算后显示，CSV 导出跟随。汇率不会自动更新，需手动维护。`costEnabled: false` 隐藏费用数字，其余功能不受影响。

## 数据包（运行时价格更新）

设置页的**数据包面板**管理带版本的数据卡 `src/pricing/ratecard.json`（schema 3）：来源状态、导出、导入、拉取、变更预览、恢复内置；**应用永远手动**。拉取源默认 jsDelivr 的仓库卡路径（`pricingCardSource` 可配），导入文件不需要网络。

- 峰谷时段变化会重新折叠全部历史，仅价格变化则不会。
- 已存储的卡损坏时，启动回退到内置卡；宿主无存储设施时覆盖仅在当前会话内生效。

卡的字段语义、结构与校验约束见[数据卡格式](./RATECARD.md)。**手改最容易出错的地方**：单价单位是每百万 token，误贴每千价会差 1000 倍，而校验仍然通过。

## 官方余额

自动用宿主已保存的 DeepSeek key 查询平台余额，无需额外配置；未配置 key 时余额块整体隐藏。查询历史记为余额快照（见[数据与存储](#数据与存储)）。

## 订阅额度

查询月付订阅的剩余额度，无需额外配置；可用 `quotaOff` 按供应商关闭。内置供应商按 Models 目录的路由自动识别：

| 供应商 | 路由 | 返回 |
| --- | --- | --- |
| zai-coding | `zai-coding-cn` / `zai-coding` / `zai` | 5h/周 token 窗口百分比、重置时刻、联网工具次数、套餐名与年/月费 |
| kimi-coding | `kimi-coding` / `kimi` | 周/5h 请求窗口百分比（只报百分比，无次数） |
| minimax | `minimax` / `minimax-coding` / `minimax-cn` | 5h/周窗口（社区文档口径，未实测） |
| opencode-go | `opencode-go` / `opencode` / `opencode-zen` | 5h/周/月窗口百分比与绝对额度（社区口径，未实测） |

**自定义查询接口**：设置 → 「用量/金额查询接口」为未被内置 spec 认领的第三方路由提供表单（host / 路径 / 认证 / 百分比别名链 / 重置字段 / 口径），「试查询」返回归一化预览（不写快照、不进缓存），保存到 `quotaSpecs`。被内置 spec 认领的路由只能「查看内置」只读预览。原始 spec 语法见 `src/quota-adapters/spec-engine.js` 头注释。

## 常驻快显

`footSource`（设置 → 「常驻快显来源」）选择 **web 侧栏页脚**显示的源：`""` 自动（官方余额优先，否则首个已应答订阅）、`official` 官方余额、或某个订阅路由 id。无查询接口的供应商不参与。

**快显样式**（同面板）：经典（默认）或数据两种。

## 手动检查更新

**设置 → 用量观测台 → 「设置」→ 「关于」**（该标签页底部）显示当前版本；「检查更新」按钮手动询问一次 npm registry。绝不自动检查：没有定时器，加载时也不探测。

## 数据与存储

用量统计没有插件私有的历史缓存：**事实来源是 dsh 自己的会话日志**，每个数字都在请求时折出。

| 数据 | 位置 | 归属 | 删掉会怎样 |
| --- | --- | --- | --- |
| 原始用量事件（每个 step 的 token 与计费依据） | `~/.dsh/sessions/` | dsh | 历史永久丢失 |
| `pulseUsage` 投影缓存 | `~/.dsh/storages/session_projcache.json` + `session_projcache/` | dsh（插件只注册投影单元） | 不丢任何数据，会从会话日志重新折叠 |
| 官方余额快照（滚动 30 天，只存金额，不存 key） | `~/.dsh/storages/pulse_balance.json` | 插件私有 | 只丢「官方扣费」对账线的历史 |
| 订阅额度利用率快照（滚动 30 天，每窗口一个百分比点） | `~/.dsh/storages/pulse_quota.json` | 燃速预估的历史 | 只丢燃速斜线，下次查询时重新积累 |
| 数据卡快照（导入/拉取的生效数据卡，含来源与保存时刻） | `~/.dsh/storages/pulse_card.json` | 数据包面板的启动覆盖（先于首次折叠应用） | 回落内置卡，重新导入或拉取即可恢复 |
| 单价 / 汇率 / 币种 / 面板开关 / 快显来源 / 自定义查询 spec | profile 的 settings（`~/.dsh/settings.yaml` 或活跃 profile patch 里的 `pulse` 行） | dsh settings | 回到默认 |
| 主题 / 面板 / 预算 / 对比 / 浮层宽度 / 快显建议记忆 | 浏览器 localStorage（`dsh-pulse:*`） | 浏览器 | 纯偏好，无用量数据 |

请求级缓存只存在于宿主进程内存（短 TTL，重启即清空），不含历史。

可选残留，均可安全删除：`~/.dsh/settings.yaml` 里的 `pulse` 节（0.1.6 及以前的宿主）、活跃 profile patch 里的 `pulse` 行（0.1.7+ 宿主把设置存在那里）、以及 `~/.dsh/storages/pulse_balance.json`。