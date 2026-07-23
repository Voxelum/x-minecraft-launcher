# M8 AI service proposal v1

Status: module-local proposal; not a published shared contract.

This proposal gives the Web API, XMCL App, and xmcl-page roles deterministic examples adapted to
the published [`contracts/shared/v1`](../../../../../../xmcl-web-api/contracts/shared/v1/README.md)
D2/D3 boundary. It does not grant M8 authority to change that boundary or to register a public route.

## Ownership

M8 owns AI requests, provider adapter calls, provider request IDs, sanitized results, and measured AI usage. M8 consumes M1 account/session identity and M3 usage authorization. M8 never stores provider credentials in a client, calculates authoritative cash prices, mutates a balance, or settles usage.

## Candidate M8 resources

```ts
type AiUsageV1 =
  | { resource: 'ai_request'; quantity: number; unit: 'request' }
  | { resource: 'ai_tokens'; quantity: number; unit: 'token' }

interface AiRequestV1 {
  requestId: string
  accountId: string
  capability: string
  model?: string
  sourceId: string
  idempotencyKey: string
}

interface AiResultV1 {
  requestId: string
  providerRequestId: string
  output: string
  usage: AiUsageV1[]
}
```

`input` is accepted by the request endpoint but intentionally omitted from retained request metadata and fixtures. Logs contain request IDs, account IDs, capability, model, status, and usage only. Provider errors exposed to clients use stable M8 codes and omit provider response bodies.

## Consumed D2/D3 shared v1

| Contract | M8 adaptation | Remaining integration work |
| --- | --- | --- |
| D2 `UsageAuthorizationRequest` | Before a provider call, M8 requests `ai_request` and maximum `ai_tokens` separately with `expectedQuantity`, `settlementIntervalSeconds: 300`, rate version, expiry, and an M8 request source. If the second authorization fails, it releases the first; any rejection makes zero provider calls. | Map the two requests to `/v1/internal/usage/authorize` using the internal writer credential and `/release` compensation. |
| D3 `CanonicalUsageEvent` | After provider success, M8 emits one `usage.recorded.v1` event per measured resource, including `rateVersion`, `intervalStart`, `intervalEnd`, source, authorization and stable event/idempotency IDs. Each AI request has source `ai:<requestId>`, so its interval cannot overlap another AI request source. | Map outbox delivery to `/v1/internal/usage/settle`; a retry receives the original settlement for the same event ID/idempotency key. |

M8 does not publish a competing shared schema. The local types mirror the shared v1 required fields; the
only remaining mocks are M1 session/scope and M3 transport/error adapters.

## Fixture index

| Fixture | Required behavior |
| --- | --- |
| `fixtures/success.json` | M1 identity and M3 authorization succeed; provider result emits request and token usage. |
| `fixtures/error.json` | Invalid input is rejected before authorization or provider invocation. |
| `fixtures/permission.json` | Missing M1 AI scope is rejected before authorization or provider invocation. |
| `fixtures/idempotent-retry.json` | A retried request returns the original result and emits no second usage event. |
| `fixtures/provider-failure.json` | Sanitized provider failure emits no success usage and leaks no provider body or credential. |
| `fixtures/duplicate.json` | Duplicate canonical usage is acknowledged without a second settlement. |
| `fixtures/out-of-order.json` | Older usage is ignored or returns the original result without another settlement. |
| `fixtures/retry.json` | Transient usage publication retries with the same event and idempotency IDs. |
| `fixtures/insufficient-balance.json` | M3 rejection returns `insufficient_balance` and makes zero provider calls. |
| `fixtures/state-conflict.json` | Expired/released authorization blocks provider invocation. |
| `fixtures/balance-conflict.json` | A post-provider M3 balance conflict is retained for reconciliation and is not retried automatically. |

All IDs and timestamps are fixed test data. No fixture contains user prompts, provider keys, real provider model names, real customer data, or client-authored cash amounts.

## Web API executable proposal

`web-api/` contains a framework-neutral implementation and focused Vitest suite because
`xmcl-web-api` is not present in this workspace:

- `route-proposal.ts` consumes an M1-like session, requires the proposal-only
  `ai:invoke` scope, rejects client account/price/provider fields, and returns stable errors.
- `ai-service.ts` claims an idempotent request, obtains both request and maximum-token
  authorizations before invoking the provider, atomically stores the sanitized result and
  canonical-usage outbox records, then publishes them with stable identifiers.
- `ai-provider.ts` keeps credentials in a server-constructed adapter, passes the M8 request ID
  as the provider idempotency key, validates measured usage, and discards provider error bodies.
- `memory-repository.ts` is test-only. Production must use a durable unique
  `(accountId, idempotencyKey)` claim and an atomic result/outbox write.

### Shared-contract integration assumptions

M1 has not published a runtime session schema or AI scope. The route therefore uses the
module-local `M1SessionMock` and proposes `ai:invoke`.

The shared v1 API authorizes one resource per call. `authorizeAll` is therefore an M8-local
compensating adapter: it calls D2 for request then tokens, releases the first authorization if the
second does not authorize, and releases both after provider failure. The D3 settlement response is
the published `UsageSettlementResult`; duplicate event retries return its existing settlement.
Transient transport failures remain in the outbox. Shared v1's generic `409`/`422` error does not
define a `balance_conflict` code, so the local reconciliation fixture remains an adapter mapping
until M3 publishes that error taxonomy.

### Integration

Move the provider/service/repository ports into `xmcl-web-api/src/lib/ai/`, implement the repository
with the platform database and durable outbox, map the M1 middleware principal and the published
shared v1 D2/D3 routes, then register the M8 handler in `xmcl-web-api/src/routes/ai.ts`. Provider
endpoint/key values must come only from server secret bindings. Do not register this proposal
directly as a public API.