# XMCL → Go/Wails Migration Plan

Source of truth for the rewrite. Every phase has a **goal**, an
**exit criterion**, and the **files / packages** it touches. Tick boxes
as we go; pick up where the last unchecked box sits.

Decisions already locked (see chat history):
- Wails **v3** (alpha.89 currently pinned in `go.mod`).
- SQLite via **`modernc.org/sqlite`** (pure Go, no cgo for the common case).
- Code lives under **`xmcl-wails-app/`** in this monorepo.
- TS-side `xmcl-runtime-api` stays the contract source of truth; Go
  structs and dispatchers are **generated** from it.
- `wrtc-multiplayer` stays in renderer for now; future Go WebRTC port
  will move it main-side.
- Drop `findInPage` / `flashFrame` / `startProfiling` / `stopProfiling`
  (CDP-only, sparse WebView2/WebKitGTK support).

---

## Phase G0 — Bridge scaffold ✅ DONE

**Goal:** prove the renderer↔Go IPC wire works.

**Exit:** `go build ./...` clean, smoke-test page loads, `BaseService`
and `WindowService` answer RPC, `commit`/`service-event` events
broadcast.

- [x] `xmcl-wails-app/` Go module on Wails v3 alpha.89.
- [x] `internal/bridge/` — `Invoke / Commit / Unref / Revalidate` bound
      to one Wails service.
- [x] `internal/bridge/state.go` — `SharedState` engine (track, commit,
      push, dispose-on-unref).
- [x] `internal/bridge/context.go` — extract caller window via
      `application.WindowKey`.
- [x] `internal/host/host.go` — paths, OS/arch, slog logger.
- [x] `internal/services/base/` — `BaseService` stubs (`getEnvironment`,
      `getSettings`, `getNetworkStatus`, …).
- [x] `internal/services/window/` — `WindowService` (chrome controls,
      dialogs, clipboard, `WindowState` shared state).
- [x] `frontend/index.html` — smoke-test page exercising the bridge.

---

## Phase G1 — Codegen the service contract ✅ DONE

**Goal:** stop hand-writing per-service `Invoke` switches. One `pnpm gen:go`
step reads `xmcl-runtime-api/src/services/*.ts` and emits typed Go
interfaces + dispatchers + state helpers + event broadcasters.

**Exit:** all 38 services generate clean (`go build ./...` green); new
services need only implement a generated interface OR embed the
`<Name>NotImplemented` stub.

- [x] `scripts/gen-go-contract.ts` — `ts-morph` AST walker. Auto-discovers
      every `<Name>Service.ts` in `xmcl-runtime-api/src/services/`.
- [x] Entity structs for every parameter / return / nested type.
- [x] State structs + `Register<Name>(sm, id, payload)` factories with
      override-able `Apply<State>_<Mutation>` hooks.
- [x] `<Service>Events` typed broadcasters for services with EventMaps.
- [x] `<Service>NotImplemented` stub structs + `RegisterStubs(b)` so the
      bridge never returns "unknown service".
- [x] `pnpm gen:go` script in root `package.json`.
- [x] Refactor BaseService + WindowService onto generated contract
      (compile-time `_ contract.X = (*Service)(nil)` assertion).

Generator stats today: 38 services, 264 methods, 18 events, 13 states,
84 mutators, 128 entity structs, 91 type-mapping warnings (all collapse
to `any` / `map[string]any`, all build clean).

---

## Phase G2 — Renderer ↔ Wails bridge shim 🟡 IN PROGRESS

**Goal:** the real `xmcl-keystone-ui/` Vue app boots against the Go
backend, with **zero changes** to keystone-ui code outside a small new
`wails-bridge/` entry shim.

**Exit:** `XMCL_RENDERER_DIR=../xmcl-keystone-ui/dist go -C xmcl-wails-app run .`
opens a window that loads keystone-ui and the renderer's first
`BaseService.getSettings()` succeeds.

- [x] `xmcl-keystone-ui/src/wails-bridge/serviceChannels.ts` — drop-in
      replacement for the Electron preload's `serviceChannels` global
      on top of Wails v3 `Call.ByName` + `Events.On`. Reuses
      `AllStates` prototype tables for `SharedState` reconstruction;
      `FinalizationRegistry` drives `Bridge.Unref`.
- [x] `xmcl-keystone-ui/src/wails-bridge/install.ts` — idempotent
      side-effect entry that installs `globalThis.serviceChannels`
      when the Electron preload didn't.
- [x] `xmcl-keystone-ui/src/windows/main/index.ts` imports the install
      shim before any other module touches `serviceChannels`.
- [x] `xmcl-wails-app/main.go` honours `XMCL_RENDERER_DIR`; serves
      either an embedded smoke page (G0/G1) or a built keystone-ui
      dist via `os.DirFS`.
- [ ] Smoke test: launch keystone-ui under Go, confirm home page
      renders, language switcher works (touches `Settings` shared
      state), window chrome buttons work.
