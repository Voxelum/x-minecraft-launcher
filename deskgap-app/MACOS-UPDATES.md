# DeskGap macOS updates: safe first step

## Implemented now

- Production adapter selection happens before network-session creation, local-data path access or Windows executable API calls. Only Windows x64 selects the existing Authenticode EXE adapter. Its discovery, size/SHA-256 checks, fixed publisher verification, native re-verification and install-on-quit behavior are unchanged.
- All other production targets (including macOS Intel/Apple Silicon, Linux and Windows ARM/ia32) use an explicitly unsupported/manual-only adapter. Check, download and install reject with `UnsupportedUpdateError`, including the platform, current version and manual website/GitHub Releases guidance. No release metadata is manufactured: neither `newUpdate=true` nor a false “no update” result is returned. No release check, download, shell/browser opening, quit or install occurs.
- The development-host updater remains unchanged and disabled. This is not a production capability claim.
- `LauncherAppUpdater` only supports release metadata or rejection; `ReleaseInfo` has no capability/error union. The current dialog recognizes `operation=manual`, but treating that as a discovered release would be incorrect without an actual check. We therefore keep unsupported capability as an error, not an invented manual release.
- `BaseService` startup now awaits a best-effort background-check wrapper which catches and logs failures. Explicit user checks still reject through the existing service/error path; the custom unsupported error name and explanatory message survive `checkUpdate`. No updater settings are overwritten after failed discovery.
- The automatic-download plugin only attaches to the existing Windows adapter. The unsupported adapter cannot accidentally become “ready” through a direct download/install call.

**Real macOS automatic updating is not implemented.** This step does not check whether a newer compatible macOS package exists. Users must explicitly visit the official website or GitHub Releases and select a compatible package. The adapter exposes an optional runtime-only `UpdateCapability` independent of `ReleaseInfo` and `updateStatus`. `BaseService.getSettings` synchronizes it before returning shared settings. It is not persisted to `setting.json`; adapters without this field retain the existing Electron behavior. The settings view waits for shared state, then shows “Automatic updates unavailable” with not-implemented/not-configured guidance instead of already-latest/NEW/install controls. Clicking Check on an unsupported host displays manual-check guidance and clears the busy state without making a release request. GitHub navigation occurs only on the user's separate button click. English and Simplified Chinese messages are included; other locales use the existing English fallback.

## Selected destination architecture (not implemented here)

Prefer Sparkle 2 updating a complete signed, notarized `.app`, rather than maintaining a second production payload-signing/update chain. Add a separate native Sparkle adapter and an explicit macOS capability branch at `getDeskGapUpdateCapability` / `createDeskGapUpdater` only when the native bridge and release pipeline are ready. Keep Windows EXE trust and macOS app/Sparkle trust independent. Do not route macOS through Windows discovery or accept an Electron package merely because its version is newer.

This change adds no dependency, native build/CMake/workspace configuration, production payload mechanism, key generation, signing, notarization, publication or appcast. Enabling Sparkle remains a separate delivery milestone.

## Acceptance before enabling macOS automatic updates

1. Ship a correctly signed, notarized and stapled full application with consistent bundle identifier, version/build ordering, entitlements and helper signing. Validate a Finder-launched installed app, not just a development executable.
2. Implement the native Sparkle lifecycle bridge (check, consent, download progress/cancel, install/relaunch and error reporting) and explicitly map real capabilities to the launcher UI; preserve the separate unsupported/not-configured capability presentation and distinguish discovery failure, up-to-date and available release states.
3. Configure HTTPS appcast and Sparkle EdDSA verification with securely managed release keys; document rotation/revocation and reject missing/incorrect signatures. Do not silently fall back to unsigned payloads.
4. Test Intel/Apple Silicon package and architecture selection, stable/prerelease channels, version ordering/no downgrade, appcast/network failure, wrong keys, truncated/tampered artifacts, interrupted downloads, concurrent checks, install permissions, running Minecraft processes and successful relaunch/version verification.
5. Verify no unsolicited browser/download action and no unhandled rejection on cold startup; explicit checks must clearly explain unsupported or unavailable capability. Keep Windows signature/installation regression tests passing.

## Focused validation

`pnpm exec vitest run deskgap-app/src/updateCapability.test.ts deskgap-app/src/updater.test.ts deskgap-app/src/updateFeed.test.ts xmcl-runtime/app/BaseService.update.test.ts xmcl-keystone-ui/src/composables/updateCapability.test.ts xmcl-keystone-ui/src/views/SettingUpdate.test.ts`

`pnpm --prefix deskgap-app check`

`pnpm --prefix xmcl-runtime-api check`

`pnpm --prefix xmcl-keystone-ui check`

The Windows adapter tests explicitly mock x64 so they exercise the unchanged Windows trust path on ARM development hosts. Platform tests fail on any unexpected native Windows API/network/path access on production macOS. No complete host build or GUI launch is part of this worker's validation.
