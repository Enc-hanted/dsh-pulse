# 兼容性说明

**简体中文** · [English](./en/COMPATIBILITY.md)

dsh-pulse 对每一代受支持的 dsh 都是同一份构建：宿主能力在运行时探测，某个席位缺席时只降级该席位。

- [支持矩阵](#支持矩阵)
- [地板是如何求值的](#地板是如何求值的)
- [运行时降级](#运行时降级)
- [护栏](#护栏)
- [终端面（dsh-tui）](#终端面dsh-tui)
- [历史代际备注](#历史代际备注)

## 支持矩阵

| 组件 | 支持范围 | 备注 |
| --- | --- | --- |
| dsh 宿主 | `>=0.2.0-rc.2 <0.3` | 整个 0.2.x 系列，含预发布；不支持 0.1.x |
| Node.js | `>=22.19` | |
| Web 前端 | 完整面板 + 会话浮层 | 客户端侧声明 `platform: "web"` |
| dsh-tui（可选） | `>=0.13.0 <0.17`，已在 0.16.1 上验证 | 独立的第三方终端前端，需单独安装 |
| 会话数据来自 | Web / dsh-tui / headless / ACP | 用量统计与前端无关 |

统计载荷在投影 schema 2–4 之间可互读，所以宿主与浏览器 bundle 版本短暂不一致时也能正常工作。

接缝包（`@deepseek-ai/dsh-credentials`、`@deepseek-ai/dsh-storage-domain`）是 **peer 依赖**，从不直接依赖：宿主通过拦截 peer 列表来解析 linked-root 模块，所以插件内的私有副本会静默遮蔽宿主自己的接缝（如 0.1.7 插件装进 0.2.1 宿主）。启动日志会打印 `dsh-pulse <version> on seams dsh-credentials <version> / dsh-storage-domain <version>`，版本错配不用剖开 `node_modules` 就能看见。

## 地板是如何求值的

`engines.dsh` 存在时以它为准：dsh 的插件兼容性检查（`dsh-app-boot`）求值 `satisfies(version, range, { includePrerelease: true })`，如果插件声明了 `engines.dsh`，就由这个判定单独决定，peer 范围被忽略。早于 `engines.dsh` 的旧内核只检查 peer 范围。两条路径都靠声明 `>=0.2.0-rc.2 <0.3` 满足，所以一个地板就能覆盖运行 0.2.0-rc.2、0.2.1-rc.2 与 0.2.1-alpha.5 的宿主。

> **为什么不用单点地板？** 用 `>=0.2.1-alpha.5` 做地板会让 dsh-tui 内核（当时是 0.2.0-rc.2）以 `skipping profile bundle "dsh-pulse"` 拒绝整个 bundle。web 和 dsh-tui 是两个不同的内核；地板必须描述整个系列，而不是某一个正在运行的副本。

## 运行时降级

在缺少某项服务的宿主上，对应的界面逐级降级，不会直接失败：

- **Store 引擎**（`dsh-client-store`）：以特性探测 + try/catch 加载；没有它时，实时侧栏同步、设置页席位与 store 支撑的仪表盘退场，普通仪表盘照常工作。
- **设置代际**：插件按结构探测两代，经典 `SettingsProvider`（任意 `register` 且参数个数 ≥ 2，包括第一代 `register/describe/update` 形态）或 0.1.7+ 的 `SettingsForms` 版本。经典宿主写入独立命名空间；0.1.7+ 宿主寻址插件条目并带版本守卫（过期写入返回 HTTP 409）。
- **投影缓存代际**：自 0.1.7 起插件只注册一种投影形态，并自己走消费者阶梯：重建时用 `coldSnapshot(meta, inheritedEventCount, events)`，会话从未播种时走零 I/O 的 `cachedSnapshot` 行。形态不匹配会触发启动断言失败，并让 `/pulse/stats` 返回 503，不会静默返回空仪表盘。`inheritedEventCount` 之前的事件是分叉会话从父会话拷来的继承前缀，折叠一律跳过，用量归父会话（`session/title` 例外，只作显示名）；会话详情与 TUI 同一口径。
- **数据卡存储**：导入/拉取的覆盖卡存进宿主的 `storageDomain`；读取失败或卡无效时启动日志留一行并回落内置卡，`/pulse/stats` 照常应答；宿主没有存储设施时覆盖只在本次会话内生效。拉取源必须是 http(s)，http 仅接受环回地址。
- **插件管理器与设置席位**：每个 factory 注册与每个宿主席位独立拒绝；宿主拒绝一个未知槽位不会影响其他席位。
- **客户端席位**：扩展按席位注册，带 warn-once 降级；崩溃的第三方仪表盘面板只移除自身。

## 护栏

两条断言把接缝变化变成明确的失败：

- **护栏 B**：启动时的形状断言，`coldSnapshot` 的参数个数须 ≥ 3，`cachedSnapshot` 须为 2；否则插件记录不匹配，`/pulse/stats` 返回 503（界面显示失败状态，不会静默留白）。
- **护栏 C**：针对*真实* `SessionProjectionCache` 原型的测试，宿主测试所用的桩不会悄悄偏离已安装的接缝包。

## 终端面（dsh-tui）

同一个包随 [dsh-tui](https://github.com/ccch1mneyyy/dsh-TUI) 挂载为终端面 `dsh-pulse/tui`，与 Web 面共享折叠、定价与配置数据。dsh-tui 需单独安装；不用 dsh-tui 可跳过本节。

**六个命令**（输入框 `/` 菜单）：

| 命令 | 打开内容 |
| --- | --- |
| `/pulse` | 迷你卡开关（同 alt+p） |
| `/pulse-day` | 今日日视图：面包屑 + 摘要 + 分时 gantt + 会话台账（`s` 切换排序） |
| `/pulse-month` | 本月月历热力 + 周趋势 + 模型分解 |
| `/pulse-year` | 近一年 53 周热力图 |
| `/pulse-cost` | 今日成本视图（场景内 `t` 在 cost/token 间切换） |
| `/pulse-sessions` | 会话切换（打字过滤 + 两步确认） |

**迷你卡**：输入框上方一张最多 3 行的卡片（pointer-only，不占键盘）。今日行拆成 ● 当前会话 / ○ 其余（今日切片，绝非终身累计），本月行带对数刻度的 sparkline，未计价份额变成一行 ⚠；点卡片体进入全量视图，`×` 收起。**Esc** 在完整场景里逐级返回（日 → 月 → 年），顶层 Esc 回聊天；`?` 帮助、`e` 导出 CSV、`r` 强制刷新。

**降级**：宿主接缝缺席时逐级降级。命令注册被拒时，`/pulse` 经 C-070 `commands.register` 回退直接打开完整日视图；场景服务缺席时面板显示一行红色失败提示并静默退出。启动日志出现一行 `falling back to direct commands.register (C-070, unattributed)` 属预期行为，并非故障。宿主 0.2.0 起不再暴露会话活跃时间戳：被另一个进程追加的持久会话不会自动重新折叠，在场景里按 `r` 手动刷新。

**诊断**：宿主命令 `/plugins check <dsh-pulse path>` 可以静态校验这个包（应报 `compatible`）；环境变量 `PULSE_TUI_DEBUG=1` 会让插件在加载时向 stderr 输出一行诊断（接缝可见性）。

## 历史代际备注

**v0.6.0+ 仅支持 dsh ≥ 0.2.0-rc.2（Node ≥ 22.19）；0.1.x 系列已退役。** v0.4.4 及更早在 0.1.5-rc.3 上以经典注册验证过；v0.4.5 的代际启发式曾误路由 0.1.5–0.1.6 经典线，v0.6.0 起改为结构探测。要点：

- **投影与缓存**：自 0.1.2-rc 起由插件自行走消费者阶梯，未播种会话走零 I/O 的 `cachedSnapshot` 行（0.1.7 前按显式截断、之后按 header 身份），否则 `readSession` + 同步 `coldSnapshot`；更旧的宿主用缓存自带的异步 `coldSnapshot(id)`（按参数个数识别）。
- **设置**：按结构探测两代。经典 `SettingsProvider`（`register` 参数 ≥ 2）写独立命名空间；0.1.7+ 寻址条目 id 并带版本守卫（过期写入 409）。宿主设置页直接消费 schemastery `Config`，字段级校验归宿主；插件自己的浮层设置页手工校验草稿，是有意的取舍。
- **客户端**：0.1.7 图标改名已桥接；仪表盘 factory 仅在 `slots.registerFactory` 存在处注册；store 引擎缺席时实时同步退场，普通仪表盘照常。
- 旧包根 `dsh-plugin.json` 已在 v0.6.1 移除：它从未被受支持的挂载路径消费，C-070 回退即预期路径。
