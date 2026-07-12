# XMCL End-to-End Tests

This package runs the launcher end-to-end via Playwright's Electron driver.
It is **also the source of truth for the user tutorial** under
[`docs/tutorial/`](../docs/tutorial): every showcase spec emits captioned
screenshots that are compiled into Markdown by
[`scripts/build-tutorial.ts`](../scripts/build-tutorial.ts).

## Two groups

The suite is split into two groups with different goals and environments:

| Group | Folder | Environment | Runs |
|---|---|---|---|
| **Safety-net (兜底)** | [`specs/ci/`](specs/ci) | Isolated, deterministic — a throwaway temp profile per test, no live-network installs, Java launch stubbed | Automatically in CI/CD on every push / PR |
| **Showcase (promo)** | [`specs/showcase/`](specs/showcase) | Real — a persistent profile on the current PC (`e2e/.showcase-data`), live network, real Java, content accumulates across runs | Manually, locally, to capture screenshots for promo posts / videos |

The **safety-net** group's only contract is *"the packaged renderer boots
without a production-only crash"* — it catches bundler / chunk-split
regressions (like the rolldown `init_runtime_dom_esm_bundler is not defined`
bug) that never reproduce in dev mode. Keep it thin, fast and network-free.

The **showcase** group drives the launcher through the common user journeys
against the real environment and captures a captioned screenshot at each
step. Those screenshots double as the promotional material and the generated
tutorial. Because it reuses a persistent profile (gitignored, **not** your
real launcher data), installed versions / instances / content build up into a
realistic-looking launcher over successive runs.

### Safety-net storylines (`specs/ci/`)

| # | Storyline | Spec |
|---|---|---|
| 00 | Boot smoke — new + old user, asserts no renderer-level crash | [`specs/ci/00-smoke-boot.spec.ts`](specs/ci/00-smoke-boot.spec.ts) |

### Showcase storylines (`specs/showcase/`)

Tests hit live network endpoints (Mojang, Fabric/Forge/NeoForge meta,
Modrinth, CurseForge) so flakiness is expected on poor connections.

| # | Storyline | Spec |
|---|---|---|
| 01 | Base flow — onboard, login (offline), install vanilla Minecraft | [`specs/showcase/01-base-flow.spec.ts`](specs/showcase/01-base-flow.spec.ts) |
| 02 | Mod flow — Fabric instance + Iris / Better3D / Complementary Reimagined | [`specs/showcase/02-mod-flow.spec.ts`](specs/showcase/02-mod-flow.spec.ts) |
| 03 | Other modloaders — Forge and NeoForge instances | [`specs/showcase/03-other-modloaders.spec.ts`](specs/showcase/03-other-modloaders.spec.ts) |
| 04 | Import flow — install a Modrinth `.mrpack` from disk | [`specs/showcase/04-import-modpack.spec.ts`](specs/showcase/04-import-modpack.spec.ts) |
| 05 | Download modpack flow — install Fabulously Optimized from the Store | [`specs/showcase/05-download-modpack.spec.ts`](specs/showcase/05-download-modpack.spec.ts) |

## Quick start

> **`e2e/` is outside the pnpm workspace** so the default `pnpm install` at
> the repo root does NOT pull Playwright. Install it once with the
> dedicated script below — your normal workflow stays lean.

```bash
pnpm install                      # repo root — no Playwright pulled
pnpm e2e:install                  # one-time — Playwright into e2e/node_modules
pnpm build:renderer && pnpm --prefix=xmcl-electron-app compile
pnpm test:e2e:ci         # safety-net group (fast, deterministic — the CI gate)
pnpm test:e2e:showcase   # showcase group (real env, screenshots — run locally)
pnpm test:e2e:scratch    # scratch / visual-verification specs only
pnpm test:e2e:ui         # Playwright UI mode (interactive)
pnpm build:tutorial      # compile showcase screenshots → docs/tutorial/
```

> `pnpm test:e2e` is an alias for the safety-net group (`test:e2e:ci`) so the
> default CI path stays cheap. Use `pnpm --prefix=e2e test:all` to run both
> groups in one shot locally.

