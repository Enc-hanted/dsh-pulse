# 中国厂商大模型订阅计划额度查询 API 调研报告

> 调研目的：评估在本地运行的 Node.js 插件中主动查询各厂商 Coding Plan / Token Plan / API 余额并展示的可行性。
> 调研方式：web_search + web_fetch，交叉验证社区逆向工具（CodexBar、OpenTokenUsage、cc-switch、quota-bar、pi-glm-quota、glm-for-copilot、kimi-code-usage、check-balance、ark-cli）与官方文档。

## 总体结论

- **可直接查（API Key 即可，普通 HTTP GET）**：智谱 GLM（订阅套餐 + 余额 + token 资源包三套端点全齐）、Kimi for Coding、MiniMax Coding Plan、SiliconFlow、DeepSeek、阶跃 StepFun、Moonshot 开放平台余额。
- **可查但认证重（云厂商 OpenAPI 签名）**：火山方舟 Coding Plan / Agent Plan（官方 OpenTOP API，需 AK/SK 签名；官方 ark-cli 已封装）。
- **仅控制台**：阿里云百炼 Coding Plan（2026 年新品，控制台"订阅套餐"页可见 5h/周/月用量，无公开 API）、token 用量统计类需求百炼走账单导出。
- **未公开**：百度千帆、LongCat、iFlow（iFlow 本身是免费 CLI，无订阅体系）。

---

## 1. 智谱 z.ai / bigmodel.cn — GLM Coding Plan ✅ 最完整

**套餐形态**：月付 Coding Plan（Lite/Pro/Max，5h 滚动窗口 + 周窗口 + 月度 web 搜索次数）；另有按量付费 Standard API（现金余额 + token 资源包）。

**推理端点**（订阅走 coding 专用端点）：
- 国际：`https://api.z.ai/api/coding/paas/v4`
- 国内：`https://open.bigmodel.cn/api/coding/paas/v4`
- Standard API：`https://api.z.ai/api/paas/v4` / `https://open.bigmodel.cn/api/paas/v4`

**⚠️ 认证差异（关键坑）**：国际站 monitor 端点用 `Authorization: Bearer <key>`；**国内 open.bigmodel.cn 的 monitor 端点用裸 key（无 Bearer 前缀）**。glm-for-copilot 按 URL 是否含 `bigmodel.cn` 切换。2026-07-30 积分制改版后国内站还必须带上下文参数（见下）。

**① 套餐用量**：`GET {host}/api/monitor/usage/quota/limit`
- 头：`Authorization`（见上）、`Accept: application/json`
- 国内个人版需 `?type=1`，团队版 `?type=2`，并带头 `bigmodel-organization: org-xxx`、`bigmodel-project: proj_xxx`；缺 type 报"当前用户不存在 coding plan"，缺 org/project 头返回空 `data:{}`（pi-glm-quota 实测记录）
- 响应：
```json
{ "code": 200, "data": { "limits": [
  { "type": "TOKENS_LIMIT", "unit": 3, "number": 5, "usage": 800000000, "currentValue": 127694464,
    "remaining": 672305536, "percentage": 15, "nextResetTime": 1770648402389 },
  { "type": "TIME_LIMIT", "unit": 5, "number": 1, "usage": 4000, "currentValue": 1828, "remaining": 2172,
    "percentage": 45, "usageDetails": [ { "modelCode": "search-prime", "usage": 1433 } ] }
] } }
```
- 字段语义：`unit:3`=5 小时滚动窗，`unit:6`=7 天窗，`unit:5 number:1`=月度；TOKENS_LIMIT/CREDIT_LIMIT（改版后积分制）是套餐窗口，TIME_LIMIT 是 web 搜索等工具次数；`percentage` 为已用百分比，`nextResetTime` 为 epoch 毫秒。

