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
   pnpm build:renderer
   pnpm --prefix=xmcl-electron-app compile
   pnpm test:e2e:scratch        # add `xvfb-run --auto-servernum` on Linux
   ```

5. Surface the resulting PNGs to the reviewer via a PR comment with
   embedded images — see the **Surface screenshots** section in
   [`AGENTS.md`](../AGENTS.md) for the exact `gh` commands.

`e2e/specs/scratch/` is gitignored; you do not need to clean it up.
