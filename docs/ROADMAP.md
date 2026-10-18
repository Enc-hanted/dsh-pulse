# dsh-pulse 官方收编实施路线（细则版）

基线：v0.6.0 @ 2026-10-19，`npm test` 本机全绿（8 个测试文件 / 31 TUI / 18 style / 4 golden 套件）。
范围：会话中最终保留的 8 项（#1–#5、#8–#10）；#6/#7 及全部创意方向已否决，不再出现。

## 0. 阅读约定：确定性分级

| 标记 | 含义 |
|---|---|
| ✅ 已验证 | 对照本机运行时 `@deepseek-ai` v0.2.1-alpha.5 快照或本仓库代码逐行核实，附文件:行号 |
| 🔶 实现时复核 | 机制清楚，但细节可能随官方版本漂移，动手前重读一次对应文件 |
| ❓ 外部依赖 | 需要官方仓库/维护者配合，时间表不可控；只做准备动作，不排期 |

工作量按「一个熟悉本仓库的人全天投入」计。

## 1. 总览

| 阶段 | 项 | 一句话 | 确定性 | 工作量 | 前置 |
|---|---|---|---|---|---|
| D0 | 版本地板决策 | 三块版本面对齐 + 修复运行时解析接管 | ✅ 机制已逐行核实 | 0.5d | — |
| P0 | #1 展示元数据 | locale/en·zh.json + icon 导出 | ✅ 契约逐行核实 | 0.5d | D0 |
| P0 | #3 依赖与发布卫生 | peer 化 + lockfile + CI 矩阵 + pack 瘦身 | ✅ 本仓库事实 | 1d | D0 |
| P1 | #2b 形态对齐（保守案） | .d.ts + README.zh + 废弃 dsh-plugin.json | ✅ / 🔶 | 1d | P0 |
| P1 | #10 额度适配器 SPI | 接口抽取 + 录制回放一致性套件 | ✅ 纯本地 | 2d | — |
| P2 | #4-路A 投影代际收敛 | 抬地板删三代鸭子检测 + 护栏 B/C | ✅ | 1d | D0 抬地板 |
| P2 | #5 定价引擎下沉 | 无 UI 服务包 + 版本化费率卡 | ✅ / 🔶 | 1.5d | P0 |
| P3 | #8 异常消耗检测 | 燃速/循环指纹/goal 花费线，纯函数 | ✅ / 🔶 | 2.5d | P2 |
| P3 | #9 usage_query 工具 | 独立可选包，默认不挂载 | ✅ | 1.5d | P2 |
| 门控 | #2a 三包拆分 / #4-路B 上游合并 | 官方收编邀约后再动 | ❓ | 另计 | 官方意向 |

里程碑：**M1 插件市场可读**（D0+P0）→ **M2 官方形态对齐**（P1）→ **M3 架构收敛**（P2）→ **M4 功能补全**（P3）。总计 ≈ 11 人日（不含门控项）。

## 实施进度

- **2026-10-19：D0 + #1 + #3 落地**（commit `60ac306`，v0.7.0，全测绿于重装后的 0.2.1-alpha.5 树）：
  - D0-甲拍板：地板 `>=0.2.1-alpha.5`；seam 两包迁 peer `>=0.2.1-alpha.5 <0.3` + devDep 钉实包；飞行前核对 0.1.7→0.2.1 差异为纯注释；启动 seam 版本日志进 host apply()。
  - #1：`locale/en.json`/`zh.json` + `./icon` 导出；manifest-test 断言契约（键集、体积、exports 完整性）。
  - #3：lockfile 入库 + CI `npm ci` + windows 矩阵；`files` 瘦身；护栏 A（seam 禁入 dependencies，schemastery 白名单）；本地 6 个 tgz 与 .tmp 清理。
  - 遗留验证（需重启宿主）：① 宿主日志应出现 `dsh-pulse 0.7.0 on seams dsh-credentials 0.2.1-alpha.5 / dsh-storage-domain 0.2.1-alpha.5`——若 seam 显示非 0.2.1-alpha.5 即解析接管未生效；② 插件管理器列表应显示双语标题/描述 + logo 图标；③ CI 双平台绿。
  - 注意：`60ac306` 同时裹入了工作树中此前未提交的用户改动（截图 3 张 + screenshots.json + pricing-facts/view 等）；如需归属清晰可 `git reset --soft HEAD~1` 拆分（未推送）。