**② 订阅信息**：`GET {host}/api/biz/subscription/list`（Bearer）
- 返回 `data[].productName`（如 "GLM Coding Max"）、`status: "VALID"`、`billingCycle: "monthly"`、`nextRenewTime`、`autoRenew`、价格、支付渠道等。

**③ Standard API 现金余额**：`GET {host}/api/biz/account/query-customer-account-report`
- 返回 `data.balance / availableBalance / rechargeAmount / giveAmount / totalSpendAmount / frozenBalance`。

**④ token 资源包余量**：`GET {host}/api/biz/tokenAccounts/list/my?pageNum=1&pageSize=100`
- 返回 `rows[]: { resourcePackageName, tokenBalance, tokensMagnitude, status: "EFFECTIVE", suitableModel }`。

**团队/模型维度**：`api/monitor/usage/model-usage`（`type=3` 团队小时级模型用量，需 org/project 头）。

**控制台**：`https://z.ai/manage-apikey/coding-plan/personal/my-plan`（国际）、`https://bigmodel.cn/coding-plan/personal/usage`、`https://bigmodel.cn/coding-plan/team/usage-stats`（团队）。`/manage-apikey/billinginfo` 是 API 计费页（网页，无需逆向——上面 ③④ 已覆盖其数据）。

**社区工具佐证**：CodexBar（macOS 菜单栏，官方文档详细描述端点）、OpenTokenUsage（含完整响应样例）、pi-glm-quota（npm，记录改版后 type/org/project 踩坑）、glm-for-copilot（VS Code 插件，consts.ts 硬编码全部路径）、glm-usage-monitor（Rust TUI）、linux.do 多帖、cc-switch 内置模板。

**评级：✅ 可直接查**（四套端点：套餐用量、订阅、余额、资源包，全齐；注意国内站裸 key + type/org/project 参数）。

## 2. 月之暗面 Kimi for Coding ✅

**套餐形态**：月付 Coding Plan（api.kimi.com，Key 格式 `sk-kimi-xxx`，与开放平台 `sk-xxx` 不互通）。

**① 套餐用量（逆向但广泛使用）**：`GET https://api.kimi.com/coding/v1/usages`
- 头：`Authorization: Bearer <sk-kimi-xxx>`
- 响应：
```jsonc
{
  "usage": { "limit": "100", "remaining": "74", "resetTime": "2026-02-11T17:32:50Z" },   // 月度
  "limits": [ { "window": { "duration": 300, "timeUnit": "TIME_UNIT_MINUTE" },
               "detail": { "limit": "100", "remaining": "85", "resetTime": "..." } } ],  // 5h 窗
  "user": { "membership": { "level": "LEVEL_INTERMEDIATE" } }
}
```
- `duration:300 TIME_UNIT_MINUTE` = 5 小时窗；另有周窗；数值为字符串。OAuth 场景（Claude Code 接入）可用 `https://auth.kimi.com/api/oauth/token`（client_id `17e5f671-d194-4dfb-9706-5516cb48c098`）刷新 token；纯 API Key 直接可用。

**② 开放平台余额（官方文档）**：`GET https://api.moonshot.cn/v1/users/me/balance`（国际站 `api.moonshot.ai`）
- 头：`Authorization: Bearer <MOONSHOT_API_KEY>`
- 响应：`{ "code": 0, "data": { "available_balance": 49.59, "voucher_balance": 46.59, "cash_balance": 3.0 }, "scode": "0x0", "status": true }`（单位 USD；可用余额 ≤0 时推理 403）。

**社区工具**：kimi-code-usage（CLI+MCP+VSCode 三形态，完整实测数据）、OpenTokenUsage、cc-switch 内置模板、hermes-agent PR #74424。

**评级：✅ 可直接查**。

## 3. MiniMax Coding Plan ✅（有一个著名字段坑）

**套餐形态**：月付 Coding Plan / Token Plan（M2/M2.5 系列），国内 minimaxi 平台 + 国际 minimax.io 双站。

