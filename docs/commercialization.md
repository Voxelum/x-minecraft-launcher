# XMCL 商业化计划

> 目标：保持现有功能免费、本地优先和开放生态定位，仅对新增 AI、超额备份保留和云端服务器托管进行商业化验证。

## 1. 产品范围与 MVP 决策

当前阶段先实现 `xmcl-web-api` 的 REST API 和模块 contract；XMCL 客户端与官网 `xmcl-page` 暂不作为本阶段的实现依赖。API 稳定后，客户端和官网分别作为 API consumer 交付对应页面与交互。

- 用户通过 PayPal 充值已配置结算法币的现金余额；账户、账单和客户端直接显示法币金额，不引入积分、点数、套餐或订阅。
- 本地 Minecraft 管理、本地启动和本地专用服务器不纳入第一版计时收费。
- 云端服务器托管使用 Vultr，MVP 区域固定为 Taipei，首发用户为台湾地区用户。
- 第一版账号采用无密码 OAuth，支持 Microsoft、Modrinth、Google 和 Discord；启动器内 Microsoft/Modrinth 登录自动创建或恢复 XMCL Account，并支持身份绑定与显式账户合并。
- 第一版支付优先使用 PayPal；Payoneer 后续评估，不阻塞 MVP。
- XMCL 托管服务器与 AI 用量按已发布结算法币价目表直接从现金余额结算。
- 每个 Account 固定拥有 1 GiB 免费备份容量，不按月重置；只有超过 1 GiB 的实际占用按保留时间收费。
- 第一版仅支持经过验证的 x86_64 实例规格、Minecraft 版本/加载器和受控 modpack 范围。
- 暂不支持多区域调度、任意 Docker 镜像、开放端口市场、自动迁移和无限制 modpack 兼容。

详细产品边界见 [产品范围与商业模式](commercialization/product-scope.md)。

## 2. 业务模块

每个模块都可以由独立负责人交付，拥有自己的输入/输出 contract、mock contract、实现范围和验收条件。模块之间通过 API、事件和数据 contract 协作，不通过共享内部实现耦合。

每个模块由一个协调 agent 管理 `Web API`、`XMCL App` 和 `xmcl-page` 三个子 agent。协调、共享 schema 发布、fixture 和并行冲突处理遵循 [模块 Agent 协调契约](commercialization/agent-coordination.md)。

每个模块的代码位置都必须同时考虑三个仓库：`xmcl-web-api` 后端、`x-minecraft-launcher` 桌面客户端和 `xmcl-page` 官网。官网当前以 VitePress 静态 Markdown 为主，登录后的交互页面/组件在 API contract 稳定后再开发。

| 模块 | 业务职责 | 主要输出 |
| --- | --- | --- |
| [M1 账户与身份](commercialization/m1-account-and-identity/index.md) | 无密码 Microsoft/Modrinth/Google/Discord OAuth、启动器自动建号/绑定、账户合并和 session | `xmclAccountId`、session、身份关联 |
| [M2 免费备份容量](commercialization/m2-package-entitlements/index.md) | 每个 Account 固定 1 GiB 免费备份容量和实际占用快照 | `BackupStorageAllowance` |
| [M3 PayPal 充值与现金结算](commercialization/m3-paypal-settlement/index.md) | PayPal 充值、结算法币余额、usage event 现金结算和对账 | 订单事件、现金账本事件、余额 |
| [M4 云服务器控制](commercialization/m4-vultr-control/index.md) | Vultr Taipei 资源、状态机、task、运行租约和控制 API | `serverId`、task、lease、服务器状态 |
| [M5 Minecraft 运行时](commercialization/m5-minecraft-runtime/index.md) | Minecraft 进程、健康检查、日志、心跳和崩溃恢复 | worker 状态、用量、运行事件 |
| [M6 手动世界备份](commercialization/m6-world-backup/index.md) | 客户端/托管服务器世界、linear/layered linear 压缩备份、恢复和删除 | signed URL、备份元数据、恢复事件 |
| [M7 合规、风控与运营](commercialization/m7-compliance-operations/index.md) | 审计、滥用、客服、观测、退款/补偿/停服 | 审计事件、运营任务、告警 |
| [M8 AI 服务](commercialization/m8-ai-service/index.md) | AI provider、请求、用量采集和结果返回 | AI 结果、usage event、provider request ID |
| [M9 Modpack 部署与来源校验](commercialization/m9-modpack-deployment/index.md) | mrpack/CurseForge ZIP 校验、config/data 部署和 mod 来源解析 | validation report、deployment manifest、部署任务 |

