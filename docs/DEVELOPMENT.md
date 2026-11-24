# 开发指南

**简体中文** · [English](./en/DEVELOPMENT.md)

dsh-pulse 是带 JSDoc 类型的纯 ES 模块：宿主侧无构建步骤，浏览器 bundle 由一次 esbuild 产出。

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
npm ci              # lockfile 已提交，复现审计过的依赖树
npm test            # 先 build，再串跑 11 个套件
npm run typecheck   # CI 门槛的 checkJs（noEmit）
npm run build       # esbuild 重建 lib/client.js（入口 src/client/main.js）
npm run build:types # tsc 从 JSDoc 生成 types/（仅声明）
```

`npm test` 先跑 `npm run build`，所以测试绿时已提交的 `lib/client.js` 不会落后于 `src/client/`。bundle 必须提交：包在安装时不带构建步骤，客户端侧有改动就重建并提交。

## 测试地图

| 套件 | 守护内容 |
| --- | --- |
| `test/host-test.mjs` | 宿主注册、设置代际、投影接缝桩 + 护栏 B、HTTP 路由、检查更新 |
| `test/aggregate-test.mjs` | 会话折叠与 state schema、逐日工具直方图、窗口切片 |
| `test/view-test.mjs` | 派生视图：分桶、模型/项目分解、定价、对账、额度估算、异常 fixture |
| `test/card-test.mjs` | 数据卡契约：seed 校验、变更预览逐叶 diff、运行时应用重定价与事实重发布、恢复内置 |
| `test/quota-adapters-test.mjs` | 额度 SPI 与卡片声明式 spec 的录制 fixture/replay（`test/fixtures/quota/`） |
| `packages/dsh-pulse-usage-query/test/shape-test.mjs` | `usage_query` 响应白名单与字符串长度边界 |
| `test/client-smoke-test.mjs` | react 桩下真实执行仪表盘派生模型钩子，抓打包器漏掉的作用域事故 |
| `test/tui-test.mjs` | 终端场景渲染与交互；`cordis.patch.yml` 的 `pulse-tui` 行必须注入 `commands` |
| `test/golden-test.mjs` | TUI/web 一致性：同一 fixture 走 `viewSlice` 与 `buildView` 须产出相同 token 与金额 |
| `test/style-test.mjs` | CSS/JSX 类名双向锁 + locale/文案纪律（`anomaly.*` 禁建议性词汇） |
| `test/manifest-test.mjs` | 版本戳一致、`/` 菜单单行、无宿主 patch、席位台账、locale/图标契约、接缝必须 peer、发布清单无测试 |

CI（`.github/workflows/test.yml`）在 ubuntu-latest 与 windows-latest（Node 22.19）上跑 `npm ci → npm run typecheck → npm test`。

## 仓库布局

```
src/index.js          宿主插件：投影单元、HTTP 路由、设置、启动接缝日志
src/aggregate.js      折叠：会话日志 → 逐会话记录 → pulseUsage state
src/view/             纯派生数据：build-view、定价引擎、对账、额度估算、异常
src/pricing/          费率卡 ratecard.json + 校验 card-schema.js + diff/拉取 card.js + 服务 index.js
src/pricing-facts.js  卡事实的运行时 derive（价目、峰谷、节假日、按次费）
src/quota-adapters/   额度 SPI：spec-engine.js 解析卡内声明式供应商 spec，types.js 契约
src/balance-service.js  官方余额出站查询
src/quota-service.js    订阅额度出站查询
src/http-helpers.js   共享守卫：同源、拒重定向、环回 http
src/client/           web UI 源码（esbuild → lib/client.js）
src/tui/              终端面：scene、data、draw、strip
src/host/             schemastery 配置 schema 与定价配置
lib/client.js         已提交的客户端 bundle（npm run build 重建）
types/                生成的声明（npm run build:types）
types-shims/          少数 Node/peer 模块的类型补齐
locale/               zh/en 文案字典（en.json / zh.json）
test/                 套件与 fixture
packages/             可选 usage_query 配套包
scripts/              build-client.mjs、record-quota-fixture.mjs
```

数据卡的字段语义与约束见 [RATECARD](./RATECARD.md)。

## 类型

源码是带 JSDoc 的 JavaScript；`tsc` 以 `checkJs` 读取，仅输出声明到 `types/`（`src/client/` 排除，单独打包）。`types-shims/` 补齐不在依赖树上的 Node/peer 模块类型。`typecheck`（noEmit）是 CI 门槛；清除类型错误应通过收窄 JSDoc 或局部 cast，不要放宽整个文件。

## 代码约定

- JSDoc（对外契约、`@param`/`@returns`）一律英文；段落级设计注记可用中文。
- 描述旧机制的注释随机制一起删，不与新代码叠放。
- 客户端文案跟随宿主语言；`anomaly.*` 严格观测性（数字与标识，不给建议），由 `style-test` 强制。
- 宿主接缝是 peer，不是依赖（原因见[兼容性](./COMPATIBILITY.md)）。新增 `@deepseek-ai/*` 要么是白名单纯库，要么进 `peerDependencies`，否则 `manifest-test` 失败。
- 不新增出站请求种类：余额、额度、手动检查更新、手动数据卡拉取即完整清单。
- 默认挂载的包不放模型可见工具；此类能力以独立 opt-in 包发布。

## 扩展点（面向插件作者）

0.1.7+ 宿主上，仪表盘是一个 **Component Factory**：`pulse.dashboard`（scope `root`，locale `dsh-pulse`，带 **store seat**），声明三个 `list` 子槽位：

| 槽位 | 渲染位置 |
| --- | --- |
| `pulse.dashboard.chip` | 内置 chip 之后的 KPI 卡片 |
| `pulse.dashboard.filter` | 工具栏项目/模型选择器之后的控件 |
| `pulse.dashboard.panel` | 内置面板之后（仅数据加载完成且非空的视图） |

注入：

```js
ctx.slots.inject("pulse.dashboard.panel", () => ctx.slots.register({
  name: "pulse.dashboard.panel", id: "my-panel",
}, MyPanel));
```

条目获得 factory locale 的 `t` 与 **store seat**：`useStore((s) => s)` 选 `{data, view, busy}`，区间切换与重新折叠时保持实时，写回用 `actions.sync(data, view, busy)`；渲染点另给 `{data, view, busy}` 同帧快照。面板逐个受监督：崩溃的面板只上报并移除自身，不拖垮仪表盘。

任何插件可用 `renderFactorySlot("pulse.dashboard", { … })` 把整个仪表盘挂到别处，接受可选 `floatActions` / `headerExtra` / `onConfigure` / `focusSession` props，支持 `fallback`。无 Factory API 的宿主上插件全部直渲染，扩展点休眠。

插件还向宿主自身席位贡献内容（缺席时降级并 warn-once）：`plugins.row.config`（bundle 详情页的完整定价编辑器）、`plugins.detail.badge` / `plugins.detail.section`（详情页标签与介绍卡）、`settings.general.item`（侧栏余额指示器作为「通用」设置页原生开关，需 store 引擎，旧宿主隐藏）。

## 配套包

`packages/dsh-pulse-usage-query` 是 opt-in 包，在同一批聚合上加一个只读、模型可见的 `usage_query` 工具。**默认不挂载，主包也从不挂载它**：用户须自行把它的行插进 profile patch。具体行、响应形状与 shape-test 保证（不含对话内容、字符串有界）见[它的 README](https://github.com/Enc-hanted/dsh-pulse/blob/main/packages/dsh-pulse-usage-query/README.md)。

## 发布清单

1. 同时递增 `package.json` 的 `version` 与 `src/client/css.js` 的 `DP_BUILD`，两者漂移时 `manifest-test` 失败。
2. 写 `CHANGELOG.md` 条目（Added / Changed / Fixed，工程类改动归入 Changed，外加升级说明）。
3. `npm ci && npm run typecheck && npm test`，同时重建 `lib/client.js`；与版本号一起提交。
4. `npm pack --dry-run` 核对文件清单：无 `test/`、无 `scripts/`；`docs/`、`locale/`、`assets/icon.svg`、`assets/shots/`、`CHANGELOG.md`、`cordis.patch.yml` 都在。
5. 提交，打标签 `v<version>`，推送提交与标签。
6. registry 发布则 `npm publish`。
7. 重装到所用 profile（registry 用 `dsh plugin --profile web add -w dsh-pulse@latest`，或重跑 link/tarball 的 `add`），重启宿主；终端面把同版本装进 dsh-tui profile 并重启。
8. 两个宿主里验证：Web 面板打开有数据；`/pulse` 有响应；插件管理器显示本地化标题/描述与蓝色图标。