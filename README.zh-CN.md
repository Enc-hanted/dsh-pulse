# dsh-pulse

[English](./README.md) | **简体中文**

[dsh](https://github.com/deepseek-ai/deepseek-harness) 的会话用量与费用观测台。统计所有会话（活跃和已持久化的）的 token 用量，按内置的 DeepSeek 官方费率估算费用，并显示官方平台余额。一切运行在 UI 平面：没有模型可见的工具，不消耗任何 token。

## 功能

- **用量走势**：今天显示分时折线图，7 天 / 30 天显示每日柱状图，90 天 / 1 年显示 GitHub 风格热力图；支持最长 30 天的自定义日期范围
- **项目 / 模型过滤器**：两个可搜索下拉框，把整个仪表盘限定到某个工作区和/或某个模型
- **缓存命中率**：环形仪表盘，附命中/读取与未缓存输入/输出明细；cache-write 计为未命中
- **模型分布 / 项目排行**：占比条与排行表
- **费用估算**：逐模型费率，区分峰谷时段；没有规则的模型单独列为未定价
- **费用走势**：每日费用火花线，快照积累一天后叠加官方扣费对账线
- **官方余额**：用宿主已存的 key 查询 DeepSeek 开放平台余额，支持手动刷新

## 快速上手

```bash
dsh plugin --profile web add -w dsh-pulse
```

重启 `dsh web`，打开 **设置 → 用量观测台**。任意对话里输入 `/pulse` 得到文本摘要（命令不会到达模型）；侧栏底部按钮打开悬浮面板。所有入口共用同一个数据源 `GET /pulse/stats`。

若已存有 `DEEPSEEK_API_KEY`，仪表盘还会显示官方余额，并在快照积累一天后出现对账线。

## 安装 / 卸载

`dsh plugin --profile <name>` 在 profile 目录内调用 pnpm，并自动调和 `dsh.profile.bundles`。profile 是 pnpm workspace 根，所以 `add` 要带 `-w`：

```bash
# 从 npm registry
dsh plugin --profile web add -w dsh-pulse

# 从打包的 tarball
dsh plugin --profile web add -w /abs/path/to/dsh-pulse-0.4.0.tgz

# 从源码检出（开发）
dsh plugin --profile web add -w link:/abs/path/to/dsh-pulse

# 从 git
dsh plugin --profile web add -w git+https://github.com/Enc-hanted/dsh-pulse
```

……或手动在 `~/.dsh/profiles/web/package.json` 的 dependencies 里加 `"dsh-pulse": "link:/abs/path/to/dsh-pulse"`，再到 profile 目录里 `pnpm install`。之后重启 `dsh web`（新增插件热加载；改代码需要重启）。

```bash
dsh plugin --profile web remove -w dsh-pulse
```

下次启动时它会从 `dsh.profile.bundles` 移除。可选残留，均可安全删除：`~/.dsh/settings.yaml` 里的 `pulse` 节，以及 `~/.dsh/storages/pulse_balance.json`。本插件从不存储密钥。

## 费用模型

单价为**每百万 token 的 CNY 金额**，默认值来自官方价格页
https://api-docs.deepseek.com/zh-cn/quick_start/pricing/（核对于 2026-08-17）。
DeepSeek 按峰谷时段计费：北京时间 **09:00–12:00** 与 **14:00–18:00** 为高峰，其余时段谷价 = 峰价的一半。

| 模型 | 时段 | 未缓存输入 | 缓存命中 | 输出 |
|---|---|---|---|---|
| deepseek-v4-flash | 高峰 | 3 | 0.1 | 9 |
| deepseek-v4-flash | 谷时 | 1.5 | 0.05 | 4.5 |
| deepseek-v4-pro | 高峰 | 9 | 0.3 | 27 |
| deepseek-v4-pro | 谷时 | 4.5 | 0.15 | 13.5 |

规则要点：没有 `peak` 块的规则是平价；没有 `cacheRead` 的回落到 `input` 单价；没有峰谷拆分的记录（升级前的宿主）整体按谷价计。高峰时段默认官方窗口，可按规则自定义（`peakHours`，小时粒度、北京时间）；`peakHours: []` 表示设了峰价也按平价计。没有规则的模型单独显示为未定价。估算按 `未缓存输入 = input + cacheWrite` 计入。

币种：每条规则以 **CNY**（默认）或 **USD** 计价，USD 模型通过 `usdToCny`（默认 6.8，定价页可改）折算，总额永远是单一 CNY 数字。折算按设计就是手动汇率：这是估算器，不是记账。`costEnabled: false` 隐藏费用数字，其余照常。

## 配置

设置 → 用量观测台 → **定价与费用** 编辑单价。模型行来自 Models 设置页，DeepSeek 官方单价已预填；每行填谷时输入/缓存命中/输出单价、CNY/USD 选择器，以及 24 小时高峰条（北京时间，默认官方窗口，全部取消 = 平价）。汇率字段用未保存的编辑即时重新计价已加载的窗口。**恢复官方价**把一行重置回基线；**刷新目录**重读模型目录；**启用费用估算**整体关掉费用数字。兜底行覆盖有用量但不在目录里的模型、两者都不匹配的已存规则，以及手动添加的模型；没有 `llm` 服务时编辑器只跑在这些行上。

**方案对比**（设置 → 用量观测台 → 方案对比）用可调的用量场景（总输入、输出占比、缓存命中率）对比各模型费率下的预估成本。方案直接来自定价与费用页的有效规则（含官方默认），费率改动自动生效；可临时添加对比方案，所有方案可显隐。场景可取自真实用量窗口，也可手动设置。

**显示设置**（设置 → 用量观测台 → 显示设置）控制仪表盘各面板的显隐，包括侧栏按钮的余额显示。仪表盘上的**月度预算**卡片可设定 CNY 预算，显示本月已用、进度条和按日均速率推算的月底预测；余额栏会按近期扣费速率显示余额可撑天数。均为本地偏好。

保存写入 `$DSH_HOME/settings.yaml`（`pulse:` 节），立即生效，重启后仍在。**恢复内置默认**把用户节清回组合配置与官方默认。没有设置服务时页面只读。

按 profile 在 `cordis.patch.yml` 覆盖：

```yaml
- insert:
    - id: pulse
      name: 'dsh-pulse'
      config:
        defaultDays: 30   # 客户端未带范围时服务的窗口
        topProjects: 8    # 项目排行行数上限
        projectDepth: 1   # 项目标签保留的路径段数（1..3）
        costEnabled: true # false 隐藏费用数字
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

`projectDepth` 控制会话工作目录如何变成项目标签：`1` 只留目录名（默认），`2` 留 `父目录/名字`，最多到 3。加深标签会重新分组既有数据，不会丢数据。

## 官方余额

`GET /pulse/balance` 用宿主已存的 key 查询 DeepSeek 开放平台，每次请求经凭据缝现取。零新增配置、零新增密钥存储：key 不离开宿主进程（只出现在一次出站 `Authorization` 头里），失败只映射为通用原因码，回复在服务端缓存 60 秒（`?refresh=1` 绕过），响应带 `cache-control: no-store`，出站请求拒绝重定向。未配置或不可达时，卡片自动隐藏或显示带重试的失败提示。

每次成功查询记录一条 `{t, total}` 快照（只有金额）到滚动 30 天的存储（`pulse_balance`，上限 1000 条、5 分钟去重）。每日官方扣费由余额序列推算，算不出来的日子（充值掩盖、缺少前序快照、超出最新快照）记为 `null`。费用火花线把它画成第三条细线。注意这是那把 key 的总扣费：别的工具共用同一把 key 时也会算进来。

## 兼容性

已在 **@deepseek-ai/dsh 0.1.0-rc.6**（2026-08-17，Windows，Node 24.14.1）上验证；dsh 自身要求 **Node ≥ 22.15**。必需宿主服务：`commands`、`sessionQuery`、`webServer`、`sessionProjections`、`sessionProjectionCache`、`sessions`。可选、自动探测：`llm`、`settings`、`credentials`、`storageDomain`。没有 `tiersByDay` 的旧宿主（schema 2）仍可渲染，费用按谷价计。滚动升级时客户端同时接受两种 payload schema，刷新页面不会因新旧宿主配对而报错；重启宿主即恢复窗口精确的范围。

## 开发

```bash
node test/aggregate-test.mjs && node test/view-test.mjs && node test/mirror-test.mjs && node test/host-test.mjs
node scripts/sync-mirror.mjs   # 改 src/view.js 后重新生成 bundle 镜像
dsh web --dump-config | grep pulse
curl 'http://127.0.0.1:3080/pulse/stats?from=2026-08-01&to=2026-08-14' | head -c 400
```

简述：宿主半是注册在 `ctx.sessionProjections` 上的投影单元（`pulseUsage`），事件提交时按天/模型/小时折叠用量，冷会话读持久化投影缓存，`GET /pulse/stats` 按窗口精确切片（同窗口并发共享一个在途折叠，15 秒 TTL）。浏览器半是零构建的客户端 bundle（纯 JS + `react`/`dsh-client-ui-primitives`），通过公开 slot 注册（`conversation.chat.commandview`、`settings.section`、`sidebar.footer.action` + `shell.overlay`），所有挂载的入口共享一个 stats store。图表无依赖：div+CSS，每张图一个内联 SVG；热力图和分时图都是纯客户端折叠。`src/view.js` 由 `scripts/sync-mirror.mjs` 镜像进 bundle，镜像测试对漂移报错。

MIT — 见 [LICENSE](./LICENSE)。
