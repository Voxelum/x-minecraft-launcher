# Vardrynn independence plan

Status: phases 1, 2 and 3 implemented with macOS validation on 2026-11-04; Windows/Linux qualification remains open. The launcher side of phase 4 is implemented, and development and production status services are deployed. The launcher and CI side of phase 5 is implemented; hosting, signing keys and platform qualification are open. Phase 6 is implemented and deployed to development and production (`vardrynn-service/accounts.js` on D1; Microsoft, Google and Discord sign-in; Settings > Vardrynn account): its acceptance check passed on development with real sign-ins; see `VARDRYNN_SERVICE_API.md`. Phase 7 is implemented in code (rooms, signaling and ICE routes plus launcher wiring) but not deployed or tested with two real clients. Later phases remain proposed. This document records the implementation sequence; it does not authorize a release or service deployment.

## Goal

Ship a Vardrynn launcher that can install alongside XMCL, imports existing data only by an explicit user choice, and does not contact XMCL-operated infrastructure or install XMCL releases. Vardrynn will own its launcher-specific online features. Minecraft, Microsoft, Modrinth, CurseForge, and similar content providers remain external where their features require them.

Keep the original project's MIT notice and clear attribution. The local `@xmcl/*` package namespace identifies upstream libraries and does not itself make a network request.

## Implementation phases

### 1. Cut unsafe upstream ties

- Disable XMCL update discovery, downloads, and install paths in Vardrynn builds before distribution. Clear or ignore persisted XMCL update information.
- Replace the remote feature-flag fetch with local defaults until a Vardrynn endpoint exists. Do not silently fall back to XMCL.
- Remove XMCL Azure telemetry exporters. Keep diagnostics local initially; add an opt-in Vardrynn destination only after defining the data policy.
- Disable or clearly mark online features that still need XMCL services. Stop XMCL news and other incidental XMCL API requests.
- Add a network destination inventory and a focused check that fails if a Vardrynn build contains active XMCL service URLs.

Acceptance: startup and ordinary local workflows make no requests to XMCL hosts, and no XMCL update can be offered or installed.

Implementation and verification: see `VARDRYNN_NETWORK_DESTINATIONS.md`. The development app and isolated production bundle passed their captured-traffic checks. This is not a signed installer or cross-platform release qualification; those checks remain in phases 2, 5, and 10.

Relevant code: `xmcl-runtime/app/BaseService.ts`, `xmcl-electron-app/main/utils/updater.ts`, `xmcl-runtime/infra/plugins/flights.ts`, `xmcl-runtime/infra/plugins/telemetry.ts`, `xmcl-runtime/infra/telemetry_resource.ts`.

### 2. Establish app identity

- Replace packaged product name, app IDs, executable and artifact names, protocol registration, OS metadata, and installer identities.
- Produce Vardrynn icons for app, dock, tray, Windows tile, and package formats from the approved artwork. Validate legibility at small sizes.
- Replace general XMCL branding in the UI and translations while preserving names that refer to an actual XMCL service or credit the upstream project.
- Keep Vardrynn and XMCL installable side by side. Do not reuse identifiers that could take over XMCL's shortcuts, protocol, or package manager records.

Acceptance: packages on supported platforms identify as Vardrynn and coexist with XMCL.

Implementation and macOS smoke evidence: see `VARDRYNN_APP_IDENTITY.md`. Independent profile/game directories are established as a coexistence prerequisite; no XMCL import is performed. Signed installers and Windows/Linux installation runs remain unqualified.

Relevant code: `xmcl-electron-app/build/electron-builder.config.ts`, `xmcl-electron-app/icons/`, `xmcl-electron-app/build/linux/`, `xmcl-keystone-ui/locales/`.

### 3. Migrate local data safely

- Give Vardrynn its own application-data and secret-storage directories.
- On first run, detect existing XMCL data and offer an import preview. Copy compatible settings, instances, account references, and the game-data root pointer; never move or delete the XMCL source.
- Treat encrypted secrets, browser storage, protocol links, backup formats, and stale update metadata separately. Require reauthentication where secrets cannot be imported safely.
- Make the import resumable and idempotent. Record a migration version and a rollback path.

Acceptance: cancel, import, retry, and rollback preserve the XMCL source; both launchers open independently and imported instances work.

Implementation, evidence and open qualification: see `VARDRYNN_DATA_MIGRATION.md`. Fixture-based validation only; real-profile rehearsal belongs to phase 10.

