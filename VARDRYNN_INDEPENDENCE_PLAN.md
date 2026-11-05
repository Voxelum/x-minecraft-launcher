# Vardrynn independence plan

Status: phases 1, 2 and 3 implemented with macOS validation on 2026-11-04; Windows/Linux qualification remains open and later phases remain proposed. This document records the implementation sequence; it does not authorize a release or service deployment.

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

Relevant code: `xmcl-runtime-api/src/services/XmclApiEndpoints.ts`, `xmcl-runtime/app/xmclApiBaseUrl.ts`, `xmcl-runtime/app/pluginApiFallback.ts`.

### 5. Own releases and updates

- Publish signed packages, release metadata, and checksums from Vardrynn CI.
- Replace self-hosted update APIs, GitHub release URLs, npm mirror fallback, AppInstaller URLs, and package-manager metadata.
- Verify signatures and checksums before installation. Test upgrades and rollback on each supported platform.
- Remove upstream publication credentials, repositories, and pages from release automation.

Acceptance: each platform discovers, downloads, verifies, and installs a Vardrynn test release, with no upstream release path.

Relevant code: `xmcl-electron-app/main/utils/updater.ts`, `xmcl-electron-app/build/appinstaller-builder.ts`, `.github/workflows/build.yml`.

### 6. Own accounts and integrations

- Build Vardrynn account registration, sessions, recovery, and deletion. Keep launcher identity separate from Minecraft game accounts.
- Register Vardrynn OAuth applications and redirect URLs for supported identity providers; replace hard-coded application IDs.
- Register a Vardrynn Discord presence application if that feature remains.
- Reconcile existing XMCL account state during migration without claiming that an XMCL identity is already a Vardrynn identity.

Acceptance: new and migrated users can sign in, renew, sign out, and recover from failed authentication without XMCL services.

Relevant code: `xmcl-runtime/xmclAccount/`, `xmcl-runtime/user/pluginOfficialUserApi.ts`, `xmcl-runtime/presence/PresenceService.ts`.

### 7. Replace multiplayer and Together

- Operate Vardrynn signaling, room membership, and relay infrastructure with authentication, rate limits, and abuse controls.
- Replace peer links and client authorization. Define capacity and cost limits.
- If paid relay remains, design billing, entitlements, refunds, and support before enabling purchases.

Acceptance: two clients can create, join, reconnect, and leave rooms across representative networks; relay traffic uses only Vardrynn infrastructure.

Relevant code: `xmcl-runtime/peer/`, `xmcl-runtime-api/src/util/sdp.ts`, `xmcl-keystone-ui/src/views/MultiplayerBilling.vue`.

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

### 10. Verify and release

- Validate the real development launcher and packaged builds at supported window sizes and on each target OS.
- Audit network traffic during startup, login, installs, multiplayer, updates, and Agent use.
- Run type checks, lint, focused logic tests, package smoke tests, and data-migration rehearsals using copies of real data.
- Release to a small test group, verify upgrades and rollback, then widen distribution.

Acceptance: the endpoint audit shows no XMCL connections; install, migration, feature, update, and rollback checks pass.

## Decisions needed before service implementation

1. Vardrynn domain and infrastructure owner.
2. First-release platforms and package formats.
3. Whether paid relay and a hosted Agent are in scope.
4. Diagnostics policy: local only or opt-in Vardrynn telemetry.
5. Account model and supported identity providers.

Recommended release sequence: ship an independent core launcher first, then enable each online feature only after its Vardrynn replacement meets its acceptance check. Phase 1 must precede any public Vardrynn package.