- [ ] Mirror the install import into the other window entries
      (`browser`, `logger`, `migration`, `app`, `multiplayer`)
      — deferred until a window other than `main` is needed.

**Run it:**

```bash
pnpm gen:go                          # regenerate Go contract
pnpm --prefix=xmcl-keystone-ui build # build dist/
XMCL_RENDERER_DIR=../xmcl-keystone-ui/dist go -C xmcl-wails-app run .
```

**Out of scope for G2:** anything that hits a not-yet-ported service
will error with `ServiceMethodNotImplemented`. The renderer is
expected to handle these gracefully today (try/catch on most calls);
where it doesn't, file a follow-up.

---

## Phase G3 — Host services (singletons used by everyone) ✅ DONE

**Goal:** the supporting infrastructure that every service relies on.

**Exit:** every later phase can grab a logger, a SQLite handle, the
mutex manager, and the secret store from a single `*Host`.

- [x] **Settings persistence.** `internal/host/settings.go` — generic
      `SettingsStore[T]` with debounced (1s) atomic-rename writes to
      `<AppDataPath>/setting.json`. BaseService wires every gen'd
      `ApplySettings_*Set` apply hook to `store.SetField(...)`. Schema
      defaults in `defaultSettings()` mirror the Zod schema's
      `.catch(...)` defaults.
- [x] **MutexManager.** `internal/host/mutex.go`. `Of(key)`, `With`,
      `WithKeys` (sorted to avoid deadlock); matches the TS
      `MutexManager` semantics for the `@Lock` decorator.
- [x] **SecretStorage.** `internal/host/secrets.go`. Backed by
      `github.com/zalando/go-keyring` (Credential Manager / Keychain /
      Secret Service). `Get/Put/Delete` + `ErrSecretNotFound`.
- [x] **SQLite.** `internal/host/sqlite.go`. `modernc.org/sqlite` (pure
      Go). `SQLite.Open(name)` returns a `*sql.DB` rooted at
      `<AppDataPath>/db/<name>.sqlite`, single writer, WAL, busy-timeout
      5s. Pool reused across calls; `Close()` releases everything.
- [x] **Logger.** `internal/host/logger.go`. `slog` JSON-ish text
      handler tee'd to stderr + a rotating file
      (`gopkg.in/natefinch/lumberjack.v2`) under `<AppDataPath>/logs/`.
- [x] **Object registry / DI.** `internal/host/registry.go`. Generic
      `Set[T] / Get[T] / MustGet[T]` over `map[reflect.Type]any`.
      Replaces TS `objectRegistry.ts` + `Inject` decorator.
- [x] **Host wiring.** `internal/host/host.go` constructs all five
      singletons during `host.New()` and exposes them as exported
      fields. `main.go` calls `app.OnShutdown(h.Close)` to flush.
- [ ] **xmcl:// HTTP server.** Deferred to G5/G8 — no current Go-side
      consumer; the keystone-ui only hits launcher-internal protocols
      (`image://`, `video://`, `xmcl://launcher`) which Wails v3 will
      front via custom asset middleware in G8.

---

## Phase G4 — Pure-data parser ports (parallelizable) 🟡 IN PROGRESS

**Goal:** Go equivalents of every `packages/*` library that doesn't
hit the network or filesystem in interesting ways. Each has unit-test
parity against existing TS fixtures (`mock/`).

**Exit:** every parser passes its golden tests; can be consumed by
phase-G5+ services.

- [x] `packages/nbt/` → `internal/parsers/nbt/`. Read + write,
      gzip / zlib / raw streams. Drops the TS prototype-decorator
      schema system in favour of native Go types (`int8 ↔ Byte`,
      `int32 ↔ Int`, `*List ↔ List`, `map[string]any ↔ Compound`).
      Round-trip tests cover every tag type, named root, empty list
      (preserves element type), multi-byte runes, gzip + zlib wrappers.
- [ ] ~~`packages/text-component/`~~ — **dropped from the Go port.**
      Audit confirmed every consumer (search filter, mod-detail render,
      resource-pack search, server-status MOTD display) is
      renderer-side. The `TextComponent` value the backend handles
      (e.g. server-status response) is opaque JSON that round-trips
      through the bridge without inspection on the Go side.
- [x] `packages/gamesetting/` → `internal/parsers/gamesetting/`.
      Parse/emit `options.txt`. Golden tests cover the full TS test
      suite incl. `gh #1379` (no backslash doubling on round-trip).
- [ ] `packages/forge-site-parser/` → HTML scraper (`golang.org/x/net/html`).
- [x] `packages/mod-parser/` → `internal/parsers/modparser/`. Reads
      `fabric.mod.json`, `quilt.mod.json`, Forge `mods.toml` +
      `MANIFEST.MF` + `mcmod.info` legacy variants. 7 golden tests
      against the real jar fixtures in `mock/mods/`. **ASM bytecode-
      scan path and LiteLoader (`litemod.json`) intentionally skipped.**
