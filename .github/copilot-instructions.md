# Copilot repository instructions

> See [`AGENTS.md`](../AGENTS.md) for the full agent contract. The most
> important rule for online Copilot sessions is repeated here for
> convenience.

## Visual verification (mandatory for `xmcl-keystone-ui/` changes)

If your change is visible to the user:

1. Read [`e2e/TESTIDS.md`](../e2e/TESTIDS.md) and reuse anchors. Add new
   `data-testid="…"` attributes if required, then run `pnpm gen:testids`.
2. Copy `e2e/specs/scratch/EXAMPLE.spec.ts.example` to
   `e2e/specs/scratch/<feature>.spec.ts`. Use `import { test, snap, expect } from '../../helpers/scratch'`.
3. Call `snap(launcher, '<step>', '<caption>')` after every meaningful
   visual change.
4. Run:

   ```bash
   pnpm e2e:install        # first time only — Playwright is opt-in
   pnpm build:renderer
   pnpm --prefix=xmcl-electron-app compile
   pnpm test:e2e:scratch        # add `xvfb-run --auto-servernum` on Linux
   ```

5. Surface the resulting PNGs to the reviewer with the helper script —
   it creates a public gist and posts a PR comment with the images
   embedded inline. Do **not** commit screenshots into the PR diff.

   ```bash
   scripts/post-screenshots.sh <spec-slug>
   # e.g. scripts/post-screenshots.sh servers-tab-empty-state-and-add-dialog
   ```

   See the **Surface screenshots** section of [`AGENTS.md`](../AGENTS.md)
   for the rationale and a manual fallback if the script fails.

`e2e/specs/scratch/` is gitignored; you do not need to clean it up.
