# M9 modpack deployment v1 proposal

Status: module-local proposal; not a published shared contract.

Target publication location: `xmcl-web-api/contracts/m9/modpack-deployment/v1/`. The shared contract owner must review and publish it before any client treats these routes or fields as authoritative.

## Ownership and dependencies

M9 is the sole writer of import state, validation reports, immutable deployment manifests, deployment history, preview records, and M9 task state. M9 never writes account, server, lease, worker, or runtime state.

This proposal consumes, without copying upstream fields:

- M1 account/session proposal: authenticated `accountId`; ownership is never accepted from a request body.
- `m4.server-control.v1-proposal`: server ownership, current server status, and a versioned supported-template lookup. M9 does not mutate `ServerResource`.
- M5 worker runtime proposal: idempotent prepare/apply/rollback commands bound to `serverId`, deployment manifest hash, and rollback snapshot. No executable M5 schema is present in this workspace.

## Candidate REST surface

All mutating routes require the verified M1 session and `Idempotency-Key`. Cross-account resources return `modpack_resource_not_found`.

| Method and route | Candidate result |
| --- | --- |
| `POST /v1/servers/{serverId}/modpack-imports` | `201` import plus upload constraints |
| `POST /v1/modpack-imports/{importId}/upload-url` | `200` single-use signed ZIP upload target |
| `POST /v1/modpack-imports/{importId}/complete` | `202` `AsyncTask` |
| `GET /v1/modpack-imports/{importId}` | `200` import state |
| `GET /v1/modpack-imports/{importId}/validation` | `200` `ModpackValidationReport` |
| `POST /v1/servers/{serverId}/modpack-deployments` | `202` immutable `DeploymentManifest` plus task |
| `GET /v1/servers/{serverId}/modpack-deployments` | `200` cursor page |
| `GET /v1/modpack-deployments/{deploymentId}` | `200` deployment state and manifest |
| `POST /v1/modpack-deployments/{deploymentId}/preview` | `202` preview task; repeat returns original task |
| `POST /v1/modpack-deployments/{deploymentId}/apply` | `202` apply task; requires accepted preview hash |
| `POST /v1/modpack-deployments/{deploymentId}/rollback` | `202` rollback task to the manifest snapshot |

## Candidate state and idempotency rules

- Import state is `created -> uploaded -> validating -> valid|invalid`. Terminal reports are immutable.
- Deployment state is `created -> previewing -> ready -> applying -> applied|failed`, with `rolling_back -> rolled_back|rollback_failed` only after a successful apply attempt has a rollback snapshot.
- A deployment manifest is canonical JSON hashed with SHA-256. Once stored, it cannot be updated; a change creates a new `deploymentId` and manifest.
- Creation idempotency is scoped to `(accountId, serverId, operation, Idempotency-Key)` for at least 24 hours. Task retry keys additionally bind `deploymentId` and manifest hash.
- Validation fails the entire import for an unsafe ZIP entry, unresolved provider source, unsupported M4/M5 template tuple, or hash mismatch. It never partially deploys.
- Apply asks M5 to stage every config/data object and provider-resolved mod, verify all SHA-256 values, create `rollbackSnapshotId`, and atomically switch only after preparation succeeds.
- Failed prepare/apply leaves the last successful deployment active. Rollback restores config/data bytes and the prior mod set from the named snapshot, not only metadata.

## Archive policy

ZIP parsing must use a maintained parser with ZIP64 and central-directory validation. Limits are server configuration published in the create-import response and enforced again during validation. The validator rejects absolute/traversal paths, case-insensitive duplicates, symbolic links, encrypted entries, unsupported compression, excessive entry count, total uncompressed size, per-entry size, or compression ratio.

Only the format manifest plus payloads resolving to `config/**` or `data/**` are accepted. Embedded `.jar`, native executable, or script payloads are rejected. Mods are represented only by validated Modrinth or CurseForge project/file identifiers and server-resolved hashes; arbitrary download URLs are never part of the deployment manifest.

## Fixture index

| Fixture | Coverage |
| --- | --- |
| `fixtures/api.json` | success, validation error, missing session, cross-account access, idempotent retry, and state conflict |
| `fixtures/validation.json` | safe pack plus traversal, duplicate, symlink, executable, archive-limit, hash, source, and compatibility failures |
| `fixtures/tasks.json` | prepare/apply success, duplicate and out-of-order events, transient retry, staging failure, and missing rollback snapshot |

The fixtures use only fake identifiers, hashes, URLs, and timestamps. They contain no user token, signed provider URL, provider secret, or real customer data.# M9 modpack deployment v1 proposal

Status: module-local proposal; not a published shared contract.

Target publication location: `xmcl-web-api/contracts/m9/modpack-deployment/v1/`. The shared contract owner must review and publish these files before any Web API, launcher client, or page client treats the routes as authoritative.

## Contract identity

Contract ID: `m9.modpack-deployment.v1-proposal`.

M9 is the sole writer of imports, validation reports, immutable deployment manifests, deployment previews, and deployment task state. M9 never writes account, server, lease, worker-runtime, or template-matrix state.

## Consumed contracts

| Owner | Required input | Current status |
| --- | --- | --- |
| M1 | Verified XMCL session and its `accountId`; ownership is never accepted from request bodies. | Proposal documented in M1; no executable published version exists in this workspace. |
| M4 | Server ownership, `serverId`, deployment task coordination, and server `statusVersion`. | Consume `m4.server-control.v1-proposal` only in fixtures until publication. |
| M5 | Supported template matrix and worker staging/apply/rollback command result. | Documented module contract only; versioned executable schema remains required. |

M9 consumes no M3 balance or ledger contract and does not call provider APIs for server state. Source adapters may resolve only Modrinth project/version and CurseForge project/file identities.

## Idempotency and immutability

- Mutations require `Idempotency-Key`, scoped to the authenticated account and route operation, retained for at least the lifetime of the import or deployment.
- Completing an import, creating a deployment, previewing, applying, and rolling back return the original task/resource for an identical retry. A reused key with a different body returns `409 idempotency_key_reused`.
- A deployment manifest is generated once from a valid report and a pinned M4/M5 compatibility snapshot. No route updates it. A changed import or compatibility selection creates another deployment ID.
- Apply stages every config/data object and provider-resolved mod, verifies every SHA-256, then requests one atomic M5 switch. Failure preserves the previous successful deployment and snapshot.
- Rollback targets `rollbackSnapshotId` and restores config/data content through M5; it is not a metadata-only status change.

## Fixture index

| Fixture | Coverage |
| --- | --- |
| `fixtures/api.json` | Request/response success, session denial, ownership hiding, validation conflict, idempotent retry, and key misuse. |
| `fixtures/archive-validation.json` | Valid package, traversal, absolute/duplicate paths, symlink, executable/script, arbitrary URL, entry/size/ratio limits, and missing manifest. |
| `fixtures/source-resolution.json` | Modrinth and CurseForge success, unresolved source, provider outage, provider mismatch, and retry. |
| `fixtures/deployment-lifecycle.json` | Immutable manifest, incompatible template, preview, duplicate/out-of-order events, apply retry, hash mismatch, staging failure, state conflict, rollback success, and missing snapshot. |

No fixture contains a real session, provider token, signed upload URL, customer identifier, or executable payload.