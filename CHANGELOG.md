# Changelog

发布以 GitHub tag 为准。本文件收录自 README 迁出的**宿主兼容性历史备注**，供仍运行旧版 dsh 的使用者备查；当前支持矩阵见 README 的「兼容性」一节。

## 宿主兼容性备注（0.1.x 世代）

**v0.6.0 起插件只支持 dsh ≥ 0.2.0-rc.2（Node ≥ 22.19），0.1.x 线废弃不再适配。** v0.4.4 及更早在 **0.1.5-rc.3** 真机验证过（当时走纯经典注册）；v0.4.5 引入的世代判别式曾把 0.1.5–0.1.6 经典线误路由（那些 provider 同样自带 describe/update），v0.6.0 已改为结构探测修复——0.1.5-rc.3 / 0.1.6-alpha.2 / 0.1.7-alpha.2 / 0.2.0-rc.2 各代 provider 形态已对照 registry 实包逐一核对。各接缝在运行时探测：

- **投影注册**：0.1.2-rc 宿主读取 `stateSchema` + `wire`，旧宿主（0.1.0-rc.x）读取旧版顶层 `schema`/`view`。
- **持久化缓存**：在 0.1.2-rc 及以后插件自己走消费者读取阶梯（未播种会话用零 I/O 的 `cachedSnapshot` 行——0.1.7 之前带显式 cut、之后仅凭 header 身份——否则 `sessionQuery.readSession` + 同步 `coldSnapshot(meta, inheritedEventCount, events)`），旧宿主（0.1.2-rc 之前）仍用缓存自读取的异步 `coldSnapshot(id)`（按形参个数识别）。
- **设置**：世代判别式按结构探测（存在 arity ≥ 2 的 `register` 即经典 `SettingsProvider`——含 rc.7 这类 register/describe/update 三全的形态——否则走 `SettingsForms`）。经典宿主注册独立命名空间；0.1.7+ 宿主按条目 id 寻址写入条目配置并带版本号守卫（过期写入返回 HTTP 409；条目被改名时 GET 如实报不可写）。展示类字段声明为 volatile，修改它们不会重启插件；settings 服务中途卸载时，两条缝的复位清单一致（GET 报不可写、POST 503）。
- **设置页校验取舍**：宿主设置页直接消费本插件的 schemastery `Config`，字段级校验与持久化是宿主的；插件自带的浮动设置页草稿校验是手写的（数字类型、跨行模型唯一性），未下发 `schema.toJSON()` 信封、未接 `dsh-client-schema-form` 的 `validateDraft`。这是有意取舍：草稿级校验拦不住跨行唯一性与 fx 下界这类语义，接入会用 schemastery 的英文报错替换现有本地化文案，还要为老宿主模块表多背一个软降级 external——当前表单规模不值得这个成本。
- **客户端**：0.1.7 的图标改名（`IconXOutline16` → `IconXOutlineMedium`）已做桥接；仪表盘工厂只在 `slots.registerFactory` 存在的宿主上注册。旧版宿主（不含分时明细）仍可正常显示，费用按谷价估算。
- **仅 0.1.7 的席位**：store 引擎（`dsh-client-store`）通过特性检测 + try/catch 引入——缺失时 store 席位、通用设置开关和侧栏实时同步退场，普通仪表盘照常工作。插件管理器席位（`plugins.row.config`、`plugins.detail.badge`、`plugins.detail.section`）与每个工厂注册各自独立拒绝，宿主拒绝任何一个未知槽位都不会拖垮其余注册。
