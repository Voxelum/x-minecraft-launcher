# Vardrynn service API (phase 4)

This is the launcher's contract with the Vardrynn service. Its types live in `xmcl-runtime-api/src/services/VardrynnApi.ts`. The service domain is `olaveapi.com`. Both services run from `vardrynn-service/worker.js`, including `GET /v1/releases/latest`, which serves the signed manifest from that environment's S3 bucket (`vardrynn-releases-dev` or `vardrynn-releases-prod`; see `VARDRYNN_RELEASES.md`):

| Environment | Origin | Cloudflare Worker |
| --- | --- | --- |
| Production | `https://api.olaveapi.com` | `vardrynn-api` |
| Development | `https://dev-api.olaveapi.com` | `vardrynn-api-dev` |

Builds are unconfigured unless `VARDRYNN_API_BASE_URL` is set. Since 2026-11-06 the GitHub variable `VARDRYNN_API_BASE_URL` is `https://api.olaveapi.com`, so CI production builds use the production service (dev test releases use `VARDRYNN_DEV_API_BASE_URL`). Account routes exist there; Modrinth sign-in and community translation still reach routes that return 404, so they fail as incompatible rather than unconfigured.

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
| `GET /v1/auth/{google,discord}/authorize`, `POST /v1/auth/{google,discord}/exchange`, `GET /v1/auth/discord/callback` | Browser PKCE sign-in; redirect must be `http://127.0.0.1:<port>/commercial-auth` | Account sign-in |
| `POST /v1/auth/microsoft/launcher-exchange` | Exchanges a Graph token for a session; links when called with a session | Account sign-in |
| `POST /v1/sessions/refresh`, `POST /v1/sessions/revoke`, `GET /v1/sessions/current` | Rotating refresh, sign-out (one or all devices) | Account session |
| `POST /v1/multiplayer/rooms`, `POST /v1/multiplayer/rooms/{id}/join`, `DELETE /v1/multiplayer/rooms/{id}`, `GET /v1/multiplayer/rooms/{id}/socket` (WebSocket) | Room admission, host-only close, signaling | Multiplayer (Bearer session; the socket takes a one-minute ticket) |
| `POST /v1/rtc/official` | STUN and TURN credentials, one hour | Multiplayer |
| `GET /v1/account`, `DELETE /v1/account`, `GET /v1/account/identities`, `POST /v1/account/identities/{google,discord}/{authorize,complete}` | Account, deletion, identity linking | Account settings |

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

## Accounts (phase 6)

Code: `vardrynn-service/accounts.js`; storage: `vardrynn-service/schema.sql` on a D1 database bound as `DB`. Without `DB` every account route returns 503 `accounts_unconfigured`.

Provisioned 2026-11-05: development Worker `vardrynn-api-dev` binds `vardrynn-accounts-dev` (`e6ed2673-e806-4070-b77e-a398d55984ce`) as `DB`; production Worker `vardrynn-api` binds `vardrynn-accounts-prod` (`e1cb502c-01bc-4b65-90d3-7d613242e5e1`) as `DB`. Both have all four tables and three indexes from `schema.sql`. Existing S3 settings and secrets were preserved. This provision did not upload Worker source. Preserve these bindings on future deployments.

Worker settings: secrets `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, and `MICROSOFT_CLIENT_ID` (the same value the launcher builds in as `VARDRYNN_MICROSOFT_CLIENT_ID`). An unset provider returns 503 `provider_unconfigured`. Register `http://127.0.0.1` loopback redirects (`/commercial-auth`) with Google and Discord.

Google uses a native desktop client with loopback support. Discord app `1568042963743805582` matches redirect URIs exactly, and the launcher's port moves (25555, then +7) when another launcher such as XMCL holds it. Discord therefore returns to this service at `GET /v1/auth/discord/callback`, which forwards `code` and `state` to the loopback address stored with the transaction. Register `https://dev-api.olaveapi.com/v1/auth/discord/callback` and `https://api.olaveapi.com/v1/auth/discord/callback` with Discord; the loopback URIs registered earlier are no longer used. Set `PUBLIC_ORIGIN` on a Worker only if it is reached through another host. Builds also read GitHub variable `VARDRYNN_DISCORD_APP_ID` for Discord presence (the same application ID). Microsoft public desktop app `fb0d7ac0-f0ff-426f-bad8-63d3863e8aa2` registers `http://localhost/auth` for personal Microsoft accounts. All five settings are authoritative in `homelab prod /dev-platform/vardrynn/{dev,prod}` and installed on both Workers. GitHub repository variable `VARDRYNN_MICROSOFT_CLIENT_ID` and the local ignored build environment contain the same Microsoft client ID.

