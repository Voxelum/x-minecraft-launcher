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
| `GET`/`HEAD /v1/databases/mod-metadata/{db.sqlite,db.sqlite.sha1}`, `GET`/`HEAD /v1/databases/project-mapping/<locale>.sqlite.{gz,sha256}` | Mod metadata and project mapping databases, streamed from the bucket's `databases/` prefix | Mod identification and localized project names (see below) |
| `GET`/`POST /v1/curseforge/v1/...` (also `v2`) | CurseForge API proxy that adds the API key | Every CurseForge search, lookup and install (see below) |
| `POST /v1/rtc/official` | STUN and TURN credentials, one hour | Multiplayer |
| `GET /v1/packs`, `GET /v1/packs/{slug}`, `GET /v1/packs/{slug}/versions/{id}`, `GET`/`HEAD /v1/packs/files/{sha1}` | Vardrynn packs: list, detail, version manifest, uploaded files | Not consumed yet (see below) |
| `PUT /v1/packs/{slug}`, `POST /v1/packs/{slug}/versions`, `DELETE /v1/packs/{slug}/versions/{id}`, `PUT /v1/packs/files/{sha1}` | Publish packs (Bearer session of a listed publisher) | Not consumed yet |
| `GET /v1/account`, `DELETE /v1/account`, `GET /v1/account/identities`, `POST /v1/account/identities/{google,discord}/{authorize,complete}` | Account, deletion, identity linking | Account settings |

Remote flags are not applied yet. `kFlights` also holds security-relevant values such as `safeStorageEncryption`, so `/v1/config` needs an explicit allowlist before anything merges into it.

## Databases

