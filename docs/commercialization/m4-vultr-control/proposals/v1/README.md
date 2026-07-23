# M4 server control v1 proposal

Status: module-local proposal. These files are not published shared contracts.

Publication proposal location: `xmcl-web-api/proposals/m4/`. Only the shared
contract owner may promote it into `contracts/`.

## Inputs

- M1 account/session v1 proposal: use the authenticated `accountId` from the verified XMCL session. M4 never accepts a caller-supplied account owner.
- Shared v1 D2/D3: M4 requests/releases M3 `server_time` authorization; M5 is
  the sole `usage.recorded.v1` producer. M4 never reads or writes a balance,
  ledger, or canonical usage event.
- Shared v1 D1/D4: M2 owns the fixed 1 GiB policy and M6 owns storage
  accounting. M4 only asks M6 to confirm deletion; it never writes storage
  policy/accounting.

`xmcl-web-api/contracts/shared/v1/` is authoritative for D1-D6 and is consumed
read-only by this proposal.

## Outputs and ownership

Contract ID: `m4.server-control.v1-proposal`.

M4 is the sole writer of `ServerResource`, M4 `AsyncTask`, `ServerLease`, provider reconciliation state, and Vultr resource identifiers. Public server responses omit provider resource identifiers and provider error bodies. M5 reports observations and usage; M7 requests operations; neither writes M4 resources.

The launcher and page consume the mounted public API through M1 sessions; they
do not retain provider credentials or write server state.

## D5: shared 300-second stop escalation

- M3 returns `stop_required` to M5; M5 stops Minecraft and publishes the
  shared `runtime.stopped.v1` event with `reason: "balance_exhausted"`.
- M4 records the persisted settlement observation, waits **300 seconds** for
  that runtime event, then force-halts the provider, closes the lease, and
  records `worker_unresponsive` if it is absent.
- The shared runtime event closes the lease at its observed stop time and
  transitions the server to stopped with `balance_exhausted`.
- Duplicate timeout deliveries reuse the task idempotency key and expected `statusVersion`; they must not close a lease twice or issue an untracked provider command.

This implements shared decision D5; the M4 sweep adapter makes timeout delivery
durable and deterministic.

## D6: admin command proposal

M4 consumes shared `admin.operation.requested.v1` only for `server_suspend`
and `server_restore`, deduplicated by `operationId`. M7 remains owner of
`AdminOperation`; M4 records one shared `admin.operation.completed.v1` event
with `owner: "m4"` and owns any resulting M4 task/state transition.

- `server_suspend` sets `desiredStatus` to `stopped`, follows the M4 stop
  path, then enters `suspended`.
- `server_restore` conditionally moves `suspended` to `stopped`; it never
  starts the server or billing. A later user start obtains fresh M3
  authorization.
- Requests use the shared target, requestedBy, reason, optional ticketId, and
  operationId fields. Duplicate requests return the recorded completion;
  unsupported/state-conflicting operations complete as `rejected`.

This consumes shared decision D6 directly.

## Fixture coverage

- `fixtures/api.json`: success, unauthenticated, forbidden, idempotent replay, state conflict, M3 rejection, quota failure, and ambiguous provider timeout.
- `fixtures/state-machine.json`: duplicate and stale observations, concurrent commands, worker timeout, balance exhaustion, and admin suspension.
- `fixtures/admin-events.json`: suspend/resume, duplicate delivery, stale version, and completion events.