**① 套餐余量**：`GET https://api.minimaxi.com/v1/token_plan/remains`（CN；国际 `https://www.minimax.io/v1/token_plan/remains`）
- 旧路径变体：`/v1/api/openplatform/coding_plan/remains`（社区早期逆向，ClaudeBar issue 引用 `https://www.minimaxi.com/...`）
- 头：`Authorization: Bearer <MINIMAX_API_KEY>`
- 响应：
```json
{ "base_resp": { "status_code": 0, "status_msg": "success" },
  "model_remains": [ { "model_name": "general",
    "current_interval_total_count": 100, "current_interval_usage_count": 72,
    "current_weekly_total_count": 500, "current_weekly_usage_count": 400,
    "current_interval_remaining_percent": 72.5, "start_time": 174..., "end_time": 174..., "remains_time": 3600000 } ] }
```
- **⚠️ 官方确认的命名坑**：`current_interval_usage_count` / `current_weekly_usage_count` 实际是**剩余量**而非已用量（MiniMax-AI/MiniMax-M2 issue #99 官方仓库确认）。已用 = total − usage_count。若有 `*_remaining_percent` 字段则以百分比为准确值。`end_time` 为重置时间戳，缺失时用 `remains_time`（毫秒）。plan 名称可能出现在 `current_subscribe_title` / `plan_name`，缺失时社区按已知额度档位推断。

**② 开放平台余额 API**：未发现公开端点，控制台查看。

**社区工具**：OpenTokenUsage（含字段映射细节）、ClaudeBar issue #114、pi-show-minimax-quota、cc-switch、check-balance。

**评级：✅ 可直接查**（注意 usage_count 语义反转）。

## 4. 阿里云百炼 ModelStudio / Qwen Coding Plan ⚠️ 仅控制台

**套餐形态**：2026 年推出 Coding Plan（整合 Qwen/GLM/Kimi/MiniMax，兼容主流编程工具）；另有经典按量付费 + 新用户免费额度。

**用量查询**：**无公开编程端点**。bailian OpenAPI（2023-12-29）只有知识库/数据/提示词/记忆类 API，无用量或套餐接口；官方答复是登录控制台"订阅套餐"页查看 5 小时/周/月消耗（developer.aliyun.com/ask/699053），token 统计走"账单明细"导出；国际站文档同样只给控制台路径。DashScope 推理响应内含 per-request `usage`，但没有套餐配额端点。

**评级：❌ 仅控制台**（做插件只能提示用户去控制台，或将来逆向其 console XHR——目前无社区成果）。

## 5. 火山引擎方舟 / 豆包 ✅ 官方 API（认证较重）

**套餐形态**：Coding Plan / Agent Plan（个人版 + 团队版席位制）；另有按量付费与 token 资源包。

**官方 OpenAPI（volcengine/ark-cli 佐证，官方开源 CLI）**：
- Coding Plan 个人：`/open/GetCodingPlanUsage`
- Agent Plan 个人：`/open/GetAFPUsage`
- 团队：`/open/GetSeatAFPUsage`、`/open/GetSeatInfoUsage`（Scene=`agent_plan_enterprise` / 空串）
- 订阅探测：`ListSubscribeTrade`、`GetSeatInfo`
- 走公网 OpenTOP 入口（`open.volcengineapi.com` 风格），认证为火山 IAM **AK/SK 签名或 SSO**，非 API Key 直连。
- 返回：CodingPlan 只有 **Percent**（session/weekly/monthly 三窗口百分比 + reset 时间，无绝对值）；AgentPlan 有 used/total 绝对值（5h/weekly/monthly）。

**传统 token 资源包余量**：未见公开独立 API；费用中心"抵扣明细"控制台查看。免费额度可通过 ark-cli `usage balance --type free-quota` 查。

**Node.js 落地建议**：自行实现 VolcSignatureV4 成本高；更现实的是调用官方 `arkcli usage plan --format json`（需用户本机装 CLI 并登录）。