> **No `playwright install` required.** These tests drive Electron via
> `_electron.launch()`, which uses the launcher's bundled Chromium. The
> ~660 MB Playwright browser cache is unnecessary; set
> `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` if you also use Playwright for
> non-Electron projects on the same machine and want to suppress the
> first-run hint.

## Architecture

```
e2e/
├── fixtures/
│   ├── launcher.ts       ← per-test Electron fixture (isolated for ci/, persistent for showcase/)
│   ├── sandbox/          ← static files copied into each test's gameData root
│   └── responses/        ← reserved for future canned response fixtures
├── helpers/
│   ├── shoot.ts          ← screenshot + caption recorder
│   ├── manifest.ts       ← per-journey manifest written on test teardown
│   ├── sandbox.ts        ← seedSandbox() — copy fixtures + create instances
│   ├── network.ts        ← page.route()-based renderer-side mocks (unused by default)
│   ├── auth-mock.ts      ← MSAL mock placeholder (next PR)
│   ├── pom/              ← Page Object Model — getByTestId() only
│   └── tasks/            ← high-level user journeys (one file per reusable flow)
│       ├── onboarding.ts
│       ├── addAccount.ts
│       ├── createInstance.ts
│       ├── browseContent.ts
│       ├── importModpack.ts
│       └── installFromStore.ts
├── specs/
│   ├── ci/               ← safety-net group (deterministic, runs in CI/CD)
│   ├── showcase/         ← promo group (real env, screenshots, run locally)
│   └── scratch/          ← PR-local visual-verification helpers (gitignored)
└── artifacts/            ← gitignored: screenshots, videos, traces, manifests
```

### Determinism guarantees (safety-net group)

| Concern | Mechanism |
|---|---|
| Launcher root | Per-test temp dir injected via `XMCL_E2E_APP_DATA` |
| Auto-updater | Disabled when `XMCL_E2E` is set (see `pluginAutoUpdate.ts`) |
| Java spawn | Stubbed when `XMCL_E2E_NO_LAUNCH` is set (see `LaunchService.ts`) |
| Microsoft auth | Planned: `helpers/auth-mock.ts` will intercept MSAL endpoints |
| Renderer network | `page.route()` per spec via `helpers/network.ts` |
| Main-process network | Planned: `XMCL_E2E_MOCKS_FILE` JSON intercept |

Showcase specs (`specs/showcase/`) intentionally **opt out** of the isolated
profile: the fixture detects a spec under `specs/showcase/` and points both
`appData` and `gameData` at the persistent `e2e/.showcase-data` directory,
which it never deletes on teardown. Auto-updater is still disabled and Java
launch is still stubbed (we screenshot the UI, not the running game), but the
network and installed content are real.

### Selector contract

Every locator in `helpers/pom/` MUST use `getByTestId()` or `getByRole()`.
Never use locale-dependent text or styling classes. When a spec needs a
new anchor, add a `data-testid="..."` attribute to the corresponding
component in `xmcl-keystone-ui/`.

### Caption grammar

Every `shoot()` caption follows the same grammar so the generated tutorial
reads consistently:

> **Step N.** Imperative sentence. Bold the **UI label** as it appears.

## Adding a new storyline

Storylines should be **rare**: the suite is intentionally narrow. Before
adding a new spec, ask whether the new journey is genuinely user-facing and
not already covered by the storylines above. If so:

1. Create `specs/showcase/NN-name.spec.ts` (or `specs/ci/NN-name.spec.ts` for
   a deterministic safety-net check).
2. Compose with helpers from `helpers/tasks/`. Add new tasks only if reused
   across multiple storylines.
3. Add `data-testid` attributes (not text/class selectors) for any new
   anchors in `xmcl-keystone-ui/` and surface them in
   [`helpers/pom/AppShell.ts`](helpers/pom/AppShell.ts).
4. Call `shoot(ctx, '01-...', { caption: '…' })` at every key point.
5. Run `pnpm test:e2e:showcase` then `pnpm build:tutorial` and inspect
   `docs/tutorial/en/<journey-id>.md`.

## Locale matrix

CI runs only the safety-net group (`en`) on PRs. Capture more locales locally
with the showcase group:

```bash
XMCL_E2E_LOCALES=en,zh-CN pnpm test:e2e:showcase
```

Trigger the workflow manually (`workflow_dispatch`) on GitHub to run the
showcase group across a full locale matrix.