Relevant code: `xmcl-runtime/constant.ts`, `xmcl-runtime/app/LauncherApp.ts`, `xmcl-runtime/setup/xmclImport.ts`, `xmcl-electron-app/main/ElectronLauncherApp.ts`.

### 4. Build Vardrynn's service base

- Define a versioned API contract for configuration, news, releases, account sessions, and service status.
- Establish development and production endpoints with TLS, deployment, monitoring, backups, and failure behavior.
- Replace XMCL endpoint defaults and remote flags with Vardrynn endpoints. An invalid or unreachable Vardrynn endpoint must not fall back to XMCL.
- Keep offline launcher functions usable when the service is unavailable.

Acceptance: development and production builds resolve only approved Vardrynn service destinations; offline behavior is predictable.

Implementation and open work: see `VARDRYNN_SERVICE_API.md`. Launcher contract, endpoint selection and offline behavior are done, and `api.olaveapi.com` and `dev-api.olaveapi.com` serve the status route. Monitoring, backups and the remaining routes are open.

Relevant code: `xmcl-runtime-api/src/services/VardrynnApi.ts`, `xmcl-runtime/app/vardrynnApiOrigin.ts`, `xmcl-runtime/app/pluginApiFallback.ts`.

### 5. Own releases and updates

- Publish signed packages, release metadata, and checksums from Vardrynn CI.
- Replace self-hosted update APIs, GitHub release URLs, npm mirror fallback, AppInstaller URLs, and package-manager metadata.
- Verify signatures and checksums before installation. Test upgrades and rollback on each supported platform.
- Remove upstream publication credentials, repositories, and pages from release automation.

Acceptance: each platform discovers, downloads, verifies, and installs a Vardrynn test release, with no upstream release path.

Implementation and open work: see `VARDRYNN_RELEASES.md`. Signed releases are hosted on Vardrynn's S3 buckets behind `api.olaveapi.com` and `dev-api.olaveapi.com`. CI signs with the production key and publishes. Packaged arm64 builds on macOS and Linux discovered, downloaded, verified and installed a test release in place. Open: the first CI run (needs this branch on `master`), production builds need `VARDRYNN_API_BASE_URL`, macOS notarization, and Windows signing.

Relevant code: `xmcl-electron-app/main/utils/updater.ts`, `xmcl-electron-app/main/utils/updateInstaller.ts`, `xmcl-runtime/app/vardrynnRelease.ts`, `scripts/vardrynn-release.ts`, `scripts/vardrynn-publish.sh`, `xmcl-electron-app/build/appinstaller-builder.ts`, `.github/workflows/build.yml`.

### 6. Own accounts and integrations

- Build Vardrynn account registration, sessions, recovery, and deletion. Keep launcher identity separate from Minecraft game accounts.
- Register Vardrynn OAuth applications and redirect URLs for supported identity providers; replace hard-coded application IDs.
- Register a Vardrynn Discord presence application if that feature remains.
- Reconcile existing XMCL account state during migration without claiming that an XMCL identity is already a Vardrynn identity.

Acceptance: new and migrated users can sign in, renew, sign out, and recover from failed authentication without XMCL services.

Relevant code: `xmcl-runtime/xmclAccount/`, `xmcl-runtime/user/pluginOfficialUserApi.ts`, `xmcl-runtime/presence/PresenceService.ts`.

Implementation (2026-11-06): the service issues rotating Bearer sessions, verifies Microsoft ID tokens and Google/Discord PKCE sign-ins (Discord through a fixed service callback), rate-limits unauthenticated routes and supports deletion and identity linking; merging is refused with a conflict. The launcher uses Vardrynn's own Microsoft and Discord application IDs and refuses XMCL Plus billing calls. XMCL account state is reconciled by never importing it: the importer copies only allowlisted settings, schema-filtered game accounts and game files, never XMCL's `secret` folder, so a migrated user starts signed out of Vardrynn and signs in afresh (`xmclImport.test.ts` plants an XMCL account session to prove it). Verified on development: new-user sign-in with all three providers, linking, refresh, sign-out (one and all devices), recovery by signing in again, restart persistence. Not verified: a real sign-in against production, account deletion confirmed end to end in the launcher (covered by service tests), Windows and Linux.

### 7. Replace multiplayer and Together

