# M5 launcher runtime v1 proposal

Status: module-local proposal. No M5 public runtime/log contract is published in
this workspace.

Contract ID: `m5.launcher-runtime.v1-proposal`.

This proposal consumes the published shared-contract baseline
`xmcl-web-api/contracts/shared/v1` indirectly through the M4 public
control-plane API. It never produces usage, resolves an authorization, or
handles the D5 stop escalation; those remain server-side M5/M3/M4
responsibilities.

The launcher consumes only authenticated public control-plane APIs:

- `GET /v1/servers/{serverId}` for the M4-owned server status and connection
  address.
- `GET /v1/servers/{serverId}/logs` for cursor-paged cloud-server logs.

It never calls `/v1/internal/**`. Worker tokens, leases used as credentials, and
provider credentials are not represented in the launcher contract or fixtures.
`source: "cloud_server"` is mandatory on remote log records so renderer code
cannot confuse them with launcher/client logs.

The status response remains the M4 `ServerResource`; M4 is its sole writer. The
client retains the highest `statusVersion` seen and deduplicates log retries by
`logId`. This proposal adds no server-side state or pricing decision.
