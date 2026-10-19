# 开发指南

**简体中文** · [English](./en/DEVELOPMENT.md)

dsh-pulse 是带 JSDoc 类型的纯 ES 模块——宿主半边没有构建步骤，浏览器 bundle 只走一次 esbuild。本页覆盖本地开发循环、测试地图、仓库布局、其他插件可以挂靠的扩展点，以及发布清单。

- [本地开发循环](#本地开发循环)
- [测试地图](#测试地图)
- [仓库布局](#仓库布局)
- [类型](#类型)
- [代码约定](#代码约定)
- [扩展点（面向插件作者）](#扩展点面向插件作者)
- [配套包](#配套包)
- [发布清单](#发布清单)

## 本地开发循环

Node ≥ 22.19。

```bash
npm ci              # lockfile is tracked; reproduces the audited tree
npm test            # build + all ten suites
npm run typecheck   # the same checkJs pass CI gates on (noEmit)
npm run build       # rebuild lib/client.js from src/client/ (esbuild)
npm run build:types # regenerate types/ from JSDoc (tsc declaration-only)
```

`npm test` 先跑 `npm run build`，所以只要测试是绿的，已提交的 `lib/client.js` 就绝不会落后于 `src/client/`。bundle 之所以提交，是因为这个包在安装时不带构建步骤——客户端半有改动时就重新构建并提交它。

## 测试地图

| 套件 | 守护内容 |
| --- | --- |
| `test/host-test.mjs` | 宿主注册、设置代际、投影接缝桩 + 护栏 B、HTTP 路由、检查更新 |
| `test/aggregate-test.mjs` | 会话折叠与其 state schema、逐日工具直方图、窗口切片 |
| `test/view-test.mjs` | 派生视图：分桶、模型/项目分解、定价、对账、额度估算、异常 fixture |
| `test/quota-adapters-test.mjs` | 额度 SPI 及 zai、kimi、minimax 的录制 fixture/replay 用例 |
| `packages/dsh-pulse-usage-query/test/shape-test.mjs` | `usage_query` 响应白名单与字符串长度边界 |
| `test/client-smoke-test.mjs` | 在 react 桩下真实执行仪表盘的派生模型钩子——能抓住打包器抓不到的、名字落在另一个函数作用域的事故 |
| `test/tui-test.mjs` | 终端场景渲染与交互，外加一个读取 `cordis.patch.yml` 的回归（`pulse-tui` 行必须注入 `commands`） |
| `test/golden-test.mjs` | TUI/web 一致性锁：同一份 fixture 折叠走两条渲染路径（`viewSlice` 与 `buildView`），必须产出相同的 token 与金额，唯一刻意保留的 GA 缺口差异会被显式断言 |
| `test/style-test.mjs` | CSS/JSX 类名锁（双向：声明了类但无标记、渲染了 token 但无规则）加 locale/文案纪律，包括 `anomaly.*` 键上禁用的建议性词汇 |
| `test/manifest-test.mjs` | 版本戳与 `package.json` 一致、`/` 菜单只有一行、无宿主 patch、席位台账、locale/图标契约、接缝包必须是 peer、发布文件清单里没有测试 |

CI（`.github/workflows/test.yml`）在 ubuntu-latest 与 windows-latest 上运行 `npm ci`、`npm run typecheck` 与 `npm test`。

## 仓库布局

```
src/index.js          host plugin: projection unit, HTTP routes, settings, startup seam log
src/aggregate.js      the fold: session logs → per-session records → pulseUsage state
src/view/             pure derived data: build-view, pricing engine, reconciliation, quota estimates, anomaly
src/client/           web UI source (compiled into lib/client.js)
src/tui/              terminal face: scene, data, draw, strip
src/host/             config schema (schemastery) and pricing config
src/pricing/          versioned rate card + the no-UI pricing service
src/quota-adapters/   subscription-quota SPI and the zai / kimi / minimax adapters
lib/client.js         built client bundle (committed; rebuilt by npm run build)
types/                generated declarations (npm run build:types)
locale/               display metadata for the plugin manager (meta.title / meta.description)
test/                 suites and fixtures
packages/             the optional usage_query companion package
```

## 类型

源码是带 JSDoc 注释的 JavaScript；`tsc` 用 `checkJs` 读取它们，把声明输出到 `types/`（客户端目录被排除——它单独打包）。`types-shims/` 补齐少数不在依赖树上的 Node/peer 模块类型。noEmit 的 `typecheck` 脚本就是 CI 门槛；清掉类型错误要靠收窄 JSDoc 或加局部类型转换，绝不要放宽整个文件。

## 代码约定

- JSDoc（对外契约、`@param` / `@returns`）一律英文；段落级设计注记可用中文。
- 描述旧机制的注释随机制一起删，绝不与新代码叠放。
- 客户端文案跟随宿主语言；`anomaly.*` 字符串严格保持观测性（数字与标识，不给建议），由 `style-test` 强制。
- 宿主接缝是 peer，不是依赖。新增 `@deepseek-ai/*` 依赖要么是白名单内的纯库，要么进 `peerDependencies`——否则 `manifest-test` 会让构建失败。
- 不新增出站请求种类：余额、额度与手动检查更新就是完整清单。
- 默认挂载的包不放模型可见的工具。此类能力以独立的 opt-in 包发布。

## 扩展点（面向插件作者）

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

条目会收到 factory locale 提供的 `t`、**store seat**——`useStore((s) => s)` 选择 `{data, view, busy}`，并在区间切换与重折时保持实时，写回用 `actions.sync(data, view, busy)`——外加渲染点 props `{data, view, busy}` 作为同帧快照。面板逐个受监督：某个面板崩溃只会上报并移除自身，不会拖垮仪表盘。任何插件也可以用 `renderFactorySlot("pulse.dashboard", { … })` 把整个仪表盘挂到别处（接受可选的 `floatActions` / `headerExtra` / `onConfigure` props，支持 `fallback`）。在没有 Factory API 的宿主上，插件全部直渲染，扩展点自动休眠。

除仪表盘外，插件还向宿主自身的席位贡献内容（缺席时降级并在日志告警一次）：**`plugins.row.config`**——完整定价编辑器渲染在插件管理器的 bundle 详情页；**`plugins.detail.badge` / `plugins.detail.section`**——详情页的标签与介绍卡片；**`settings.general.item`**——侧栏余额指示器作为「通用」(General) 设置页的原生开关（需要 store 引擎，旧宿主上隐藏）。

## 配套包

`packages/dsh-pulse-usage-query` 是一个 opt-in 包，在同一批聚合之上增加一个只读、模型可见的工具（`usage_query`）。**它默认不挂载，主包也从不挂载它**——用户必须自己把它的行插进 profile patch。具体的行、响应形状与 shape-test 的保证（不含对话内容、字符串有界）见[它的 README](https://github.com/Enc-hanted/dsh-pulse/blob/main/packages/dsh-pulse-usage-query/README.md)。

## 发布清单

1. 同时更新 `package.json` 的 `version` 与 `src/client/css.js` 的 `DP_BUILD`——两者漂移时 `manifest-test` 会失败。
2. 写 `CHANGELOG.md` 条目（Added / Changed / Fixed / Engineering，外加升级说明）。
3. `npm ci && npm run typecheck && npm test`——这也会重建 `lib/client.js`；与版本号一起提交。
4. `npm pack --dry-run` 并检查文件清单：没有 `test/`、没有 `scripts/`；`docs/`、`locale/`、`assets/icon.svg`、`assets/shots/`、`CHANGELOG.md` 与 `cordis.patch.yml` 都在。
5. 提交，打标签 `v<version>`，推送提交与标签。
6. 若是 registry 发布，执行 `npm publish`。
7. 重装到你使用的 profile——registry 安装用 `dsh plugin --profile web add -w dsh-pulse@latest`，或重新执行 link/tarball 的 `add`——然后重启宿主。终端面则把同一版本装进 dsh-tui profile 并同样重启。
8. 在两个宿主里验证：Web 面板能打开并显示数据；`/pulse` 有响应；插件管理器显示本地化标题/描述与蓝色图标。

作者自用的工具（canvas 演示、截图矩阵、流程文档）放在 gitignore 的路径里——见 `.gitignore`；直接用 `node` 运行它们，不必为此新增 npm 脚本。
