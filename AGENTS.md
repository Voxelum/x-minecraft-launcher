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
reviewer sees them inline. Pick **one** of:

**A. Comment with embedded images (preferred)**

```bash
# Copy artifacts to a stable, branch-local path that GitHub can serve raw.
mkdir -p .pr-screenshots
cp -r e2e/artifacts/screenshots/en/* .pr-screenshots/
git add -f .pr-screenshots
git commit -m "chore: add visual verification screenshots"
git push

# Then post a comment that embeds the images.
gh pr comment --body "$(cat <<'EOF'
### Visual verification

| Step | Screenshot |
|---|---|
| Initial | ![initial](.pr-screenshots/<spec-slug>/01-initial.png) |
| After click | ![after](.pr-screenshots/<spec-slug>/02-after-click.png) |

Spec: \`e2e/specs/scratch/<your-feature>.spec.ts\`
EOF
)"
```

GitHub renders `.pr-screenshots/...` paths in PR comments by resolving them
against the PR's HEAD commit, so no raw-URL gymnastics are needed.

**B. Drop the screenshots into the PR body**

Same `cp` + `git add -f` step, then edit the PR description with the same
table. Use `gh pr edit --body "..."`.

Do **not** commit screenshots into `e2e/artifacts/` — that path stays
gitignored. The PR-local `.pr-screenshots/` folder exists only to host
images for review and should be removed in a follow-up clean-up commit
before merge (or by the merge bot).

---

## Other conventions

- Dependency updates use `chore:` (not `fix:`). See `CONTRIBUTING.md`.
- Type-check after edits with `pnpm check`. Lint with `pnpm lint`.
- Do not modify `e2e/specs/01-..05-...spec.ts` (the canonical storylines)
  to verify your unrelated feature. Use `specs/scratch/` instead.
- The full e2e suite (`pnpm test:e2e`) hits live network endpoints and
  takes 10–30 minutes per storyline. Scratch specs are the fast path.