- Operate Vardrynn signaling, room membership, and relay infrastructure with authentication, rate limits, and abuse controls.
- Replace peer links and client authorization. Define capacity and cost limits.
- If paid relay remains, design billing, entitlements, refunds, and support before enabling purchases.

Acceptance: two clients can create, join, reconnect, and leave rooms across representative networks; relay traffic uses only Vardrynn infrastructure.

Relevant code: `xmcl-runtime/peer/`, `xmcl-runtime-api/src/util/sdp.ts`, `xmcl-keystone-ui/src/views/MultiplayerBilling.vue`.

Implementation (2026-11-06, not deployed): paid relay is out of scope, so there is no billing, entitlement or purchase path; the multiplayer screen no longer shows billing. The service gained room, socket and ICE routes backed by a Durable Object (`vardrynn-service/multiplayer.js`; limits and bindings in `VARDRYNN_SERVICE_API.md`). The launcher's existing room client now authenticates with the Vardrynn session, requires sign-in, and uploads no multiplayer telemetry. The sidebar entry and `/multiplayer` route are restored. Verified by unit tests of the room rules, routes, tickets and socket glue (fake sockets) and by type checks. Not verified: a deployed service, Cloudflare TURN, two clients on different networks, reconnect over real sockets, Windows and Linux. Open: the manual-invite dialogs still build `xmcl.app/peer` links (phase 9), and an unauthenticated user sees the raw error code rather than a sign-in prompt.

### 8. Replace the built-in Agent

- Provide a Vardrynn model gateway, account authorization, quotas, and operational controls. Keep the user-configured provider path available.
- Replace XMCL's built-in endpoint, protocol headers, entitlement wording, and telemetry.

Acceptance: both built-in and user-configured modes work, with no Agent request to XMCL.

Relevant code: `xmcl-runtime-api/src/services/AgentService.ts`, `xmcl-runtime/agent/`, `xmcl-keystone-ui/src/composables/agent/`.

### 9. Finish supporting surfaces

- Replace or remove XMCL news, localization fetch, metadata proxy, Ely.by helper, feedback, help, sponsor, and release links.
- Update README, translations, packaging instructions, and support destinations. Retain accurate upstream attribution and license text.
- Review DeskGap as a separate distribution target before publishing it.

Acceptance: every visible link and network destination has an intentional owner and purpose.

Implementation (2026-11-05): support links (feedback, login help, unauthenticated-launch warning, crash prompt, sync help, code of conduct) now point at the Vardrynn repository's issue tracker through `xmcl-runtime-api/src/util/vardrynnLinks.ts`; upstream Discord, Reddit, QQ, Kook and XMCL guide links are gone, and `supportLinks.test.ts` fails if they return. The user agent identifies Vardrynn. The Ely.by authlib list, the mod-metadata and project-mapping database sources, the dead `xmcl.app/peer` invite builders and the unused `xmcl.app/auth` redirect no longer name XMCL services; the two databases have no source until a Vardrynn mirror exists. DeskGap's updater no longer targets the upstream repository and reports `not-configured`. README and contributing text name Vardrynn and keep upstream attribution and sponsor credit (About page, README). News and localization already use the Vardrynn service (phase 4). Not done: a Vardrynn website or documentation site (none exists, so no guide link), a Vardrynn mirror for the metadata databases, DeskGap packaging and signing, a Vardrynn-owned Agent endpoint (phase 8, skipped), translating the new `loginError.openSupport` string beyond English, Ukrainian and Simplified Chinese.

### 10. Verify and release

- Validate the real development launcher and packaged builds at supported window sizes and on each target OS.
- Audit network traffic during startup, login, installs, multiplayer, updates, and Agent use.
- Run type checks, lint, focused logic tests, package smoke tests, and data-migration rehearsals using copies of real data.
- Release to a small test group, verify upgrades and rollback, then widen distribution.

Acceptance: the endpoint audit shows no XMCL connections; install, migration, feature, update, and rollback checks pass.

## Decisions needed before service implementation

1. Vardrynn domain and infrastructure owner. Decided: `olaveapi.com` on Cloudflare (2026-11-04).
2. First-release platforms and package formats.
3. Whether paid relay and a hosted Agent are in scope.
4. Diagnostics policy: local only or opt-in Vardrynn telemetry.
5. Account model and supported identity providers.

Recommended release sequence: ship an independent core launcher first, then enable each online feature only after its Vardrynn replacement meets its acceptance check. Phase 1 must precede any public Vardrynn package.
