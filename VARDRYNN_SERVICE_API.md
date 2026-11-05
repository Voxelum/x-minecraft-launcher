# Vardrynn service API (phase 4)

This is the launcher's contract with the Vardrynn service. Its types live in `xmcl-runtime-api/src/services/VardrynnApi.ts`. The service domain is `olaveapi.com`. Both services run from `vardrynn-service/worker.js`. Development also has `GET /v1/releases/latest`, which reads the S3 release bucket (code merged, not yet deployed; the deployed version returns 404 with no storage). Production still runs the status-only version:

| Environment | Origin | Cloudflare Worker |
| --- | --- | --- |
| Production | `https://api.olaveapi.com` | `vardrynn-api` |
| Development | `https://dev-api.olaveapi.com` | `vardrynn-api-dev` |

Builds are unconfigured unless `VARDRYNN_API_BASE_URL` is set. Production is deliberately not the default yet: account calls, Modrinth sign-in and community translation would then reach routes that return 404, instead of failing predictably as unconfigured. Make it the default once those routes exist.

## Endpoint selection

The origin comes from `VARDRYNN_API_BASE_URL` when the main bundle is built. It is compiled in, so a packaged build does not read it from the user's environment. `pluginFlights` validates it once and publishes the result as the local `vardrynnApiBaseUrl` flight; no remote source can set that flight.

| Build | Accepted origin |
| --- | --- |
| Production | `https://` origin with no path, query or credentials |
| Development | The same, or `http://` on `127.0.0.1`, `localhost` or `[::1]` |

An XMCL host is rejected like any other invalid value. Missing or rejected values leave the service unconfigured, with no default and no XMCL fallback. A rejected value logs a warning.

```sh
VARDRYNN_API_BASE_URL=https://<approved-origin> pnpm --prefix=xmcl-electron-app compile
```

## Contract

All paths are versioned. A breaking change takes a new prefix; `v1` responses carry `apiVersion: "v1"`, and additive fields are allowed. The launcher treats any other version as incompatible.

| Route | Purpose | Launcher use |
| --- | --- | --- |
| `GET /v1/status` | `state` of `ok`, `degraded` or `maintenance`, optional `message` | Settings > About |
| `GET /v1/config` | Remote `flags` | Not consumed; needs an allowlist first (see below) |
| `GET /v1/news` | `items`; query carries `version`, `os`, `arch`, `env`, `build`, `locale` | `useLauncherNews`, not yet shown in the UI |
| `GET /v1/releases/latest` | Version, channel, assets with `sha256` and `signature` | Launcher updater (see `VARDRYNN_RELEASES.md`); deployed to development only |
| `POST /v1/sessions`, `GET /v1/sessions/current`, `DELETE /v1/sessions/current` | Launcher account session | Phase 6 |

Remote flags are not applied yet. `kFlights` also holds security-relevant values such as `safeStorageEncryption`, so `/v1/config` needs an explicit allowlist before anything merges into it.

## Offline behavior

| State | Meaning | Behavior |
| --- | --- | --- |
| `unconfigured` | No valid origin in this build | No service request is made |
| `unreachable` | Network failure, timeout, redirect or 5xx | Online features fail; local features continue |
| `incompatible` | 4xx, or a body outside the contract | As unreachable; the launcher needs updating |
| `ok`, `degraded`, `maintenance` | Reported by the service | Shown as reported |

The status request times out after five seconds and refuses redirects, so a response cannot move the launcher off the approved origin. Nothing at startup waits on the service. Account calls and Modrinth sign-in fail with `vardrynn_service_unconfigured`, and Modrinth sign-in does so before opening the browser. Community translation and news return empty results.

## Not covered here

Monitoring and backups do not exist yet. The Worker stores nothing itself; the release route reads an optional R2 binding. Other contract routes return 404. Remaining hard-coded XMCL origins are assigned to later phases and stay blocked by the phase 1 guard: `BUILTIN_AGENT_ENDPOINT` (phase 8), and the Ely.by helper and metadata database proxy (phase 9).

## Verification on 2026-11-04

- Real development app with a temporary loopback stub: Settings > About showed `Degraded` from one `GET /v1/status`, then `Unreachable` once the stub stopped. No renderer console errors.
- Real development app without a configured origin: normal startup, `window.flights` empty, About showed `Not configured`.
- `pnpm check`, `pnpm lint`, the renderer build, production main compilation and `scripts/check-vardrynn-network.ts` passed. The stub origin does not appear in the production bundle.

- Deployed development service: `/v1/status` returned the contract body over TLS 1.3 with `cache-control: no-store`; unknown paths returned 404 and `POST` returned 405. Plain `http://` is also served, but the launcher only accepts `https://` origins outside loopback.
- Real development app built with `https://dev-api.olaveapi.com`: About showed `Available`. The app was then restored to unconfigured.

- Deployed production service: the same route checks passed over TLS 1.3, pinned to Cloudflare's address because a local resolver still held a cached NXDOMAIN (zone negative TTL is 1800 seconds).
- Real development app built with `https://api.olaveapi.com`, with `--host-resolver-rules` for the same reason: About showed `Available`. The app was then restored to unconfigured.

Not verified: an origin set in a packaged build, Windows and Linux.

- Release route deployed to `vardrynn-api-dev` by direct Scripts API upload. The deployed script matched the committed source. `/v1/status` returned 200; `/v1/releases/latest` returned 404 with no binding and 405 for `POST`, both `no-store`. The 200 and 503 release responses have not run on Cloudflare. Production's script and both domain bindings were unchanged.