**评级：✅ 可查但需云签名**（或借道 ark-cli）。

## 6. 聚合/其他平台

**SiliconFlow 硅基流动 ✅ 官方文档**
- `GET https://api.siliconflow.cn/v1/user/info`（国际 `.com`）
- 头：`Authorization: Bearer <key>`
- 响应：`{ "code": 20000, "message": "OK", "status": true, "data": { "balance": "0.88", "chargeBalance": "88.00", "totalBalance": "88.88", "status": "normal", ... } }`（CN 为 CNY、国际为 USD；2026-06-11 起 name/image/email 返回空串，余额字段不受影响——linux.do 的"下线通知"实际是去 PII，不是下线余额）。

**心流 iFlow ❌ 无订阅体系**：iFlow CLI 免费使用（登录送额度）；开放平台（docs.iflow.cn）只有搜索 API 的 Credits 计费说明，无额度查询端点。
**LongCat（美团）❌ 未公开**：免费领 token 模式，无限量查询 API 文档或社区逆向成果。
**DeepSeek ✅**：`GET https://api.deepseek.com/user/balance`（Bearer）→ `{ "is_available": true, "balance_infos": [ { "currency": "CNY", "total_balance": "100.00", "granted_balance": "50.00", "topped_up_balance": "50.00" } ] }`。官方无订阅，纯余额。
**阶跃 StepFun ✅**：`GET https://api.stepfun.com/v1/accounts`（Bearer）→ `balance`（CNY）。
**百度千帆 ❌**：无公开余额/套餐查询 API，控制台。
**百度/百川**：check-balance 工具标注"仅控制台"。

---

## 汇总对比表

| 厂商/平台 | 套餐形态 | 额度查询端点 | 认证 | 关键坑 | 评级 |
|---|---|---|---|---|---|
| 智谱 GLM（z.ai / bigmodel.cn） | 月付 Coding Plan + 按量 API + token 资源包 | `/api/monitor/usage/quota/limit`、`/api/biz/subscription/list`、`/api/biz/account/query-customer-account-report`、`/api/biz/tokenAccounts/list/my` | Bearer（国际）/ **裸 key（国内）** | 国内需 `?type=1/2` + `bigmodel-organization`/`bigmodel-project` 头；unit:3=5h、6=周 | ✅ 可直接查（最全） |
| Kimi for Coding | 月付 Coding Plan | `GET api.kimi.com/coding/v1/usages`；开放平台 `GET api.moonshot.cn/v1/users/me/balance`（官方） | Bearer sk-kimi-xxx / sk-xxx | 两套 Key 不互通；数值为字符串；duration:300=5h | ✅ 可直接查 |
| MiniMax | 月付 Coding/Token Plan | `GET api.minimaxi.com/v1/token_plan/remains`（国际 minimax.io；旧路径 coding_plan/remains） | Bearer | **usage_count 实为剩余量**；已用=total−usage；end_time/remaining_percent 优先 | ✅ 可直接查 |
| 阿里云百炼 Qwen | 月付 Coding Plan + 按量 | 无公开端点；控制台"订阅套餐"页 | — | bailian OpenAPI 无用量接口，账单导出 | ❌ 仅控制台 |
| 火山方舟/豆包 | Coding/Agent Plan（个人+团队席位）+ 资源包 | `/open/GetCodingPlanUsage` 等 OpenTOP OpenAPI | **AK/SK 签名 / SSO** | CodingPlan 仅返回百分比无绝对值；资源包无独立 API | ✅ 可查（签名重，可借 ark-cli） |
| SiliconFlow | 按量余额 | `GET api.siliconflow.cn/v1/user/info`（官方） | Bearer | CN=CNY / .com=USD；字符串金额 | ✅ 可直接查 |
| DeepSeek | 按量余额 | `GET api.deepseek.com/user/balance`（官方） | Bearer | 无订阅套餐 | ✅ 可直接查 |
| StepFun | 按量余额 | `GET api.stepfun.com/v1/accounts` | Bearer | — | ✅ 可直接查 |
| iFlow 心流 | 免费 CLI（无订阅） | 无 | — | 开放平台仅搜索 Credits | ❌ 不适用 |
| LongCat | 免费 token 领取 | 无 | — | — | ❌ 未公开 |
| 百度千帆 | 按量 | 无 | — | — | ❌ 仅控制台 |

