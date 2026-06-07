# XMCL End-to-End Tests

This package runs the launcher end-to-end via Playwright's Electron driver.
It is **also the source of truth for the user tutorial** under
[`docs/tutorial/`](../docs/tutorial): every spec emits captioned screenshots
that are compiled into Markdown by [`scripts/build-tutorial.ts`](../scripts/build-tutorial.ts).

## Storylines

The suite is intentionally narrow: five focused storylines that cover the
launcher's main user journeys end-to-end. Tests hit live network endpoints
(Mojang, Fabric/Forge/NeoForge meta, Modrinth, CurseForge) so flakiness is
expected on poor connections — pin the locale matrix down for CI.

| # | Storyline | Spec |
|---|---|---|
| 00 | Boot smoke — new + old user, asserts no renderer-level crash | [`specs/00-smoke-boot.spec.ts`](specs/00-smoke-boot.spec.ts) |
| 01 | Base flow — onboard, login (offline), install vanilla Minecraft | [`specs/01-base-flow.spec.ts`](specs/01-base-flow.spec.ts) |
| 02 | Mod flow — Fabric instance + Iris / Better3D / Complementary Reimagined | [`specs/02-mod-flow.spec.ts`](specs/02-mod-flow.spec.ts) |
| 03 | Other modloaders — Forge and NeoForge instances | [`specs/03-other-modloaders.spec.ts`](specs/03-other-modloaders.spec.ts) |
| 04 | Import flow — install a Modrinth `.mrpack` from disk | [`specs/04-import-modpack.spec.ts`](specs/04-import-modpack.spec.ts) |
| 05 | Download modpack flow — install Fabulously Optimized from the Store | [`specs/05-download-modpack.spec.ts`](specs/05-download-modpack.spec.ts) |

## Quick start

> **`e2e/` is outside the pnpm workspace** so the default `pnpm install` at
> the repo root does NOT pull Playwright. Install it once with the
> dedicated script below — your normal workflow stays lean.

```bash
pnpm install                      # repo root — no Playwright pulled
pnpm e2e:install                  # one-time — Playwright into e2e/node_modules
pnpm build:renderer && pnpm --prefix=xmcl-electron-app compile
pnpm test:e2e            # run all journeys
pnpm test:e2e:scratch    # run scratch / visual-verification specs only
pnpm test:e2e:ui         # Playwright UI mode (interactive)
pnpm build:tutorial      # compile screenshots → docs/tutorial/
```

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
│   ├── launcher.ts       ← per-test isolated Electron fixture
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
├── specs/                ← five storyline specs (see table above)
└── artifacts/            ← gitignored: screenshots, videos, traces, manifests
```

### Determinism guarantees

| Concern | Mechanism |
|---|---|
| Launcher root | Per-test temp dir injected via `XMCL_E2E_APP_DATA` |
| Auto-updater | Disabled when `XMCL_E2E` is set (see `pluginAutoUpdate.ts`) |
| Java spawn | Stubbed when `XMCL_E2E_NO_LAUNCH` is set (see `LaunchService.ts`) |
| Microsoft auth | Planned: `helpers/auth-mock.ts` will intercept MSAL endpoints |
| Renderer network | `page.route()` per spec via `helpers/network.ts` |
| Main-process network | Planned: `XMCL_E2E_MOCKS_FILE` JSON intercept |

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
not already covered by the five storylines above. If so:

1. Create `specs/NN-name.spec.ts`.
2. Compose with helpers from `helpers/tasks/`. Add new tasks only if reused
   across multiple storylines.
3. Add `data-testid` attributes (not text/class selectors) for any new
   anchors in `xmcl-keystone-ui/` and surface them in
   [`helpers/pom/AppShell.ts`](helpers/pom/AppShell.ts).
4. Call `shoot(ctx, '01-...', { caption: '…' })` at every key point.
5. Run `pnpm test:e2e` then `pnpm build:tutorial` and inspect
   `docs/tutorial/en/<journey-id>.md`.

## Locale matrix

CI runs only `en` on PRs. Run more locales locally with:

```bash
XMCL_E2E_LOCALES=en,zh-CN pnpm test:e2e
```

Trigger the workflow manually (`workflow_dispatch`) on GitHub to capture a
full locale matrix nightly.