`serverless-api.md` 是共享技术基础设施说明，不计入独立业务模块。它描述 `xmcl-web-api` 如何承载各模块的 API、队列、数据库和运行时适配。

在任何模块开始实现前，协调 agent 必须将其 REST API、内部 API 和事件 schema 发布到 `xmcl-web-api/contracts/`；Markdown 说明页只描述业务边界，不能替代可执行 schema、fixture 或 contract test。

## 3. 模块依赖关系

### 共享承载

所有业务模块都运行在 `xmcl-web-api` 提供的 serverless API、MongoDB、Queue、KV、Scheduled Task 和 secret/binding 基础设施上。它是共享技术基础设施，不是业务模块。

### 直接业务依赖

```text
M1 账户与身份
  | \
  |  +--> M2 免费备份容量 ------> M6 手动世界备份 ----> M3 PayPal 与现金结算
  |  |
  |  +--> M3 PayPal 与现金结算 --> M4 云服务器控制 ----> M5 Minecraft 运行时
  |  |
  +-----------------------------------------------> M8 AI 服务

M4 云服务器控制 ----> M6 托管服务器世界手动备份
M5 Minecraft 运行时 --> M6 世界导出与恢复

M4 云服务器控制 ----> M9 Modpack 部署与来源校验
M9 Modpack 部署与来源校验 --> M5 Minecraft 运行时

M1、M2、M3、M4、M5、M6、M8、M9 --运营事件--> M7 合规、风控与运营

M1、M2、M3、M4、M5、M6、M7、M8、M9 --共享承载--> xmcl-web-api Serverless API
```

图中：M1 向其他模块提供账户归属；M2 只定义每个 Account 固定 1 GiB 免费备份容量；M3 负责 PayPal 现金充值、现金余额和所有收费 usage event 的结算；M4/M5/M8 分别产生服务器、运行时和 AI 用量事件；M6 只为超过 1 GiB 的备份保留产生用量事件；M9 负责 modpack 导入校验和部署清单，调用 M5 应用到服务器。

### 运营事件依赖

M1 的身份事件、M2 的备份容量事件、M3 的支付/账本/结算事件、M4 的服务器/租约事件、M5 的运行事件、M6 的存储/恢复事件和 M8 的 AI/provider 事件，都需要输出给 M7 合规、风控与运营模块，用于审计、告警、客服和人工处理。

### 可并行模块

在 contract 已定义、真实依赖尚未完成时，以下模块可以并行推进：

- M1：账户与身份，优先完成启动器 Microsoft、Modrinth OAuth 的自动建号/绑定，再实现 Google、Discord OAuth、显式绑定和账户合并。
- M2：免费备份容量，使用 mock `xmclAccountId`、备份 metadata 和 layer 引用计数。
- M3：PayPal 充值与现金结算，使用 PayPal Sandbox、mock 现金余额和 fake usage event。
- M5：Minecraft 运行时，使用 fake control plane 和 fake lease。
- M6：客户端世界备份，使用 fake client snapshot 和本地对象存储。
- M8：AI 服务，使用 fake provider、固定结算法币价目表和 mock settlement。
- M9：Modpack 部署与来源校验，使用 fake ZIP、fake Modrinth/CurseForge source adapter 和 fake worker。
- M7：合规、风控与运营，先定义事件、审计、指标、告警和后台流程。