- [x] `packages/resourcepack/` → `internal/parsers/resourcepack/`.
      `ReadPackMeta` + `ReadIcon` + `ReadPackMetaAndIcon`. The TS
      package's runtime model-loader / asset-resolution surface stays
      renderer-side (deepslate / three.js).
- [ ] `packages/unzip/` → collapsed into the modparser/resourcepack
      packages already (both use `archive/zip` directly via
      `OpenJar` / `OpenSource`). May still want a small streaming
      helper later for `InstallService` segmented downloads.
- [ ] ~~`packages/asm/`~~ — **dropped** per migration decision. JVM
      bytecode reader is too far afield from the launcher's core
      domain; mods that lack a metadata file will surface as
      "unknown loader" in the renderer.
- [ ] `packages/semver/` → defer until G5 (we may be able to use
      `golang.org/x/mod/semver` + a thin Mojang-version coercion
      shim instead of porting the full TS range parser).

---

> **Phase order note (May 2026):** G6 (shallow, parser-backed
> services) now runs **before** G5 (deep install/launch/network
> work). Shipping the instance-management surface first lets the
> renderer's main view become functional against real on-disk data
> well before the heavy installer/launch pipeline lands. Within G6,
> `ResourceService` is **deferred** to the back of the queue — every
> other service can ship without it.

## Phase G6 — Instance + market + mod metadata

**Goal:** the user-data-heavy services. Most use SQLite extensively.

**Exit:** keystone-ui can create instances, install mods from
Modrinth/CurseForge, view installed resources.

- [x] `xmcl-runtime/instance/` → `InstanceService`,
      `InstanceOptionsService`, `InstanceModsService`,
      `InstanceModsGroupService`, `InstanceResourcePackService`,
      `InstanceSavesService` (level.dat NBT scan via the new
      `internal/parsers/gamedata`; clone / delete / import / export /
      shared-saves linking; LinkSaveAsServerWorld),
      `InstanceShaderPacksService` + `InstanceResourcePacksService`
      (both backed by the shared `internal/services/instancedomain`
      scaffold — directory walk → ResourceState; resource packs get
      `pack.mcmeta` parsing for free),
      `InstanceServerInfoService` (servers.dat NBT read +
      hard-link link/unlink), `InstanceLogService`,
      `InstanceScreenshotService`, `InstanceThemeService`.
- [x] `xmcl-runtime/instanceIO/` → `InstanceIOService`
      (GetGameDefaultPath wired for vanilla / Modrinth /
      CurseForge defaults; ParseInstanceFiles real walk + sha1;
      ParseLauncherData + ImportLauncherData + ExportInstanceAsServer
      surface typed errors pending the third-party launcher
      adapters), `InstanceManifestService`
      (real walk + sha1/md5/sha256 hash fan-out; client + server
      manifest variants), `InstanceInstallService` (state-only
      stub; modpack-install pipeline lands with MarketService).