---

## D0. 版本地板决策（新增前置，横跨 #3/#4）

**已验证的三块版本面**（2026-10-19 实测，三者互相脱节）：

| 版本面 | 值 | 证据 |
|---|---|---|
| 宿主运行时（用户实际在跑的） | **0.2.1-alpha.5** | npx 缓存 `@deepseek-ai/dsh*` 全家族一致 |
| package.json 声明 | 钉精确版 `0.2.0-rc.2` | [package.json:61-62](../package.json#L61) |
| 插件仓库 dev 树（node_modules + gitignored lockfile） | **0.1.7-alpha.2** | 实目录非链接；lockfile 记录的旧范围 `^0.1.0-rc.6 \|\| ^0.1.7-alpha.0`（09-23 安装，10-05 落盘） |

**成因**：依赖范围从 `^0.1.x` 改钉 `0.2.0-rc.2` 后从未重装——lockfile 被 .gitignore（#3 要治的），脱节无人发现。

**运行时影响（关键新发现，机制已逐行核实）**：profile 以符号链接挂载本插件（linked root），宿主的解析拦截 `routeLinked`（`dsh-app-boot/lib/index.js:1676-1704`）**只接管列在 `peerDependencies` 里的包名**（L1684 `readPeerNames`）；`dsh-credentials`/`dsh-storage-domain` 现在坐在 `dependencies` 里 → 不被接管 → **在你的 0.2.1-alpha.5 宿主里，插件实际加载的是仓库自己那份 0.1.7-alpha.2**（代码路径推定；D0 第 0 步放一行版本探针实测确认）。它能跑纯靠 API 恰好兼容 + [index.js:119-140](../src/index.js#L119-L140) 的三代 arity 鸭子检测兜着。这把 #3 的 peer 化从「卫生项」升级为「解析修复」。

**决策**（推荐甲，与「提交官方」意图一致）：

- **甲：抬地板到 0.2.0 系 + peer 化接管解析。** engines 保持 `>=0.2.0-rc.2`；两依赖改 peer（范围 `>=0.2.0-rc.2 <0.3`）——peer 化本身就是让宿主拦截接管、消灭双版本加载的修复动作（见上）；删 pre-0.1.2-rc 与 0.1.2-rc 两条代码路径（并入 #4-路A）；CHANGELOG 明示弃用旧宿主。测试面：host-test.mjs 现有的三代 stub 用例删两代。
- **乙：社区通用。** 地板放 0.1.7-alpha.2，peer 范围放宽，arity 检测保留。仅当用户明确要保旧宿主时选。

**步骤**：0) 版本探针实测运行时加载版本（apply() 里临时 `createRequire` 读 `@deepseek-ai/dsh-credentials/package.json` 版本打日志，boot profile 看一眼即删）；1) peer 化 + devDependencies 留测试副本；2) 删旧 node_modules 与陈旧 lockfile，重装对齐声明；3) 抬地板删旧路径。

**验收**：`npm install` 后 node_modules 与声明一致；host-test 只剩单代接缝用例。
**回滚**：单独 commit，revert 即回到五代兼容。
**工作量 0.5d。确定性 ✅**（矛盾本身与代码位置均已核实）。

---

## P0-1（#1）展示元数据：locale + icon

**已验证契约**（`@deepseek-ai/dsh-app-boot/lib/index.js`，v0.2.1-alpha.5 快照）：
- 入口 `readPluginMeta(specifier, parentURL)`（L2216），Plugin Manager / 插件清单 / 市场列表均经 `ctx.pluginPackages.metaOf` 调它——**不导入、不激活插件**。
- 文本：解析 `<包名>/locale/en.json`（必须经 package.json exports 暴露为资源，L2220）；其它语言文件与 en.json 同目录、逐个经完整 specifier 解析（`locale/zh.json`）；字段为 `title`、`description` 纯字符串；缺失回退英文，再回退 package.json `name`/`description`。
- 图标（L2085-2109）：二选一——package.json 根 `icon` 字段（相对路径，须留在包目录内），或 exports 暴露 `<包名>/icon` 资源；扩展名限 `.svg/.png/.jpeg/.webp`，原始 ≤256KiB（L2077 `MAX_ICON_BYTES`），读成 base64 data URL。icon 失败保留文本并附诊断，不整体失败。

