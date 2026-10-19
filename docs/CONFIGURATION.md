# 配置参考

**简体中文** · [English](./en/CONFIGURATION.md)

日常配置都在 Web 界面的 **设置 → 用量观测台** 里完成。本页是参考，覆盖多数人只会碰一次的部分：定价编辑器、显示设置、按 profile 的覆盖，以及每个查询和每个存储文件各自负责什么。

- [设置页](#设置页)
- [按 profile 覆盖](#按-profile-覆盖)
- [费用模型](#费用模型)
- [官方余额](#官方余额)
- [订阅额度](#订阅额度)
- [手动检查更新](#手动检查更新)
- [数据与存储](#数据与存储)

## 设置页

设置 → 用量观测台下分三个标签页。

**「定价与费用」(Pricing & cost)** 编辑单价。模型行**只来自 Models 设置页的模型配置**（不可手动增删），DeepSeek 官方单价自动回填；**只保存你改过的行**——没动过的模型继续跟随官方通配默认价，官方调价会自动跟上，「恢复官方价」(Official rates) 把某行清回未改状态。每行填谷时输入 / 缓存命中 / 输出单价、CNY/USD 选择器与一条 24 小时高峰条（北京时间，默认官方窗口，全部取消即平价）。每个供应商分组标题带「月付费」(Monthly) 开关；页面底部的「模型配色」(Model colors) 卡片可以为任意模型指定颜色，或恢复自动配色。「刷新目录」(Refresh catalog) 重读模型目录；「启用费用估算」(Enable cost estimates) 整体关闭费用数字。

**「方案对比」(Compare plans)** 在可调的用量场景（总输入、输出占比、缓存命中率）下比较各模型费率对应的预估成本。方案直接来自定价页的有效规则（含官方默认），所以费率一改这里就跟着变；可以临时添加对比方案，每个方案都能显示或隐藏，场景也可以取自真实用量窗口或手动设置。

**「设置」(Settings)** 控制各面板的显隐与侧栏余额开关，选择**主题**（蓝 / 粉 / 橙 / 黑白，各自带亮暗两版并自动跟随宿主），还能按供应商关闭订阅额度查询。底部是**「关于」(About)** 面板：当前版本与手动检查更新。

**「月度预算」(Monthly budget)** 是仪表盘上的一张卡片：设定 CNY 预算，显示本月已用、进度条，以及按日均速率外推的月底预测。

主题、面板开关、预算、对比方案与浮层宽度存在浏览器的 localStorage（`dsh-pulse:*`）；其余全部经宿主的设置服务保存。

保存立即生效、重启后仍在；与另一个窗口的保存撞车时，编辑器会自动刷新本地副本以便干净重试（过期写入返回 HTTP 409）。显示类字段（汇率、币种、面板开关）的改动不重启插件。宿主没有设置服务时页面只读；没有 `llm` 服务时没有可编辑的模型行。

## 按 profile 覆盖

默认值由 bundle 自己注入活跃 profile patch。要覆盖，就在 `cordis.patch.yml` 里加一行 `pulse`：

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
<https://api-docs.deepseek.com/zh-cn/quick_start/pricing/>（核对于 2026-10-19）。
DeepSeek 按峰谷时段计费：北京时间 **09:00–12:00** 与 **14:00–18:00** 为高峰，**仅周一至周五**；其余时段（含整个周末）谷价 = 峰价的一半。

| 模型 | 时段 | 未缓存输入 | 缓存命中输入 | 输出 |
|---|---|---|---|---|
| deepseek-flash | 高峰 | 2 | 0.04 | 8 |
| deepseek-flash | 谷时 | 1 | 0.02 | 4 |
| deepseek-v4-pro | 高峰 | 9 | 0.3 | 27 |
| deepseek-v4-pro | 谷时 | 4.5 | 0.15 | 13.5 |

单价放在一张带版本的费率卡（`src/pricing/ratecard.json`）里，所以一次调价以新版本发布，而不是埋在代码里的一处编辑。`deepseek-v4-flash` 与 `deepseek-v4-flash-vision-exp` 是已下线的旧模型 id：平台仍接受对它们的调用，但实际由 DeepSeek-V4.1-Flash 提供服务并按 Flash 价计费，因此本插件把这些历史事件按 Flash 档计价，而不是再列一行过期单价。

规则可以更细：

- 高峰时段默认**仅工作日**生效；`weekdaysOnly: false` 让某条规则的高峰每天都算，`peakHours: []` 仍表示平价
- 按**供应商**限定：`provider` 填供应商 route id 时只对该供应商的同名模型生效（精确匹配优先），留空则通配该模型 id 的所有供应商——给「代理商也卖 deepseek-v4-flash」这类情况单独定价、又不影响官方渠道，就很方便
- 供应商可整体标记为**月付费**（`monthlyProviders`）：该供应商所有模型无需单价、费用按 0 边际计；可选的**月付金额**（`monthlyFee`）不进按量估算，只在方案对比里作为订阅行同台展示

官方 `web_search` 与会话标题生成的辅助 LLM 调用本地没有 usage 事件；观测台按会话日志精确计数，折算为一行「辅助调用（估算）」(aux calls, est.) 伪模型，进入模型堆叠与费用走势，按事件当日生效的官方价计费。2026-11-01 起平台对服务端搜索**按次计费**（¥0.005/次成功请求，随 Search/Fetch API 开放公告生效）；观测台把它计为已知固定项叠加在形状估算上——对账差额与形状自校准都不吸收它，保持纯 token 语义。本地按「1 请求 = 1 次计」估计，实际账单按服务端执行次数（单次请求最多 5 次），这个系数待计费上线后再对照余额实证。**形状自校准（默认开启）**：官方余额序列是每日真值，面板据此校准辅助调用的估算形状——对已存数据的纯函数，无新存储、无定时器；换一个部署会自己收敛到那个部署的负载。近 7 个完整日出现 ≥15% 且 ≥¥0.10 的对账偏差时，仪表盘亮**对账漂移告警**（悬停看逐日对照）；快照稀疏的日子不参与学习与告警。想冻结自校准，在配置里手写 `searchShape`（键 `miss`/`hit`/`out`）。

币种：每条规则以 **CNY**（默认）或 **USD** 计价，USD 模型通过 `usdToCny`（默认 6.8，定价页可改）折算，总额永远是单一 CNY 数字。折算按设计就是手动汇率：这是估算器，不是记账。`costEnabled: false` 隐藏费用数字，其余照常。

**这是估算器，不是记账**：未定价模型单独列示，累计未定价 token 不足 5k 视为零头、不显示，超过后卡片提示「有未定价消耗」(some usage unpriced)——点击直达定价页。

## 官方余额

`GET /pulse/balance` 用宿主已存的 key 查询 DeepSeek 开放平台：零新增配置、零新增密钥存储，key 不离开宿主进程（只出现在一个出站 `Authorization` 头里）；失败映射为通用原因码，并在卡片内联重试；服务端缓存 60 秒（面板的刷新按钮即强制刷新）。未配置时余额块整体隐藏。

每次成功查询把一条 `{t, total}` 快照（只存金额）记入滚动 30 天的存储（上限 1000 条、5 分钟去重）。每日官方扣费由余额序列推算；推不出来的日子（充值掩盖、缺少前序快照）留空，费用走势把它画成第三条细线。注意这里指的是那把 key 的**总扣费**：共用同一把 key 的别的工具也会算进来。

## 订阅额度

`GET /pulse/quota` 查询**月付订阅**（Coding Plan / Token Plan）的剩余额度，安全姿态与官方余额相同：凭据按操作即时获取，只出现在一个出站 `Authorization` 头里；快照只记录每个窗口的利用率百分比（滚动 30 天，去重 + 上限），永不落任何密钥或原始响应。服务端缓存 60 秒。

内置适配器（按 Models 目录的供应商路由自动识别，无需配置）：

| 适配器 | 路由 | 端点 | 返回 |
| --- | --- | --- | --- |
| zai-coding | `zai-coding-cn` / `zai-coding` / `zai` | `open.bigmodel.cn` 或 `api.z.ai` 上的 `/api/monitor/usage/quota/limit` 与 `/api/biz/subscription/list` | 5h/周 token 窗口百分比、重置时刻、联网工具次数、套餐名与年/月费 |
| kimi-coding | `kimi-coding` / `kimi` | `api.kimi.com/coding/v1/usages` | 周/5h 请求窗口百分比（比率源只报百分比，不会给出次数） |
| minimax | `minimax` / `minimax-coding` | `api.minimaxi.com/v1/token_plan/remains` | 5h/周窗口（社区文档口径，未实测） |

适配器实现一个小小的 SPI（`src/quota-adapters/`）：识别供应商路由、构造请求、解析响应。每个适配器在 `test/fixtures/quota/` 下都有录制的 fixture/replay 用例，所以改解析器不用真实账号也能测；`scripts/record-quota-fixture.mjs` 是那个负责脱敏的手动录制器。

这些大多是**未承诺 SLA 的内部端点**（与社区工具用的是同一批）；每个解析器都是防御式的：字段缺失降级为「未知」(unknown) 而不是 0%，失败以通用原因码呈现。

**估算口径**（面板小字里也写着）：订阅额度只有百分比，没有绝对 token 数。dsh 拿它们反推——同一时间跨度内该供应商路由的本地 token 消耗 ÷ 服务端百分比 = 估算总额，剩余量随之得出。**dsh 只覆盖这台机器经它跑的流量**：key 与别的工具共用时估算偏低；按趋势参考看，不是记账。燃速预估是快照序列上的线性斜率，回答「按这个速率什么时候耗尽」与「重置时预计的百分比」。

**分项目消耗**：窗口（或本月）内该供应商的本地 token 按每个会话的工作目录归因到项目——各项目的 token、份额条，以及**月费分摊**（套餐费 × 份额；套餐未公开价格时只显示份额）。可在设置 → 「设置」(Settings) 里按供应商关闭查询。

## 手动检查更新

**设置 → 用量观测台 → 「设置」(Settings) → 「关于」(About)**（该标签页底部）显示当前版本；「检查更新」(Check for updates) 按钮会手动询问一次 npm registry，给出四种结果之一：「已是最新」(up to date) / 「有新版本」(new version available) / 「开发版」(development build) / 「检查失败」(check failed)。绝不自动检查——没有定时器，也不在加载时探测。

## 数据与存储

用量统计没有插件私有的历史缓存：**事实来源是 dsh 自己的会话日志**，每个数字都在请求时折出来。

| 数据 | 位置 | 归属 | 删掉会怎样 |
| --- | --- | --- | --- |
| 原始用量事件（每个 step 的 token 与计费依据） | `~/.dsh/sessions/` | dsh | 真的丢历史 |
| `pulseUsage` 投影缓存 | `~/.dsh/storages/session_projcache.json` + `session_projcache/` | dsh（插件只注册投影单元） | 什么也不丢——会从会话日志重新折出 |
| 官方余额快照（滚动 30 天，只存金额，不存 key） | `~/.dsh/storages/pulse_balance.json` | 插件唯一的私有持久文件 | 只丢「官方扣费」(official spend) 对账线的历史 |
| 订阅额度利用率快照（滚动 30 天，每窗口一个百分比点） | `~/.dsh/storages/pulse_quota.json` | 燃速预估的历史 | 只丢燃速斜线，下次查询时重新积累 |
| 单价 / 汇率 / 币种 / 面板开关 | profile 的 settings（`~/.dsh/settings.yaml` 或活跃 profile patch 里的 `pulse` 行） | dsh settings | 回到默认 |
| 主题 / 面板 / 预算 / 对比 / 浮层宽度 | 浏览器 localStorage（`dsh-pulse:*`） | 浏览器 | 纯偏好，无用量数据 |

所以卸载重装（甚至删掉 `session_projcache`）之后，整段用量历史都会重新折出，不需要任何迁移。请求级的 payload 缓存只活在宿主进程内存里（短 TTL，重启即清空），同样不含历史。

可选残留，均可安全删除：`~/.dsh/settings.yaml` 里的 `pulse` 节（0.1.6 及以前的宿主）、活跃 profile patch 里的 `pulse` 行（0.1.7+ 宿主把设置存在那里）、以及 `~/.dsh/storages/pulse_balance.json`。卸载或删掉它们**不会丢历史用量**。
