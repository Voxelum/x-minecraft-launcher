# Web API promotion checklist

- [ ] Shared contract owner reviews `xmcl-web-api/proposals/m4/` and publishes a versioned contract without changing shared v1 semantics.
- [ ] M1 account/session and shared v1 D2 authorization are consumed without copying upstream fields.
- [ ] Route ownership is derived from the verified M1 session; cross-account lookup returns `server_not_found`.
- [ ] MongoDB indexes enforce server, task, lease, operation, observation, and idempotency uniqueness.
- [ ] Every state transition uses expected `statusVersion` and persists command source, reason, task id, and request id.
- [ ] Every mutation requires `Idempotency-Key`; replay returns the original task and does not repeat provider calls.
- [ ] Vultr adapter is the only token holder; public responses and logs omit token, provider id, and provider error body.
- [ ] Ambiguous create outcomes reconcile from persisted server identity before another create call.
- [ ] Worker healthy observation is required before `running` and active lease state.
- [ ] D5 has a deterministic 300-second scheduled sweep, duplicate-delivery tests, lease closure, provider halt, and reconciliation tests.
- [ ] D6 consumer verifies admin scope, deduplicates `operationId`, and never permits M7 to write server state.
- [ ] Fixtures cover success, permission, idempotency, provider failure, duplicate, stale, retry, balance exhaustion, and state conflict.
- [ ] Contract, route, repository, queue retry, and provider adapter tests pass in Deno and Cloudflare targets.
- [ ] No real Vultr credential or provider resource identifier exists in fixtures.