The launcher downloads two read-only SQLite databases from this service: `mod-metadata` (maps a file's sha1 to its Modrinth and CurseForge project) and `project-mapping` (localized project names, one file per locale, `en` as the fallback). It fetches the checksum file first, then the database, and rejects a download whose checksum differs. A build without a service origin requests neither.

The Worker streams files from `<bucket>/databases/<name>/` with presigned GETs and serves only the names above. A missing file is 404 (a missing locale falls back to `en`); a storage failure is 503.

`.github/workflows/mirror-databases.yml` fills both buckets every day at 05:23 UTC, or on a manual run. It downloads the latest releases of `Voxelum/minecraft-mods-database` and `Voxelum/xmcl-commuity-content-i18n`, checks every file against its checksum with `scripts/vardrynn-mirror-databases.sh`, and uploads only the databases that changed (data first, then its checksum). Neither upstream repository declares a license; the mod database describes itself as data for launchers to use.

Setup (done 2026-11-06): the GitHub environment `databases` has no required reviewers, so the schedule can run, and holds `VARDRYNN_S3_{DEV,PROD}_{ACCESS_KEY_ID,SECRET_ACCESS_KEY}`. These are dedicated MinIO users with the policies `vardrynn-releases-{dev,prod}-databases`: they can read, write and delete only `databases/*` in their own bucket. Checked from outside: writes elsewhere in the bucket, reading `latest.json`, listing the bucket root and writing to the other bucket are all refused. The bucket and endpoint variables are the repository variables the release job already uses. The Workers read with their existing read-only pair.

Deployment (2026-11-06): both buckets were filled by running `scripts/vardrynn-mirror-databases.sh` locally with these keys (mod database release `v25`, translations `v12`; a second run skipped every file as unchanged). `vardrynn-api-dev` and `vardrynn-api` were uploaded through the Scripts API from the committed `worker.js`, `accounts.js` and `multiplayer.js`, with every binding and secret unchanged. On both origins `/v1/status` is 200, account and room routes are 401 without a session, the full `db.sqlite` download and the `en` and `zh-cn` mapping files match their checksums, and unknown names are 404. The scheduled workflow starts running once this branch is on `master`; GitHub only schedules or dispatches workflows from the default branch.

## CurseForge proxy

The launcher holds no CurseForge API key. The main process's CurseForge client uses `<origin>/v1/curseforge` as its server, and renderer requests to `api.curseforge.com` are rewritten to the same place by `pluginApiFallback`. The Worker (`vardrynn-service/curseforge.js`) forwards only `/v1/` and `/v2/` CurseForge API paths, adds the `CURSEFORGE_API_KEY` secret, passes only `accept` and `content-type` upstream, limits POST bodies to 1 MB, and does not follow redirects. `CURSEFORGE_RATE_LIMITER` allows 300 requests per minute per client address (namespaces `1005` dev, `1006` production). File downloads come from CurseForge's CDN and need no key. A build without a service origin has no CurseForge access.

Deployed 2026-11-06 to both Workers with the key from Infisical (`CURSEFORGE_API_KEY`). Checked on both origins: a game lookup, a search and a fingerprint POST return 200; other paths return 404. To rotate the key, set the Worker secret again; no launcher release is needed.

## Packs

Code: `vardrynn-service/packs.js`; tables `packs` and `pack_versions` in `schema.sql`, on the same D1 database as accounts. A pack's mods can come from Modrinth and CurseForge in the same version, which neither site's own pack format allows.

A version's manifest is the launcher's instance manifest (`InstanceManifest` in `packages/instance/files.ts`): `runtime` plus `files`. Each file needs a `sha1` and at least one source: `modrinth` (`projectId`, `versionId`), `curseforge` (`projectId`, `fileId`) or `https` `downloads`. Files on neither site, such as configs, are uploaded to this service and listed by their `/v1/packs/files/{sha1}` URL. Publishing rejects paths that are absolute, contain `..`, `\` or `:`, repeat (case-insensitively), or name launcher files (`instance.json`, `instance-lock.json`, `unresolved-files.json`, `.install*`).

| Route | Behavior |
| --- | --- |
| `GET /v1/packs?q=` | Packs with at least one version, newest version first, up to 100; `q` matches the title |
| `GET /v1/packs/{slug}` | Pack with description and versions (no manifests); 404 until the first version is published |
| `GET /v1/packs/{slug}/versions/{id}` | One version with its manifest |
| `GET`/`HEAD /v1/packs/files/{sha1}` | Uploaded file streamed from `packs/files/{sha1}` in the bucket; cached as immutable |
| `PUT /v1/packs/{slug}` | Create or update title (1-100), `summary` (300), `description` (20,000), `iconSha1` (an uploaded file) |
| `POST /v1/packs/{slug}/versions` | `version` (letters, digits, `.+_-`, up to 64), `changelog`, `manifest`; 409 if the version exists; JSON bodies are limited to 1 MB |
| `DELETE /v1/packs/{slug}/versions/{id}` | Removes a version |
| `PUT /v1/packs/files/{sha1}` | Raw body up to 50 MB; 400 `hash_mismatch` unless its SHA-1 is the name |

Write routes require a session whose account is listed in the Worker setting `PACK_PUBLISHER_ACCOUNT_IDS` (comma-separated); without it nobody can publish. A pack belongs to the account that created it. Invalid manifests return 400 `invalid_manifest` with a `detail` naming the problem. Without `DB` the pack routes return 503 `packs_unconfigured`; without the S3 read settings files return 503 `pack_storage_unavailable`, and uploads also need `S3_PACKS_ACCESS_KEY_ID` and `S3_PACKS_SECRET_ACCESS_KEY`. The slug `files` is reserved.

Download URLs in a manifest are fetched by every player who installs the pack, so only publishers can add them. Public routes are not rate limited, like the database routes.

Deployment (not done yet):
- Apply `schema.sql` to `vardrynn-accounts-dev` and `vardrynn-accounts-prod`. It only adds tables.
- Create a MinIO user per bucket that can read and write only `packs/*`, like the `databases/*` users, and set its keys as `S3_PACKS_ACCESS_KEY_ID` and `S3_PACKS_SECRET_ACCESS_KEY` on each Worker.
- Set `PACK_PUBLISHER_ACCOUNT_IDS` on each Worker. Production needs a sign-in first to create the account.
- Upload `s3.js` and `packs.js` with the other modules, keeping every existing binding.

## Offline behavior

| State | Meaning | Behavior |
| --- | --- | --- |
| `unconfigured` | No valid origin in this build | No service request is made |
| `unreachable` | Network failure, timeout, redirect or 5xx | Online features fail; local features continue |
| `incompatible` | 4xx, or a body outside the contract | As unreachable; the launcher needs updating |
| `ok`, `degraded`, `maintenance` | Reported by the service | Shown as reported |

The status request times out after five seconds and refuses redirects, so a response cannot move the launcher off the approved origin. Nothing at startup waits on the service. Account calls and Modrinth sign-in fail with `vardrynn_service_unconfigured`, and Modrinth sign-in does so before opening the browser. Community translation and news return empty results.

## Not covered here

Monitoring and backups do not exist yet. The Worker stores nothing itself; the release route reads an optional R2 binding. Other contract routes return 404. The only hard-coded XMCL origin left is `BUILTIN_AGENT_ENDPOINT` (phase 8), still blocked by the phase 1 guard.

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

Not in scope: paid relay, billing and entitlements. The XMCL billing views are gone from the multiplayer screen and the launcher refuses the billing calls. Development deployment (2026-11-06): `vardrynn-api-dev` was uploaded through the Scripts API from the committed `worker.js`, `accounts.js` and `multiplayer.js`, keeping every existing binding and secret. It added the `MULTIPLAYER_ROOMS` Durable Object (migration `v1`, `new_sqlite_classes`), the `MULTIPLAYER_RATE_LIMITER` binding (namespace `1003`, 30 requests per 60 seconds) and a random `ROOM_TICKET_SECRET`. That secret exists only in the Worker, because the Infisical identity is read-only; rotate it by setting a new value. No TURN key is set, so `/v1/rtc/official` offers STUN only. Checked on `dev-api.olaveapi.com`: `/v1/status` 200; `POST /v1/rtc/official` and `POST /v1/multiplayer/rooms` 401 without a session; `GET .../socket` without an upgrade 426 (the room object answered); `/v1/account` 401. Not run on Cloudflare: a room with two real signed-in clients. A local two-client run (`vardrynn-service/multiplayer-smoke.mjs`, 26 checks, throwaway local database) passed and found a replayed-ticket bug, fixed in `e846aebc6` and redeployed to development on 2026-11-06 with all bindings and secrets unchanged. Production (2026-11-06): `vardrynn-api` was uploaded the same way with the `MULTIPLAYER_ROOMS` object (migration `v1`), `MULTIPLAYER_RATE_LIMITER` (namespace `1004`, 30 per 60 seconds) and its own random `ROOM_TICKET_SECRET`; all existing bindings and secrets were unchanged. Checks on `api.olaveapi.com` matched development. No TURN key is set. Not yet run: a room with two real accounts on different networks.
