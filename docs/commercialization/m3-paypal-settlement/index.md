# M3 PayPal 充值与现金结算

> 本页定义 M3 对 PayPal 充值、账户现金余额和 usage settlement 的实现边界。MVP 没有积分、订阅或套餐履约。

## Consumed shared contract

M3 consumes the immutable published contract at
`xmcl-web-api/contracts/shared/v1` (D1/D4, D2, D3, D5 and D6). That
directory is the authority; this module does not modify it. The local proposal
under `proposals/v1` supplements PayPal, cash-ledger and UI test cases only.

M2 owns only the fixed 1 GiB policy; M6 owns storage accounting and submits
only overage `storage_retention` usage to M3. M3 implements D2/D3 for its
authorization and settlement boundary, returns D5 `stop_required`, and
consumes only D6 `refund` and `balance_adjust` operations. M5/M4 own the
required stop event and 300-second provider force-stop escalation.

```ts
type MeterUnit = 'second' | 'request' | 'token' | 'byte_second'
type UsageResource = 'server_time' | 'ai_request' | 'ai_tokens' | 'storage_retention'

interface UsageAuthorizationRequest {
  accountId: string
  resource: UsageResource
  sourceId: string
  expectedQuantity: number
  unit: MeterUnit
  settlementIntervalSeconds: number
  rateVersion: number
  idempotencyKey: string
  expiresAt: string
}

interface CanonicalUsageEvent {
  eventType: 'usage.recorded.v1'
  eventId: string
  schemaVersion: 1
  accountId: string
  authorizationId: string
  resource: UsageResource
  sourceId: string
  quantity: number
  unit: MeterUnit
  rateVersion: number
  sequence?: number
  intervalStart: string
  intervalEnd: string
  occurredAt: string
  idempotencyKey: string
}
```

## M3 cash model

```ts
interface UsageSettlementResult {
  settlementId: string
  usageEventId: string
  charged: Money
  ledgerEntryId?: string
  action: 'continue' | 'stop_required'
  rateVersion: number
  status: 'settled' | 'rejected' | 'pending'
}

interface Money {
  currency: string // configured ISO 4217 settlement currency
  amountMinor: number
}

interface Balance {
  accountId: string
  available: Money
  reserved: Money
}

interface CashRate {
  rateVersion: number
  resource: UsageResource
  unit: MeterUnit
  amountMinorPerUnit: number
  effectiveAt: string
  retiredAt?: string
}

interface UsageAuthorization {
  authorizationId: string
  accountId: string
  resource: UsageResource
  sourceId: string
  status: 'authorized' | 'rejected' | 'expired' | 'released'
  rateVersion: number
  expiresAt: string
  actionOnExhaustion: 'stop_required'
}
```

任何 usage event、PayPal webhook、充值和现金结算都必须幂等并可对账。余额不允许为负。

账户与 UI 显示的是已配置结算法币的现金金额，不存在积分或虚拟货币单位。MVP 的所有余额和价目表使用同一种 ISO 4217 结算法币；金额以该货币最小单位的非负安全整数持久化，并由客户端按货币格式化显示。`CashRate` 和实际扣款金额在授权/结算时必须快照。事件仍使用自身 canonical unit，并携带 schema version、sourceId 和在需要严格排序时的单调 sequence。

M3 是余额、预留和最终结算的唯一写入者：资源模块先取得 `UsageAuthorization`，再提交用量。AI 和云服务器的所有用量均按 `CashRate` 扣现金；M6 只提交超过 M2 固定 1 GiB 免费容量的 `storage_retention`。可用余额无法覆盖下一结算区间时返回 `stop_required`，资源 owner 必须停止资源或拒绝新的超额存储，而不是继续累计欠费。

## Shared API schema

```text
POST /v1/billing/paypal/orders
GET  /v1/billing/balance
GET  /v1/billing/rates
GET  /v1/billing/ledger
GET  /v1/billing/usage
POST /v1/webhooks/paypal
POST /v1/internal/usage/authorize
POST /v1/internal/usage/release
POST /v1/internal/usage/settle
```

| Endpoint | 作用 | 返回 |
| --- | --- | --- |
| `POST /v1/billing/paypal/orders` | 创建一次性现金充值订单。 | PayPal approval URL、订单 ID |
| `GET /v1/billing/balance` | 查询可用和预留现金余额。 | `Balance` |
| `GET /v1/billing/rates` | 查询 AI、服务器和超额备份保留时间的现金价目表。 | `CashRate[]` |
| `GET /v1/billing/ledger` | 查询现金充值、预留、扣款、退款和调整记录。 | 分页 ledger |
| `GET /v1/billing/usage` | 查询 AI、服务器和超额备份保留时间的结算明细。 | 分页 settlement |
| `POST /v1/webhooks/paypal` | 接收 PayPal 充值支付、退款和拒付事件。 | 快速 `2xx`，异步记账 |
| `POST /v1/internal/usage/settle` | 结算服务器、AI、存储 usage event。 | `UsageSettlementResult` |

## Dependencies

M4 只申请/释放服务器运行授权，M5 是服务器运行用量的唯一生产者；M6、M8 各自产生所属 resource 的 usage event。它们都不直接修改余额。M2 只提供 1 GiB 免费备份容量；M3 返回现金结算结果。

## First mergeable increment

- Consumes: `xmcl-web-api/contracts/shared/v1` for D1/D4, D2, D3, D5 and D6. It is authoritative and is not modified by M3.
- Module-local supplement: [M3 contract proposal v1](proposals/v1/README.md). It adds no shared fields and does not grant endpoint authority.
- Child role plan: [implementation checklists](proposals/v1/implementation-checklists.md).
- Fixtures: deterministic success, error, permission, idempotent retry, provider failure, duplicate, out-of-order, retry, insufficient-balance, and state-conflict examples under `proposals/v1/fixtures/`.
- XMCL App slice: transport-neutral read-only billing domain/service types and ISO-currency formatting in `xmcl-runtime-api`.
- D2/D3/D5/D6 are resolved by the consumed shared v1. M3 still requires production persistence with atomic ledger/reservation writes and a platform-managed PayPal verifier before enabling network routes.

## Three subpages

- [Web API 变更](web-api.md)
- [XMCL App 变更](xmcl-app.md)
- [xmcl-page 变更](xmcl-page.md)
