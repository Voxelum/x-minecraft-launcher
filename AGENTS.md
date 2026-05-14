# AGENTS.md — Instructions for AI coding agents

> Read this file in full before making any changes. It is a contract between
> the human maintainers of XMCL and any agent (GitHub Copilot, Claude Code,
> Cursor, etc.) that opens a session against this repository.

This file is short on purpose. Repository conventions live in
[`CONTRIBUTING.md`](CONTRIBUTING.md) and the per-package READMEs.

---

## Visual verification — when you change anything in `xmcl-keystone-ui/`

If your change is **visible to the user** (a new dialog, a new tab, a
relocated button, a styling tweak), you MUST capture screenshots of the
result so the human reviewer can confirm the intent without checking out the
branch and rebuilding the launcher.

The repository ships a one-call Playwright helper for exactly this. **Do
not** reinvent it.

### 1. Discover existing UI anchors

The file [`e2e/TESTIDS.md`](e2e/TESTIDS.md) lists every `data-testid` in the
launcher renderer. Read it first. Reuse an existing anchor whenever possible
— it keeps the suite stable.

If the anchor you need is missing:

1. Add `data-testid="my-feature-thing"` to the relevant `*.vue` element.
2. Run `pnpm gen:testids` to refresh the registry.
3. Commit the regenerated `e2e/TESTIDS.md` together with the Vue change.

Use kebab-case. Keep IDs short and stable across locales.

### 2. Write a scratch spec

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

- Call `snap(launcher, step, caption)` after **every meaningful visual
  change**. One PNG per critical step is the rule.
- Prefer `getByTestId(...)` over text/class selectors (text changes per
  locale).
- Keep the spec under ~50 lines. If it grows, promote it to a real
  storyline under `e2e/specs/NN-name.spec.ts`.

Scratch specs live under `e2e/specs/scratch/`, which is **gitignored**
except for the example template. They exist only for the lifetime of the
PR — you do not need to clean them up.

### 3. Run it

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

### 4. Surface screenshots to the human reviewer

After the spec passes, attach the captured PNGs to the pull request so the
reviewer sees them inline. **Do not commit screenshots into the PR diff.**
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

- Dependency updates use `chore:` (not `fix:`). See `CONTRIBUTING.md`.
- Type-check after edits with `pnpm check`. Lint with `pnpm lint`.
- Do not modify `e2e/specs/01-..05-...spec.ts` (the canonical storylines)
  to verify your unrelated feature. Use `specs/scratch/` instead.
- The full e2e suite (`pnpm test:e2e`) hits live network endpoints and
  takes 10–30 minutes per storyline. Scratch specs are the fast path.

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
