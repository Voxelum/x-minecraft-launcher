# Copilot repository instructions

> See [`AGENTS.md`](../AGENTS.md) for the full agent contract. The most
> important rule for online Copilot sessions is repeated here for
> convenience.

## Real development-app validation (default)

For UI behavior or Electron/main/preload/runtime integration, first test in the
actual launcher started by the repository's `dev:main` and `dev:renderer`
tasks. Connect Chrome DevTools to the active Electron debugging port (`9222` by
default; VS Code launches may use another port), drive the complete workflow,
and inspect renderer plus main-process logs.

Renderer changes normally hot-reload. After an Electron main/runtime change,
confirm `xmcl-electron-app/dist/index.js` was rebuilt, restart only this
repository's Electron app, reconnect DevTools, and rerun the same workflow.
Preserve user state and clean up temporary profiles, services, remote
directories, credentials, and keys. See [`AGENTS.md`](../AGENTS.md) for the
full procedure.

Do not create a scratch E2E spec merely for a one-time click-through. Add one
when the behavior needs durable regression coverage, CI execution,
deterministic isolation, or explicitly requested reviewer screenshots.

## Scratch E2E and screenshots (when needed)

When a scratch spec is warranted:

1. Read [`e2e/TESTIDS.md`](../e2e/TESTIDS.md) and reuse anchors. Add new
   `data-testid="…"` attributes if required, then run `pnpm gen:testids`.
2. Copy `e2e/specs/scratch/EXAMPLE.spec.ts.example` to
   `e2e/specs/scratch/<feature>.spec.ts` and use the scratch helpers.
3. Run:

   ```bash
   pnpm e2e:install        # first time only — Playwright is opt-in
   pnpm build:renderer
   pnpm --prefix=xmcl-electron-app compile
   pnpm test:e2e:scratch        # add `xvfb-run --auto-servernum` on Linux
   ```

4. If screenshots were requested, call `snap(...)` after each meaningful
   visual state and surface the PNGs with the helper script. Do **not** commit
   screenshots into the PR diff.

   ```bash
   scripts/post-screenshots.sh <spec-slug>
   # e.g. scripts/post-screenshots.sh servers-tab-empty-state-and-add-dialog
   ```

   See the **Surface screenshots** section of [`AGENTS.md`](../AGENTS.md)
   for the rationale and a manual fallback if the script fails.

`e2e/specs/scratch/` is gitignored; you do not need to clean it up.
