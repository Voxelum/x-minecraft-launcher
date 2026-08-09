# AGENTS.md — Instructions for AI coding agents

> Read this file in full before making any changes. It is a contract between
> the human maintainers of XMCL and any agent (GitHub Copilot, Claude Code,
> Cursor, etc.) that opens a session against this repository.

This file is short on purpose. Repository conventions live in
[`CONTRIBUTING.md`](CONTRIBUTING.md) and the per-package READMEs.

---

## Validate in the real development app first

For UI behavior and Electron/main/preload/runtime integration, the default
validation environment is the actual launcher started by the repository's
development tasks. Do not write a scratch E2E spec merely to click through a
change once. Direct DevTools debugging is faster, exercises real app state and
IPC boundaries, and gives better access to renderer errors and main-process
logs.

For main-launcher UI viewport checks, use the dimensions declared in
`xmcl-electron-app/main/defaultApp.ts`: `800x400` is the minimum supported
window and `1200x720` is the default desktop window. Do not test the main
launcher at smaller or mobile-like viewport sizes (for example, `480px` wide),
because Electron prevents the real window from reaching them. Only use a
different size range when validating another window with its own manifest
constraints or when the task explicitly changes those constraints.

1. Reuse the running `dev:main` and `dev:renderer` tasks. Do not start a
   duplicate launcher or dev server if one is already running.
    The normal development target must load the renderer from
    `http://localhost:3000`, not the built renderer from
    `http://xmcl.runtime`. `dev:main` compiles the main bundle with
    `HAS_DEV_SERVER=true`; when launched by VS Code, `LAUNCH_BY=vscode` means
    the task watches and rebuilds but the `Electron: Main (launch)` debug
    configuration owns the Electron process.
2. Treat `pnpm --prefix=xmcl-electron-app compile` as a production-bundle
  smoke step, not the default development launch. It writes a
  `HAS_DEV_SERVER=false` bundle to the same
  `xmcl-electron-app/dist/index.js`, so manually launching Electron after
  `compile` loads the already-built renderer through `xmcl.runtime`. Because
  an existing `dev:main` watcher does not rebuild merely because its output
  was overwritten, restart that task or otherwise trigger and confirm a
  fresh dev main rebuild before relaunching Electron. Verify `/json/list`
  reports a `localhost:3000` page before beginning normal UI validation.
3. Connect to the launcher's Chrome DevTools endpoint. `xmcl-electron-app/dev.ts`
   uses port `9222` by default, but VS Code launch configurations may choose a
   different port such as `9300`. Discover the active port from process
   arguments or task output, then inspect `/json/list` and select the real
   `X Minecraft Launcher` page.
4. Drive the real launcher through DevTools and validate the complete user
   workflow, not only the changed control. Use accessibility snapshots,
  renderer console/network inspection, main logs, and the local/WSL environment.
5. Renderer changes normally hot-reload. Electron main/runtime changes are
   rebuilt into `xmcl-electron-app/dist/index.js` but are not loaded by an
   already-running main process. Confirm the watcher rebuilt the bundle, then
   restart only this repository's Electron app, reconnect DevTools, and retry
   the same workflow. Never terminate unrelated Electron processes.
6. Preserve user data. Record any instance/profile fields touched by the test,
   use uniquely named temporary remote directories, services, and credentials,
   and remove only those test resources afterward. Reopen or restart the app
   once more to confirm cleaned state was reloaded.
7. Still run the narrowest relevant automated test plus type-check/lint. Real
   app debugging validates integration; it does not replace cheap regression
   checks for pure logic.

Report the exercised workflow and important observed results (for example
status transitions, PIDs, file counts, timings, logs, and cleanup), rather than
only saying that the app was opened.

## Scratch E2E and screenshots (when needed)

Write a scratch Playwright spec when the behavior deserves a repeatable
regression check, must run in CI, requires deterministic isolated state, or a
maintainer/reviewer explicitly needs reproducible screenshots. A scratch spec
is a supplement to real-app validation, not the default prerequisite for every
visible change.

When a scratch spec is warranted, use the repository helper below rather than
inventing another harness.

### 1. Discover existing UI anchors

The file [`e2e/TESTIDS.md`](e2e/TESTIDS.md) lists every `data-testid` in the
launcher renderer. Read it first. Reuse an existing anchor whenever possible
— it keeps the suite stable.

If the anchor you need is missing:

1. Add `data-testid="my-feature-thing"` to the relevant `*.vue` element.
2. Run `pnpm gen:testids` to refresh the registry.
3. Commit the regenerated `e2e/TESTIDS.md` together with the Vue change.

Use kebab-case. Keep IDs short and stable across locales.

### 2. Write the scratch spec

Copy the template:

```bash
cp e2e/specs/scratch/EXAMPLE.spec.ts.example \
   e2e/specs/scratch/<your-feature>.spec.ts
```

Edit it to drive the new UI. The full surface you need is:

```ts
import { test, snap, expect } from '../../helpers/scratch'

test('<short description>', async ({ launcher, shell }) => {
  await shell.goto('/your-route')
  await snap(launcher, '01-initial', 'Initial state of the new view.')

  await launcher.main.getByTestId('my-feature-thing').click()
  await snap(launcher, '02-after-click', 'Dialog opens.')
})
```