## 对 Node.js 插件的落地建议

1. **第一批接入**（纯 `fetch` + Bearer/裸 key，1~2 小时工作量）：GLM（国内+国际双站）、Kimi、MiniMax、SiliconFlow、DeepSeek、StepFun。所有端点均为简单 GET，响应 JSON 结构上文齐全。
2. **GLM 双站适配**：按 baseURL 是否含 `bigmodel.cn` 决定 Authorization 是否带 Bearer；国内站额外要求 type/org/project 三个上下文（可让用户从 `bigmodel.cn/coding-plan/` 页 DevTools 复制，或在插件里做配置向导）；建议同时拉 `subscription/list` 合并套餐名。
3. **MiniMax**：直接展示 `remaining` 语义（不要把 usage_count 当已用）；优先用 `*_remaining_percent`。
4. **Kimi**：存 sk-kimi-xxx 即可；若做 Claude Code OAuth 场景需实现 auth.kimi.com refresh_token 轮换。
5. **火山**：视需求决定——轻量方案调 `arkcli usage plan`（外部依赖）；重量方案实现 VolcSignatureV4。
6. **阿里云**：暂无法编程查询，UI 上放控制台深链即可。
7. **通用容错**：这些都是未承诺 SLA 的内部/逆向端点（Kimi usages、MiniMax remains、GLM monitor 均未写入公开 API 文档），务必做超时（10s）、降级显示"未知"与最后成功时间缓存，勿把失败渲染成 0%。

## 主要来源

- CodexBar z.ai 文档：https://github.com/steipete/CodexBar/blob/main/docs/zai.md
- OpenTokenUsage（zai/kimi/minimax 三份 provider 文档）：https://github.com/PowerUserZ/OpenTokenUsage
- pi-glm-quota（改版踩坑记录）：https://github.com/focksor/pi-glm-quota
- glm-for-copilot consts.ts / usage.ts（全部路径常量）：https://github.com/KiwiGaze/glm-for-copilot
- Kimi 官方余额文档：https://platform.kimi.ai/docs/api/balance
- kimi-code-usage：https://github.com/Golden0Voyager/kimi-code-usage
- MiniMax 官方 issue #99（usage_count 语义）：https://github.com/MiniMax-AI/MiniMax-M2/issues/99
- ClaudeBar issue #114（MiniMax 端点）：https://github.com/tddworks/ClaudeBar/issues/114
- quota-bar 平台 API 参考：https://github.com/nmsn/quota-bar/blob/main/docs/platform-api-reference.md
- cc-switch 用量查询手册：https://github.com/farion1231/cc-switch
- ark-cli 官方用量技能：https://github.com/volcengine/ark-cli（skills/arkcli-usage）
- 阿里云 Coding Plan 控制台查看问答：https://developer.aliyun.com/ask/699053 ；帮助文档 https://help.aliyun.com/zh/model-studio/coding-plan ；用量统计 https://www.alibabacloud.com/help/en/model-studio/model-usage-statistics
- SiliconFlow 官方 user/info：https://docs.siliconflow.com/cn/api-reference/userinfo/get-user-info
- check-balance 多平台余额工具：https://github.com/hanmumuHL/check_balance
- linux.do GLM 用量讨论：https://linux.do/t/topic/1049783
- glm-usage-monitor：https://github.com/KotDath/glm-usage-monitor
- iFlow Credits：http://docs.iflow.cn/en/docs/credits/
