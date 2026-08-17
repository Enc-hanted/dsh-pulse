# dsh-pulse

[English](./README.md) | **简体中文**

**[dsh](https://github.com/deepseek-ai/deepseek-harness) 的跨会话用量与费用观测台** —— 每个人拿到新 agent harness 后最想问的那件事：*它到底花了我多少钱？*

`dsh-pulse` 把语料库里的每个会话（活跃 + 已持久化）折叠成按会话的用量
记录，并渲染到 Web UI：

- **用量走势** — 趋势面板按范围选图：**今天**渲染当日**分时折线图**
  （缓存读取走左轴；未缓存输入与输出共用右轴，95%+ 的命中率也不会把小
  序列压扁），**7 天 / 30 天**渲染每日堆叠柱状图，**90 天 / 1 年**渲染
  GitHub 风格的每日热力图（星期行、月份标注、强度分级、今天描边、悬停
  明细），与柱状图共用同一带边框的绘图区；**自定义日期范围**（最长
  30 天）由宿主按窗口精确服务（`?from=&to=`）
- **项目 / 模型过滤器** — 两个可搜索下拉框（内嵌过滤输入）把整个仪表盘
  限定到某个工作区和/或某个模型；模型过滤器贯穿所有图表，费用也不例外
- **缓存命中率** — 环形仪表盘，附命中/读取与未缓存输入/输出明细；
  cache-write 计为未命中，因此会上报它的提供商（pi-ai）无法抬高命中率
- **模型分布 / 项目排行** — 每模型与每工作区的占比条与排行表
  （行数上限来自 `topProjects` 配置，不是写死的切片）
- **费用估算** — 内置官方逐模型费率（见下文）；没有匹配规则的模型会
  诚实报告为未定价 token；`/pulse` 命令卡片同样打印估算值。二级定价页
  （设置 → 用量观测台 → 定价与费用）列出你在 Models 设置页配置的模型，
  只要求填单价和币种 —— CNY 或 USD，通过一个可编辑汇率统一折算成
  CNY 总额
- **费用走势 / 按模型费用** — 与费用估算卡片同行、平分宽度的小型
  花火线（每日合计 + 高峰时段细线，CNY；悬停任意点看当日峰谷拆分，有
  余额历史后叠加官方扣费线），模型分布里另有逐模型费用行；两者都随
  仪表盘的项目/模型过滤器即时重新计价
- **官方余额** — 用宿主自己存的 key 查询 DeepSeek 开放平台余额
  （总额、赠送/充值拆分、可用状态、手动刷新）；见[官方余额](#官方余额)

## 快速上手

1. 安装到你的 profile 并重启 `dsh web`（见[安装](#安装)）。
2. 打开 Web UI → **Settings → Usage Pulse** 进入仪表盘；在任意对话里输入
   `/pulse` 得到文本摘要卡片（不耗 token —— 命令永远不会到达模型）；
   侧栏底部按钮打开悬浮面板。
3. 可选：设置 → 用量观测台 → 定价与费用，编辑逐模型单价、高峰时段和
   USD→CNY 汇率。若已存有 `DEEPSEEK_API_KEY`（Web 端 Models 页写入），
   仪表盘还会显示官方余额，并在快照积累一天后出现官方扣费对账线。

四个入口，一个数据源（`GET /pulse/stats`，同源 JSON）：

| 入口 | Slot |
|---|---|
| `/pulse` 聊天命令（带仪表盘卡片） | `conversation.chat.commandview`（key `pulse`） |
| 设置页 "Usage Pulse" | `settings.section` |
| 侧栏底部按钮 → 悬浮面板 | `sidebar.footer.action` + `shell.overlay` |

一切运行在 **UI 平面**：没有模型可见的工具、不占提示词面、零 token 消耗。
宿主半注册一个增量投影单元；浏览器半是手写的零构建客户端 bundle
（纯 JS + `react`/`dsh-client-ui-primitives` 平台种子），通过公开 slot
体系注册。

## 架构

宿主半搭在 harness 的**会话投影缝**上，而不是按需重读日志：

- `pulseUsage` 是注册在 `ctx.sessionProjections` 上的投影单元
  （key `pulseUsage`，state version 4）。注册表对每个活跃会话的每条提交
  事件驱动其 `apply`，并保温水位缓存，因此路由读取的是 O(1) 快照。
  逐小时、逐模型的明细只保留最近三天（`HOURS_RETENTION_DAYS`），随新
  事件到达而修剪 —— 分时图有数据源，状态和持久化检查点又不膨胀。当某
  模型的高峰时段在设置里变化时，单元以递增的 state version 重新注册：
  持久化缓存行不再匹配，每个会话在下次读取时从日志重新折叠，历史正确
  重定价（只改价格的编辑绝不触发重放）。
- 冷（已持久化）会话走 `ctx.sessionProjectionCache`（`coldSnapshot`）
  —— 持久化缓存的读取阶梯：顺利路径 = 一行缓存检查点 + 一段持久化尾部
  读取，绝不整份加载日志。两个服务都随 web profile 的 base/web-app
  bundle 发行；插件不需要额外的组合行。
- `/pulse/stats?from=YYYY-MM-DD&to=YYYY-MM-DD` 把每个会话的逐日映射裁剪
  到请求窗口（1–1095 天；`?days=N` 出于兼容仍被接受），输出 schema-3
  JSON。同窗口的并发请求共享一个在途折叠，一个短 TTL 缓存（15 秒）再次
  服务最近折过的窗口 —— 切标签页和重复挂载仪表盘都很便宜。缓存带代际
  戳：设置变更之前开始的折叠，其过期 payload 永远不会在失效之后落地。
  折叠即便请求方断开也会跑完 —— 被中止的 HTTP 等待绝不能截断折叠，否则
  TTL 缓存会把残缺窗口发给下一个读取者。一个读不了的会话被跳过，绝不
  致命。
- 浏览器半拥有全部视图：范围、自定义日期、项目/模型过滤器、热力图和
  分时图都是对同一批记录的纯客户端折叠 —— 切换视图不产生额外聚合。所有
  已挂载的入口共享一个 stats store（一次取数、可中止、无竞态），最近
  四个取过的窗口留在带新鲜度上限（60 秒）的客户端 payload 缓存里：回到
  刚看过的范围立即渲染，后台取数刷新。payload 的窗口与工具栏选择不一致
  （切换的中间态）时渲染加载态 —— 上一个窗口的数字绝不挂在新范围的标签
  下。同时打开设置页、命令卡片和悬浮面板只触发一次请求。

折叠语义（写在单元自身的文档里）：

- **tokens** 来自 `assistant/message` 的 usage —— harness 互斥的
  `TokenUsage` 字段（未缓存输入、缓存读取、缓存写入、输出），按天、按
  模型折叠，最近三天还按小时、按模型折叠（`hoursByDay`，分时图的数据源）。
- **turns** 统计至少含一个已关闭 step 的去重 turn（`step/end`，与官方
  `dsh-session-stats` 对齐）；被拒绝/空转的 turn 不计。**tool calls**
  统计 `tool/call` 事件。
- 无时间戳的事件不归属到天；未知事件类型与畸形字段被跳过，绝不抛出。

## 安装

`dsh plugin --profile <name>` 转发到 profile 目录内的 pnpm，并自动调和
`dsh.profile.bundles`（任何已安装、包声明了 `dsh.bundle.patch` 的依赖都会
加入层叠）。profile 是 pnpm workspace 根，所以 `add` 要带 `-w`：

```bash
# 从 npm registry
dsh plugin --profile web add -w dsh-pulse

# 从打包的 tarball（pnpm pack，不经过发布）
dsh plugin --profile web add -w /abs/path/to/dsh-pulse-0.3.0.tgz

# 从源码检出（开发）
dsh plugin --profile web add -w link:/abs/path/to/dsh-pulse

# 从 git
dsh plugin --profile web add -w git+https://github.com/Enc-hanted/dsh-pulse

# ……或手动：在 ~/.dsh/profiles/web/package.json 的 dependencies 里加
# "dsh-pulse": "link:/abs/path/to/dsh-pulse"，然后在 profile 目录里
# pnpm install。
```

然后重启 `dsh web`（新增插件热加载；改它的代码需要重启）。

**滚动升级**：浏览器 bundle 从磁盘提供，而宿主半活在运行中的进程里，因此
刷新页面可能短暂出现「新客户端 + 旧宿主」的配对。客户端因此同时接受两种
payload schema：schema 3（窗口精确的 `from`/`to`）和 schema 2（锚定今天
的 `days` 窗口、标量 turns）—— 视图收敛到旧宿主实际服务的窗口而不是报错。
重启宿主即恢复窗口精确的范围。

## 兼容性

已在 **@deepseek-ai/dsh `0.1.0-rc.6`**（npx，2026-08-17）上验证，
Windows + fnm Node 24.14.1 —— dsh 自身要求 **Node ≥ 22.15**
（`node:zlib` 的 zstd）。必需宿主服务：`commands`、`sessionQuery`、
`webServer`、`sessionProjections`、`sessionProjectionCache`、`sessions`。
可选、自动探测：`llm`（定价编辑器的模型目录）、`settings`（持久化定价）、
`credentials`（官方余额路由）、`storageDomain`（余额快照历史）。没有
`tiersByDay` 的旧宿主（schema 2）仍可渲染；费用那时全部按谷时单价计。

## 卸载

```bash
dsh plugin --profile web remove -w dsh-pulse
```

下次启动时 bundle 调和会把它从 `dsh.profile.bundles` 移除。可选残留、均可
安全删除：`~/.dsh/settings.yaml` 里的 `pulse` 节（你的定价规则），以及
`~/.dsh/storages/pulse_balance.json`（滚动余额快照）。本插件从不存储任何
密钥。

## 费用模型

单价为**每百万 token 的 CNY 金额**，默认值来自官方价格页
https://api-docs.deepseek.com/zh-cn/quick_start/pricing/（核对于
2026-08-17）。DeepSeek 按**峰谷时段**计费（北京时间 **09:00–12:00** 与
**14:00–18:00** 为高峰；其余时段谷价 = 峰价的一半），自 2026-08-17 生效：

| 模型 | 时段 | 未缓存输入 | 缓存命中 | 输出 |
|---|---|---|---|---|
| deepseek-v4-flash | 高峰 | 3 | 0.1 | 9 |
| deepseek-v4-flash | 谷时 | 1.5 | 0.05 | 4.5 |
| deepseek-v4-pro | 高峰 | 9 | 0.3 | 27 |
| deepseek-v4-pro | 谷时 | 4.5 | 0.15 | 13.5 |

投影把每条用量事件切进其北京时间的峰/谷档（固定 UTC+8 偏移 —— 与宿主时区
无关），估算值按模型为
`谷时(未缓存输入 × input + 缓存读取 × cacheRead + 输出 × output)`
加上同样一组按 `peak` 单价的和，其中 `未缓存输入 = input + cacheWrite`。
没有 `peak` 块的规则是平价（两档都按所列单价）；没有 `cacheRead` 的规则
回落到其 `input` 单价；没有峰谷拆分的记录（升级前的宿主）整体按谷时单价
计。高峰时段默认为官方窗口，可按规则自定义（`peakHours`，小时粒度、北京
时间）—— 适用于按自己窗口计费的提供商；显式的 `peakHours: []` 表示
「无高峰时段」，即设了峰价也按平价计。没有规则的模型单独显示为未定价
—— 绝不悄悄乱猜。估算按合适的精度显示（≥1 保留两位小数，<1 保留三位
有效数字）。

**币种**：每条规则以 **CNY**（默认）或 **USD** 计价；USD 计价的模型通过
一个可配置汇率（`usdToCny`，默认 6.8，定价页可改）折算，总额永远是单一
CNY 数字 —— 混币种仪表盘无需逐行换算也保持有意义。折算按设计就是手动
汇率：这是估算器，不是记账。设 `costEnabled: false` 可隐藏费用卡片和命令
的费用行，其余数字照常。

## 官方余额

`GET /pulse/balance` 用**宿主已存的 key** 查询 DeepSeek 开放平台
（`GET /user/balance`）—— 每次请求经凭据缝现取（就是 Web 端 Models 页
写入的那个 `DEEPSEEK_API_KEY`；`llm-deepseek` 设置命名空间的
`apiKeyEnv` / `baseURL` 覆盖会被尊重）。零新增配置、零新增密钥存储：

- key 永不离开宿主进程：只活在一次出站 `Authorization` 头里，每次实际
  取数都重新解析（凭据缝的按操作契约），绝不会出现在响应、日志或错误里
  —— 失败只映射为通用原因码（`ENOTFOUND`、`HTTP 401` 等）；
- 解析后的回复（仅金额）在服务端缓存 60 秒；`?refresh=1` 绕过
  （卡片的刷新按钮）；
- 响应带 `cache-control: no-store`，出站请求拒绝重定向
  （`redirect: "error"`）；
- 未配置（无凭据服务/未存 key）或不可达 → 仪表盘卡片自动隐藏，或显示
  通用失败提示并可重试。

**对账**：每次成功查询记录一条 `{t, total}` 快照 —— 只有金额 —— 进滚动
30 天的存储域 global（`pulse_balance`，上限 1000 条、5 分钟去重）。
`/pulse/stats` 把它们折成 `balanceSeries`：某日官方扣费 = 当日入账余额 −
出账余额。余额上涨的日子（充值掩盖了扣费）、没有前序快照的日子、以及最新
快照之后的日子都是 `null` —— 未知，绝不静默填零。费用火花线把它画成第三
条细线（官方扣费），与本地估算并肩，费率的系统性漂移一眼可见；同一把 key
若还有别的工具在用，该线会偏大（它是那把 key 的总扣费，不只本 harness
的）。

## 定价页

设置 → 用量观测台 打开在仪表盘；头部的**定价与费用**按钮（以及费用卡片的
「未配置/未定价」提示）翻到定价编辑器 —— 内部二级页，不涉及 shell 导航，
每次新开都落在仪表盘。侧栏悬浮面板和 `/pulse` 命令卡片保持只读。

- **模型行来自 Models 设置页** —— harness 的实时模型目录，经 `llm` 服务
  读取并随设置下发。每行显示模型 id 与显示名（按提供商分组），只要求填
  单价：谷时的输入/缓存命中/输出（每百万 token），外加 CNY/USD 选择器。
  DeepSeek 官方单价已预填。
- **峰谷计价** 展开一行的峰时单价和 24 小时条：点选小时格标记高峰时段
  （北京时间；高亮 = 高峰），默认官方 09:00–12:00 / 14:00–18:00 窗口，
  一键恢复，全部取消 = 平价。保存会提示是否改了高峰时段，并在服务端后台
  重折历史 —— 下次刷新读到的是暖缓存，不用自己付重放的成本。
- **汇率** — 一个 USD→CNY 字段（默认 6.8）；预览行用你未保存的编辑对
  已加载窗口（新开时 90 天）即时重新计价，先看效果再提交。
- **恢复官方价** 把官方模型的一行重置回未动过的基线；重复的模型 id 和
  无效数字在保存时被拒绝。
- 兜底行覆盖其余一切：有用量（90 天窗口 —— 不止仪表盘的 7 天）但不在
  目录里的模型（从 Models 页移除了 —— 历史仍要计价）、两者都不匹配的已存
  规则，以及给「还没配置的模型」手动加行预定价。没有 `llm` 服务时整个
  编辑器就跑在这些行上。**刷新目录**重读模型目录并保留你未保存的编辑。
- **启用费用估算** 可整体关掉费用卡片和 `/pulse` 命令的费用行；完全空的
  行不会被持久化。

保存经 harness 设置服务持久化（`$DSH_HOME/settings.yaml` 的 `pulse:` 节），
立即生效（stats payload 缓存被失效），重启后仍在。组合条目保持为设置的
`base` 层：编辑过的值覆盖它，**恢复内置默认**把用户节清回组合配置与官方
默认。本页编辑的是*有效*列表（官方默认已合并），所见即所计。没有设置服务
时页面只读，组合配置保持权威。

按 profile 在 `cordis.patch.yml` 覆盖：

```yaml
- insert:
    - id: pulse
      name: 'dsh-pulse'
      config:
        defaultDays: 30   # 客户端未带范围时服务的窗口
        topProjects: 8    # 项目排行行数上限
        projectDepth: 1   # 项目标签保留的路径段数（1..3）
        costEnabled: true # false 隐藏费用卡片与命令费用行
        usdToCny: 6.8     # 统一 CNY 总额的 USD→CNY 汇率
        pricing:          # 逐模型覆盖内置默认
          - model: deepseek-v4-pro
            input: 4.5
            cacheRead: 0.15
            output: 13.5
            peak:         # 峰时单价（默认官方窗口）
              input: 9
              cacheRead: 0.3
              output: 27
            currency: CNY
          - model: third-party-x   # 平价 USD 规则 + 自定义高峰时段
            input: 0.5
            output: 2
            currency: USD
            peakHours: [0, 1, 2, 3, 4, 5]   # 按北京时间计峰的小时
```

`projectDepth` 控制会话工作目录如何变成项目标签：`1` 只留目录名（默认），
`2` 留 `父目录/名字`，最多到 3 —— 两个目录同名时有用。加深标签会重新分组
既有数据；不丢任何数据。

## 开发

```bash
node test/aggregate-test.mjs          # 宿主侧折叠、小时明细、窗口、切片
node test/view-test.mjs               # 客户端视图模型、分时序列、热力图
node test/mirror-test.mjs             # bundle 镜像与 src/view.js 保持同步
node test/host-test.mjs               # 桩服务上挂载的宿主半
node scripts/sync-mirror.mjs          # 改 src/view.js 后重新生成镜像
```

客户端 bundle 镜像了 `src/view.js`（dsh 客户端半是单个自注册文件，不能
require node 侧模块）：改 `src/view.js`，跑 `scripts/sync-mirror.mjs`，
`test/mirror-test.mjs` 会对漂移报错。

## 验证

```bash
node test/aggregate-test.mjs && node test/view-test.mjs && node test/mirror-test.mjs && node test/host-test.mjs
dsh web --dump-config | grep pulse    # 组合进了 profile 的行
curl 'http://127.0.0.1:3080/pulse/stats?from=2026-08-01&to=2026-08-14' | head -c 400
```

## 设计说明

- **增量而非按需** — 投影注册表在事件提交时折叠；路由从不重折。冷会话
  来自持久化投影缓存，其行是折叠捷径、不是权威（过期行代价是一段尾部
  重放，绝不是错误数字）。
- **窗口精确服务** — 宿主把逐日映射裁剪到请求的 `from`/`to`，payload
  保持小巧，每个自定义范围都是真实的，不被裁到锚定今天的窗口。
- **只用 slot** — 不替换任何 shell 自有的 slot；每个注册都是增量
  （`list`/`keyed` 条目），插件破坏不了核心 UI，卸载也干净（宿主侧每个
  注册都是 fiber effect）。
- **只用主题 token** — 所有颜色都是 `--dsw-alias-*` 变量；明暗主题零成本
  跟随 shell（原生日期/下拉控件也含在内，通过 `color-scheme`）。热力图
  强度分级与更柔和的分段激活态是
  `--dsw-alias-state-business-primary` 的 `color-mix` 调色，带回退。
- **无依赖图表** — 柱状、分时折线、仪表盘和热力图格子都是 div+CSS，每张
  图一个内联 SVG（无需测量即响应式）；圆环是一个 SVG 圆。
- **默认懒加载** — 仪表盘打开在 7 天窗口，只取请求的范围，客户端 payload
  缓存先行渲染、后台取数刷新，宿主的 TTL + 在途缓存让重复窗口很便宜。
- `src/view.js` 由 `scripts/sync-mirror.mjs` 镜像进浏览器 bundle，两份
  副本都被测试覆盖。

MIT — 见 [LICENSE](./LICENSE)。