- When screenshots are required, call `snap(launcher, step, caption)` after
  every meaningful visual change. One PNG per critical step is the rule.
- Prefer `getByTestId(...)` over text/class selectors (text changes per
  locale).
- Keep the spec under ~50 lines. If it grows, promote it to a real
  storyline under `e2e/specs/NN-name.spec.ts`.

Scratch specs live under `e2e/specs/scratch/`, which is **gitignored**
except for the example template. They exist only for the lifetime of the
PR — you do not need to clean them up.

### 3. Run the scratch spec

```bash
pnpm install --frozen-lockfile     # first time only
pnpm e2e:install --frozen-lockfile # first time only — installs Playwright (e2e is outside the workspace)
pnpm build:renderer                # required after any xmcl-keystone-ui change
pnpm --prefix=xmcl-electron-app compile
pnpm test:e2e:scratch
```

> Electron tests do **not** need `playwright install` — `_electron.launch()`
> uses the bundled Electron Chromium, not Playwright's downloaded browsers.
> Skipping that step saves ~660 MB and 1–2 minutes per CI run.

Linux runners need `xvfb-run --auto-servernum pnpm test:e2e:scratch` because
the launcher is an Electron app.

Outputs land at:

```
e2e/artifacts/screenshots/en/<test-title-slug>/<step>.png
e2e/artifacts/screenshots/en/<test-title-slug>/manifest.json
```

If a `snap()` fails it logs a warning but does not fail the test.

### 4. Surface screenshots when requested

When screenshot evidence is requested, attach the captured PNGs to the pull
request so the reviewer sees them inline. **Do not commit screenshots into the
PR diff.**
GitHub does not expose its drag-and-drop image-upload endpoint to bots, so
we host the PNGs in a **public gist** and reference them by raw URL inside
a PR comment. A helper script does the whole thing:

```bash
scripts/post-screenshots.sh <spec-slug>
# e.g. scripts/post-screenshots.sh servers-tab-empty-state-and-add-dialog
```

The slug is the directory name under `e2e/artifacts/screenshots/en/`. The
script:

1. Creates a public gist titled `Visual verification for PR #<n> (<slug>)`
   with every PNG in that directory (using `gh gist create`).
2. Builds a Markdown table of `gist.githubusercontent.com` raw URLs.
3. Optionally appends the captions from `manifest.json`.
4. Posts the comment via `gh pr comment`.

Requires `gh` (logged in), `bash`, and `jq`. The Copilot agent's sandbox
ships all three.

If you must do it by hand:

```bash
gist=$(gh gist create --public --desc "PR #N visuals" \
  e2e/artifacts/screenshots/en/<slug>/*.png)
gh api "gists/$(basename "$gist")" --jq \
  '.files | to_entries | map("![](\(.value.raw_url))") | .[]'
gh pr comment --body "$(...paste the URLs into a markdown table...)"
```

Never commit `e2e/artifacts/` (gitignored) or any `.pr-screenshots/`
folder. The PR's file diff stays clean.

---

## Other conventions

- Do not change project-wide compiler, build, lint, or workspace configuration
  without explicit maintainer approval. This includes settings such as
  `module`, `moduleResolution`, `target`, bundler behavior, lint rules, and
  workspace/package-manager policy. Prefer a scoped adapter, shim, declaration,
  or package-local workaround. If a shared config change is genuinely required,
  stop and ask first, explaining the impact.
- Dependency updates use `chore:` (not `fix:`). See `CONTRIBUTING.md`.
- Type-check after edits with `pnpm check`. Lint with `pnpm lint`.
- Do not modify `e2e/specs/showcase/01-..05-...spec.ts` (the canonical
  storylines) or `e2e/specs/ci/**` (the safety-net group) to verify your
  unrelated feature. Use `specs/scratch/` instead.
- The showcase suite (`pnpm test:e2e:showcase`) hits live network endpoints
  and takes 10-30 minutes per storyline. The safety-net group
  (`pnpm test:e2e:ci`) is deterministic and network-free. Prefer the real dev
  app for interactive verification; scratch specs are the fast automated path
  when repeatability or screenshot evidence is needed.

## Network access (Copilot coding agent only)

The Copilot sandbox blocks arbitrary egress. The hosts you'll always have
are `github.com`, `api.github.com`, `*.githubusercontent.com`,
`registry.npmjs.org`, and the npm CDN — that's enough to clone, install,
build, run any scratch spec that doesn't hit external APIs, and post the
gist + PR comment.

If your scratch spec needs to install Minecraft / Forge / Fabric / Modrinth
content (i.e. anything in storylines 4 or 5 of the canonical suite), the
following hosts must be added to **Settings → Code & automation → Copilot
→ Coding agent → Allowed network access** for the run to succeed:

```
api.modrinth.com, cdn.modrinth.com,
api.curseforge.com, edge.forgecdn.net,
launchermeta.mojang.com, piston-meta.mojang.com, piston-data.mojang.com,
resources.download.minecraft.net, libraries.minecraft.net,
meta.fabricmc.net, maven.fabricmc.net,
files.minecraftforge.net, maven.minecraftforge.net,
maven.neoforged.net
```

Without these, your scratch spec must avoid network installs. The
`Firewall rules blocked me from connecting to one or more addresses`
warning at the end of a Copilot session is informational — it means egress
to a non-allowlisted host was attempted and blocked, not that the session
itself failed.