- [ ] `xmcl-runtime/market/`, `packages/curseforge/`, `packages/modrinth/`
      → `MarketService`, `ProjectMappingService`, `ModpackService`,
      `ModMetadataService`.
      - **`ModMetadataService`** ✅ — backed by the upstream
        read-only sqlite blob at
        `xmcl.blob.core.windows.net/releases/db.sqlite` (with the
        adjacent `.sha1` integrity file). Lazy first-call download
        through `network.Client.Download` (segmented + sha1
        verified + atomic rename); subsequent calls reuse the
        cached `*sql.DB` opened by `modernc.org/sqlite` in
        read-only mode. Surfaces `getMetadataFromSha1{,s}`,
        `lookupModrinthId`, `lookupCurseforgeId`, and
        `lookupMapping` against the `file` /
        `{forge,fabric}_mod` / `modrinth_version` /
        `curseforge_file` / `project_mapping` tables. Network
        outages and integrity failures degrade silently to "no
        attribution" so the renderer's resource list keeps
        rendering. 3 test cases against a synthetic seeded DB.
      - **`ProjectMappingService`** ✅ — backed by the per-locale
        catalog at
        `xmcl.blob.core.windows.net/project-mapping/<locale>.sqlite`
        (with adjacent `.sha256` and `.gz` variants). Pulls the
        gzipped blob, gunzips into memory, sha256-verifies, and
        atomic-renames into
        `<appData>/project-mapping-<locale>.sqlite`. Falls back
        to `en` when the requested locale isn't published; the DB
        is reopened transparently when the renderer flips
        `settings.locale` at runtime. Implements
        `lookupBy{Modrinth,Curseforge}`, `lookupByKeyword` (LIKE
        match on name+description), and the batch `lookupBatch`.
        3 test cases against a synthetic seeded DB.
      - `ModpackService` exposes an empty `ModpackState`.
        **`MarketService`-shaped surface** lands as a small
        Modrinth-v2 + CurseForge-v1 HTTP client at
        `internal/market/` (just enough to resolve a
        `version-id` / `file-id` to a `{filename, urls,
        sha1, size}` tuple). The per-domain
        `installFromMarket` (mods, resourcepacks,
        shaderpacks, generic resources) and
        `ModpackService.installModpackFromMarket` are wired
        through it: payload decoded, files downloaded with
        `network.Client.Download` (sha1 + retries +
        segmented), then `RefreshMetadata` on the per-domain
        `ResourceState` so the renderer sees the new files
        immediately. CurseForge `x-api-key` is sourced from
        `host.CurseforgeAPIKey` (`.env` /
        `CURSEFORGE_API_KEY`). 4 test cases against
        in-process Modrinth + CurseForge stubs.
        **Search / project-detail / fingerprint matching
        stay renderer-side for now** — they hit the
        upstream APIs directly through the renderer's
        existing fetch wrappers (CORS proxy lives at
        `mediaserver`'s `/proxy` route).
- [x] `xmcl-runtime/serverStatus/` → `ServerStatusService`. Real
      Minecraft Server List Ping (`internal/mcping`): handshake →
      status request → status response (JSON) → ping/pong RTT.
      Errors classify into the renderer's `serverStatus.timeout` /
      `.nohost` / `.refuse` failure-status shape.
- [x] `xmcl-runtime/save/` → save-file parsing (NBT level.dat /
      servers.dat) lives in `internal/parsers/gamedata`. Tests pass
      against the existing `mock/saves/sample-map/level.dat` and
      `mock/servers.dat` fixtures. Anvil/region chunk parsing is
      out of scope (no current renderer consumer).
- [x] `xmcl-runtime/resource/` → `internal/resource/`. SQLite-backed
      catalogue mirroring `packages/resource/schema.ts` v2.2:
      `resources(sha1 PK, name, sha256, forge|fabric|liteloader|
      quilt|neoforge|resourcepack|save|shaderpack|instance|github|
      curseforge|modrinth|gitlab|mmcmodpack)`, `uris(sha1, uri)`,
      `icons(sha1, icon)`, `tags(sha1, tag)`, and the snapshot
      fast-path `snapshots(domainedPath PK, ino, mtime, fileType,
      sha1)`. `Manager.Scan(dir, domain)` walks the on-disk
      directory and skips re-hashing/re-parsing for every entry
      whose `(ino, mtime)` matches the catalogue — a re-open of an
      instance with N mods drops to O(N stat()) + a single SELECT.
      Cold-path runs sha1 + the loader-specific parser
      (modparser / resourcepack) under a `golang.org/x/sync/semaphore`
      cap of 8, then upserts snapshot + resources + uris + icons
      atomically. `SearchByName(keyword, domain)` powers
      `InstanceModsService.searchInstalled`. `HashesByURIs` lets
      installers turn an upstream Modrinth/CurseForge URL into the
      on-disk hash without re-hashing. CurseForge `Murmur2`
      fingerprint (whitespace-stripped) ported to
      `resource.Fingerprint(path)`. `InstanceModsService` and
      `instancedomain.Service` (used by `InstanceResourcePacksService`
      / `InstanceShaderPacksService` / `InstanceResourcesService`)
      consult the manager from `host.Registry`; when no SQLite is
      wired (e.g. unit tests) they fall back to live re-scan +
      re-parse. 4 manager tests + 4 mod-parser tests + 5 in-place
      domain-service tests still green.

---

## Phase G5 — Network layer + installers + game launch (the long pole)

**Goal:** download Minecraft + Forge/Fabric/Quilt/NeoForge, launch the
game, stream logs back to the renderer.

**Exit:** vanilla install + launch round-trip works end-to-end against
the Wails build.

- [x] **HTTP client.** `internal/network/`. Stdlib `net/http`-backed
      `Client` with a `statsTransport` wrapper that tracks per-origin
      connection + byte counters; `BaseService.GetNetworkStatus` now
      returns real numbers. `Download` does sha1-verifying retrying
      writes to a `.part` file then atomic rename; `DownloadAll`
      fans out N concurrent downloads with bounded parallelism. Test
      coverage: happy-path, fallback URLs, sha1 mismatch surfacing,
      transient HTTP-500 retry, partial-failure aggregation.
- [x] `packages/file-transfer/` — segmented downloader. Optional
      Range fan-out (`DownloadOptions.Segments`, `SegmentThreshold`)
      with HEAD-probed `Accept-Ranges: bytes` detection. Auto-mode
      stays on the cheap single-stream path for the thousands of
      tiny asset/library/version-json fetches; opt-in (or known-big
      `ExpectedSize`) triggers parallel range GETs that stitch into
      the same `.part` file at fixed offsets. Falls back to
      single-stream when the upstream ignores Range. Tests cover
      parallel-range, range-ignored fallback, small-file skip,
      forced single-stream, sha1 verification post-merge.
- [x] **API-set / BMCL mirror.** `internal/network/mirror.go` +
      `gfw.go`. Ports the TS launcher's `apiSetsPreference` /
      `getApiSets` / `shouldOverrideApiSet` model. Each downloader
      asks `Host.Mirror()` for a `MirrorPreference`, then calls one
      of the typed rewriters (`AssetsURLs`, `LibraryURLs`,
      `ForgeMavenURLs`, `NeoForgeMavenURLs`, `MojangHostURLs`,
      `VersionManifestURLs`, `FabricMetaURLs`, `QuiltMetaURLs`) to
      get the candidate URL chain. The chain is fed to
      `Client.Download` which already tries them in order. Default
      mirror is `https://bmclapi2.bangbang93.com`; preference flips
      at runtime via the renderer's settings UI without a restart.
      `IsLikelyChinaUser()` heuristic (env override / locale / TZ)
      makes the auto mode pick the mirror first when the user
      didn't choose explicitly.
- [x] **Mojang version manifest.** `internal/installer/manifest/`.
      Disk-cached `version_manifest.json` with offline fallback;
      stale-after defaults to 1h. Now takes a URL chain (via
      `Options.URLs`) so BMCL is tried first when the user is on
      the mirror; `SetURLs` lets the InstallService /
      VersionMetadataService re-evaluate the chain on every call as
      the user flips `apiSetsPreference`. Wired into both
      `VersionMetadataService.GetLatestMinecraftRelease` and
      `InstallService.InstallMinecraft`.
- [x] **Vanilla installer.** `internal/installer/vanilla/`. Single
      `Install(ctx, opts)` runs the full pipeline: version JSON →
      client jar → libraries (parallel, sha1-verified) → asset index
      → asset objects (parallel). Network-bound smoke
      (`XMCL_E2E_INSTALL=1`) installs MC 1.20.4 from Mojang's CDN in
      ~15s.
- [x] `packages/installer/` loader subprocesses → ported. Fabric +
      Quilt are pure meta-fetch + version.json write
      (`internal/installer/fabric`, `.../quilt`). Forge + NeoForge
      share `forgepack` (installer-jar download + extract
      `version.json` / `install_profile.json` / embedded
      `maven/...` libs / `data/...` blobs) and `profile`
      (`install_profile.json` post-processor execution: variable
      substitution, library install, java sub-process per
      processor). Every loader installer now honours the
      `MirrorPreference` so BMCL kicks in transparently for the
      installer jar, the loader meta endpoint, and every library /
      asset the install pipeline pulls. **Optifine + LabyMod
      now ported too** — `internal/installer/optifine`
      (BMCL-redirect download → generated version JSON →
      `java -cp <installer> optifine.Patcher` to produce the
      patched library jar; `InstallAsMod` variant skips the
      patcher and hard-links the installer jar into
      `<instance>/mods/`) and `internal/installer/labymod`
      (LabyMod 4 manifest → per-env `libraries.json` +
      `customManifestUrl` merged into a Mojang-style version
      JSON, then asset cache populated under
      `labymod-neo/assets/`).
- [x] `packages/core/` (`@xmcl/core`) → `internal/parsers/core/`.
      Version JSON resolution + inheritance walk, classpath + JVM
      arg assembly (`GenerateArguments`), library rule evaluation,
      native extraction (`CheckNatives`), launch precheck
      (`CheckJava`, `CheckVersion`, `CheckLibraries`, `LinkAssets`),
      and loader-detection helpers (`ExtractLoaders`).
- [x] `xmcl-runtime/launch/` → `internal/services/launch/`.
      `LaunchService.Launch` runs the precheck stack, extracts
      natives, calls `core.GenerateArguments`, `os/exec.Cmd.Start`s
      the JVM, and streams stdout/stderr line-by-line through the
      bridge as `minecraft-stdout` / `minecraft-stderr`. Per-pid
      supervision powers `Kill`, `GetGameProcess`, `GetGameProcesses`;
      `minecraft-start` / `minecraft-exit` events fire around the
      process lifecycle. Persistence across launcher restarts is
      deferred to G7.
- [x] `xmcl-runtime/install/` → `internal/services/install/`. Real
      `InstallMinecraft` / `InstallMinecraftJar` / `InstallLibraries`
      / `InstallAssets` / `InstallAssetsForVersion` / `InstallDependencies`
      / `Reinstall` go through the vanilla installer. Loader installs
      (`InstallForge`, `InstallNeoForged`, `InstallFabric`,
      `InstallQuilt`, `InstallOptifine`,
      `InstallOptifineAsMod`, `InstallLabyModVersion`) wired
      through the per-loader installer packages;
      `InstallForge` / `InstallNeoForged` / `InstallOptifine`
      pick a JDK from the persisted `javas.json` for the
      post-processor / patcher execution.
      `InstallByProfile` decodes the renderer-supplied
      Forge/NeoForge `install_profile.json`, runs
      `profile.InstallLibraries` then `profile.Resolve` +
      `profile.Run` to execute every post-processor.
      `Diagnose` walks `core.CheckVersion` /
      `core.CheckLibraries` / asset-index existence and
      surfaces the renderer-side `InstallIssue` so the
      "re-install to fix" prompt can fire. 7 test cases
      across the optifine + labymod packages.
- [x] `xmcl-runtime/version/` → `internal/services/version/`. Real
      scan that produces full `VersionHeader` rows (loader versions
      via `core.ExtractLoaders`); `RefreshVersions` /
      `RefreshVersion` push the right SharedState mutators.
      `MigrateMinecraftFile` deferred to G7's MigrationService.
- [x] `xmcl-runtime/versionMetadata/` → `internal/services/versionmetadata/`.
      `GetLatestMinecraftRelease` reads from the cached Mojang
      manifest; `SetLatestMinecraft` lets the renderer override.
- [x] `xmcl-runtime/java/` → `internal/services/java/`. Discovers
      JDKs from `JAVA_HOME`, `where`/`which`, the Windows
      `HKLM\Software\JavaSoft` registry walk, and the macOS Apple JRE
      install root. `java -version` parsing lives in
      `internal/parsers/javaparse/` (legacy `1.8.0_NNN`, modern
      `X.Y.Z`, and major-only `25` forms). Records persist to
      `<appData>/javas.json`. **`InstallJava` ✅** — pulls the Mojang
      java-runtime index (`launchermeta.mojang.com/v1/products/
      java-runtime/.../all.json`, BMCL-mirror aware via
      `MirrorPreference.JavaRuntimesURL`), resolves the matching
      per-platform component manifest, parallel-downloads every
      file entry (sha1-verified, raw stream — LZMA path skipped
      to avoid cgo deps), recreates the directory tree + falls
      back to a file copy when the OS rejects unprivileged
      symlinks (Windows non-admin), chmod +x on POSIX, then
      probes the resulting binary so the new JDK lands in
      `<appData>/javas.json` and the renderer's `JavaState`
      refreshes automatically. Lives in
      `internal/installer/javaruntime/`.

---

## Phase G7 — Auth, presence, themes, misc

**Goal:** all remaining renderer-facing services.

**Exit:** the keystone-ui is fully functional against Go; only
multiplayer (still in renderer) and the apps-host (next phase) remain.

- [x] `xmcl-runtime/user/` → `UserService`. Persistence (`user.json` +
      keyring tokens), offline / dev login, Yggdrasil (authlib-injector)
      password grant, Microsoft device-code → Xbox Live → XSTS →
      Minecraft services chain, **and Microsoft auth-code grant via a
      one-shot localhost listener at `127.0.0.1:25555/auth`** with
      PKCE (S256) + CSRF state. The renderer's `properties.mode`
      ('device' vs anything-else) selects the flow, matching
      `UserLoginForm.vue`. `RemoveUser`, `RemoveUserGameProfile`
      (offline-only, mirrors TS), `SelectUserGameProfile`, `AbortLogin`,
      `AbortRefresh`, `AddYggdrasilService` / `RemoveYggdrasilService`
      (file-backed registry at `<appDataPath>/yggdrasil.json`),
      `GetSupportedAuthorityMetadata` (builtins + Yggdrasil flow types),
      `SaveSkin` (HTTP fetch → atomic file write).
      **`UploadSkin`** dispatches to the right backing authority: 
      Microsoft accounts go through the Mojang services API
      (`SetSkinByURL` / `SetSkinByFile` multipart / `ShowCape` /
      `HideCape` / `ResetSkin`); Yggdrasil + LittleSkin accounts
      go through `yggdrasil.ThirdPartyClient.SetTextureURL` /
      `SetTextureFile` / `DeleteTexture`; offline accounts apply
      the change locally. Skin source URLs accept `https://`,
      `file://`, and `image://` prefixes; the latter two read the
      raw PNG bytes for multipart upload.
      **`LoginModrinth`** runs the OAuth code-grant flow against
      Modrinth via the same `authcallback` listener (port 25555,
      path `/modrinth-auth`), exchanges the code through the
      launcher's hosted proxy `https://api.xmcl.app/modrinth/auth`,
      and persists the resulting token JSON under keyring slot
      `(modrinth, MODRINTH_USER)`. `HasModrinthToken` decodes
      that JSON and reports validity from the stored issued_at +
      expires_in.
      5 user-service tests + 3 PKCE/URL tests + 4 callback-listener
      tests + 2 modrinth tests + 5 mojang skin tests + 4 upload-skin /
      payload-parsing tests.
- [x] `xmcl-runtime/authlibInjector/` → `AuthlibInjectorService`.
      Fetches `https://authlib-injector.yushi.moe/artifact/latest.json`,
      caches the manifest at `<gameDataPath>/authlib-injection.json`,
      downloads the jar to the Maven-conventional path under
      `libraries/`, sha256-validates. `IsAuthlibInjectorReady` /
      `AbortAuthlibInjectorInstall` complete the surface.
- [x] `xmcl-runtime/user/OfficialUserService.ts` →
      `OfficialUserService`. Wraps `api.minecraftservices.com` /
      `api.mojang.com` for SetName, GetNameChangeInformation,
      CheckNameAvailability, HideCape/ShowCape, security location +
      challenges. Token lookup via shared `usertoken.Store` (registered
      by UserService into the host registry).
- [x] `xmcl-runtime/littleSkin/` → `LittleSkinUserService`. Full
      `Authenticate()` OAuth flow now wired: opens the LittleSkin
      consent page in the browser, listens on
      `127.0.0.1:25555/littleskin` via the shared `authcallback`
      package, exchanges the code for a bearer token, persists it
      under the OS keyring (`xmcl/littleskin.cn/default`).
      `GetAllCharacters` / `SetCharacterTexture` / `ListSkins` work
      against that stored token; `SetCharacterName` errors loudly
      because the contract type lacks a name field (matches the TS
      gap). `UploadTexture` deferred — needs multipart upload.
- [x] `xmcl-runtime/elyby/` → `ElyByService`. Backend-only helper
      (contract is empty); registered into `host.Registry` so the
      LaunchService middleware can call `InstallAuthlib(mcVersion)`
      to swap `com.mojang:authlib:*` for the Ely.by-patched build,
      and `UncacheElyLibrary` after a `com.mojang.authlib` crash.
      Cache (`<appData>/ely-authlib.json`) records the per-MC
      install path + sha1; the upstream MC↔authlib mapping is
      fetched from `https://api.xmcl.app/elyby/authlib` (with ETag)
      and falls back to an embedded `cache.json` snapshot.
- [x] `xmcl-runtime/yggdrasilServer/` → `internal/yggserver/`.
      Embedded Yggdrasil-protocol HTTP server for offline / peer
      accounts. Exposes the same routes as the TS impl (meta /
      `hasJoined` / `profile/{uuid}` / `textures` proxy / `join`
      stub). Signs textures with the same RSA key pair shipped by
      the legacy build so authlib-injector treats both as the same
      authority. Started by `UserService.bootstrap` on a free
      localhost port; base URL stashed in `host.Registry` so the
      LaunchService can pass it via
      `-Dauthlibinjector.yggdrasil.prefetched`.
- [x] `xmcl-runtime/presence/` (Discord RPC) → `PresenceService`.
      Backed by `github.com/hugolgst/rich-go`. Lazy-connects on first
      `SetActivity`, respects `settings.discordPresence`, disables
      gracefully when the Discord socket isn't available.
- [x] `xmcl-runtime/theme/` → `ThemeService`, `InstanceThemeService`.
      (Already shipped in G6 — read/write theme.json + theme-media/.)
- [ ] `xmcl-runtime/migration/` → `MigrationService` (data root move).
- [ ] `xmcl-runtime/playTime/` → playtime stats writer.
- [ ] `xmcl-runtime/peer/` → `PeerService` (the *signaling* side; the
      WebRTC engine itself stays in the renderer for G7).
- [ ] `xmcl-runtime/elyby/`, `xmcl-runtime/littleSkin/` → skin-server
      integrations.

### G7 Go-side packages introduced

- `internal/auth/` — shared HTTP client.
- `internal/auth/yggdrasil/` — Yggdrasil + authlib-injector clients,
  `LoadAPIProfile` for service metadata + favicon scrape.
- `internal/auth/microsoft/` — device-code OAuth + Xbox Live + XSTS +
  Minecraft services chain.
- `internal/auth/mojang/` — small REST adapter for Mojang services
  (set/reset name + skin + cape; security challenges).
- `internal/auth/littleskin/` — LittleSkin REST adapter + OAuth
  authorize/exchange helpers.
- `internal/auth/modrinth/` — Modrinth OAuth helpers (authorize
  URL builder + token exchange via the launcher's hosted proxy).
- `internal/auth/offline/` — deterministic offline UUID + token gen.
- `internal/auth/usermodel/` — on-disk user.json schema + debounced
  saver (1s tail + atomic-rename).
- `internal/auth/usertoken/` — keyring wrapper that mirrors
  `pluginUserTokenStorage.ts` (per-authority namespaces).
- `internal/auth/yggregistry/` — file-backed authlib-injector service
  list (`<appDataPath>/yggdrasil.json`).
- `internal/auth/authcallback/` — one-shot localhost HTTP listener
  used by the Microsoft auth-code grant (and reusable for Modrinth /
  LittleSkin OAuth callbacks later).
- `internal/yggserver/` — embedded Yggdrasil-protocol server for
  offline / peer accounts (replaces the TS
  `pluginYggdrasilHandler`). Signs textures with the same RSA key
  pair the legacy build ships so vanilla launchers treat both
  endpoints as the same authority.

---

## Phase G8 — Apps host + alt-windows + protocols

**Goal:** parity with the Electron host's "PWA"-style alt-app feature
(`AppsService`) and the multi-window arrangement (logger, multiplayer,
migrate, browse).

**Exit:** all four secondary windows render under Wails; alt apps
install/uninstall; `xmcl://` deep links open the launcher with the
right route.

- [ ] `xmcl-runtime/apps/` → `AppsService` (rewriting installed-app
      manifests to a local dir; spawning extra Wails windows pointed
      at them).
- [ ] Multi-window setup in `xmcl-wails-app/main.go` — one Wails app,
      multiple `app.Window.NewWithOptions(...)` calls; each window
      keyed by a `name` so the keystone-ui router can target it.
- [ ] `image://` and `video://` custom protocols → Wails v3
      `AssetOptions.Middleware` or a dedicated handler.
- [ ] Single-instance lock + `xmcl://` deep-link receiver (Windows
      `IPCEndpoint`, macOS `URL Schemes`).
- [ ] System tray + auto-launch (Wails v3 `SystemTray` API).

---

## Phase G9 — Native bridges that need Go ports

**Goal:** replace the cgo / N-API native modules currently in
`packages/` with pure-Go (or Go-spawned-helper) equivalents.

**Exit:** the Go binary has no Node/Electron runtime dependency.

- [ ] `packages/sqlite/` — already covered in G3 (`modernc.org/sqlite`).
- [ ] `packages/system/` — Win32 bits (UAC, shortcut creation, registry
      reads) → `golang.org/x/sys/windows`. Linux/macOS equivalents
      where applicable.
- [ ] `packages/nat-api/` → `huin/goupnp` + `fd/go-nat`.
- [ ] `packages/discord-rpc/` → done in G7 (`hugolgst/rich-go`).
- [ ] `packages/bore/` → keep the Rust binary, spawn it from Go.
- [ ] `packages/wrtc-multiplayer/` — **postponed**: stays renderer-side
      until G11.
- [ ] `packages/worker/` → drop. Goroutines replace it; per-service
      pools internal.

---

## Phase G10 — CI, packaging, auto-update

**Goal:** CI builds Wails binaries on Win/macOS/Linux, signs them,
ships them through the same auto-update channel.

**Exit:** a tagged release produces installers identical in
distribution to today's Electron builds; users can update in place.

- [ ] CI matrix: `win-x64`, `mac-arm64`, `mac-x64`, `linux-x64`.
- [ ] WiX MSI / NSIS installer for Windows; `.dmg` for macOS;
      `.AppImage` + `.deb` for Linux.
- [ ] Code signing pipeline (reuse existing certs / notarization).
- [ ] Replace `electron-updater` with a Go in-process updater. Write
      to `<AppData>/xmcl/Update/` and re-launch.
- [ ] Telemetry → `BaseService.reportItNow` keeps working;
      `applicationinsights-go` for the Go side.

---

## Phase G11 — Cutover

**Goal:** retire `xmcl-electron-app/` from `master`.

**Exit:** Wails build is the only build the CI ships.

- [ ] Run both builds side-by-side for one full release cycle. Track
      issue parity in a public board.
- [ ] Repoint the e2e Playwright suite at the Wails build. Fix
      divergences.
- [ ] Move `xmcl-runtime/`, `xmcl-electron-app/`, and their deps under
      `legacy/` (kept in tree for a release or two for bisect).
- [ ] Remove the Electron-preload shim from keystone-ui's entry once
      no Electron consumer remains.
- [ ] Move `wrtc-multiplayer` into the Go process via Pion
      (`github.com/pion/webrtc`). Drop the renderer-side preload entry.

---

## Cross-cutting checklists

### Renderer-visible regressions to watch for
- `File.path` (Electron extension) — Wails drag-and-drop hands you a
  file list with paths via a different bridge; keystone-ui has helpers
  in `composables/dropHandler.ts` that need patching.
- Window vibrancy / mica — Wails v3 supports it via window options at
  construction time, not runtime toggle. `setTranslucent` becomes a
  no-op until v3 lands runtime support; design around restart-on-toggle.
- File picker filter syntax — Electron uses `{name, extensions[]}`,
  Wails v3 takes a single pattern string. Conversion already done in
  `internal/services/window/window.go`'s `joinExtensions`.
- Locale fallback — keystone-ui assumes `BaseService.getSettings()`
  resolves before mount. `BaseService.getSettings` MUST be a fast path
  in Go (no disk on first call beyond the settings JSON read).

### Things deliberately NOT being ported
- `findInPage` / `flashFrame` / `startProfiling` / `stopProfiling`
  (decision #6).
- `@xmcl/worker` (replaced by goroutines).
- The `xmcl://launcher` localhost HTTP server *if* nothing external
  depends on it (verify in G3).

### Documentation cadence
- Each phase that introduces a new public Go API gets a section in
  `xmcl-wails-app/docs/` mirroring the existing `docs/*.md` for the
  TS packages. Don't write narrative docs for in-progress code.

---

## Pickup index

When resuming a session, look at the first unchecked box above and
start there. The phase headers double as natural commit prefixes
(`G3:`, `G4:`, etc.) so `git log --oneline | grep ^G` gives a quick
status read-out.
