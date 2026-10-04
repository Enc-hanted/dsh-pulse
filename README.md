<a id="top"></a>

# dsh-pulse

**简体中文**（默认） · [English](#dsh-pulse--english)

[dsh](https://github.com/deepseek-ai/deepseek-harness) 的会话用量与费用观测台。统计所有会话（活跃和已持久化的）的 token 用量，按内置的 DeepSeek 官方费率估算费用，并显示官方平台余额。一切运行在 UI 平面：没有模型可见的工具，不消耗任何 token。

## 功能

- **面板结构**：首行是一块**流式画布**，按三个区求解——**资金列**（费用估算叠官方余额，两个短块本是同一语义，叠放后每区都天然有卡高）、**订阅额度区**、**缓存命中区**；各区只声明 flex 权重与 cqi 主导的理想宽（em 只作可读性地板），换行点跟着画布宽度走、不被宿主字号缩放劫持，退化路径有序（三区一行 → 缓存整行 → 全叠），没有任何组合模板；扩展 chip 在独立的一行里渲染，永远撑不到首行
- **用量走势**：单日窗口显示分时折线图（今天与最近 3 天内的历史日都聚合各会话逐时明细），7 天 / 30 天显示每日柱状图，90 天 / 1 年显示 GitHub 风格热力图；支持最长 30 天的自定义日期范围。柱状图支持两级钻取：点某天 → 该天按模型铺满全宽，再点某模型 → 展开输入 / 缓存 / 输出 token 拆分；点空白处或 Esc 逐级返回
- **项目 / 模型过滤器**：项目为可搜索下拉框；模型为**多选**（搜索 + 复选列表，空 = 全部）——用量堆叠图例、费用堆叠图例与模型分布行都可直接**点选联动**同一个筛选集合；从某个会话点 `/` 菜单的 pulse 时，浮层会自动把项目过滤到该会话所属的工作区，并把当前会话钉在会话列表顶部（带「当前会话」标记）——手动切换过滤器后不再自动跳回
- **跨供应商模型区分**：模型按「供应商 · 显示名称」来自 Models 配置；同名模型被多个供应商同时提供时才带上供应商前缀，否则只显示名称。**同一供应商的多个接入路由算一个来源**：DeepSeek 官方 API 路由与客户端登录后自动出现的账号路由（`deepseek-official` / `deepseek-account`）余额同源、对账统一计入，展示合并成一行（逐路由明细保留在 `modelRoutes`，将来若两条路由计费方式分家可一键拆开）。选中第三方（非官方来源）模型时隐藏官方余额；未配置费用的第三方模型连费用估算和月度预算一起隐藏
- **模型分布 / 项目排行**：占比条与排行表
- **模型配色**：每个模型一个跨界面稳定的颜色。先按厂商品牌梯度取「本命色」——同一模型在任何窗口、任何组合、任何界面都是同一个颜色；再对**同一屏内过近**的两个颜色做一次按集合的分离（目标 ΔE ≥ 0.07，只让后来者顺延、不改动已定的颜色），所以一张图里任意两行都分得开（实测厂商自身梯度的相邻档常常只差 0.013 ΔE，单靠品牌梯度不够）。辅助调用固定为金色**斜纹**填充（估算语义，与任何实色品牌都不会混）；**黑白**配色下自动色不是一律压成同一种灰，而是按明度分档的灰度阶梯。设置 → 定价与费用 的「模型配色」卡片可为任意模型指定颜色，指定色优先并在黑白下保持彩色
- **会话明细与子代理归因**：会话按项目分组，每组带子代理小计（数量 / token / 费用）；展开任意会话进入**断点分析**——在累计消耗曲线上点最多 3 个断点，逐段读取 token 与费用（秒级精度，适合拆「调研 / 思考 / 总结」阶段）
- **费用估算**：逐模型费率，按官方阶梯时段计价（含 2025-08-17 起的峰谷价）；没有规则的模型单独列为未定价
- **费用走势**：多日窗口按 日/周/月 柱状聚合，快照积累一天后叠加官方扣费对账线，可钻取某天的峰谷 / 分模型拆分；单日窗口的费用走势是 **24 小时分时柱**（每小时按自己的峰谷时段计价，hover 读 峰/谷/合计；辅助调用按日估算、不进分时，仅以小字注明）。对账偏差的逐日明细在消费金额卡展开区
- **资金列**（费用估算 + 官方余额，上下叠放、est 钉顶 bal 钉底）：主值随卡宽在 20–34px 间连续缩放，未配置时是去定价入口；第三方筛选或未定价时同样只显示未配置态；**未定价只在够得上时提一句**：累计未定价 token < 5k 视为零头噪声、整行不出现；≥5k 显示「有未定价消耗」（尾随热区同款小箭头），点一下直达定价页。**官方余额块**：徽章（余额可撑天数）+ 次主值 + 赠送/充值拆分，未配置整段隐藏、失败行内重试。**订阅额度块**按行直读——名字列居左（窄时省略号收缩），窗口芯片列永远竖排：轨道 `flex:1` 吃满行宽、百分比贴块缘右对齐，块再窄也只是轨道变短、永不把内容顶出卡外；每个窗口是「5小时 ▮▮ 20%」（不依赖悬停），暖/热档（≥70% / ≥90%）的百分数字重加重一档——颜色之外的第二通道，轨道在宽画布上随卡宽小幅加粗保持体量，悬浮层显示该窗口自己的「{v}后重置」。**热区 = 语义块本身**：估算块与订阅额度块可点（悬停浮起背景、Enter/Space 可操作，头部右缘带常驻小箭头、随展开开合转向，`aria-controls` 指向展开槽，焦点环 2px），余额与缓存纯展示永远箭头。点击热区向下展开槽：估算 →「费用估算 + 月度预算」与**对账明细表**（逐日 官方扣费 / 本地估算 / 差额，稀疏日带 ≈，偏差日标红、无引导文案）；额度 → 订阅明细（窗口 / 燃速 / 分项目）；再点同块或 Esc 收起，展开时其余面板模糊压暗。刷新按钮悬浮在画布右上角（挂载时画布预留那个角，一次刷新余额 + 订阅额度；刷新中图标自旋、不可重复点，环心无数据时以「—」占位并同步读屏文案）
- **缓存命中区**（纯展示）：环是全卡唯一不可压缩的元素、卡片高度的基准——直径由画布宽度决定（`clamp(9em, 21cqw, 17.5em)`），永远不从行高反推、也永不被挤压；值弧平头端帽，命中率 ≥~96% 时缺口仍按真实比例露出；环行是「环｜证据列（命中/总输入、未缓存输入、输出，数值贴块缘右对齐）｜区间内活动三格」的三段式——活动格装得下贴右、装不下整段折到环下方铺满；无数据时保留环与环心说明、略去恒为 0 的两行；缓存区关闭时活动三格落到画布底部整行
- **订阅额度**：GLM Coding Plan、Kimi For Coding、MiniMax Coding Plan 等月付订阅的额度查询——每家供应商一枚窗口利用率芯片（5 小时 / 本周，带重置倒计时），消费金额卡展开后看明细：套餐名与续期、各窗口进度、按本地用量标定的总额 / 剩余估算、快照序列燃速与耗尽时刻预估、联网等附加额度，以及**分项目消耗表**（本窗口 / 本月，各项目的 token、份额与月费分摊）；设置页可按供应商开关查询
- **报表导出**：仪表盘右上角一键下载当前窗口的 CSV 日表（每日 token、缓存命中率、搜索/标题调用数、分时费用、官方扣费与对账差额，含汇总行），UTF-8 + BOM，Excel 直接打开不乱码
- **精简摘要浮层**：`/` 菜单的 **pulse** 一行打开插件自有的浮层，先给「本会话」自己的数字，再用本项目窗口（用量 / 费用 / 会话数）作框，并回答两个具体问题——钱花在哪些模型上（占比条 + 各自费用）、最近是哪些会话；浮层窄时自动竖排，一个按钮原地切到完整观测台
- **面板自适应**：尺寸一律从内容或容器推导——间距/节奏用 `em`（随字号缩放），环用 `max(12em, min(100%, 15em, 46cqw))`（随卡片），百分比列固定宽度右对齐；**首行卡片区域的样式表禁止出现版面用途的 px**（图标热区、字体行高这类元素自身属性除外），由 `test/style-test.mjs` 闸门把守；显示不下时先截断可恢复的文本（悬停看全文），卡片行在窄面板下自动从两列变一列；主题支持浅色 / 深色 / 粉 / 橙与自定义强调色
- **手动检查更新**：**设置 → 用量观测台 → 关于** 显示当前版本与「检查更新」按钮；点击后由宿主查询 npm registry，面板给出「已是最新 / 有新版本 / 开发版 / 检查失败」四态。绝不自动检查——无定时器、不在加载时探测

## 快速上手

```bash
dsh plugin --profile web add -w dsh-pulse
```

重启 `dsh web`，打开 **设置 → 用量观测台**。任意对话里 `/` 菜单的 **pulse** 一行会打开一个按该会话工作区限定的浮层——先看精简摘要，一个按钮切到完整观测台；侧栏底部按钮直接打开完整面板。所有入口共用同一个数据源 `GET /pulse/stats`。

`/` 菜单那一行是**客户端命令贡献**：dsh 只为自带的内置命令画图标，而贡献项可以带图标，且文案在每次打开菜单时求值（所以随界面语言走）。它打开的是插件自有的 `shell.overlay` 座位，因此菜单里只有一行——本插件不注册宿主命令，否则必然会多出一行没有图标的目录行（dsh 把贡献项与宿主命令按名字合并）。这里不修改 dsh 本身。

若已存有 `DEEPSEEK_API_KEY`，仪表盘还会显示官方余额，并在快照积累一天后出现对账线。

## 安装 / 卸载 / 更新

`dsh plugin --profile <name> <args>` 在 profile 目录内调用 pnpm（参数原样透传），并自动调和 `dsh.profile.bundles`。profile 是 pnpm workspace 根，所以 `add` / `remove` 要带 `-w`。

```bash
# 安装：任选一种来源
dsh plugin --profile web add -w dsh-pulse                              # npm registry
dsh plugin --profile web add -w /abs/path/to/dsh-pulse-0.5.1.tgz      # 打包的 tarball（本仓库版本 0.5.1）
dsh plugin --profile web add -w link:/abs/path/to/dsh-pulse           # 源码检出（开发）
dsh plugin --profile web add -w git+https://github.com/Enc-hanted/dsh-pulse

# 确认装的是哪个版本、什么形态（link 会显示 link: 路径）
dsh plugin --profile web list -w dsh-pulse

# 更新：registry 安装拉到最新发布版；tarball / link 安装则重新 add 覆盖
dsh plugin --profile web add -w dsh-pulse@latest

# 卸载
dsh plugin --profile web remove -w dsh-pulse
```

安装、更新或卸载之后都要**重启 `dsh web`**：宿主半（投影单元与 HTTP 路由）在插件加载时注册，必须重启；只换了客户端 bundle 时整页刷新即可（宿主的 watcher 会重新发布，**设置 → 用量观测台 → 关于** 显示的版本可用来确认页面在跑哪一版）。

可选残留，均可安全删除：`~/.dsh/settings.yaml` 里的 `pulse` 节（0.1.6 及以前的宿主）、活跃 profile patch 里的 `pulse` 行（0.1.7+ 宿主把设置存在那里）、以及 `~/.dsh/storages/pulse_balance.json`。卸载或删掉它们**不会丢历史用量**——见下一节。

## 数据与存储

用量统计没有插件私有的历史缓存：**事实来源是 dsh 自己的会话日志**，数字在每次请求时折出来。

| 数据 | 位置 | 归属 | 删掉会怎样 |
| --- | --- | --- | --- |
| 原始用量事件（每个 step 的 token 与计费依据） | `~/.dsh/sessions/` | dsh | 真的丢历史 |
| `pulseUsage` 投影缓存 | `~/.dsh/storages/session_projcache.json` + `session_projcache/` | dsh（插件只注册投影单元） | 自动从会话日志重算 |
| 官方余额快照（滚动 30 天，只存金额，不存 key） | `~/.dsh/storages/pulse_balance.json` | 插件唯一的私有持久文件 | 只丢「官方扣费」对账线历史 |
| 订阅额度利用率快照（滚动 30 天，每窗口百分比点） | `~/.dsh/storages/pulse_quota.json` | 燃速预估的历史 | 只丢燃速斜线，下次查询重新积累 |
| 单价 / 汇率 / 币种 / 面板开关 | profile 的 settings（`~/.dsh/settings.yaml` 或活跃 profile patch 的 `pulse` 行） | dsh settings | 回到默认 |
| 主题 / 面板 / 预算 / 对比 | 浏览器 localStorage（`dsh-pulse:*`） | 浏览器 | 纯偏好，无用量数据 |

所以卸载重装（甚至删掉 `session_projcache`）之后，历史用量会完整重算，不需要任何迁移。请求级的 payload 缓存只在宿主进程内存里（短 TTL），重启即空，同样不含历史。

## 费用模型

单价为**每百万 token 的 CNY 金额**，默认值来自官方价格页
https://api-docs.deepseek.com/zh-cn/quick_start/pricing/（核对于 2026-09-18）。
DeepSeek 按峰谷时段计费：北京时间 **09:00–12:00** 与 **14:00–18:00** 为高峰，且**仅周一至周五**；其余时段（含整个周末）谷价 = 峰价的一半。

| 模型 | 时段 | 未缓存输入 | 缓存命中 | 输出 |
|---|---|---|---|---|
| deepseek-flash | 高峰 | 2 | 0.04 | 8 |
| deepseek-flash | 谷时 | 1 | 0.02 | 4 |
| deepseek-v4-pro | 高峰 | 9 | 0.3 | 27 |
| deepseek-v4-pro | 谷时 | 4.5 | 0.15 | 13.5 |

`deepseek-v4-flash` 与 `deepseek-v4-flash-vision-exp` 是已下线的旧模型名：平台仍接受调用，但实际由 DeepSeek-V4.1-Flash 提供服务并按 Flash 价计费，因此本插件把这些历史事件按 Flash 档计价，而不是再列一行过期单价。按供应商限定的规则始终按它写的那个 id 计价。

规则的高峰时段默认**仅工作日**生效；把某条规则设为 `weekdaysOnly: false` 可让它的 `peakHours` 每天都算高峰，`peakHours: []` 仍表示平价。

规则可按供应商限定：`provider` 填供应商 route id 时只对该供应商的同名模型生效（精确匹配优先），留空则通配该模型 id 的所有供应商（官方默认如此）。这让你能给「代理商也卖 deepseek-v4-flash」这类情况单独定价，而不影响官方渠道。

供应商可整体标记为**月付费**（`monthlyProviders`，定价页每个供应商分组的开关）：该供应商所有模型无需单价，费用按 0 边际计（算作已配置，不算未定价）。开关旁可填**月付金额**（`monthlyFee`，CNY/月）：金额不参与按量成本估算，只作为「方案对比」页的订阅行与按量方案同台比较。

官方 `web_search` 与会话标题生成的辅助 LLM 调用本地没有 usage 事件，用量观测台按会话日志里的请求事件**精确计数**，并折算为 `辅助调用（估算）` 伪模型行进入模型堆叠与费用走势：搜索按单次形状（种子：未命中 8k / 命中 1.5k / 输出 1k）折算，标题请求自带确切 prompt 文本与输出上限，折算层直接按文本估算输入 token（CJK ≈0.6/字、其他 ≈0.3/字）、输出按上限钳制到 32，并按事件自带的路由计价。定价按当日生效的官方价（峰/谷按事件时刻判定），类型视图的本地 token 计量保持纯实测。

**形状自校准（默认开启）**：官方余额序列给出每日真值，视图把「官方扣费 − 实测费用 − 辅助估算」的逐日残差归因——有辅助调用的日子推出隐含标量 `s = (估算 + 残差) / 估算`（钳制 0.5–3），无调用日是对照组，出现无法归因的残差即**挂起学习**并提示；≥3 个一致样本（极差 ≤1.6×）且中位 `s` 偏离 1 超 3% 才切换生效形状（输出项实测近恒定，冻结不动）。整个机制是对已存数据的纯函数：无新存储、无定时器、换一个部署会自己收敛到那个部署的负载。快照稀疏的日子（面板没开跨零点，余额只给得出区间估计而非日历日测量）不参与学习与告警；近 7 个完整日出现 ≥15% 且 ≥¥0.10 的对账偏差时，仪表盘亮**对账漂移告警**（悬停看逐日对照）。在配置里手写 `searchShape`（键 `miss`/`hit`/`out`）即冻结自校准。CSV 导出带搜索/标题调用数与对账差额列；会话明细有「搜索 ×N」徽标与会话级辅助账单。

币种：每条规则以 **CNY**（默认）或 **USD** 计价，USD 模型通过 `usdToCny`（默认 6.8，定价页可改）折算，总额永远是单一 CNY 数字。折算按设计就是手动汇率：这是估算器，不是记账。`costEnabled: false` 隐藏费用数字，其余照常。

## 配置

设置 → 用量观测台 → **定价与费用** 编辑单价。模型行**只来自 Models 设置页的模型配置**（不可手动添加/删除），DeepSeek 官方单价自动回填；同一来源族的路由（官方 API 与客户端账号路由）共用一行、按通配价覆盖全部路由；每行填谷时输入/缓存命中/输出单价、CNY/USD 选择器，以及 24 小时高峰条（北京时间，默认官方窗口，全部取消 = 平价）。页面底部的**模型配色**卡片给出每个模型的当前颜色（自动色实时预览）并可指定自定义色、或一键回到自动。**只保存你改过的行**：没动的模型继续走官方通配默认价，官方改价自动跟上；**恢复官方价**把一行清回未改状态。每个供应商分组头有**月付费**开关，开启后该组模型收起单价输入。汇率字段用未保存的编辑即时重新计价已加载的窗口。**刷新目录**重读模型目录；**启用费用估算**整体关掉费用数字。没有 `llm` 服务时页面无可编辑行。

**方案对比**（设置 → 用量观测台 → 方案对比）用可调的用量场景（总输入、输出占比、缓存命中率）对比各模型费率下的预估成本。方案直接来自定价与费用页的有效规则（含官方默认），费率改动自动生效；可临时添加对比方案，所有方案可显隐。场景可取自真实用量窗口，也可手动设置。

**显示设置**（设置 → 用量观测台 → 显示设置）控制仪表盘各面板的显隐（含**会话明细**面板）、侧栏按钮的余额显示，并可选择**配色**——**蓝色**（即原作默认外观）、**粉色**、**橘色**或**黑白**。每套配色自带亮/暗两版，自动跟随宿主的亮暗主题。仪表盘上的**月度预算**卡片可设定 CNY 预算，显示本月已用、进度条和按日均速率推算的月底预测；余额栏会按近期扣费速率显示余额可撑天数。均为本地偏好。

保存立即生效，重启后仍在。0.1.6 及以前的宿主写入 `$DSH_HOME/settings.yaml`（`pulse:` 节，作为组合 base 之上的用户层）；0.1.7+ 宿主通过设置服务把 `pulse` 条目的配置写进活跃 profile patch，并带读取版本号守卫——与其他窗口的保存撞车时会返回 409，编辑器自动刷新本地副本以便重试。显示类字段（汇率、币种、面板开关等）声明为 *volatile*，修改它们不会重启插件；修改某条规则的峰时窗口才会重折叠一次历史。**恢复内置默认**把用户节清回组合配置与官方默认。没有设置服务时页面只读。

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
        monthlyProviders: []   # 包月订阅的供应商 route id，其模型费用按 0 计
        monthlyFee: {}         # 供应商 route id → 月付金额（CNY/月），用于方案对比展示
        quotaOff: []           # 关闭订阅额度查询的供应商 route id
        searchShape: {}        # 手动指定搜索调用形状 {miss, hit, out}（token/次）；留空 = 自校准
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
          - model: weekend-peak    # 这些小时每天都算高峰（含周末）
            input: 1
            output: 2
            peak: { input: 2, output: 4 }
            peakHours: [9, 10, 11]
            weekdaysOnly: false
          - provider: pi-ai         # 只对该供应商的同名模型生效
            model: deepseek-v4-flash
            input: 2
            output: 4
```

## 官方余额

`GET /pulse/balance` 用宿主已存的 key 查询 DeepSeek 开放平台，每次请求经凭据缝现取。零新增配置、零新增密钥存储：key 不离开宿主进程（只出现在一次出站 `Authorization` 头里），失败只映射为通用原因码，回复在服务端缓存 60 秒（`?refresh=1` 绕过），响应带 `cache-control: no-store`，出站请求拒绝重定向。未配置或不可达时，卡片自动隐藏或显示带重试的失败提示。

每次成功查询记录一条 `{t, total}` 快照（只有金额）到滚动 30 天的存储（`pulse_balance`，上限 1000 条、5 分钟去重）。每日官方扣费由余额序列推算，算不出来的日子（充值掩盖、缺少前序快照、超出最新快照）记为 `null`。费用火花线把它画成第三条细线。注意这是那把 key 的总扣费：别的工具共用同一把 key 时也会算进来。

## 订阅额度

`GET /pulse/quota` 查询**月付订阅**（Coding Plan / Token Plan）的剩余额度，与官方余额同款安全姿态：凭据每操作现取（llm 设置里该路由的 `apiKeyEnv` 引用 → Models 页写入的凭据记录（api-key 或 OAuth grant）→ 适配器内置环境变量名），只出现在一次出站 `Authorization` 头里；成功查询把每个窗口的利用率记录为滚动 30 天的 `{t, provider, window, pct}` 快照（`pulse_quota`，去重 + 上限），永不落任何密钥或原始响应。服务端缓存 60 秒（`?refresh=1` 绕过），轮询节奏与余额条一致。

内置适配器（按 Models 目录的供应商路由自动识别，无需配置）：

| 适配器 | 路由 | 端点 | 返回 |
| --- | --- | --- | --- |
| zai-coding | `zai-coding-cn` / `zai-coding` / `zai` | `open.bigmodel.cn` 或 `api.z.ai` 的 `/api/monitor/usage/quota/limit` + `/api/biz/subscription/list` | 5h/周 token 窗口百分比、重置时刻、联网工具次数、套餐名与年/月费 |
| kimi-coding | `kimi-coding` / `kimi` | `api.kimi.com/coding/v1/usages` | 周/5h 请求窗口百分比（比率源只报百分比，不生成次数） |
| minimax | `minimax` / `minimax-coding` | `api.minimaxi.com/v1/token_plan/remains` | 5h/周窗口（社区文档口径，未实测） |

这些多是**未承诺 SLA 的内部端点**（社区工具同款），解析全部防御式：字段缺失降级为「未知」而不是 0%，失败以通用原因码呈现。

**估算口径**（面板小字同步声明）：订阅额度只有百分比，没有绝对 token 数。dsh 用本地记录反推——同一时间跨度内该供应商路由的本地 token 消耗 ÷ 服务端百分比 = 估算总额，再给剩余量。**dsh 只覆盖这台机器经它跑的流量**：key 还被别的工具共用时估算偏低，仅供趋势参考，不是记账。燃速预估来自快照序列的线性斜率（≥2 个点、≥10 分钟跨度），给出「按此速率何时耗尽」与「重置时预计百分比」。

**分项目消耗**：把窗口（或本月）内该供应商的本地 token 按会话工作目录归因到项目——各项目的 token、份额条，以及**月费分摊**（套餐费 × 份额；套餐未公开价格时只显示份额）。边界天优先用 3 天保留期的小时级明细，缺失小时明细的日子按重叠比例折算。设置 → 用量观测台 → 显示设置里可按供应商关闭查询（写入 `quotaOff`）。

## 检查更新

`GET /pulse/update-check` 是设置页的手动检查：向 npm registry 询问 `dsh-pulse` 已发布的 `dist-tags.latest`，返回 `{ok, latest, publishedAt}`（失败则是 `{ok:false, error}`——registry 失败是数据，不是 HTTP 错误）。除余额与订阅额度查询外，这是本插件唯一的出站请求，且只有「检查更新」按钮会调用它：不在加载时探测、不做任何轮询，客户端拿返回值与自身构建戳比对。

## 扩展仪表盘（面向插件作者）

在 0.1.7+ 宿主上，仪表盘是一个 **Component Factory**（`pulse.dashboard`，root 作用域，locale `dsh-pulse`，带 **store seat**），声明了三个子槽位：

| 槽位 | 类型 | 渲染位置 |
| --- | --- | --- |
| `pulse.dashboard.chip` | `list` | 内置 chip 之后的 KPI 卡片 |
| `pulse.dashboard.filter` | `list` | 工具栏中项目/模型选择器之后的控件 |
| `pulse.dashboard.panel` | `list` | 内置面板之后（仅在数据加载完成且非空的视图中） |

注入方式：

```js
ctx.slots.inject("pulse.dashboard.panel", () => ctx.slots.register({
  name: "pulse.dashboard.panel", id: "my-panel",
}, MyPanel));
```

条目会收到工厂 locale 提供的 `t`、**store seat**——`useStore((s) => s)` 选择 `{data, view, busy}` 且跨窗口切换/重折叠保持实时（仪表盘每次变化都会同步），以及写回用的 `actions.sync(data, view, busy)`——外加渲染点 props `{data, view, busy}` 作为同帧快照。面板逐个受监督——某个面板崩溃只会上报并移除自身，不会拖垮仪表盘。任何插件也可以用 `renderFactorySlot("pulse.dashboard", { … })` 把整个仪表盘挂到别处（接受可选的 `floatActions` / `headerExtra` / `onConfigure` 仪表盘 props，支持 `fallback` 选项）。在没有 Factory API 的宿主上插件全部直渲染，扩展点自动休眠。

## 插件管理器与设置页席位

除仪表盘外，插件还向宿主自身的席位贡献内容（席位缺失时静默降级）：

- **`plugins.row.config`**（键 `dsh-pulse#pulse`）——完整定价编辑器渲染在插件管理器的 bundle 详情页（`view: "page"`），列表中显示一行摘要（`view: "summary"`）。
- **`plugins.detail.badge` / `plugins.detail.section`**——详情页标题旁的标签与页面内容下的介绍卡片。
- **`settings.general.item`**（id `pulse-foot-balance`）——侧栏余额指示器作为「通用」设置页的原生开关，与面板页共用同一偏好 store（需要 store 引擎；旧宿主上隐藏）。

## 兼容性

已在 **@deepseek-ai/dsh 0.1.5-rc.3 与 0.1.7-alpha.2**（Windows，Node 24.14.1）上验证；dsh 要求 **Node ≥ 22.15**。同一份构建覆盖所有代际，各接缝在运行时探测：

- **投影注册**：0.1.2-rc 宿主读取 `stateSchema` + `wire`，旧宿主（0.1.0-rc.x）读取旧版顶层 `schema`/`view`。
- **持久化缓存**：在 0.1.2-rc 及以后插件自己走消费者读取阶梯（未播种会话用零 I/O 的 `cachedSnapshot` 行——0.1.7 之前带显式 cut、之后仅凭 header 身份——否则 `sessionQuery.readSession` + 同步 `coldSnapshot(meta, inheritedEventCount, events)`），旧宿主（0.1.2-rc 之前）仍用缓存自读取的异步 `coldSnapshot(id)`（按形参个数识别）。
- **设置**：经典宿主在 `SettingsProvider` 上注册独立命名空间；0.1.7+ 宿主经 `SettingsForms` 写入条目配置并带版本号守卫（过期写入返回 HTTP 409）。展示类字段声明为 volatile，修改它们不会重启插件。
- **客户端**：0.1.7 的图标改名（`IconXOutline16` → `IconXOutlineMedium`）已做桥接；仪表盘工厂只在 `slots.registerFactory` 存在的宿主上注册。旧版宿主（不含分时明细）仍可正常显示，费用按谷价估算。
- **仅 0.1.7 的席位**：store 引擎（`dsh-client-store`）通过特性检测 + try/catch 引入——缺失时 store 席位、通用设置开关和侧栏实时同步退场，普通仪表盘照常工作。插件管理器席位（`plugins.row.config`、`plugins.detail.badge`、`plugins.detail.section`）与每个工厂注册各自独立拒绝，宿主拒绝任何一个未知槽位都不会拖垮其余注册。
- **前端**：客户端半声明 `platform: "web"`，所以只有 Web 前端会加载它——`dsh-tui` 之类的其它前端没有这个面板；本插件也不注册宿主命令，所以那些前端的命令平面里没有 `/pulse`。**用量数据不受影响**：宿主半与前端无关，任何前端（Web / dsh-tui / headless / ACP）跑出来的会话都会被 `pulseUsage` 折叠，照常出现在 Web 面板里。

统计载荷为 **schema 4**：在 schema 3 之上增加 `corpusSessions`（窗口之外还有多少会话），用来区分「从未记录过」和「该区间内没有用量」。客户端可读 schema 2–4，因此升级过程中宿主与浏览器 bundle 版本不一致也能继续工作。

## 开发

```bash
npm test                    # host / aggregate / view / tui / golden / style / manifest 七个套件
npm run build               # 改 src/ 后重新构建 lib/client.js（esbuild）
```

特别致谢 [Linux Do](https://linux.do/) 社区。

MIT — 见 [LICENSE](./LICENSE)。

---

<a id="english"></a>

# dsh-pulse — English

[简体中文](#top) · **English**

Per-session usage and cost observatory for [dsh](https://github.com/deepseek-ai/deepseek-harness). Aggregates token usage across all sessions, estimates cost from built-in DeepSeek rates, and shows the official platform balance. Everything runs on the UI plane: no model-visible tools, zero tokens spent.

## Features

- **Panel structure**: two first-row KPI cards (spending card, cache-hit ring) stretched level by the grid; their height comes from content, and the right card's slack goes to the ring (which carries a 12em floor, so it never shrinks away on a sparse card). Extension chips render in their own row and can never stretch the KPI row; the usage and cost trends switch with the two tabs in the trend header
- **Usage trend**: hourly line chart for single-day windows (today and any of the last 3 days aggregate the sessions' own hour maps), daily bars for 7/30 days, GitHub-style heatmap for 90 days/1 year, custom date ranges up to 30 days. The bar chart drills two levels: click a day to sweep that day full width by model, click a model for its input/cache/output token split, then click empty space or press Esc to unwind one level at a time
- **Project / model filters**: projects pick from a searchable dropdown; models are a **multi-select** (searchable checkbox list, empty = all) — the usage-stack legend, the cost-stack legend and the model-distribution rows all **click-toggle the same filter set**. The `/pulse` row opens its seat scoped to that session's workspace automatically and pins the current session to the top of its session list (with a Current badge) — until you change the filter yourself
- **Cross-provider model distinction**: models are labeled as `provider · display name` from the Models config; the provider prefix appears only when several providers serve the same-named model, otherwise just the name. **Several routes to one vendor count as one source**: the hand-entered DeepSeek API route and the account route the desktop client adds on sign-in (`deepseek-official` / `deepseek-account`) draw on the same balance, count into the same reconciliation and display as ONE row (the per-route rows stay available as `modelRoutes`, so the two can be shown apart again the day they bill differently). Selecting a third-party (non-official) model hides the official balance; an unpriced third-party model also hides the cost estimate and the monthly budget
- **Model distribution / project ranking**: share bars and a ranked table
- **Model colours**: every model wears one colour that is stable across surfaces. It starts as the vendor's brand-gradient colour — the same model keeps the same colour in every window, every set, every view — and a visible screen is then resolved once: any two colours closer than ΔE 0.07 are separated by moving only the later one, so no two rows of one chart can look alike (measured: neighbouring brand-gradient steps are often just 0.013 ΔE apart). The aux pseudo-model is pinned to a gold **stripe** texture (it is an estimate, and no solid family colour can be confused with it); in the B&W theme auto colours become a lightness ladder instead of one flat grey. The **Model colours** card under Settings → Pricing can pin any model to a colour of your own — it wins over the auto colour and stays vivid in B&W
- **Session detail & subagent attribution**: sessions grouped by project, with a subagent subtotal (count / tokens / cost) and every session's own break analysis — expand a session, click its cumulative-consumption curve to place up to three breaks, and read per-segment tokens and cost at second accuracy (a task's research / thinking / summary stages)
- **Cost estimate**: per-model rates priced by the official tier schedule, including the off-peak/peak epochs from 2025-08-17; models without a rule are listed as unpriced
- **Cost trend**: multi-day windows aggregate into day/week/month bars with the official balance reconciliation line overlaid after a day of snapshots, drillable by tier and model; a single-day window shows **24 hourly cost bars** priced at each hour's own billing schedule (hover for peak / off-peak / total; aux calls are day-level estimates and ride a footnote instead)
- **Spending card**: row-one left card in **stat blocks** — each block stacks a label, its value, then that value's OWN caveats under it (a caveat qualifies the number above it; baseline alignment never drags it up to the label): ① the spending estimate is the hero (20px; an unconfigured state doubles as the 去定价 entry, and third-party or unpriced picks show the same honest face) ② the official balance sits on ONE line with its value (15px), caveats on the next: runway · granted/topped split; the section hides while unconfigured, a failure retries inline ③ subscription quota reads straight off each row — **the provider name stays left and the windows sit as a content-sized group flush RIGHT** (`margin-left:auto`, nothing stretches to soak up width), the utilization track a fixed `6em` and the percentage a fixed right-aligned `2.8em` column, so every column lines up across rows and each row ends exactly at the card's edge; each window as `5-hour ▮▮ 20%` (no hover needed; warm/hot windows set their percentage one weight step heavier — a second, non-color tier channel, and the ribbon thickens slightly with canvas width), plus **one compressed countdown per row, on the window that resets soonest** (`18m` / `2h` / `3d`, an absolute `10-03` beyond a week) instead of repeating "resets in …" twice ④ **an unpriced caveat only appears once it matters**: under 5k unpriced tokens is rounding noise and the line is not rendered at all; at or above it the card says `Some usage unpriced` (the hot zones' painted chevron trailing it) and opens the pricing page, with the model ids and counts in the hover title. The refresh floats in the card's own top-right corner (inside the padding band, zero flow cost) and refreshes balance + subscriptions together, spinning while in flight. One click expands the estimate + budget panel, the quota detail (windows / burn / per-project table) and the **reconciliation table** (per-day official spend / local estimate / gap, ≈ on sparse days, drifted days in the danger color, no attribution copy) — re-click or Escape closes, and the rest of the dashboard dims while it is open
- **Cache card**: row-one right card, pure display, with no head row — the ring's center already names it, so every fixed row we drop goes back into the ring. The ring's size is `max(12em, min(100%, 15em, 46cqw))`: it grows with the row, caps at 15em, never exceeds 46% of the card's width, and never shrinks below its 12em floor; no fixed pixel box, no size containment to overflow its body; with no data it keeps the ring and its in-ring explanation but no longer lists the two always-zero detail rows; the **in-window activity (sessions / turns / tool calls) is three EQUAL cells at the bottom of this card**
- **Subscription quota**: flat-rate plan quota (GLM Coding Plan, Kimi For Coding, MiniMax Coding Plan …) as one utilization chip per provider (5-hour / weekly windows with reset countdowns); the consumption card's expansion holds the detail: plan name and renewal, per-window progress, totals/remaining calibrated from local usage, burn-rate and exhaustion forecasts from the snapshot series, web-tool extras, and the **per-project burn table** (window / month, each project's tokens, share and slice of the monthly fee); queries toggle per provider in settings
- **CSV export**: one click in the dashboard header downloads the loaded window as a UTF-8 CSV daily table — tokens, cache-hit rate, search/title call counts, tier-aware cost, official spend and the reconciliation gap per day, plus a totals row (opens directly in Excel)
- **Compact summary seat**: the `/pulse` menu row opens the plugin's own floating seat with this session's numbers first, then the workspace window (tokens / cost / sessions) as the frame, answering two concrete questions — which models spent the tokens (share bars, each with its cost) and which sessions were recent — in a two-column layout that stacks when the seat is narrow. One button hands the seat over to the full observatory
- **Panel-relative sizing**: sizes derive from content or container — spacing and rhythm in `em` (scale with the type scale), the ring as `max(12em, min(100%, 15em, 46cqw))` (scales with the card), quota counts in fixed-width right-aligned columns; **the card-region stylesheet may not contain layout-purpose pixels at all** (element-intrinsic icon hit targets and typography line-heights excepted), enforced by the `test/style-test.mjs` gate. Text that cannot fit truncates only where it is recoverable (its `title` carries the rest); the card row itself drops from two columns to one on a narrow panel; themes cover light / dark / pink / orange with a custom accent
- **Manual update check**: **Settings → Usage Pulse → About** shows the running version and a **Check for updates** button; pressed, the host asks the npm registry and the panel reports up to date / newer version / development build / failure. It never checks on its own — no timer, no probe at load

## Quick start

```bash
dsh plugin --profile web add -w dsh-pulse
```

Restart `dsh web`, then open **Settings → Usage Pulse**. In any conversation, the `/` menu's **pulse** row opens a floating seat scoped to that session's workspace — the compact summary first, the full observatory one button away; the sidebar foot button opens the observatory directly. All surfaces share one data source, `GET /pulse/stats`.

The `/` menu row is a **client command contribution**: dsh's menu draws glyphs only for its own built-ins, while a contribution carries an icon and copy that is read on every candidate pass (so it follows the UI language). It opens the plugin's own `shell.overlay` seat, so the menu shows exactly one row — this plugin registers no host command, which would necessarily add a second, glyph-less row (dsh merges contributions with the host catalog by name). Nothing here patches dsh itself.

With a stored `DEEPSEEK_API_KEY`, the dashboard also shows the official balance and, after a day of snapshots, the reconciliation line.

## Install / Uninstall / Update

`dsh plugin --profile <name> <args>` runs pnpm inside the profile directory (arguments are passed through) and reconciles `dsh.profile.bundles` automatically. Profiles are pnpm workspace roots, hence the `-w` on `add` / `remove`.

```bash
# install — pick one source
dsh plugin --profile web add -w dsh-pulse                              # npm registry
dsh plugin --profile web add -w /abs/path/to/dsh-pulse-0.5.1.tgz      # packed tarball (this repo: 0.5.1)
dsh plugin --profile web add -w link:/abs/path/to/dsh-pulse           # source checkout (development)
dsh plugin --profile web add -w git+https://github.com/Enc-hanted/dsh-pulse

# confirm which version and form is installed (a link shows the link: path)
dsh plugin --profile web list -w dsh-pulse

# update — a registry install pulls the latest published version;
# a tarball / link install is replaced by re-running add
dsh plugin --profile web add -w dsh-pulse@latest

# uninstall
dsh plugin --profile web remove -w dsh-pulse
```

Restart `dsh web` after any install, update or removal: the host half (projection unit and HTTP routes) registers at plugin load, so a restart is required; a client-bundle-only change just needs a page reload (the host's watcher republishes it, and **Settings → Usage Pulse → About** shows which version the page is running).

Leftovers, all safe to delete: the `pulse` section in `~/.dsh/settings.yaml` (hosts up to 0.1.6), the `pulse` row in the active profile patch (0.1.7+ hosts store settings there), and `~/.dsh/storages/pulse_balance.json`. Removing them — or the plugin itself — **loses no usage history**; see the next section.

## Data & storage

Usage statistics have no plugin-private history cache: **dsh's own session logs are the source of truth**, and every number is folded at request time.

| Data | Location | Owned by | What deleting it costs |
| --- | --- | --- | --- |
| Raw usage events (per-step tokens and the billing basis) | `~/.dsh/sessions/` | dsh | the actual history |
| `pulseUsage` projection cache | `~/.dsh/storages/session_projcache.json` + `session_projcache/` | dsh (the plugin only registers the projection unit) | nothing — it is refolded from the session logs |
| Official-balance snapshots (rolling 30 days, money only, never the key) | `~/.dsh/storages/pulse_balance.json` | the plugin's only private durable file | the official-spend reconciliation line only |
| Subscription-quota utilization snapshots (rolling 30 days, per-window percentage points) | `~/.dsh/storages/pulse_quota.json` | the burn-rate history | the burn slope only; it re-accumulates from the next query |
| Pricing / FX rate / currency / panel toggles | the profile's settings (`~/.dsh/settings.yaml` or the `pulse` row in the active profile patch) | dsh settings | back to defaults |
| Theme / panels / budget / compare / card height | browser localStorage (`dsh-pulse:*`) | the browser | preferences only, no usage data |

So uninstalling and reinstalling (even deleting `session_projcache`) refolds the whole history with no migration. The request-level payload cache lives in host process memory only (short TTL) and holds no history.

## Cost model

Rates are **CNY per million tokens**; defaults are built in from the official price page (https://api-docs.deepseek.com/zh-cn/quick_start/pricing/, checked 2026-09-18). DeepSeek bills by peak/off-peak windows: Beijing time **09:00–12:00** and **14:00–18:00**, **Monday to Friday only** — every other hour, including the whole weekend, is off-peak at half the peak rate.

| model | tier | uncached input | cache-hit input | output |
|---|---|---|---|---|
| deepseek-flash | peak | 2 | 0.04 | 8 |
| deepseek-flash | off-peak | 1 | 0.02 | 4 |
| deepseek-v4-pro | peak | 9 | 0.3 | 27 |
| deepseek-v4-pro | off-peak | 4.5 | 0.15 | 13.5 |

`deepseek-v4-flash` and `deepseek-v4-flash-vision-exp` are retired ids: the platform still accepts them and serves them as DeepSeek-V4.1-Flash at Flash rates, so this plugin prices those events at the Flash tier instead of listing a second, stale rate row. A provider-scoped rule always prices exactly the id it names.

A rule's peak hours are weekdays-only by default. Setting `weekdaysOnly: false` on a rule bills its `peakHours` on every day of the week; an explicit empty `peakHours` list still means flat pricing.

Rules can be provider-scoped: a `provider` holds the route id and prices only that provider's same-named model (exact match wins); left empty, the rule prices the model id from any provider (the official defaults work this way). So a reseller serving `deepseek-v4-flash` can be priced separately without touching the official channel.

A provider can be marked **monthly-paid** as a whole (`monthlyProviders`, toggled per provider group in the pricing page): its models need no rates and price at zero marginal cost (configured, never "unpriced"). Next to the toggle sits a **monthly amount** field (`monthlyFee`, CNY/mo): the figure never enters the pay-per-token estimate — it surfaces in plan comparison as the subscription row.

The official `web_search` and session-title LLM calls have no local usage events; the observatory counts them **exactly** from the log-only request events and converts them into an `Aux calls (est.)` pseudo-model row in the model stack and the cost trend. Search converts through a per-call shape (seed: 8k miss / 1.5k hit / 1k output); title requests carry their exact prompt text and output cap, so the fold estimates their input tokens from the text itself (CJK ≈0.6/char, other ≈0.3/char), clamps the output at 32, and prices the day under the route the event names. Everything prices at that day's official rates (peak/off-peak from each event's own time). The type view's local token totals stay measurement-pure; the row is always labeled as an estimate.

**Self-calibrating shape (on by default)**: the official balance series provides daily ground truth, and the view attributes the per-day residual `official − measured − aux-estimate` — aux days imply a scalar `s = (est + gap) / est` (clamped to 0.5–3), aux-free days act as controls whose unattributable residue **suspends learning** with a visible note. The active shape switches only after ≥3 consistent samples (spread ≤1.6×) whose median `s` sits at least 3% off 1 (the output component measures near-exact and stays frozen). The whole mechanism is a pure function of already-stored data: no new storage, no timers, and each deployment converges to its own workload. Sparse snapshot days (the dashboard was closed across midnight, so the balance only yields an interval estimate, not a per-calendar-day measurement) join neither learning nor alerting. When any of the last 7 complete days drifts ≥15% **and** ≥¥0.10 from the estimate, the dashboard raises a **reconciliation drift alert** (hover for the per-day breakdown). A manual `searchShape` (`miss`/`hit`/`out` keys) freezes the calibration. CSV export gains search/title call counts and a recon-gap column; session rows carry a plain-text `Search ×N` badge and a per-session auxiliary bill.

Currency: rules price in **CNY** (default) or **USD**; USD-priced models convert through one configurable rate (`usdToCny`, default 6.8, editable in the pricing page), so the total is always a single CNY sum. The conversion is a manual rate by design: this is an estimator, not accounting. `costEnabled: false` hides the cost figures while keeping every other number.

## Configuration

**Settings → Usage Pulse → Pricing & cost** edits the rates. Rows come **only from the Models settings page's configured models** (no manual add/delete), with official DeepSeek rates auto-filled; routes of one source family (the official API route and the desktop client's account route) share a single row whose wildcard rate covers every route; each row takes off-peak input / cache-hit / output rates, a CNY/USD selector, and a 24-hour peak strip (Beijing time, official windows by default, all deselected = flat). **Only rows you edited are saved** — untouched models keep inheriting the official wildcard defaults, so official rate changes reach them automatically, and **Official rates** clears a row back to that untouched state. Each provider group header has a **Monthly** toggle that collapses its rows' rate inputs. The exchange-rate field re-prices the loaded window with your unsaved edits. **Refresh catalog** re-reads the model catalog; **Enable cost estimates** turns cost figures off entirely. The **Model colours** card at the page bottom previews every model's current colour and lets you pin your own (or reset one, or all, back to auto). Without the `llm` service there are no rows to edit.

**Compare plans** (Settings → Usage Pulse → Compare plans) prices a usage scenario (total input, output/input ratio, cache hit rate) against the effective pricing rules (official defaults included), so rate edits show up here automatically. Temporary plans can be added; every plan can be shown or hidden. The scenario can be taken from the real usage window, or set by hand.

**Display settings** (Settings → Usage Pulse → Display settings) toggle each dashboard panel (including the **session detail** panel) and the sidebar balance indicator, and pick a **color theme** — *blue* (the original look), *pink*, *orange* or *B&W*. Every palette carries its own light and dark variant and follows the shell's theme automatically. The **monthly budget** card on the dashboard takes a CNY budget and shows month-to-date spend, a progress bar and a run-rate month-end forecast; the balance bar shows how many days the balance lasts at the recent spend rate. All local preferences.

Saves apply immediately and survive restarts. On hosts up to 0.1.6 they go to `$DSH_HOME/settings.yaml` (`pulse:` section, user layer over the composition base); on 0.1.7+ hosts the plugin writes the `pulse` entry's config in the active profile patch through the settings service, under a read-revision guard — a save that races another window is refused (HTTP 409) and the editor refreshes itself for a clean retry. Display fields (rate, currency, budget toggles) are declared *volatile*, so editing them does not restart the plugin; editing a rule's peak hours re-folds history once. **Restore defaults** clears the user section back to the composition config and the official defaults. Without a settings service the page is read-only.

Profile overrides in `cordis.patch.yml`:

```yaml
- insert:
    - id: pulse
      name: 'dsh-pulse'
      config:
        defaultDays: 30   # window served when the client sends none
        topProjects: 8    # ranked-project row cap
        projectDepth: 1   # path segments in a project label (1..3)
        costEnabled: true # false hides the cost figures
        usdToCny: 6.8     # USD→CNY rate for the unified CNY total
        monthlyProviders: []   # flat-subscription provider route ids; their models price at 0
        monthlyFee: {}         # provider route id → monthly price (CNY/mo), surfaced in plan comparison
        quotaOff: []           # provider route ids with subscription-quota queries switched off
        searchShape: {}        # manual per-call aux shape {miss, hit, out} (tokens); empty = self-calibrating
        pricing:          # overrides the built-in defaults per model
          - model: deepseek-v4-pro
            input: 4.5
            cacheRead: 0.15
            output: 13.5
            peak:         # peak-hour rates (official windows by default)
              input: 9
              cacheRead: 0.3
              output: 27
            currency: CNY
          - model: third-party-x   # flat USD rule with custom peak hours
            input: 0.5
            output: 2
            currency: USD
            peakHours: [0, 1, 2, 3, 4, 5]   # Beijing-time hours billed at peak
          - model: weekend-peak    # bill those hours on every day of the week
            input: 1
            output: 2
            peak: { input: 2, output: 4 }
            peakHours: [9, 10, 11]
            weekdaysOnly: false
          - provider: pi-ai         # prices only that provider's same-named model
            model: deepseek-v4-flash
            input: 2
            output: 4
```

## Official balance

`GET /pulse/balance` queries the DeepSeek open platform with the key the host already stores, resolved per request through the credentials seam. Zero new configuration, zero new secret storage: the key never leaves the host process (it appears only in one outbound `Authorization` header), failures map to generic cause codes, replies are cached 60 s server-side (`?refresh=1` bypasses), responses carry `cache-control: no-store`, and outbound requests refuse redirects. Unconfigured or unreachable, the card hides itself or shows a retry.

## Subscription quota

`GET /pulse/quota` queries the remaining quota of **flat-rate subscriptions** (coding plans, token plans) with the same security posture as the official balance: credentials resolve per operation (the route's `apiKeyEnv` ref from the llm settings → the credential record the Models page writes (api-key or OAuth grant) → the adapter's well-known env names) and live only in one outbound `Authorization` header; every successful query records each window's utilization as a rolling 30-day `{t, provider, window, pct}` snapshot (`pulse_quota`, deduped, capped) — never a key, never a raw payload. Server-cached 60 s (`?refresh=1` bypasses); the polling cadence matches the balance bar.

Built-in adapters (auto-detected from the Models catalog's provider routes, zero configuration):

| adapter | routes | endpoints | returns |
| --- | --- | --- | --- |
| zai-coding | `zai-coding-cn` / `zai-coding` / `zai` | `open.bigmodel.cn` or `api.z.ai`: `/api/monitor/usage/quota/limit` + `/api/biz/subscription/list` | 5h/weekly token-window percentages, reset instants, web-tool counts, plan name and fee |
| kimi-coding | `kimi-coding` / `kimi` | `api.kimi.com/coding/v1/usages` | weekly/5h request-window percentages (ratio sources render percentage-only, never a count) |
| minimax | `minimax` / `minimax-coding` | `api.minimaxi.com/v1/token_plan/remains` | 5h/weekly windows (community-documented, not live-verified) |

Most of these are **internal endpoints without a committed SLA** (the same ones community tools use); every parser is defensive — a missing field degrades to "unknown", never a fabricated 0%, and failures surface as generic cause codes.

**Estimation honesty** (stated in the panel's own footnote): subscriptions report percentages only, never absolute tokens. dsh back-solves them — local tokens for that provider route over the same span ÷ the server's percentage = the estimated total, and the remainder follows. **dsh sees only the traffic it carries**: a key shared with other tools reads low; treat the numbers as trends, not accounting. The burn forecast is a linear slope over the snapshot series (≥2 points, ≥10 minutes apart), answering "when does it run out at this rate" and "projected percentage at reset".

**Per-project burn**: the window's (or the month's) local tokens for the provider attribute to projects through each session's working directory — tokens, share bars, and the **monthly-fee apportionment** (plan fee × share; share only when the plan hides its price). Boundary days prefer the 3-day hourly retention; days without hour maps prorate by overlap. Queries toggle per provider under Settings → Usage Pulse → Display settings (writes `quotaOff`).

## Update check

`GET /pulse/update-check` is the settings page's manual check: it asks the npm registry for `dsh-pulse`'s published `dist-tags.latest` and answers `{ok, latest, publishedAt}` (or `{ok:false, error}` — a registry failure is data, not an HTTP error). It is the plugin's only outbound request besides the balance and subscription-quota queries, and the only caller is the **Check for updates** button: nothing probes at load, nothing polls, and the client compares the answer against its own build stamp.

Every successful query records one `{t, total}` snapshot, money only, in a rolling 30-day storage (`pulse_balance`, capped at 1000 entries, 5-minute dedupe). Per-day official spend is derived from the balance series; days where it can't be known (a top-up masks the spend, no prior snapshot, past the newest snapshot) are `null`. The cost sparkline draws this as a third line. Note that it is that key's total spend: if other tools share the key, it includes them.

## Extending the dashboard (for plugin authors)

On 0.1.7+ hosts the dashboard is a **Component Factory** (`pulse.dashboard`, root scope, locale `dsh-pulse`, with a **store seat**) declaring three child slots:

| slot | kind | rendered |
| --- | --- | --- |
| `pulse.dashboard.chip` | `list` | KPI tiles after the built-in chips |
| `pulse.dashboard.filter` | `list` | controls after the project/model pickers in the toolbar |
| `pulse.dashboard.panel` | `list` | panels after the built-in ones, in the loaded non-empty view |

Inject a component:

```js
ctx.slots.inject("pulse.dashboard.panel", () => ctx.slots.register({
  name: "pulse.dashboard.panel", id: "my-panel",
}, MyPanel));
```

Entries receive the factory's `t` (the `dsh-pulse` locale), the **store seat** — `useStore((s) => s)` selects `{data, view, busy}` and stays live across range switches and refolds (the dashboard syncs it on every change), plus `actions.sync(data, view, busy)` for write-back — and the render-site props `{data, view, busy}` as a same-tick snapshot. Panels are supervised individually — a crashing panel is reported and removed without taking the dashboard down. Any plugin can also mount the whole dashboard elsewhere with `renderFactorySlot("pulse.dashboard", { … })` (accepts the optional `floatActions` / `headerExtra` / `onConfigure` dashboard props; a `fallback` option is honored). On hosts without the factory API the plugin renders everything directly and the extension points stay dormant.

## Plugin-manager and settings-page seats

Beyond the dashboard, the plugin contributes to the shell's own seats (all degrade silently when a seat is missing):

- **`plugins.row.config`** keyed `dsh-pulse#pulse` — the full pricing editor rendered on the bundle's Plugins-page detail (`view: "page"`) and a one-line summary in the rows list (`view: "summary"`).
- **`plugins.detail.badge` / `plugins.detail.section`** — a tag beside the detail title and an intro card under the page content.
- **`settings.general.item`** id `pulse-foot-balance` — the sidebar-balance indicator as a native General-settings toggle, wired to the same preference store as the panels page (requires the store engine; hidden on older hosts).

## Compatibility

Verified against **@deepseek-ai/dsh 0.1.5-rc.3 and 0.1.7-alpha.2** (Windows, Node 24.14.1); dsh requires **Node ≥ 22.15**. One build serves every generation — the seams are detected at runtime:

- **Projection registration**: the 0.1.2-rc host reads `stateSchema` + `wire`, older hosts (0.1.0-rc.x) read the legacy top-level `schema`/`view` pair.
- **Persisted cache**: on 0.1.2-rc and later the plugin drives the consumer-owned ladder itself (zero-I/O `cachedSnapshot` — with the explicit cut before 0.1.7, header-only identity after — otherwise `sessionQuery.readSession` + the synchronous `coldSnapshot(meta, inheritedEventCount, events)`), while pre-0.1.2-rc hosts keep the cache's self-reading async `coldSnapshot(id)` (detected by arity).
- **Settings**: classic hosts register a per-plugin namespace on the `SettingsProvider`; 0.1.7+ hosts write the entry's config through `SettingsForms` under revision checks (stale writes get HTTP 409). Display fields are declared volatile, so those edits never restart the plugin.
- **Client**: the 0.1.7 icon rename (`IconXOutline16` → `IconXOutlineMedium`) is bridged, and the dashboard factory registers only where `slots.registerFactory` exists. Hosts without hourly tier details still render, with costs priced at off-peak rates.
- **0.1.7-only seats**: the store engine (`dsh-client-store`) is required via a feature-detected, try-caught lookup — without it the store seats, the General-settings toggle and the live footer sync drop out while the plain dashboard keeps working. The plugin-manager seats (`plugins.row.config`, `plugins.detail.badge`, `plugins.detail.section`) and every factory registration refuse alone, so a host that rejects one unknown slot never takes down the rest of the registration batch.
- **Frontends**: the client half declares `platform: "web"`, so only the Web frontend loads it — `dsh-tui` and other frontends get no panel, and the plugin registers no host command, so their command plane has no `/pulse`. **The data is unaffected**: the host half is frontend-agnostic, so sessions from any frontend (Web, dsh-tui, headless, ACP) are folded by `pulseUsage` and show up in the Web dashboard.

The stats payload is **schema 4**: schema 3 plus `corpusSessions` (how many sessions exist outside the window, which is what separates "nothing recorded yet" from "nothing in this range"). The client reads schemas 2–4, so a host and a browser bundle from different releases keep working through an upgrade.

## Development

```bash
npm test                    # host / aggregate / view / tui / golden / style / manifest suites
npm run build               # rebuild lib/client.js from src/ (esbuild)
```

Special thanks to the [Linux Do](https://linux.do/) community.

MIT — see [LICENSE](./LICENSE).
