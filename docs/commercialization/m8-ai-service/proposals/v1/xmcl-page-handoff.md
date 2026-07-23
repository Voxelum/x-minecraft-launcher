# M8 xmcl-page renderer handoff

Status: module-local implementation proposal. The `xmcl-page` repository is not present in this
workspace, and the public M1/M3/M8 schemas are not published. Do not ship this proposal as a
network client.

## Owned page files

When the page repository and published client are available, limit implementation to:

- `src/en/commercialization/ai.md`
- `.vitepress/theme/components/commercialization/AiUsage.vue`
- `.vitepress/theme/components/commercialization/AiTryout.vue`
- M8-local component tests and fixtures beside those components

The components must use the page application's published commercial API client and existing M1
session. They must not import a root launcher API client, create another token store, call a
provider directly, accept a provider key, calculate authoritative charges, or mutate a balance.

## Required UI

`ai.md` explains capabilities, server-published settlement currency and rates, usage limits, and
that confirmed charges come directly from the account cash balance.

`AiTryout.vue`:

- renders signed-out, loading, ready, submitting, result, and recoverable failure states;
- fetches the published model/capability catalog and never embeds provider model identifiers;
- generates one idempotency key for a user intent and reuses it only for transport retries;
- disables duplicate submit while that intent is pending;
- preserves sanitized results while usage reconciliation is retrying;
- renders only stable API error copy and request ID, never raw provider details;
- offers sign-in for authentication failures, retry for transient/provider failures, a new intent
  for authorization conflicts, and balance management for `insufficient_balance`.

`AiUsage.vue`:

- shows server-confirmed quantities, settlement currency, published rate version, and charges;
- treats duplicate and out-of-order usage as reconciliation metadata, not additional charges;
- retains the latest confirmed balance when a refresh conflicts or fails;
- labels pending reconciliation without presenting browser-calculated totals as authoritative;
- paginates only through the published client cursor.

Unknown error/status/resource values degrade to a generic recoverable state. Browser storage,
analytics, and logs must not contain prompts, results, session tokens, idempotency keys, provider
request IDs, raw errors, or provider credentials.

## Proposed test IDs and accessibility

- `ai-model-select`, `ai-input`, `ai-submit`, `ai-result`
- `ai-error`, `ai-sign-in`, `ai-retry`, `ai-balance-action`
- `ai-usage-list`, `ai-usage-sync-status`, `ai-confirmed-balance`

All controls require programmatic labels. Status transitions use a polite live region; blocking
errors use an alert. Loading and disabled states must not rely on color alone. Focus returns to the
result or error summary after submission and remains visible at desktop and mobile widths.

## Renderer fixture matrix

`fixtures/xmcl-page-renderer-states.json` covers success, generic API error, authentication,
idempotent transport retry, sanitized provider failure, event retry, duplicate and out-of-order
delivery, insufficient balance, and authorization/balance conflicts. The colocated Vitest check
guards the renderer-facing safety and retry invariants until these cases can move into page
component tests.

## Release gates

1. Replace proposal shapes with shared-owner-published M1 session, M3 authorization/settlement, and
   M8 OpenAPI/client versions.
2. Run the page repository's typecheck and component tests.
3. Exercise every fixture at desktop and mobile viewports and capture the page repository's
   required visual evidence.
4. Verify retries reuse the same idempotency key and never display an extra confirmed charge.

