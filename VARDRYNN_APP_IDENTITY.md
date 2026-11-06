# Vardrynn app identity (Task 2)

Implements phase 2 of `VARDRYNN_INDEPENDENCE_PLAN.md`. This is local packaging work, not authorization to publish a release.

## Identity and boundaries

Use `Vardrynn` as the product name and macOS bundle/executable name, `vardrynn` as the Windows/Linux executable, package/data namespace and URL scheme, and `com.vardrynn.launcher` as the bundle/notification ID. Windows AppX uses `Vardrynn.Launcher` with application ID `Vardrynn`. Signing credentials and owned update infrastructure remain phase 5 work; no XMCL publishing or AppInstaller feed may be inherited.

Reuse the approved `xmcl-keystone-ui/src/assets/vardrynn-mark.png` artwork for native icon encodings and sizes. Preserve source artwork, MIT notices, upstream attribution, actual XMCL service names, and compatible file format names.

A separate empty data namespace is required now to avoid silently opening or modifying XMCL data. Do not import, move, delete, or auto-detect-and-reuse XMCL profiles. The preview/copy/retry migration workflow remains Task 3.

Continue on the existing feature branch with the uncommitted Task 1 work intact. Do not change shared compiler/workspace settings, release workflows, service credentials, or enable updates.

## Implementation checklist

- [x] Add regression checks for independent shortcuts, protocol dispatch, and Electron profile setup; update Linux installer fixtures to guard XMCL coexistence.
- [x] Apply package metadata, artifact names, Linux scripts, OS registration and local profile identity. Disable inherited publication/AppInstaller configuration.
- [x] Encode app/dock/tray/tile icons from the approved mark and update native consumers.
- [x] Replace general launcher branding in translations and auxiliary UI while retaining service names, format compatibility and attribution.
- [x] Validate the real development workflow through the Chrome DevTools CLI, run focused tests, type checks, lint, production builds and a local macOS package smoke check; repeat Task 1 network audits.

## Verification on 2026-11-04

- Real development app: completed fresh onboarding using `~/.vardrynn`, skipped account sign-in, opened Settings/About, inspected the new mark and upstream credit, and confirmed the unavailable updater. No instances, accounts, or credentials were imported or edited. After a production compile, restarted the development task and confirmed `http://localhost:3000/index.html#/me` with the normal Vardrynn profile reloaded.
- Both the development app and packaged app were checked at actual native window sizes `1200x720` and `800x400`; the renderer reported matching dimensions and no horizontal overflow. The CLI's `resize_page` command is unsupported by this Electron endpoint, so the native windows were resized through the main-process debugger instead.
- Native identity: development reports app name `Vardrynn` and user data `/Users/michaelolave/Library/Application Support/vardrynn`. The packaged app reports the same name in its isolated profile, registers `vardrynn`, and loads the bundled renderer at `http://xmcl.runtime/index.html`. This hostname remains the internal resource origin, not an upstream service destination.
- Built the unsigned ARM64 macOS artifact `xmcl-electron-app/build/output/task2-smoke/vardrynn-0.73.1-arm64.dmg` using the repository builder configuration with publishing and signing disabled. Its Info.plist contains bundle ID `com.vardrynn.launcher`, name/executable `Vardrynn`, version `0.73.1`, and only the `vardrynn` URL scheme. Mounted read-only: it contains `Vardrynn.app` and an Applications link. Ejected afterward; nothing was installed into Applications.
- Packaged `icon.icns` exactly matches the new Vardrynn icon. The ICO contains seven frames from 16 through 256 pixels; ICNS includes standard and Retina representations. Linux PNGs cover 16 through 1024 pixels. Windows tile canvases match their declared dimensions and preserve aspect ratio/transparency, correcting the inherited distorted dimensions and `Wie310x150` filename typo. The small 16/32/40 pixel assets and a wide tile were inspected locally. Regenerate on macOS with `pnpm exec tsx scripts/generate-vardrynn-icons.ts`; the approved source mark is unchanged.
- `Resources/LICENSE.XMCL` exactly matches the original repository MIT notice. No `app-update.yml` is emitted. The Windows Store application ID and upstream publishing metadata were removed; package author metadata now identifies Vardrynn contributors while the original license and About attribution remain intact.
- Packaged safety check: seeded persisted auto-download/install opt-ins and upstream feature flags. After an explicit update check, capability remained `{ automatic: false, reason: 'not-configured' }`, status `none`, metadata `null`, and runtime flags `{}`. The Agent showed its unavailable message and custom-provider settings action.
- Network audit passed across 232 production build artifacts, 4,136 Chromium network events, and two Undici request headers, with no upstream XMCL traffic. No packaged renderer console messages were reported in the captured session. An initial temporary-profile attempt used macOS's symlinked `/tmp` path and was rejected by the existing restore ancestor guard; using the canonical `/private/tmp` path resolved the test setup without changing that safeguard.
- Independent review found and fixed fresh-profile directory creation before Electron `setPath`, third-party UI shortcut takeover, and Linux installation path casing. Regression tests preserve existing XMCL desktop/Steam/Linux records. Linux script fixtures now derive `/opt/Vardrynn` from electron-builder's actual `AppInfo.sanitizedProductName`; the executable remains `vardrynn`.
- `pnpm check`, `pnpm lint`, production main compilation, renderer build and bundle verification passed. All 117 focused identity/network tests passed across 21 files. The full suite reported 2,952 passing tests and one known unrelated timeout in `InstanceInstallService.progressive.test.ts` (`refreshes watched pending counts when the whole staging root is removed and recreated`), with 35 skipped. An earlier run also hit the existing backup staging-marker JSON race in `e2eRestoreFault.test.ts`; its isolated retry and subsequent full run passed.
- Cleanup: removed the unique isolated production game/profile directories and all temporary shortcut fixtures, ejected the DMG, and stopped the DevTools CLI daemon. The normal development launcher remains running at `1200x720`. The two recorded pre-existing XMCL profile files retained their hashes. The newly initialized normal Vardrynn profile points to `~/.vardrynn` and contains no game accounts or instances.

## Deliberate boundaries and remaining qualification

The separate empty app/game directories are a prerequisite for coexistence; import preview/copy/retry and secret migration still belong to Task 3. Existing format names (`.xmclbackup`, compatible manifests), local library namespaces, true upstream service names, and upstream sponsor credit remain intentional.

Unsigned local packaging does not qualify a signed release. Windows and Linux installers still require execution on their target operating systems. AppX signing/publisher ownership, Store registration, OAuth clients, update hosting, release automation, and DeskGap remain later-phase work. Existing user-named server service/deployment identities need review with data migration; this task does not rename or take over deployed services. Pre-existing URL argument handling and manifest URL escaping were not redesigned.