M4 云服务器控制可以先用 mock account、现金余额、ledger 和 usage settlement 开发 Vultr adapter；M5、M6、M8、M9 都可以使用 fake contract 并行开发。真实支付、云资源和对外收费启用前，只需验证相关模块的 contract、风控和运营流程。

## 4. 并行实施规则

M1-M9 的协调 agent 及其 `Web API`、`XMCL App`、`xmcl-page` 子 agent 全部可以立即启动，不存在按模块或 Phase 的启动顺序。真实上游尚未就绪时，直接使用已发布 schema 对应的 fixture/mock contract；上游实现完成后，以 contract test 替换 mock，不改变已发布字段语义。

每个模块独立完成其资源 owner、API/event schema、fixture、状态机和验收测试即可交付。是否启用某项真实支付、云资源或对外产品能力，只取决于该能力涉及的 contract、风控和运营验收是否完成，不构成其他模块开始实现的前置条件。

具体协调、共享 schema 变更和跨模块冲突处理见 [模块 Agent 协调契约](commercialization/agent-coordination.md)。
负责启动 coordinator 和 subagent 的编排说明见 [实现启动交接](commercialization/spawn-handoff.md)。

## 5. 共享技术边界

- `xmcl-web-api` 是 serverless API 与控制平面，不运行 Minecraft 进程。
- Hono 共享路由、MongoDB raw collection、Cloudflare Queue/KV/Cron/Durable Object 可作为模块的承载基础。
- Serverless 不依赖进程内存保存余额、锁、租约或任务进度。
- 现金账本、服务器状态和 webhook 必须使用持久化状态、条件更新、原子操作和幂等事件。
- Vultr 实例内 worker 负责 Minecraft 进程、世界文件、游戏端口、持续日志、健康检查和心跳。
- 客户端或 XMCL 托管服务器世界以 `linear`/`layered linear` 压缩格式进入对象存储；不备份非托管服务器、日志或配置，MongoDB 只保存备份元数据和状态。
- PayPal、Vultr、MongoDB 和对象存储凭据只放在服务端 secret/binding 中。

共享基础设施的详细约束见 [Serverless API](commercialization/serverless-api.md)。

## 6. 首批技术验收重点

- 现有 Microsoft/Minecraft 游戏登录、Modrinth 登录与 XMCL 商业账户 session 分离；商业账户支持 Microsoft、Modrinth、Google 和 Discord OAuth，启动器首发自动接入 Microsoft 和 Modrinth。
- OAuth provider 身份绑定和账户合并必须二次认证、显式确认、幂等并可审计。
- PayPal webhook 读取原始请求体并完成验签；重复、乱序、重试和延迟事件不会重复履约。
- 现金余额只能通过服务端账本事件变更，余额、预留余额和订单可以对账。
- 只有 worker 确认服务器进入 `running` 后才开始计费。
- Vultr API 超时、配额不足、创建失败、重复启停和 serverless 重启均有幂等处理。
- 世界和日志存入对象存储，MongoDB 仅保存元数据和状态。
- 服务器故障不会导致用户持续扣费，世界备份可以恢复。
- PayPal 密钥、Vultr token、MongoDB 和对象存储凭据不进入客户端、普通日志或仓库配置。

## 7. 首批需要拍板的问题

1. 首发主体和运营地区是否满足 PayPal 商业账户、税务和隐私要求？
2. Vultr Taipei 的实例库存、配额、IPv4 和滥用处理能力是否满足 MVP？
3. 首发支持哪些 Minecraft 版本、加载器、modpack 和资源规格？
4. AI、云服务器和超额备份保留时间的结算法币价目表、最低充值额与价格调整通知规则是什么？
5. 现金余额退款、PayPal 拒付和已消费服务费用的处理规则是什么？
6. 客户端世界数据归属、备份格式保留期、layer 链删除和恢复窗口是什么？
7. 谁负责服务器滥用、版权投诉、支付争议和用户申诉？

在上述问题得到确认前，使用测试现金余额和邀请制，不开放大规模真实付费或多区域部署。
