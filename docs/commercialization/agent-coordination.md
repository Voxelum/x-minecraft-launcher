# 模块 Agent 协调契约

M1-M9 没有实施阶段或启动顺序：每个模块及其子 agent 都可以立即并行实现。每个模块由一个协调 agent 负责，并管理三个子 agent：`Web API`、`XMCL App` 和 `xmcl-page`。协调 agent 不取代子 agent 的实现工作；它负责冻结本模块的输入/输出、分配资源所有权、维护 mock，并处理跨模块 contract 冲突。

负责 spawn coordinator/subagent 的编排 agent 使用 [实现启动交接](spawn-handoff.md) 执行并行拓扑、共享 contract 裁决和模块完成回报。

## 共享 contract 的唯一来源

业务说明页不是可执行 schema 的唯一来源。开始实现前，协调 agent 必须将以下产物提交到 `xmcl-web-api/contracts/`，并在本模块 `index.md` 中记录已消费和已发布的版本：

- `openapi.yaml`：所有外部 REST API、内部 API、请求/响应 body、错误码和鉴权 scope。
- `events/*.schema.json`：所有异步事件的 schema、`eventId`、`schemaVersion`、生产者、幂等键和顺序规则。
- `fixtures/`：成功、重试、冲突、权限不足、配额不足和 provider 失败的固定 mock response/event。

一个被发布的字段只能向后兼容地增加可选字段。任何语义变更、新的必填字段、状态迁移或计费规则都必须以新版本 schema 发布，并由受影响模块的协调 agent 确认后实施。共享 contract 的维护权由指定的共享 contract owner 持有；模块 agent 不直接覆盖其他模块已发布的 schema。

## 协调 agent 的交付物

每个模块协调 agent 必须维护本模块 `index.md`，并在开始开发前明确：

- 输入：依赖的 API/event schema 版本、可用 mock 和前置条件。
- 输出：本模块拥有的资源、REST API、事件和唯一写入者。
- 状态：状态机、允许迁移、并发命令优先级、重试和人工处理条件。
- 安全：认证主体、scope、secret 边界、审计字段和数据保留要求。
- 计量：适用时的 canonical unit、时间边界、现金价目表版本、结算权威和余额不足动作。
- 验收：三个子 agent 可独立运行的 contract test，以及一个使用固定 fixture 的跨模块测试。

协调 agent 负责合并三个子 agent 的变更，并确认客户端和官网只调用已发布 API。前端子 agent 可以与 API 子 agent 并行，但不得自行发明 endpoint、错误码、状态或业务规则。

## 三个子 agent 的边界

| 子 agent | 可以拥有 | 不可以拥有 |
| --- | --- | --- |
| Web API | 服务器端资源、状态迁移、provider adapter、事件生产与消费、服务端授权和审计写入。 | 客户端 provider secret、浏览器/桌面 UI 状态，或其他模块资源的直接写入。 |
| XMCL App | 交互、系统浏览器 OAuth、已发布 API client、本地临时状态和用户确认。 | PayPal/Vultr/worker secret、账本写入、现金价格判断或未发布的内部 API。 |
| xmcl-page | 公开说明、已发布 API client 和网页交互。 | 第二套账户系统、provider secret、账本/资源状态写入或未发布的内部 API。 |

## 并行冲突处理

- 资源只允许一个模块拥有最终状态和持久化写入权；其他模块通过 API、命令或事件请求变更。
- 所有异步命令都必须返回共享 `AsyncTask`，并带 `requestId`、目标资源和可查询的失败原因。
- 所有可重试写入必须声明幂等键的作用域和保留期；事件必须声明去重键和顺序语义。
- 一个模块需要扩展上游 contract 时，先提交兼容的 schema 提案和 fixture；未发布前只能在本模块 mock 中试验。
- 协调 agent 无法裁决共享 contract 时，提交给共享 contract owner；不要通过复制字段或绕过内部 API 解决。