**实施步骤**：
1. 新增 `locale/en.json`、`locale/zh.json`：`{ "title": "Pulse Usage Observatory", "description": "跨会话 token 用量、缓存命中与费用观测台" }`（英文按 README 首段改写）。
2. [package.json](../package.json) `exports` 增 `"./locale/en.json"`、`"./locale/zh.json"`、`"./icon": "./assets/logo.svg"`；`files` 增 `"locale"`。
3. 确认 `assets/logo.svg` ≤256KiB（现约 KB 级，✅）。
4. 扩展 `test/manifest-test.mjs`：断言三个新 exports 存在、两个 locale JSON 的键集合相等、icon 文件存在且不超限。

**边界修正**（本会话核实）：UI 的 736 键词典（[locale.js](../src/client/locale.js)）的 zh/en 键集相等断言**已存在**于 style-test（"locale: zh/en share one key set"），且它与宿主展示元数据是两回事——宿主只读 title/description。词典是否迁入包根 locale/*.json 属可选项，仅当核实官方 client 插件确实从包根 locale 装载运行时词典后再做（🔶）。

**验收**：宿主 GUI 插件列表显示双语标题/描述 + 图标（手动一次）；manifest-test 绿。
**风险/回滚**：纯增量导出，无行为变化；revert 单 commit。**工作量 0.5d。确定性 ✅**。

## P0-2（#3）依赖与发布卫生

**已验证事实**：
- 依赖钉精确版（[package.json:61-62](../package.json#L61)）；实装 0.1.7-alpha.2（见 D0）。
- `package-lock.json` 存在但被 [.gitignore:2](../.gitignore#L2) 忽略 → CI 只能 `npm install`（[test.yml:17](../.github/workflows/test.yml#L17) 注释自认）。
- `files` 含 `"test"`（[package.json:31](../package.json#L31)）→ 发布包含测试；`scripts/build-client.mjs` 同理可摘。
- 根目录 6 个 tgz / v4-canvas.html / .tmp-* **均已被 .gitignore 覆盖**——是本地磁盘卫生（直接删除即可），非仓库缺陷（修正早前判断）。
- CI：单 ubuntu 单 node 22。

**实施步骤**：
1. D0 决策落地：两依赖迁 `peerDependencies`（带 `peerDependenciesMeta.optional: false`），devDependencies 放一份供本地测试。
2. `.gitignore` 移除 `package-lock.json` 行，提交 lockfile；CI 改 `npm ci`。
3. `files` 摘 `"test"` 与构建脚本，保留 `lib/client.js`（运行时需要）。
4. CI 矩阵：`ubuntu-latest × windows-latest`（本插件 Windows 开发，projectOf(cwd) 等路径逻辑值得矩阵覆盖）；node 22。
5. 本地删 6 个 tgz 与 .tmp-session-log.jsonl。
6. `npm pack --dry-run` 目检产物清单入 manifest-test 断言（不含 test/、含 locale/、icon 路径有效）。
7. **护栏 A（防复发）**：manifest-test 断言 `dependencies` 中 `@deepseek-ai/*` 恒为零（宿主 seam 一律 peer）——本次「钉版与实装脱节 + 影子加载」的复发条件变成 CI 红灯。重装时清掉 `node_modules/.pnpm` 残留，统一 npm 单一管理器（现树混有 pnpm 布局）。

**验收**：CI 绿（两平台）；pack 清单断言绿；版本探针确认运行时加载宿主 0.2.1 副本（D0 步骤 0 的复测）。peer 对 linked-root 的接管机制已逐行核实（`routeLinked` L1684）；唯一保留复核点 🔶：经 plugin-market **安装**（非链接）路径下 installation scope 的解析分支（L1664）。
**风险**：peer 化后本地裸 `npm install` 不再自动装宿主包 → devDependencies 兜底。**工作量 1d。确定性 ✅（本仓库）+ 🔶（peer 安装路径）**。

---

## P1-1（#2b）命名与产物形态：保守对齐案

**已验证事实**：`dsh-plugin.json` 是 T-Auto dsh-std 0.15 社区 schema；官方 `readPluginMeta` 只读 locale JSON + package.json（L2216-2243），**不读它**。官方包惯例（前轮核实）：`README.md` + `README.zh.md` + `README.i18n.yaml`、TS 产物 `lib/index.js` + `lib/types/**/*.d.ts`、`repository.directory`、组合包 `-bundle` 后缀。

**为什么先保守**（可行性论证）：三包拆分（#2a）在无官方 monorepo 落位前是纯本地成本，且收编时 scope/`repository.directory` 必然再改一次。保守案把「官方读得到的所有表面」做完，拆包留给邀约后一次到位。

**实施步骤**：
1. `.d.ts`：`tsc --allowJs --checkJs --emitDeclarationOnly`（JSDoc 密度已很高，[index.js](../src/index.js)/[aggregate.js](../src/aggregate.js) 主导出已注释）；`exports` 增 `"./types"` 或各入口旁挂 `.d.ts`；CI 加 typecheck job。
2. `README.zh.md`（翻译现 49KB README 的头部+配置段即可，细节段链接英文）+ `README.i18n.yaml`。
3. `dsh-plugin.json` 降级：从 `files` 移除、文件头注释标注 legacy（保留在 repo 供 T-Auto 生态用户，不再随包发布）。
4. `repository` 补 `directory` 字段占位（收编时改指官方 monorepo 路径）。

**验收**：`tsc --noEmit` 0 错误；pack 含 .d.ts 与双语 README；host/TUI 两面回归绿。
**风险**：exports 变更影响 Loader 对 `dsh-pulse` / `dsh-pulse/tui` 的解析 → 全量回归 + 金丝雀（本机 profile 装一次）。**工作量 1d。确定性 ✅ 契约 / 🔶 JSDoc→d.ts 类型完整率**。

## P1-2（#10）额度适配器 SPI + conformance 套件

**已验证事实**：适配器内联在 [quota-service.js](../src/quota-service.js)（386 行，z.ai 编码注释 L74-80）；`test/` 下 8 个文件**无一是 quota 测试**——适配器零覆盖。快照域 `pulse_quota` 只存 `{t, provider, window, pct}`（L35-50），隐私姿态良好，保持。

**实施步骤**：
1. 接口定义 `src/quota-adapters/types.js`：`{ id, match(providerId, describeRow), fetchQuota({ resolveCredential, signal }) → { windows: [{ id, pct, resetMs }] } }`；不匹配返回 `undefined`，网络/解析错误 throw（语义与现路由层一致）。
2. 内置适配器逐个迁 `src/quota-adapters/<provider>.js`，quota-service 只留编排。
3. 扩展点：host config 增 `extraQuotaAdapters`（对象数组，zod schema 在 [config-schema.js](../src/host/config-schema.js) 既有体系内加），README 写注册法。
4. conformance：`scripts/record-quota-fixture.mjs` 录制（**脱敏在录制层强制**：剥 Authorization/cookie/账号字段，输出前打印待检清单）；夹具 `test/fixtures/quota/<provider>/<case>.json` 含 `wire`（原始响应）与 `normalized`（期望输出）；回放测试逐夹具深比较。

**验收**：每个内置适配器 ≥2 夹具（正常 + 边界如时间戳三种编码）；CI 绿；录制脚本手动跑一次核对脱敏。
**风险**：供应商端点漂移——这正是本项要治的病，夹具失败即信号。**工作量 2d。确定性 ✅（纯本地重构）**。

---

## P2-1（#4-路A）投影代际收敛

**已验证事实**：arity 鸭子检测在 [index.js:119-140](../src/index.js#L119-L140)（`coldSnapshot.length >= 3` 分 0.1.2-rc 前后；`cachedSnapshot` 2/3 参数分 0.1.7-alpha 前后）；官方 `dsh-token-meter` 的 tokenUsage 投影与 pulseUsage 的 token 折叠重叠（前轮核实），pulse 增量字段 = byDay/modelsByDay/hoursByDay/tiersByDay/turnsByDay/toolCallsByDay/auxByDay（[index.js:227-235](../src/index.js#L227)）。

**实施步骤（路A，本地）**：
1. 依 D0-甲删两条旧路径，`projectionValuesOf` 收敛为单一接缝形态。
2. **护栏 B（有声失败）**：删 arity 检测的同时，apply() 启动时对 `coldSnapshot`/`cachedSnapshot` 做一次显式签名断言——不符则 `logger.error` + `/pulse/stats` 返回 5xx。否则宿主接缝变形会被 [aggregate() 的 per-session try/catch](../src/index.js#L238) 吞成「仪表盘静默变空」，那是误读的静默近亲。
3. **护栏 C（第二信源）**：devDependencies 钉一个真实宿主版本，host-test 增加对真实包跑接缝的用例——手写代际 stub 测不出宿主真形状漂移，宿主升级时 bump devDep 即在此爆红。
4. host-test 删对应代 stub；保留 0.2.0 形态用例。
5. 附带产出（给路B用，0.5d）：`docs/projection-parity.md` 字段对照表——pulseUsage 各字段 vs tokenUsage/contextPressure/contextBreakdown，标注重叠与增量，作为上游提案附件。

**路B（❓ 门控）**：向官方提案合并字段或扩展点。不排期；邀约后以对照表开 Issue。

**验收**：全测绿；代码搜索 `coldSnapshot.length` 零命中；接缝断言在故意错配的 stub 下响亮失败（护栏 B 的反向测试）。**工作量 1d + 对照表 0.5d。确定性 ✅**。

## P2-2（#5）定价引擎下沉

**已验证事实**：引擎已三模块化——[pricing-facts.js](../src/pricing-facts.js)（33 行纯数据：PEAK_HOURS/时区偏移/默认汇率/AUX 计费事实含 `fromMs` 时效门）、[view/pricing-engine.js](../src/view/pricing-engine.js)（291 行）、[host/pricing-config.js](../src/host/pricing-config.js)（145 行）；费率改动不触发 refold 的 invariant 已在生产验证（epoch 机制，[index.js:325-336](../src/index.js#L325)）。

**实施步骤**：
1. 收拢为 `src/pricing/` 无 UI 服务（engine + facts + config 合一），host 经 Cordis 服务导出（命名对照官方服务惯例定，🔶 实现时看一个官方 service 包）；web/TUI/测试三消费方改 import。
2. 版本化费率卡 `src/pricing/ratecard.json`：`{ version, checkedAt, usdToCny, models[], auxCallFee }`——AUX_CALL_FEE 这类时效事实全部入卡；包内嵌默认，用户 config 覆盖（现有 `pricing: []` 规则语义不变）。
3. 更新通道**零新增出站**：复用 `/pulse/update-check` 的 npm registry 探测（8s 超时、手动触发），有新版只报版本号，数据本体随包发布。
4. golden-test 扩展：host 切片与 client 设置页预览对同一费率卡输出一致。

**验收**：定价单测迁移全绿；golden 一致性绿；update-check 行为不变。
**风险**：服务命名与官方惯例冲突 → 收编时改名是一次机械替换。**工作量 1.5d。确定性 ✅ 本地 / 🔶 服务命名**。

---

## P3-1（#8）异常消耗检测

**数据面事实**：payload 已含 byDay/modelsByDay 序列、toolCallsByDay（总数）、auxByDay；quota 快照域有 pct 时序。**缺口**：循环指纹需要工具名维度，fold 目前只记总数（[index.js:234](../src/index.js#L234)）——需 fold 扩展 `toolHistogramByDay`，stateVersion 10→11 触发历史会话安全 refold（同机制已被 pricing epoch 验证）。

**实施步骤**：
1. [aggregate.js](../src/aggregate.js) fold 扩展工具名直方图（新字段可缺省，向后兼容）。
2. `src/view/anomaly.js` 纯函数三件：
   - 燃速突增：日粒度当前窗口 vs 自身历史 P95（输入 byDay，无新存储）；
   - 循环指纹：同工具高频重复 + token 陡增的合取判定（输入直方图 + byDay）；
   - goal 花费线：goal 关联会话（descendant 树）费用合计，纯数字。
3. UI 一块面板（web + TUI 条带），文案全部走观测语气。
4. **说教禁令可执行化**：style-test 增禁词断言（「建议」「应该」「值得吗」「请考虑」在 #8 面板词典中零出现）。

**验收**：合成事件流三夹具（正常/突增/循环）单测；禁词断言绿；stateVersion 迁移后历史会话数字与迁移前一致（refold 幂等测试）。
**风险**：全量 refold 的一次性成本（与 peak-hours 改动同量级，已知可接受）。**工作量 2.5d。确定性 ✅ 算法 / 🔶 fold 迁移**。

## P3-2（#9）usage_query 只读工具（独立可选包）

**设计原则**（按 agent-experience 规范）：最小上下文面、有界输出、参数规则放参数上。

- `name`: `usage_query`
- `description`: 查询 dsh-pulse 用量聚合（token、缓存命中率、估算费用），可按天/模型/项目分组。当用户问「今天/近30天用了多少、花了多少、哪个模型或项目最多」时调用。只返回聚合数字，不含会话内容。
- 参数：`window` enum `today|7d|30d|custom`（默认 7d）；`from`/`to` `YYYY-MM-DD`（window=custom 时必填）；`groupBy` enum `day|model|project`（默认 day）；`top` 1-20（默认 8）。
- 返回：`{ window, totals, groups: [top-N], hint: "完整视图：/pulse" }`——数字与短标识，无自由长文本。

**实施步骤**：
1. 独立包 `dsh-pulse-usage-query`（依赖 dsh-pulse 的聚合出口），host 半注册 tool，直接调 `buildStats` 同一聚合函数（绕过 HTTP，注意不复用 TTL 缓存的并发语义单独评估）。
2. **默认不挂载为硬条件**：README 首段明示「需在 profile patch 手动 insert 此行才生效」，包内不含任何自启用路径。
3. 测试：响应结构白名单断言（聚合字段 + 短字符串标识，无长自由文本）——「永不返回会话内容」从承诺变成结构保证。

**验收**：手动挂载后问宿主「今天花了多少」得到正确聚合；不挂载时工具列表零变化。
**风险**：模型可见面扩大 → 由默认不挂载 + 独立包双重隔离。**工作量 1.5d。确定性 ✅**。

---

## 风险登记册

| # | 风险 | 影响 | 缓解 |
|---|---|---|---|
| R1 | 官方快照版本漂移（本路线契约核自 v0.2.1-alpha.5） | #1/#2 契约失效 | 每阶段开工前重读 `readPluginMeta` 对应行（10 分钟） |
| R2 | peer 化在 plugin-market **安装**（非链接）路径下的解析 | #3 | linked-root 路径已核实（`routeLinked` 只拦 peer 名单）；安装路径实装后 `plugin_manager install_bundle` 实测一次 |
| R3 | exports 变更破坏 Loader 解析 | #2b | host/TUI 全量回归 + 本机 profile 金丝雀 |
| R4 | stateVersion 11 迁移的全量 refold 成本 | #8 | 与既有 peak-hours 改动同机制同量级，已验证可接受 |
| R5 | 本 GUI 受限沙箱跑不了 esbuild（命名管道 EPERM） | 实施期测试 | 测试命令走授权升级或在终端会话外执行；CI 为最终裁判 |
| R6 | 复发：未来新增宿主 seam 依赖误入 `dependencies`，影子加载重演 | 全部 | 护栏 A（manifest-test 断言，CI 红灯） |
| R7 | 宿主接缝形状再变（如 0.3），被 per-session catch 吞成静默空盘 | #4-路A 后的所有版本升级 | 护栏 B（启动显式断言，有声失败）+ 护栏 C（真实包接缝用例） |

## 不变式（每阶段的红灯，违者即停）

1. 零新增出站：`/pulse/update-check` 仍是唯一主动外联，手动触发。
2. 零模型可见面：默认挂载的包不注册任何模型可见工具。
3. 凭证与内容不落盘：credentials 只活在单次出站头；聚合层不存 prompt/completion 文本。
4. 计价解耦：events/tokens/bytes 一等公民，¥ 只是派生视图。
5. 观测语气：#8 面板禁词表进 CI。
