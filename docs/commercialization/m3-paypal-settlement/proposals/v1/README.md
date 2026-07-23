# M3 contract proposal v1

Status: module-local supplement. It consumes the published
`xmcl-web-api/contracts/shared/v1` schemas and fixtures; it is not a published
contract and cannot override them.

This directory lets the Web API, XMCL App, and xmcl-page roles review the same
deterministic examples. Nothing here grants endpoint authority, changes a
shared schema, or permits a client to write the cash ledger.

## Ownership

M3 is the sole writer of cash balances, reservations, immutable cash-ledger entries, PayPal settlement state, rate snapshots, usage authorizations, and usage settlements. Resource modules submit canonical usage; they do not calculate prices or mutate balances.

All money uses one configured ISO 4217 settlement currency and a non-negative safe integer `amountMinor`. A rate and the resulting charge are snapshotted at authorization or settlement time. No client-supplied amount is price authority.

## Shared v1 adoption

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
  quantity: number
  unit: MeterUnit
  rateVersion: number
  intervalStart: string
  intervalEnd: string
  occurredAt: string
  sourceId: string
  sequence?: number
  idempotencyKey: string
}
```

Shared validation rules consumed by M3:

- `currency` is an uppercase three-letter ISO 4217 code; `amountMinor`, quantities, versions, and sequences are safe integers in their documented non-negative or positive range.
- Authorization binds account, resource, source, unit, expected quantity, settlement interval seconds, rate version, idempotency key, and expiry. Settlement must reject a mismatched binding.
- `eventId` is the event deduplication key. `idempotencyKey` scopes retried commands to the authenticated producer and operation. Retention duration remains a shared-owner decision.
- Producers requiring strict order provide a strictly increasing `sequence` per `sourceId`; intervals for a source cannot overlap. Duplicate and older events return the original result or a no-op outcome and never write a second charge.
- A settlement that cannot reserve or charge the next interval returns `stop_required`; the balance remains non-negative.

## Shared-owner proposals

| Decision | M3 proposal | Owner action required |
| --- | --- | --- |
| D2 Usage authorization request | Consume `usage-authorization.schema.json`; no module-local field aliases. | Published in shared v1. |
| D3 Canonical usage input | Consume `canonical-usage-event.schema.json`; M5/M6/M8 emit it exactly or use an explicit M3 adapter. | Published in shared v1. |
| D5 Balance exhaustion path | M3 returns `stop_required`; M5 publishes the stop and M4 force-stops after 300 seconds. | Published in shared v1; M3 does not write M4/M5 state. |
| D6 Admin operations | Consume only `refund` and `balance_adjust`, deduplicated by `operationId`; emit one completion. | Published in shared v1. |

## Fixture index

| Fixture | Required behavior |
| --- | --- |
| `fixtures/success.json` | Authorization and settlement charge one snapshotted rate. |
| `fixtures/error.json` | Invalid quantity is rejected without state mutation. |
| `fixtures/permission.json` | A user session cannot call internal settlement. |
| `fixtures/idempotent-retry.json` | Retrying order creation returns the original order. |
| `fixtures/provider-failure.json` | PayPal failure does not credit cash. |
| `fixtures/paypal-raw-webhook.json` | Signature verification consumes the exact raw body; invalid or retried events do not credit twice. |
| `fixtures/duplicate.json` | Duplicate usage returns the original settlement. |
| `fixtures/out-of-order.json` | Older sequence is ignored without another charge. |
| `fixtures/retry.json` | A transient settlement retry eventually returns one charge. |
| `fixtures/insufficient-balance.json` | Insufficient cash returns `stop_required` and no negative balance. |
| `fixtures/state-conflict.json` | Released authorization cannot be settled. |

These examples intentionally contain no provider token, webhook signature, real customer data, or price-selection input from a client.