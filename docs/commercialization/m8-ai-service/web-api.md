# M8 Web API 变更

## 边界

负责 AI provider adapter、模型目录、请求鉴权、限流、用量采集和结果返回。M3 负责按结算法币价目表结算。

## 代码位置与本地 proposal

- `xmcl-web-api/src/routes/ai.ts`
- `xmcl-web-api/src/lib/ai/`
- `xmcl-web-api/src/lib/ai/usage.ts`
- `xmcl-web-api/src/lib/usageSettlement.ts`

当前 workspace 缺少 `xmcl-web-api`，所以可执行、框架无关的 M8-local proposal 在
[`proposals/v1/web-api`](proposals/v1/web-api)。它覆盖 server-only provider adapter、M1 session mock、M3
已发布 shared v1 D2/D3 adapter、幂等 request repository 和 durable-outbox 行为；memory repository 只可用于测试。
真实实现必须替换为持久化唯一 `(accountId, idempotencyKey)` claim 与 result/outbox 原子写入。

## API

```text
GET  /v1/ai/models
POST /v1/ai/{capability}
GET  /v1/ai/usage
```

请求前通过 shared v1 D2 `/v1/internal/usage/authorize` 取得 `ai_request` 与最大 token usage authorization；
第二个授权失败时释放第一个。授权因现金余额不足、过期或冲突被拒绝时不调用 provider。完成后经 D3
`/v1/internal/usage/settle` 生成 `ai_request`/实际 `ai_tokens` canonical usage event，不能直接修改余额。
exact retry 返回既有结算；每个 AI request 用独立 source 避免 interval 重叠；transient publish 保留在 outbox。
`balance_conflict` 仍需 M3 发布具体错误 taxonomy 后映射到 reconciliation。

## 验收

- 请求、provider request ID 和实际用量可对账。
- 现金余额不足返回稳定错误码。
- provider key、用户敏感输入和 token 不进入日志。
- shared v1 D2/D3 已消费；真实路由仍等待 M1 session/scope 和 internal credential injection；provider endpoint/key
  仅使用 server binding。
