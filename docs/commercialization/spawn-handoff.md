# 实现启动交接

本文件交给负责 spawn subagent 的编排 agent。目标是同时启动 M1-M9 的实现，不引入 Phase、模块启动顺序或“等待上游完成”的门槛。

## 先读

编排 agent、每个模块协调 agent 和每个子 agent 都必须先读：

- 本仓库的 `AGENTS.md`。
- [模块 Agent 协调契约](agent-coordination.md)。
- [共享 Serverless API 约束](serverless-api.md)。
- 自己负责模块的 `index.md`、`web-api.md`、`xmcl-app.md`、`xmcl-page.md`。

此 workspace 主要包含 `x-minecraft-launcher`。`xmcl-web-api` 和 `xmcl-page` 不在当前 workspace 时，子 agent 只能发布对应的 contract、mock 和实现清单，不得假定自己能修改不存在的仓库；协调 agent 必须在回报中标记该阻塞。

## Spawn 拓扑

立即并行启动 9 个模块协调 agent：M1、M2、M3、M4、M5、M6、M7、M8、M9。每个协调 agent 可以立即并行启动三个子 agent：

| 子 agent | 负责内容 |
| --- | --- |
| Web API | 模块拥有的服务端资源、路由、状态机、provider adapter、events、schema、fixture 和服务端测试。 |
| XMCL App | 已发布 API client、桌面端交互、本地临时状态、可访问性和 renderer 测试。 |
| xmcl-page | 官网说明、已发布 API client 和网页登录交互。 |

总数为 9 个 coordinator 加上最多 27 个子 agent。平台并发不足时，优先保持 9 个 coordinator 并发；每个 coordinator 自己串行其三个子 agent，但不得等待其他业务模块。

编排 agent 自己兼任 shared contract owner 和最终集成 owner。它不直接实现业务功能，负责裁决共享 schema、审查跨模块变更、运行集成检查和汇总结果。

## 并行规则

- 子 agent 可以使用 fixture/mock contract 立即开工；不得因为真实上游尚未完成而停工。
- 模块协调 agent 是本模块唯一对外发言人，负责合并三个子 agent 的变更和回报。
- 只有 shared contract owner 可以合并 `xmcl-web-api/contracts/` 下由多个模块消费的 schema 变更。
- 不允许通过直接读写另一个模块数据库、collection 或内部实现绕过 API/event contract。
- 不允许子 agent 修改另一个模块的业务代码。需要共享变更时，提交 schema 提案、fixture 和兼容性说明给 shared contract owner。
- 已发布字段只能添加可选字段；需要语义变更、新必填字段、状态迁移或价格规则变更时，发布新 schema version。

## 模块任务卡

| 模块 | Coordinator 的唯一资源/重点 | 立即发布或消费的 contract |
| --- | --- | --- |
| M1 账户与身份 | XMCL Account、OAuth identity、session、自动 launcher exchange、账户合并。 | 发布 account/session/identity schema；消费者只依赖 `accountId` 和 XMCL session。 |
| M2 免费备份容量 | 固定 1 GiB 备份政策。 | 发布 `BackupStoragePolicy { freeBytes, policyVersion }`；与 M6 共同冻结实际占用量 owner。 |
| M3 PayPal 充值与现金结算 | 现金余额、账本、PayPal order/webhook、价目表、预留和结算。 | 发布 `Money`、`CashRate`、`UsageAuthorization`、canonical usage event、结算结果和 fixture。 |
| M4 Vultr 云服务器控制 | ServerResource、task、lease、Vultr v2 adapter、状态机。 | 消费 M1/M3；发布 server/task/lease schema；只由 M4 写服务器状态。 |
| M5 Minecraft 运行时 | worker token、heartbeat、runtime event、server-time event。 | 消费 M4 lease；将 worker 事件映射为 M3 canonical usage event；只由 M5 产生 `server_time`。 |
| M6 手动世界备份 | BackupResource、Linear/layered Linear 压缩对象、layer 引用、恢复、超额保留计费。 | 消费 M1/M2/M3/M4/M5；只由 M6 写实际对象占用和引用计数。 |
| M7 合规、风控与运营 | 审计、管理员操作、对账、人工处理。 | 发布 `AdminOperation` command/result 事件；M3/M4 分别消费余额和服务器命令。 |
| M8 AI 服务 | provider adapter、AI request/result、AI usage。 | 消费 M1/M3；在调用 provider 前取得授权，完成后发布 canonical usage event。 |
| M9 Modpack 部署与来源校验 | ZIP 校验、来源解析、immutable manifest、preview/apply/rollback。 | 消费 M1/M4/M5；发布 validation report 和 deployment manifest。 |

