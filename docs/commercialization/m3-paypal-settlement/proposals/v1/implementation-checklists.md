# M3 implementation checklists

These checklists consume `xmcl-web-api/contracts/shared/v1` as the published
contract. The module-local fixtures supplement PayPal and cash-ledger behavior;
they never replace shared field names, ordering rules, or ownership.

## Web API child

- [ ] Publish accepted schemas and fixtures under `xmcl-web-api/contracts/`; do not treat this proposal as executable authority.
- [ ] Require XMCL session scope for account reads and service scope for usage authorization, release, settlement, and reconciliation.
- [ ] Verify PayPal webhooks from the raw body with platform-managed secrets.
- [ ] Exercise the valid, invalid-signature, and retried raw-body cases in `fixtures/paypal-raw-webhook.json`; parsing or normalizing the body before verification is forbidden.
- [ ] Persist order/webhook deduplication, immutable ledger entries, reservations, rate snapshots, and settlement outcomes atomically.
- [ ] Return the original outcome for idempotent retries and duplicates.
- [ ] Reject mismatched authorization bindings, out-of-order usage, released/expired authorization, and unsafe integer amounts.
- [ ] Keep balances non-negative and return `stop_required` without directly stopping resources.
- [ ] On `server_time` exhaustion, return `stop_required` only; M5 emits
  `runtime.stopped.v1` and M4 owns the mandatory 300-second escalation.
- [ ] Consume only D6 `refund` and `balance_adjust` operations keyed by
  `operationId`, and write exactly one M3 completion event.
- [ ] Test every fixture in `fixtures/` on each supported serverless target.

## XMCL App child

- [ ] Consume only the published billing contract through `BillingService`; never call PayPal directly with a secret.
- [ ] Generate one idempotency key per user intent and reuse it for transport retries.
- [ ] Open provider approval in the system browser.
- [ ] After approval, cancellation, or callback, refresh order and balance from the service; never infer payment completion locally.
- [ ] Format `Money` using its ISO currency and minor-unit semantics; never label cash as points or credits.
- [ ] Keep rate display informational; do not calculate authoritative charges or write ledger state.
- [ ] Cover success, permission, retry, provider failure, and state-conflict responses with fixed fixtures.
- [ ] Use shared v1 `expectedQuantity`, `settlementIntervalSeconds`,
  `intervalStart`, `intervalEnd`, and `rateVersion`; do not retain the
  superseded local aliases.

## xmcl-page child

- [ ] Consume only the published order, balance, rate, ledger, and usage APIs through the site client.
- [ ] Keep card collection and webhook handling on PayPal/server infrastructure.
- [ ] Show server-confirmed pending, completed, cancelled, refunded, and disputed order states.
- [ ] Reuse the idempotency key for a retried user intent and refresh server state after returning from approval.
- [ ] Display configured settlement currency and published rate version without deriving authoritative prices.
- [ ] Cover cancellation, permission failure, provider failure, idempotent retry, and stale-state conflict fixtures.

## Coordinator acceptance

- [x] Shared v1 resolves D1/D4, D2, D3, D5 (including 300-second escalation),
  and D6; M3 consumes the version without editing it.
- [ ] Resource ownership has one writer for balance, reservation, ledger, order, authorization, and settlement state.
- [ ] Web API, XMCL App, and xmcl-page report consumed contract versions and test commands.
- [ ] No secret, provider credential, screenshot artifact, shared manifest, or cross-module implementation is included.