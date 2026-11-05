# Vardrynn service API (phase 4)

This is the launcher's contract with the Vardrynn service. Its types live in `xmcl-runtime-api/src/services/VardrynnApi.ts`. No service is deployed yet. The service domain is `olaveapi.com` (decided 2026-11-04); the exact API hostname, the infrastructure owner and TLS/deployment are still open, so every build is currently unconfigured until `VARDRYNN_API_BASE_URL` is set to the chosen origin.

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
| `GET /v1/releases/latest` | Version, channel, assets with `sha256` and `signature` | Phase 5 |
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

Deployment, TLS, monitoring, backups and failure handling on the server side do not exist yet and need the domain and owner decisions. Remaining hard-coded XMCL origins are assigned to later phases and stay blocked by the phase 1 guard: `BUILTIN_AGENT_ENDPOINT` (phase 8), and the Ely.by helper and metadata database proxy (phase 9).

## Verification on 2026-11-04

- Real development app with a temporary loopback stub: Settings > About showed `Degraded` from one `GET /v1/status`, then `Unreachable` once the stub stopped. No renderer console errors.
- Real development app without a configured origin: normal startup, `window.flights` empty, About showed `Not configured`.
- `pnpm check`, `pnpm lint`, the renderer build, production main compilation and `scripts/check-vardrynn-network.ts` passed. The stub origin does not appear in the production bundle.

Not verified: a deployed service, TLS, an origin set in a packaged build, Windows and Linux.
