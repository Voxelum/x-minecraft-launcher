# M6 module-local contract proposals v1

These files are M6-owned proposals for shared decisions D1, D3, and D4. They are not canonical schemas and must not be copied into a shared manifest. `xmcl-web-api` is absent from this workspace, so the shared contract owner must review and publish an adapted version there before another module consumes them.

Compatibility rule: v1 fields are immutable. Compatible revisions may add optional fields or fixtures under this directory. A new required field, state transition, attribution rule, interval rule, or event meaning requires a new version directory.

## D1: measured storage ownership

`storage-state.proposal.schema.json` makes M6 the sole writer of `BackupResource`, verified physical objects, layer references, `usedBytes`, `overageBytes`, and `billingCursor`. M2 contributes only `freeBytes` and `policyVersion`; those values are recorded as settlement inputs and are never recomputed or changed by M6.

Only verified physical objects with at least one active reference occupy storage. `usedBytes` is the sum of each distinct physical `objectId` exactly once. `overageBytes` is `max(usedBytes - freeBytes, 0)`. Uploading, failed, deleted, and zero-reference objects do not count.

## D3: M6 usage proposal

`storage-retention-event.proposal.schema.json` is an M6 output proposal, not the M3 canonical event. M3 must publish an explicit adapter before accepting it. Each event covers one half-open interval `[intervalStart, intervalEnd)`, uses `byte_second`, and has an idempotency key derived from schema version, account, attributed backup, interval bounds, and rate version.

## D4: cursor, mutations, and attribution

The settlement interval is 3600 seconds, aligned to Unix epoch boundaries. `lastSettledAt` is the exclusive lower bound of the next unsettled interval. A scheduled settlement at boundary `B` emits `[lastSettledAt, B)` and advances the cursor to `B` atomically with its outbox records.

Before upload completion, deletion, object removal, or reference addition/removal changes occupied bytes or attribution, M6 first settles `[lastSettledAt, mutation.occurredAt)` under the old state. It then applies the mutation and sets `lastSettledAt` to `mutation.occurredAt` in the same transaction. A failed object deletion keeps metadata, references, accounting, and cursor unchanged. Deleting a referenced parent is rejected before settlement because it cannot change state.

For deterministic shared-layer attribution, each physical object is assigned to the lexicographically smallest active `backupId` that references it. Distinct physical objects are sorted by `(attributedBackupId, objectId)`, and the Account free bytes are consumed in that order. Remaining bytes are billable and grouped by attributed backup. Every reference mutation is settled before this ordering is recomputed, so attribution cannot rewrite an earlier interval.

`fixtures/storage-settlement.json` covers a shared object, a mid-interval reference release, a deletion settlement, and a failed physical deletion.