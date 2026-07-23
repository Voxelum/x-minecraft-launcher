# M8 AI 服务

## 当前增量

本 workspace 没有 `xmcl-web-api` 或 `xmcl-page` 仓库。M8 消费已发布的
[`contracts/shared/v1`](../../../../xmcl-web-api/contracts/shared/v1/README.md) D2 usage authorization
和 D3 canonical usage；所有 M8 endpoint shapes、M1 session mock 和 adapter 仍在
[`proposals/v1`](proposals/v1/README.md)，不得复制或修改 shared contract。

XMCL App 增量提供了本地 `AiService` schema、专用 REST client 和 renderer state：客户端只发送 XMCL
session 与用户 intent，不能写入余额、发布 usage、保存 provider secret 或直接调用 provider。

## 输入、输出与唯一写入者

- **Consumes:** M1 session/account identity（proposal: `ai:invoke` scope）以及 shared v1 D2 usage
  authorization、D3 canonical usage event。
- **Owns:** AI request/result、provider request ID、已测量 `ai_request`/`ai_tokens` usage，以及 usage outbox。
  只有 M8 调用 provider、写 AI request/result 和发出 canonical usage；M3 是余额、费率和结算唯一写入者。
- **Public proposal:** `GET /v1/ai/models`, `POST /v1/ai/{capability}`,
  `GET /v1/ai/usage`。`POST` 需要 `Idempotency-Key`；服务端从 M1 session 得到 account，不接受 client
  account、price 或 provider 字段。

## 状态与安全

请求状态为 `processing -> completed | failed`。相同 `(accountId, idempotencyKey)` 且相同 intent 重放已持久化
结果；不同 intent 返回冲突。M8 在调用 provider 前通过 D2 分别申请 request/token 授权；第二个授权失败时释放第一个，
任何拒绝、过期或冲突均为零 provider 调用。provider 成功后原子持久化 result 与 D3 canonical usage outbox；
事件重试复用 event/idempotency ID，并接收原始 settlement。每个 AI request 使用独立 source，避免 source interval
重叠；本地 `balance_conflict` 仅在 M3 发布对应 error taxonomy 前作为 reconciliation adapter fixture。

provider endpoint/key 仅能来自 Web API server secret binding。prompt、provider credentials、provider response
body 和 token 不进入 fixture、client storage 或日志；客户端仅显示稳定错误及 request ID。

## 验收与待裁决

`proposals/v1` 包含 API/auth/idempotency/provider-failure/event retry/duplicate/out-of-order/balance-conflict
fixtures 与可执行 Web API proposal。`xmcl-runtime-api/src/services/AiService.ts`、`xmcl-runtime/ai/` 和
`xmcl-keystone-ui/src/composables/ai.ts` 覆盖 App contract、专用 client 和 usage 去重。

shared v1 D1/D4、D5 和 D6 已审阅但不由 M8 消费；M8 不得写 storage accounting、server stop 或 admin event。
仍需要 M1 session/scope、M3 internal credential injection，以及 M3 `409`/`422` error taxonomy（包括
`balance_conflict`）后，才能把 adapters 移入真实 Web API 路由并将 launcher client 注入 M1 session provider。

## Three subpages

- [Web API 变更](web-api.md)
- [XMCL App 变更](xmcl-app.md)
- [xmcl-page 变更](xmcl-page.md)