Behavior:
- Sessions are opaque Bearer tokens (15 minute access, 30 day rotating refresh), stored as SHA-256 hashes. Replaying a rotated refresh token revokes the session. The launcher's DPoP binding is not used yet.
- One provider identity belongs to one account. Signing in with a linked identity restores the account; a new identity creates one.
- Linking an identity that belongs to another account returns 409 `identity_conflict`. Account merge routes do not exist, and old XMCL accounts are not imported.
- `DELETE /v1/account` erases identities and revokes all sessions at once. Recovery is signing in again with any linked provider; there are no passwords.
- Billing and subscription routes (`/v1/xmcl-plus/*`, `/v1/billing/*`) do not exist; the launcher refuses them locally with `billing_unavailable`.
- Microsoft sign-in sends the ID token from the launcher's MSAL sign-in. The service verifies the RS256 signature against Microsoft's consumer keys (`login.microsoftonline.com/consumers/discovery/v2.0/keys`, cached for an hour and refetched for an unknown `kid`), the issuer and `tid` of the personal-account tenant, `aud` = `MICROSOFT_CLIENT_ID`, and `exp`/`nbf` with five minutes of skew. A Graph access token is rejected. The identity subject is the personal account's Graph user id (the last 16 hex digits of `oid`), matching identities stored before this change.
- `/v1/auth/*` and `/v1/sessions/refresh` are limited per `cf-connecting-ip` by the `AUTH_RATE_LIMITER` Workers rate-limit binding: 20 requests per 60 seconds, namespace `1001` on development and `1002` on production. Over the limit returns 429 `rate_limited` with `retry-after: 60`. Cloudflare counts per location and approximately. Without the binding requests are not limited. Deployments must keep this binding along with `DB`, the secrets and the S3 settings.

Open: Modrinth identity is not supported; account merging is not supported; the launcher's DPoP binding is unused; monitoring and backups of the D1 databases do not exist.

### Development deployment and sign-in check (2026-11-06)

`vardrynn-api-dev` runs `worker.js` and `accounts.js` from `cbfaf6d96`, uploaded by the Scripts API with `keep_bindings` for `d1`, `secret_text` and `plain_text`. A settings read before and after showed identical bindings: `DB`, the five OAuth secrets and the five S3 settings. Production (`vardrynn-api`) was not changed.

Route checks on `https://dev-api.olaveapi.com`: `/v1/status` 200, `/v1/account` without a token 401, Google `authorize` returned Google's URL with the launcher's own loopback redirect, Discord `authorize` returned the service callback as redirect, the callback 302'd to the stored loopback port, a non-loopback redirect returned 400 `invalid_redirect_uri`, and a bad Microsoft token 401 `provider_rejected`.

Real development launcher (`dev:main` with `VARDRYNN_API_BASE_URL=https://dev-api.olaveapi.com`, renderer on port 3010 because 3000 was taken), driven through the account service's IPC channel because no Vardrynn screen mounts the account panel yet (the multiplayer login dialog is disabled until phase 7):
- Discord sign-in created an account (6.5 s); Google then linked by browser (14.6 s) and Microsoft by the in-app window (15.9 s), all on one account (`discord/web_link`, `google/web_link`, `microsoft/launcher_link`).
- `refreshSession` extended the session; `getTogetherOverview` failed locally with `billing_unavailable`.
- `revokeSession` cleared the main-process credential (`refreshAccount` then failed with `xmcl_account_session_missing`). Signing in with Discord again restored the same account with a new session and all three identities.
- After restarting Electron, the stored session loaded and `refreshAccount` succeeded.

Found: after sign-out, re-reading the account state returned the old account and session IDs. The preload reused its cached state object with `Object.assign`, which cannot clear fields that became `undefined`; it now drops absent fields (fixed with the account screen below). The test account (your Discord, Google and Microsoft identities) remains in `vardrynn-accounts-dev`.

### Account screen (2026-11-06)

Settings > Vardrynn account (`XmclAccountPanel.vue`) shows the account, session (refresh, sign out this device, sign out all devices), the Microsoft, Google and Discord sign-in methods with their display names, and account deletion behind a confirmation dialog (`DELETE /v1/account`). It shows a notice instead of sign-in buttons when the build has no service origin. Modrinth sign-in and account merging are not offered; an identity that belongs to another account shows a conflict notice. Only the English strings are updated.

Real development launcher at 1200x720: the signed-in screen showed all three methods; Sign out this device switched it to the signed-out view; Sign in with Discord restored the account; Refresh, and opening and cancelling the delete dialog, worked; no renderer console errors. At an emulated 800x400 viewport the cards stack and the method buttons fit without horizontal overflow. Not exercised: confirming deletion (it would delete your dev account), sign out all devices, and the unconfigured notice.

