# Serverless API 共享基础设施

## 角色

该文档不是独立业务模块，而是 M1-M9 共享的技术承载层。`xmcl-web-api` 使用共享 Hono 应用，并可运行在 Deno、Cloudflare Workers 和 Azure Functions；Cloudflare 入口已有 Queue、KV、Cron/Scheduled 和 Durable Object 能力。

业务模块必须先定义 API/event contract，再由本基础设施提供路由、数据库、secret、队列和运行时适配。

发布的 REST API、内部 API、事件 schema 和 fixture 统一存放在 `xmcl-web-api/contracts/`。字段、事件和状态的兼容性规则见 [模块 Agent 协调契约](agent-coordination.md)；该目录是运行时 contract 的唯一来源。

`xmcl-page` 和 `x-minecraft-launcher` 都是 API consumer，不属于 serverless 内部实现。官网当前是 VitePress 静态站；需要登录的商业页面应在 API contract 稳定后，通过 `.vitepress/theme/components/` 和共享 API client 接入，不在浏览器保存 provider secret、Vultr token 或 PayPal secret。

## 可直接承载的功能

- XMCL 账户、外部身份、session、设备和注销 API。
- 每个 Account 固定 1 GiB 免费备份容量及实际占用快照 API。
- PayPal 现金充值订单、Checkout、webhook、退款和拒付 API。
- 不可变现金账本、预留、结算、释放、退款和对账 API。
- Vultr 控制平面、资源声明、状态机、运行租约和 worker 心跳 API。
- 世界、日志和备份的对象存储元数据 API。
- signed URL 上传/下载接口。
- 审计、运营查询、成本统计和异常补偿 API。
- Queue、KV、Cron/Scheduled 驱动的 webhook 后续动作、provisioning、对账、低余额停服和清理任务。

## 不应承载的功能

- Minecraft Java 进程、世界文件实时读写和游戏端口监听。
- 持续日志流、长连接和长期运行的 provisioning agent。
- worker 心跳的实际产生、崩溃恢复和优雅停止。

这些功能由 Vultr 实例上的 worker/agent 承担，serverless 只接收并持久化事件。

## 现有代码复用

- 共享路由注册在 `src/app.ts`，商业路由放入 `src/routes/`。
- 平台依赖通过 `AppEnv` 注入，复用现有 DB、geo、queue 和 realtime 入口模式。
- MongoDB 当前使用 raw collection 访问，保持无实体 ORM 设计。
- Cloudflare Worker 可复用 Queue、KV、Durable Object 和 scheduled handler。
- PayPal、Vultr 和对象存储凭据使用各平台 secret/binding 管理。
- 官网 consumer 代码建议放在 `xmcl-page/.vitepress/theme/lib/commercialApi.ts` 和 `xmcl-page/.vitepress/theme/components/commercialization/`。

## 必要改造

当前认证 middleware 只能验证 Microsoft Graph 和 Minecraft bearer token，需要新增 XMCL 商业账户 session。

当前 `Db`/`MongoCollection` 抽象需要补充：

- 条件更新和原子增量。
- 列表查询、分页和排序。
- 唯一索引与重复事件保护。
- 状态机的条件迁移。
- 账本写入和余额校验的一致性策略。

serverless 实例可冻结、重启和并发执行，不能依赖进程内存保存余额、锁、租约或任务进度。所有状态必须持久化到 MongoDB、KV、Durable Object 或队列。

## Shared API conventions

所有业务 REST API 使用 `/v1` 前缀，并遵循以下约定：

```text
Authorization: Bearer <xmcl-session-token>
Idempotency-Key: <client-generated-key>
X-Request-Id: <optional-correlation-id>
```

```ts
interface ApiError {
	error: string
	message: string
	requestId: string
	details?: unknown
}

interface AsyncTask<T = unknown> {
	taskId: string
	requestId: string
	status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
	resource?: { type: string; id: string }
	result?: T
	error?: ApiError
	createdAt: string
	updatedAt: string
}

interface Page<T> {
	items: T[]
	nextCursor?: string
}
```

Webhook 路由必须使用原始 body 验签；内部 worker/admin 路由使用独立 scope，不接受普通用户 session。所有异步操作返回 `202` 和 `taskId`，所有会改变余额、资源状态或对象状态的接口都要求幂等键。

## 共享基础设施验收

- 所有商业路由在 Deno 或 Cloudflare 目标运行时通过类型检查和集成测试。
- 任意函数重试、并发执行或实例重启不会破坏账本和服务器状态。
- 异步任务具有 task ID、重试、幂等和失败转人工处理的路径。
- secret 不出现在客户端、普通日志或仓库配置中。
