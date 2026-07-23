# M8 implementation checklists

These checklists consume the module-local proposal for planning only. Network consumers must switch to shared-owner-published M1, D2, and D3 contracts before release.

## Web API child

- [x] Keep provider orchestration behind injected authorization, provider, and usage ports.
- [x] Authorize with M3 before every provider call.
- [x] Publish provider-measured request/token usage only after provider success.
- [x] Use stable event and idempotency IDs derived from the M8 request intent.
- [x] Cover authorized success, insufficient balance, provider failure, idempotency, and outbox outcomes with focused domain tests.
- [x] Exercise a module-local M1 session mock and proposed `ai:invoke` scope at the route boundary.
- [ ] Replace the mock with the published M1 XMCL session and accepted AI scope.
- [ ] Persist request/result/idempotency state before exposing routes; do not rely on serverless process memory.
- [ ] Adapt to shared-owner-published D2/D3 schemas and run every fixture as a contract test.
- [x] Sanitize provider errors and keep credentials behind the server-only provider adapter.
- [ ] Wire provider credentials to the target platform secret bindings.
- [ ] Register `/v1/ai` routes only after the public contract is published.

## XMCL App child

- [x] Define strict provider-neutral model, request, result, and measured-usage schemas.
- [x] Reject provider-only fields and client-authored cash amounts.
- [x] Enforce `ai_request/request` and `ai_tokens/token` pairings.
- [ ] Export/register the service only after the public M8 contract is published; shared manifests remain untouched in this increment.
- [ ] Generate one idempotency key per user intent and reuse it only for transport retries.
- [ ] Display only server-published currency/rates and server-confirmed charges; never calculate authoritative price.
- [ ] Add UI, accessibility states, scratch E2E, and screenshots only after models and error schemas are published.
- [ ] Cover all proposal fixtures through the runtime transport adapter.

## xmcl-page child

- [ ] Wait for shared-owner-published M1, D2, D3, and M8 OpenAPI schemas before adding an API client or interactive page.
- [ ] Consume only `/v1/ai/models`, `/v1/ai/{capability}`, and `/v1/ai/usage` through the published client.
- [ ] Generate one idempotency key per trial intent and reuse it for retries.
- [ ] Display configured settlement currency and published rates as server data, not browser price authority.
- [ ] Keep provider credentials, settlement mutation, and raw provider errors out of browser code.
- [ ] Cover success, permission, retry, provider failure, insufficient balance, and state conflict fixtures.
- [ ] Verify any visible implementation at desktop/mobile viewports using the page repository's visual workflow.

## Coordinator acceptance

- [x] M8 resource ownership and sole writers are recorded.
- [x] D2 and D3 are recorded as open shared-owner proposals, not published contracts.
- [x] The required request, error, permission, retry, provider-failure, duplicate, out-of-order, balance, and conflict fixtures exist.
- [x] No secret, provider credential, screenshot artifact, shared contract, route registry, package manifest, or other-module implementation is changed.
- [ ] M1 session and M3 D2/D3 contract versions are published and consumed by network code.
- [ ] Web API persistence/idempotency and all three consumers pass integration contract tests.