## 首轮共享 contract 裁决

以下项目不是模块启动门槛，但 shared contract owner 必须在各模块第一次合并真实代码前裁决，并将答案发布为 versioned schema 与 fixture：

1. **M2/M6 存储所有权**：M2 只拥有固定免费容量 policy；M6 是 `usedBytes`、`overageBytes`、object/layer 引用计数和存储计费 cursor 的唯一写入者。不要让 M2 与 M6 各自计算实际占用。
2. **M3 授权请求**：定义 `UsageAuthorizationRequest`，至少绑定 `accountId`、`resource`、`sourceId`、预计数量、unit、结算区间、rateVersion、幂等键和过期时间。
3. **Canonical usage event**：M3 定义唯一的输入事件 schema。M5、M6、M8 要么完整发布该 schema，要么发布自身事件并由 M3 adapter 显式转换；不能混用。
4. **M6 超额保留时钟**：定义结算区间、`lastSettledAt`、删除/引用变更时的结算、以及同一 layer 的物理字节归属。
5. **余额耗尽停止路径**：固定 `M5 usage -> M3 settlement -> M5 stopped event -> M4 close lease`；M4 还必须定义 worker 无响应时的强制停止 timeout。
6. **M7 管理命令**：定义 `admin.operation.requested` 和 `admin.operation.completed`，以 `operationId` 去重；M3 只消费退款/余额调整，M4 只消费停服/恢复。

这些决定可与模块实现并行进行。决定未发布前，模块只能在自己的 mock 内试验，不得把猜测写成共享 API。

## 每个 coordinator 的启动提示

编排 agent 可以将下列通用提示与模块任务卡一起传给每个 coordinator：

```text
你是 <Mx> 的协调 agent。立即并行启动 Web API、XMCL App、xmcl-page 三个子 agent。
先阅读 docs/commercialization/agent-coordination.md、docs/commercialization/spawn-handoff.md、
本模块 index.md、web-api.md、xmcl-app.md、xmcl-page.md 和 AGENTS.md。
使用已发布 schema/fixture；缺失共享 contract 时提交兼容 schema 提案，不要阻塞或修改其他模块业务代码。
你拥有本模块资源和文档中列出的代码位置。合并前运行模块级验证，并回报 contract 版本、fixture、变更文件、测试、风险和需要 shared contract owner 裁决的事项。
```

## UI、测试与交付要求

- 改动 `xmcl-keystone-ui/` 的子 agent 必须遵循 `AGENTS.md`：先查 `e2e/TESTIDS.md`，使用 scratch Playwright spec，捕获每个关键 UI 状态，运行 renderer build、Electron compile 和 scratch E2E；不得改 showcase/CI canonical specs 来验证无关功能。
- 所有 Web API 子 agent 必须提供请求/响应、错误、权限不足、幂等重试和 provider 失败 fixture。
- 所有事件生产者必须提供重复、乱序、重试和余额/状态冲突 fixture。
- 模块 coordinator 必须先运行最小范围的类型检查、测试或 build；完成后再报告给编排 agent。
- 不提交 secret、provider token、截图 artifact 或外部服务真实凭据。

## Coordinator 完成回报格式

每个 coordinator 完成一次可合并增量后，向编排 agent 回报：

```text
Module: Mx
Published contracts: <path + version>
Consumes: <schema versions>
Owned resources: <resources and sole writers>
Implemented: <API/App/Page files>
Fixtures and tests: <commands + result>
UI evidence: <scratch spec + screenshots, if renderer changed>
Open contract decisions: <none or decision IDs>
Integration risks: <none or concise list>
```

编排 agent 只在以下条件同时满足时将模块标记为 ready：该模块的 schema/fixture 已发布、资源 owner 无冲突、子 agent 输出已合并、最小验证通过、所有开放共享决定已记录。真实 PayPal、Vultr、AI provider 或对象存储启用仍需对应模块的安全、风控和运营验收，但不阻塞其他模块实现。