### Hardening and production deployment (2026-11-06)

Both Workers run `worker.js` and `accounts.js` from `d6d62f030`, uploaded with `keep_bindings` for `d1`, `secret_text` and `plain_text` plus the new `AUTH_RATE_LIMITER` binding. Settings reads before and after showed that binding as the only change; production `DB` is `vardrynn-accounts-prod`.

- Development: a sequential run of 30 sign-in requests from one address was not limited; a parallel burst of 80 returned 28 × 200 and 52 × 429. A raw Graph token returned 401 `provider_rejected`. In the real development launcher, signing out and then using Sign in with Microsoft (ID token path, 26 s) restored the existing account with all three methods, confirming the subject mapping. Sign out all devices returned to the signed-out view, and Discord sign-in restored the account. No renderer console errors.
- Production (`https://api.olaveapi.com`): `/v1/status` 200, `/v1/account` 401 without a token, `/v1/releases/latest` 404 (empty bucket, unchanged), Google `authorize` used the launcher's loopback redirect, Discord `authorize` used `https://api.olaveapi.com/v1/auth/discord/callback`, the callback 302'd to the stored loopback port, and a Graph token returned 401. No real sign-in has been made against production, and no production build has been published with it.

## Multiplayer (phase 7)

`vardrynn-service/multiplayer.js` holds the routes and the `MultiplayerRoom` Durable Object. The Worker authenticates the Bearer session, rate-limits per account and forwards to the room object named by the room ID. Peers carry game traffic directly or through TURN; the service relays only signaling.

| Binding | Purpose |
| --- | --- |
| `MULTIPLAYER_ROOMS` | Durable Object namespace for class `MultiplayerRoom` (needs a `new_sqlite_classes` or `new_classes` migration) |
| `ROOM_TICKET_SECRET` | Secret that signs socket tickets. Without it every multiplayer route answers 503 `multiplayer_unconfigured` |
| `MULTIPLAYER_RATE_LIMITER` | Optional Workers rate limiter, keyed by account |
| `TURN_KEY_ID`, `TURN_API_TOKEN` | Optional Cloudflare Realtime TURN key. Without them `/v1/rtc/official` offers STUN only (`STUN_URLS`, default `stun:stun.cloudflare.com:3478`) |

Rules enforced by the room object: 2 to 16 members (default 8); one connection per account (a newer one replaces the older, close code 4001); tickets are signed, expire after 60 seconds and seat the peer once; messages over 64 KiB or above 20 per second (burst 60) close the socket; signals are rebuilt field by field, members may signal only the host, and a shared TURN server must be a `turn:`/`turns:` URL. The host can remove a member (close code 4003, no rejoin) or hand over the role to a connected member. If the host's socket drops the room waits 60 seconds for it to return, then closes (4000); rooms also close 24 hours after creation, and closed records are deleted after an hour. Sockets are plain, not hibernating, so an open room is billed as an active Durable Object.

The launcher refuses room and relay requests without a signed-in account (`multiplayer_sign_in_required`) and sends them only to the configured origin. Multiplayer telemetry is removed: diagnostics stay in the local log.

Not in scope: paid relay, billing and entitlements. The XMCL billing views are gone from the multiplayer screen and the launcher refuses the billing calls. Development deployment (2026-11-06): `vardrynn-api-dev` was uploaded through the Scripts API from the committed `worker.js`, `accounts.js` and `multiplayer.js`, keeping every existing binding and secret. It added the `MULTIPLAYER_ROOMS` Durable Object (migration `v1`, `new_sqlite_classes`), the `MULTIPLAYER_RATE_LIMITER` binding (namespace `1003`, 30 requests per 60 seconds) and a random `ROOM_TICKET_SECRET`. That secret exists only in the Worker, because the Infisical identity is read-only; rotate it by setting a new value. No TURN key is set, so `/v1/rtc/official` offers STUN only. Checked on `dev-api.olaveapi.com`: `/v1/status` 200; `POST /v1/rtc/official` and `POST /v1/multiplayer/rooms` 401 without a session; `GET .../socket` without an upgrade 426 (the room object answered); `/v1/account` 401. Not run on Cloudflare: a room with two real signed-in clients. A local two-client run (`vardrynn-service/multiplayer-smoke.mjs`, 26 checks, throwaway local database) passed and found a replayed-ticket bug, fixed in `e846aebc6` and redeployed to development on 2026-11-06 with all bindings and secrets unchanged. Production is not deployed.
